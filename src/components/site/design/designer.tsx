"use client";

/* eslint-disable @next/next/no-img-element -- anh thu nho tu canvas/object URL */
import { AlertTriangle, CheckCircle2, Copy, Crop, ImagePlus, Loader2, Maximize, Minus, Pause, PenLine, Play, Plus, RotateCcw, Send, Trash2, Type, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { useMemo } from "react";
import {
  CAP_COLORS,
  CAP_ZONES,
  COASTER_MATERIALS,
  DESIGN_LIMITS,
  HAT_DESIGN_ENABLED,
  NAPKIN_BORDERS,
  NAPKIN_MATERIAL,
  NAPKIN_SIZE_MM,
  NAPKIN_ZONE,
  TEXT_FONTS,
  THREAD_COLORS,
  TSHIRT_COLORS,
  TSHIRT_ZONES,
  type DesignItem,
  type DesignSpec,
} from "@/modules/design/config";
import { buildCap, buildCoaster, CAP, capSurface, capZoneAt, loadCapModel } from "./models";
import { normalize, pointInPolygon, presetShape, scaleShape, scallopSquare, SHAPE_PRESETS, shapeFromImage, teeOutline, type Pt } from "./shapes";
import { coasterCanvas, cropImage, fabricTile, loadImage, prepareImage, renderText, trim } from "./textures";

type Product = "hat" | "napkin" | "tshirt";
type Placed = DesignItem & { thumb: string };
type Runtime = {
  source: HTMLCanvasElement;
  img?: HTMLImageElement;
  file?: File;
  mesh?: THREE.Mesh;
  texture?: THREE.Texture;
  textureKey?: string;
  /** anh ve tu mui theu that cho be ngang `width` mm (xem truoc) */
  stitched?: { canvas: HTMLCanvasElement; width: number };
};
type StitchSummary = { stitches: number; colors: number; est_minutes: number; width_mm: number; height_mm: number; token?: string };

/** Gui anh sang /api/design/stitch-preview (Ink/Stitch) -> anh ve tu mui theu that, cat sat. */
async function fetchStitched(src: HTMLCanvasElement, widthMm: number, maxColors = 6) {
  const blob = await new Promise<Blob | null>((res) => src.toBlob(res, "image/png"));
  if (!blob) throw new Error("Could not read the design image.");
  const fd = new FormData();
  fd.set("image", blob, "design.png");
  fd.set("width_mm", String(Math.min(130, Math.max(10, Math.round(widthMm)))));
  fd.set("max_colors", String(maxColors));
  const res = await fetch("/api/design/stitch-preview", { method: "POST", body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not create the stitch preview.");
  const report = JSON.parse(decodeURIComponent(res.headers.get("X-Stitch-Report") || "%7B%7D")) as StitchSummary;
  report.token = res.headers.get("X-Stitch-Token") ?? undefined;
  const url = URL.createObjectURL(await res.blob());
  try {
    const img = await loadImage(url);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return { canvas: trim(c), report };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Anh xem truoc con dung duoc neu be ngang chi lech duoi 12% (mat do mui doi theo mm). */
const freshFor = (stitchedWidth: number | undefined, widthMm: number) => stitchedWidth !== undefined && Math.abs(stitchedWidth - widthMm) / widthMm < 0.12;

const VIEWS: Record<string, [number, number, number]> = {
  front: [0, 40, 430],
  left: [430, 40, 0],
  right: [-430, 40, 0],
  back: [0, 60, -430],
  napkin: [0, 300, 0.01], // khan phang: nhin thang tu tren xuong
};

const uid = () => Math.random().toString(36).slice(2, 10);
/** Dau hieu ghi vao clipboard khi Ctrl+C mot hinh (Ctrl+V sau do nhan ban hinh nay). */
const CLIP_PREFIX = "csh-design:";

/** Con tro vong cung (xoay) khi re chuot ngay ngoai goc khung, giong Figma. */
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5 14a7 7 0 1 1 7 7" fill="none" stroke="white" stroke-width="4"/><path d="M5 14a7 7 0 1 1 7 7" fill="none" stroke="black" stroke-width="1.8"/><path d="M1.5 11.5 5 15.5l3.5-4" fill="none" stroke="black" stroke-width="1.8"/></svg>',
)}") 12 12, crosshair`;

/** Ao phong: mat truoc ben trai, mat sau ben phai (tam moi mat cach giua TEE_X mm). */
const TEE_X: Record<string, number> = { front: -480, back: 480 };
/** Goc nhin ao: [vi tri camera, diem nhin] */
const TEE_VIEWS: Record<string, [[number, number, number], [number, number, number]]> = {
  both: [[0, 2150, 0.01], [0, 0, 0]],
  front: [[TEE_X.front, 1600, 0.01], [TEE_X.front, 0, 0]],
  back: [[TEE_X.back, 1600, 0.01], [TEE_X.back, 0, 0]],
};

/** Camera nhin thang xuong lot coc, xa theo kich thuoc de luon vua khung. */
const coasterView = (sizeMm: number): [number, number, number] => [0, sizeMm * 2.7, 0.01];

export function Designer() {
  const [product, setProduct] = useState<Product>(HAT_DESIGN_ENABLED ? "hat" : "napkin");
  // khan cocktail giong mau trong shop: vuong 150 mm, cotton canvas (mot chat lieu)
  const mat = COASTER_MATERIALS.find((m) => m.key === NAPKIN_MATERIAL) ?? COASTER_MATERIALS[0];
  const [color, setColor] = useState((HAT_DESIGN_ENABLED ? CAP_COLORS : mat.colors)[0].key);
  const [border, setBorder] = useState(NAPKIN_BORDERS[0].key);
  const [borderThread, setBorderThread] = useState("white");
  const sizeMm = NAPKIN_SIZE_MM;
  // ---- hinh dang khan: hinh co san, cat theo anh khach up, hoac khach tu ve da giac ----
  const [shapeKey, setShapeKey] = useState("square");
  const [shapeImg, setShapeImg] = useState<{ canvas: HTMLCanvasElement; file: File; img: HTMLImageElement; keepBg: boolean } | null>(null);
  const [shapeMargin, setShapeMargin] = useState(0);
  // do muot duong cat quanh anh, mm (lap khe giua cac chi tiet nho)
  const [shapeSmooth, setShapeSmooth] = useState(0);
  const [shapeImageOn, setShapeImageOn] = useState(true);
  const [customPts, setCustomPts] = useState<Pt[] | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const outlineMm = useMemo<Pt[]>(() => {
    if (shapeKey === "square" && border === "scallop") return scallopSquare(sizeMm);
    const unit =
      shapeKey === "image" && shapeImg
        ? shapeFromImage(shapeImg.canvas, shapeMargin / sizeMm, shapeSmooth / sizeMm)
        : shapeKey === "custom" && customPts
          ? customPts
          : presetShape(shapeKey);
    return scaleShape(unit, sizeMm);
  }, [shapeKey, shapeImg, shapeMargin, shapeSmooth, customPts, border, sizeMm]);
  // mep luon song chi lam duoc tren khan vuong; hinh khac dung vien satin manh theo duong cat
  const edgeOptions = NAPKIN_BORDERS.filter((b) => (shapeKey === "square" ? b.key !== "satin" : b.key !== "scallop"));
  const pickShape = (key: string) => {
    setShapeKey(key);
    if (key === "square" && border === "satin") setBorder("scallop");
    if (key !== "square" && border === "scallop") setBorder("satin");
  };
  const borderHex = (THREAD_COLORS.find((c) => c.key === borderThread) ?? THREAD_COLORS[0]).hex;
  const [items, setItems] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  // xem truoc mui theu that (dich vu Ink/Stitch): tat = anh goc, bat = ve tu chinh cac mui theu
  const [stitchMode, setStitchMode] = useState(false);
  const stitchModeRef = useRef(stitchMode);
  stitchModeRef.current = stitchMode;
  const [stitchBusy, setStitchBusy] = useState(0);
  const [stitchError, setStitchError] = useState<string | null>(null);
  const [stitchReports, setStitchReports] = useState<Record<string, StitchSummary>>({});
  const [playerOpen, setPlayerOpen] = useState(false);
  const [bgStitched, setBgStitched] = useState<{ canvas: HTMLCanvasElement; width: number; src: HTMLCanvasElement } | null>(null);
  const inFlight = useRef(new Set<string>());
  const [removeBg, setRemoveBg] = useState(true);
  const [text, setText] = useState("");
  const [font, setFont] = useState(TEXT_FONTS[0].key);
  const [thread, setThread] = useState(THREAD_COLORS[0].key);
  const [error, setError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [cropFor, setCropFor] = useState<string | null>(null);

  const mount = useRef<HTMLDivElement>(null);
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    model?: THREE.Group;
    /** he toa do luu vi tri hinh (mm, day chop/khan o y = 0) */
    space?: THREE.Object3D;
    target?: THREE.Mesh;
    /** ao: mat truoc / mat sau la 2 be mat rieng (theo zone cua hinh) */
    targets?: Record<string, THREE.Mesh>;
    material?: THREE.MeshStandardMaterial;
  } | null>(null);
  const runtime = useRef(new Map<string, Runtime>());
  const twill = useRef<HTMLImageElement | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  /** khung chon kieu Figma (SVG phu len canvas), cap nhat moi khung hinh theo camera */
  const overlay = useRef<SVGSVGElement>(null);
  const corners = useRef<{ x: number; y: number }[]>([]);

  const colors = product === "hat" ? CAP_COLORS : product === "tshirt" ? TSHIRT_COLORS : mat.colors;
  // ao: hinh moi them vao mat dang chon
  const [teeSide, setTeeSide] = useState<"front" | "back">("front");
  const colorHex = (colors.find((c) => c.key === color) ?? colors[0]).hex;

  // ---- khoi tao three.js (1 lan) ----
  useEffect(() => {
    const el = mount.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    // canvas co theo khung (khong de three.js gan be rong px co dinh -> tran ngang tren mobile)
    Object.assign(renderer.domElement.style, { touchAction: "none", display: "block", width: "100%", height: "100%" });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f4efe6");
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f6c, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-250, 420, 380);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(300, 150, -300);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(32, 1, 5, 6000);
    camera.position.set(330, 150, 420);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.enableDamping = true;
    controls.minDistance = 200;
    controls.maxDistance = 700;
    three.current = { renderer, scene, camera, controls };
    // dev: cho phep chinh camera tu console khi canh mo hinh theo anh phoi
    if (process.env.NODE_ENV !== "production") (window as unknown as { __design: unknown }).__design = three.current;

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 1 ? 44 : 32; // khung doc (mobile): nhin rong hon de thay ca mu
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      drawOverlay();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      three.current = null;
    };
  }, []);

  // ---- dung mo hinh theo san pham / mau / vien ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      twill.current ??= await loadImage("/design/twill.jpg");
      const t = three.current;
      if (!t || cancelled) return;
      if (t.model) {
        t.scene.remove(t.model);
        t.model.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      }
      t.targets = undefined;
      // go decal cu khoi canh truoc khi dung lai (truoc day chi bo tham chieu -> moi lan doi mau them 1 ban anh)
      for (const r of runtime.current.values()) {
        if (r.mesh) {
          t.scene.remove(r.mesh);
          r.mesh.geometry.dispose();
          r.mesh = undefined;
        }
      }
      if (product === "hat") {
        const tex = new THREE.CanvasTexture(fabricTile(twill.current, colorHex));
        tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        // co file mo hinh that (public/design/models/cap.glb) thi dung, khong thi dung mo hinh dung bang code
        const cap = (await loadCapModel(tex)) ?? buildCap(tex, 22);
        if (cancelled) return;
        t.scene.add(cap.group);
        t.model = cap.group;
        t.space = cap.group;
        t.target = cap.crown;
        t.material = cap.material;
        t.controls.target.set(0, 0, 0);
      } else if (product === "tshirt") {
        // ao phong trai phang: mat truoc + mat sau dat canh nhau
        const parent = new THREE.Group();
        const targets: Record<string, THREE.Mesh> = {};
        for (const side of ["front", "back"] as const) {
          const outline = teeOutline(side);
          const tex = new THREE.CanvasTexture(coasterCanvas({ twill: twill.current, fabricHex: colorHex, material: "felt", outlineMm: outline, border: "plain", borderHex: colorHex, pxPerMm: 3 }));
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          const tee = buildCoaster(outline, tex, colorHex);
          tee.group.position.x = TEE_X[side];
          tee.surface.userData.zone = side;
          parent.add(tee.group);
          targets[side] = tee.surface;
        }
        t.scene.add(parent);
        t.model = parent;
        t.space = parent;
        t.target = targets.front;
        t.targets = targets;
      } else {
        // khan: vai canvas + mep (may gap / luon song / chi chay) theo dung duong cat
        // anh khach dung lam dang khan (neu chon theu luon anh do) nam giua khan
        const background =
          shapeKey === "image" && shapeImageOn && shapeImg ? (stitchMode && bgStitched?.src === shapeImg.canvas ? bgStitched.canvas : shapeImg.canvas) : null;
        const tex = new THREE.CanvasTexture(coasterCanvas({ twill: twill.current, fabricHex: colorHex, material: mat.texture, outlineMm, background, backgroundMarginMm: shapeMargin, border, borderHex }));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        const nap = buildCoaster(outlineMm, tex, colorHex);
        t.scene.add(nap.group);
        t.model = nap.group;
        t.space = nap.group;
        t.target = nap.surface;
        t.controls.target.set(0, 0, 0);
      }
      t.model.updateMatrixWorld(true);
      for (const it of itemsRef.current) rebuildDecal(it);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildDecal doc ref
  }, [product, colorHex, border, borderHex, outlineMm, mat.texture, shapeKey, shapeImageOn, shapeImg, stitchMode, bgStitched]);

  // ---- xem truoc mui theu: lan luot gui tung hinh (va anh nen lot coc) sang dich vu theu ----
  useEffect(() => {
    if (!stitchMode) return;
    const run = async (key: string, job: () => Promise<void>) => {
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);
      setStitchBusy((n) => n + 1);
      try {
        await job();
        setStitchError(null);
      } catch (e) {
        setStitchError(e instanceof Error ? e.message : "Could not create the stitch preview.");
      } finally {
        inFlight.current.delete(key);
        setStitchBusy((n) => n - 1);
      }
    };
    for (const it of items) {
      const r = runtime.current.get(it.id);
      if (!r || freshFor(r.stitched?.width, it.widthMm)) continue;
      const width = it.widthMm;
      run(`${it.id}:${width}`, async () => {
        const out = await fetchStitched(r.source, width);
        r.stitched = { canvas: out.canvas, width };
        setStitchReports((m) => ({ ...m, [it.id]: out.report }));
        const cur = itemsRef.current.find((x) => x.id === it.id);
        if (cur) rebuildDecal(cur);
      });
    }
    // anh dung lam dang khan (neu theu luon anh do): be ngang that cua anh tren khan
    if (product === "napkin" && shapeKey === "image" && shapeImageOn && shapeImg) {
      const xs = outlineMm.map((p) => p[0]);
      const ys = outlineMm.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      const src = shapeImg.canvas;
      const width = Math.round(Math.min(w - 2 * shapeMargin, (h - 2 * shapeMargin) * (src.width / src.height)));
      if (!(bgStitched?.src === src && freshFor(bgStitched.width, width))) {
        run(`bg:${width}`, async () => {
          const out = await fetchStitched(src, width);
          setBgStitched({ canvas: out.canvas, width, src });
          setStitchReports((m) => ({ ...m, background: out.report }));
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildDecal doc ref; chay lai khi hinh/kich thuoc doi
  }, [stitchMode, items, shapeImg, shapeImageOn, shapeKey, outlineMm, product, bgStitched]);

  useEffect(() => {
    const t = three.current;
    if (!t) return;
    const [x, y, z] = product === "hat" ? [330, 150, 420] : product === "tshirt" ? TEE_VIEWS.both[0] : coasterView(sizeMm);
    t.camera.position.set(x, y, z);
    t.controls.target.set(0, 0, 0);
    t.controls.minDistance = product === "hat" ? 200 : product === "tshirt" ? 300 : 80;
    t.controls.maxDistance = product === "tshirt" ? 4000 : 700;
    // khan / ao la do phang: khoa xoay; keo chuot trai vao cho trong = dich khung nhin (ban tay), lan chuot = zoom.
    // mu: chuot trai xoay, chuot phai dich
    const flat = product !== "hat";
    t.controls.enableRotate = !flat;
    t.controls.mouseButtons = { LEFT: flat ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    t.controls.touches = { ONE: flat ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    // khong cho dich lac khoi san pham: gioi han diem nhin trong khung quanh san pham
    const [bx, bz] = product === "tshirt" ? [900, 550] : product === "hat" ? [150, 150] : [sizeMm * 0.6, sizeMm * 0.6];
    const by = product === "hat" ? 150 : 50;
    const clamp = () => {
      const tg = t.controls.target;
      const c = new THREE.Vector3(THREE.MathUtils.clamp(tg.x, -bx, bx), THREE.MathUtils.clamp(tg.y, -by, by), THREE.MathUtils.clamp(tg.z, -bz, bz));
      if (c.equals(tg)) return;
      t.camera.position.add(c.clone().sub(tg));
      tg.copy(c);
    };
    t.controls.addEventListener("change", clamp);
    return () => t.controls.removeEventListener("change", clamp);
  }, [product, sizeMm]);

  // ---- decal ----
  const rebuildDecal = useCallback(
    (it: DesignItem) => {
      const t = three.current;
      const r = runtime.current.get(it.id);
      if (!t?.target || !t.space || !r) return;
      if (r.mesh) {
        t.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
      }
      // texture chi tao lai khi doi che do "gia theu" (keo/doi co thi giu nguyen -> muot)
      const useStitched = stitchModeRef.current && r.stitched && freshFor(r.stitched.width, it.widthMm);
      const key = useStitched ? `s${r.stitched!.width}` : "o";
      if (!r.texture || r.textureKey !== key) {
        r.texture?.dispose();
        r.texture = new THREE.CanvasTexture(useStitched ? r.stitched!.canvas : r.source);
        r.texture.colorSpace = THREE.SRGBColorSpace;
        r.texture.anisotropy = 8;
        r.textureKey = key;
      }
      const p = t.space.localToWorld(new THREE.Vector3(...it.point));
      const n = new THREE.Vector3(...it.normal).transformDirection(t.space.matrixWorld);
      const o = new THREE.Object3D();
      o.position.copy(p);
      o.lookAt(p.clone().add(n));
      o.rotateZ((-it.rotationDeg * Math.PI) / 180);
      const geo = new DecalGeometry(t.targets?.[it.zone] ?? t.target, p, o.rotation, new THREE.Vector3(it.widthMm, it.heightMm, 40));
      // thu tu lop: hinh them sau nam tren (tranh soc nhap nhay o phan chong nhau)
      const layer = Math.max(0, itemsRef.current.findIndex((x) => x.id === it.id));
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          map: r.texture,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4 - layer * 2,
          polygonOffsetUnits: -4 - layer * 2,
          side: THREE.DoubleSide,
          roughness: 0.6,
        }),
      );
      mesh.userData.itemId = it.id;
      mesh.userData.frame = { p, quat: o.quaternion.clone(), w: it.widthMm, h: it.heightMm };
      mesh.renderOrder = 2 + layer;
      t.scene.add(mesh);
      r.mesh = mesh;
    },
    [stitchMode],
  );

  useEffect(() => {
    for (const it of itemsRef.current) rebuildDecal(it);
  }, [rebuildDecal]);

  const updateItem = (id: string, patch: Partial<DesignItem>) => {
    setItems((list) =>
      list.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        const r = runtime.current.get(id);
        if (r && patch.widthMm !== undefined) next.heightMm = Math.round((patch.widthMm * r.source.height) / r.source.width * 10) / 10;
        rebuildDecal(next);
        return next;
      }),
    );
  };

  // ---- khung chon kieu Figma: 4 goc keo doi co, ra ngoai goc thi xoay ----
  const centerRef = useRef({ x: 0, y: 0 });
  const maxWidth = product === "hat" ? 110 : product === "tshirt" ? 280 : 140;
  const drawOverlay = () => {
    const svg = overlay.current;
    const t = three.current;
    if (!svg || !t) return;
    const id = selectedRef.current;
    const f = id ? (runtime.current.get(id)?.mesh?.userData.frame as { p: THREE.Vector3; quat: THREE.Quaternion; w: number; h: number } | undefined) : undefined;
    const normal = f ? new THREE.Vector3(0, 0, 1).applyQuaternion(f.quat) : null;
    // an khung khi khong chon hoac hinh dang o mat khuat cua mu
    if (!f || !normal || normal.dot(t.camera.position.clone().sub(f.p)) <= 0) {
      svg.style.display = "none";
      return;
    }
    svg.style.display = "";
    const rect = t.renderer.domElement.getBoundingClientRect();
    const toScreen = (v: THREE.Vector3) => {
      const q = v.clone().project(t.camera);
      return { x: ((q.x + 1) / 2) * rect.width, y: ((1 - q.y) / 2) * rect.height };
    };
    const pts = (
      [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ] as const
    ).map(([sx, sy]) => toScreen(new THREE.Vector3((sx * f.w) / 2, (sy * f.h) / 2, 0).applyQuaternion(f.quat).add(f.p)));
    const c = toScreen(f.p);
    corners.current = pts;
    centerRef.current = c;
    svg.querySelector("polygon")!.setAttribute("points", pts.map((q) => `${q.x},${q.y}`).join(" "));
    pts.forEach((q, i) => {
      const g = svg.querySelector(`[data-i="${i}"]`)!;
      const dx = q.x - c.x;
      const dy = q.y - c.y;
      const len = Math.hypot(dx, dy) || 1;
      g.querySelector("rect")!.setAttribute("x", String(q.x - 5));
      g.querySelector("rect")!.setAttribute("y", String(q.y - 5));
      g.querySelector("circle")!.setAttribute("cx", String(q.x + (dx / len) * 12));
      g.querySelector("circle")!.setAttribute("cy", String(q.y + (dy / len) * 12));
    });
  };

  // dev: ve khung chon theo yeu cau khi kiem thu trong tab an (requestAnimationFrame bi dung)
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __designDraw: () => void }).__designDraw = drawOverlay;

  const startHandle = (mode: "resize" | "rotate") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const t = three.current;
    const id = selectedRef.current;
    const it = itemsRef.current.find((x) => x.id === id);
    if (!t || !id || !it) return;
    t.controls.enabled = false;
    const rect = t.renderer.domElement.getBoundingClientRect();
    const c = centerRef.current;
    const at = (ev: PointerEvent | React.PointerEvent) => ({ x: ev.clientX - rect.left - c.x, y: ev.clientY - rect.top - c.y });
    const p0 = at(e);
    const d0 = Math.hypot(p0.x, p0.y) || 1;
    const a0 = Math.atan2(p0.y, p0.x);
    const move = (ev: PointerEvent) => {
      const p = at(ev);
      if (mode === "resize") {
        const w = Math.round(Math.min(maxWidth, Math.max(DESIGN_LIMITS.minWidth, (it.widthMm * Math.hypot(p.x, p.y)) / d0)));
        updateItem(id, { widthMm: w });
      } else {
        let r = it.rotationDeg + ((Math.atan2(p.y, p.x) - a0) * 180) / Math.PI;
        r = ((((r + 180) % 360) + 360) % 360) - 180;
        // bat dinh vao 0 / 90 / -90 / 180 khi gan (giong Figma giu Shift)
        const snap = [0, 90, -90, 180, -180].find((v) => Math.abs(v - r) < 4);
        updateItem(id, { rotationDeg: Math.round(snap ?? r) });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      t.controls.enabled = true;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- keo tha tren be mat ----
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    const dom = t.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let dragging: string | null = null;
    let pressAt: { x: number; y: number } | null = null;
    const cast = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, t.camera);
    };
    const down = (e: PointerEvent) => {
      cast(e);
      const decals = [...runtime.current.values()].map((r) => r.mesh).filter(Boolean) as THREE.Mesh[];
      const hit = ray.intersectObjects(decals, false)[0];
      if (!hit) dom.style.cursor = "grabbing";
      if (hit) {
        dragging = hit.object.userData.itemId;
        setSelected(dragging);
        t.controls.enabled = false;
        dom.setPointerCapture(e.pointerId);
      } else {
        pressAt = { x: e.clientX, y: e.clientY };
      }
    };
    const move = (e: PointerEvent) => {
      if (!dragging && !pressAt) {
        // re chuot: tren hinh -> keo hinh, cho trong -> ban tay dich khung
        cast(e);
        const decals = [...runtime.current.values()].map((r) => r.mesh).filter(Boolean) as THREE.Mesh[];
        dom.style.cursor = ray.intersectObjects(decals, false).length ? "move" : "grab";
      }
      if (!dragging || !t.target || !t.space) return;
      cast(e);
      // ao: keo duoc tu mat truoc sang mat sau
      const hit = ray.intersectObjects(t.targets ? Object.values(t.targets) : [t.target], false)[0];
      if (!hit?.face) return;
      const local = t.space.worldToLocal(hit.point.clone());
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const zone = product === "hat" ? capZoneAt(local).key : product === "tshirt" ? (hit.object.userData.zone as string) : NAPKIN_ZONE.key;
      updateItem(dragging, { point: [local.x, local.y, local.z], normal: [n.x, n.y, n.z], zone });
    };
    const up = (e: PointerEvent) => {
      // bam (khong keo) vao cho trong -> bo chon, an khung
      if (!dragging && pressAt && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) < 4) setSelected(null);
      pressAt = null;
      dragging = null;
      dom.style.cursor = "grab";
      t.controls.enabled = true;
    };
    dom.addEventListener("pointerdown", down);
    dom.addEventListener("pointermove", move);
    dom.addEventListener("pointerup", up);
    dom.addEventListener("pointercancel", up);
    return () => {
      dom.removeEventListener("pointerdown", down);
      dom.removeEventListener("pointermove", move);
      dom.removeEventListener("pointerup", up);
      dom.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateItem dung setState dang ham
  }, [product, rebuildDecal]);

  // ---- them hinh / chu ----
  const defaultPlacement = (zoneKey: string) => {
    if (product === "tshirt") {
      // giua nguc (mat truoc) / giua lung tren (mat sau), cac hinh sau lech nhau
      const n = itemsRef.current.filter((i) => i.zone === zoneKey).length;
      const [dx, dz] = ([[0, 0], [-60, -60], [60, 60], [60, -60], [-60, 60], [0, 90]] as const)[n % 6];
      return { point: [TEE_X[zoneKey] + dx, 1.5, -170 + dz] as [number, number, number], normal: [0, 1, 0] as [number, number, number], zone: zoneKey };
    }
    if (product === "napkin") {
      // nhieu hinh tren khan: rai lech nhau de khong chong len nhau, khach keo lai sau
      const n = itemsRef.current.length;
      const k = sizeMm / 150;
      const [dx, dz] = ([[0, 0], [-25, -25], [25, 25], [25, -25], [-25, 25], [0, 30]] as const)[n % 6];
      return { point: [dx * k, 1.5, dz * k] as [number, number, number], normal: [0, 1, 0] as [number, number, number], zone: NAPKIN_ZONE.key };
    }
    // ban tia tu phia vi tri do vao tam mu -> diem tren be mat (dung cho ca mo hinh .glb)
    const t = three.current;
    const aim = ({ front: [0, 38, 1], left: [1, 44, 0], right: [-1, 44, 0], back: [0, 62, -1] } as Record<string, [number, number, number]>)[zoneKey] ?? [0, 38, 1];
    if (t?.target && t.space) {
      const from = t.space.localToWorld(new THREE.Vector3(aim[0] * 400, aim[1], aim[2] * 400));
      const to = t.space.localToWorld(new THREE.Vector3(0, aim[1], 0));
      const hit = new THREE.Raycaster(from, to.sub(from).normalize()).intersectObject(t.target, false)[0];
      if (hit?.face) {
        const lp = t.space.worldToLocal(hit.point.clone());
        const n = hit.face.normal.clone().transformDirection(t.target.matrixWorld);
        return { point: [lp.x, lp.y, lp.z] as [number, number, number], normal: [n.x, n.y, n.z] as [number, number, number], zone: zoneKey };
      }
    }
    const s = { front: [0, 0.3], left: [Math.PI / 2, 0.4], right: [-Math.PI / 2, 0.4], back: [Math.PI, 0.62] }[zoneKey] ?? [0, 0.3];
    const { point, normal } = capSurface(s[0], s[1]);
    return { point: [point.x, point.y, point.z] as [number, number, number], normal: [normal.x, normal.y, normal.z] as [number, number, number], zone: zoneKey };
  };
  const freeZone = () => {
    if (product === "napkin") return NAPKIN_ZONE.key;
    if (product === "tshirt") return teeSide;
    const used = new Set(itemsRef.current.map((i) => i.zone));
    return CAP_ZONES.find((z) => !used.has(z.key))?.key ?? "front";
  };

  const addItem = (source: HTMLCanvasElement, base: Partial<DesignItem>, file?: File, img?: HTMLImageElement) => {
    // doc itemsRef (khong doc state) de them nhieu anh lien tiep trong mot lan chon van dem dung
    if (itemsRef.current.length >= DESIGN_LIMITS.maxItems) return setError(`Up to ${DESIGN_LIMITS.maxItems} images or texts per design.`);
    const zoneKey = freeZone();
    const zone = product === "hat" ? CAP_ZONES.find((z) => z.key === zoneKey)! : product === "tshirt" ? TSHIRT_ZONES.find((z) => z.key === zoneKey)! : NAPKIN_ZONE;
    const aspect = source.height / source.width;
    let w = product === "napkin" ? Math.round(sizeMm * 0.45) : product === "tshirt" ? 200 : Math.min(zone.maxW * 0.7, 70);
    if (w * aspect > zone.maxH * 0.9) w = (zone.maxH * 0.9) / aspect;
    w = Math.max(DESIGN_LIMITS.minWidth, Math.round(w));
    const id = uid();
    runtime.current.set(id, { source, file, img });
    const it: Placed = {
      id,
      kind: base.kind ?? "image",
      widthMm: w,
      heightMm: Math.round(w * aspect * 10) / 10,
      rotationDeg: 0,
      ...defaultPlacement(zoneKey),
      ...base,
      thumb: source.toDataURL("image/png"),
    } as Placed;
    itemsRef.current = [...itemsRef.current, it];
    setItems((l) => [...l, it]);
    setSelected(id);
    rebuildDecal(it);
    // quay camera ve phia vua dat
    const t = three.current;
    if (t && product === "hat") {
      const v = VIEWS[zoneKey] ?? VIEWS.front;
      t.camera.position.set(v[0] * 0.9 + (zoneKey === "front" ? 120 : 0), v[1] + 40, v[2] * 0.9 + (zoneKey !== "front" && zoneKey !== "back" ? 120 : 0));
    }
  };

  /** Them mot hoac nhieu anh; moi anh thanh mot hinh rieng dat vao vi tri con trong. */
  const onFiles = async (list: FileList | null) => {
    setError(null);
    for (const f of Array.from(list ?? [])) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
        setError(`${f.name}: use a PNG, JPG or WEBP image.`);
        continue;
      }
      if (f.size > DESIGN_LIMITS.maxUploadBytes) {
        setError(`${f.name} is larger than 8 MB.`);
        continue;
      }
      const url = URL.createObjectURL(f);
      try {
        const img = await loadImage(url);
        addItem(prepareImage(img, removeBg), { kind: "image", fileName: f.name, removeBg }, f, img);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read this image.");
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  };

  /**
   * Anh lam dang khan: bo nen tron roi cat theo duong vien (xem shapeFromImage).
   * Icon/logo vuong co nen mau (vd nen xanh) thi khach thuong muon giu ca nen -> "Keep the image background":
   * khong bo nen, khan cat theo khung anh. Mac dinh giu nen khi anh kin nen mau (khong trong, khong trang) - xem coloredSquareBg.
   */
  const onShapeFile = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setError("Use a PNG, JPG or WEBP image.");
    if (f.size > DESIGN_LIMITS.maxUploadBytes) return setError("Image is larger than 8 MB.");
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImage(url);
      const keepBg = coloredSquareBg(img);
      setShapeImg({ canvas: prepareImage(img, !keepBg), file: f, img, keepBg });
      pickShape("image");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const addText = async () => {
    const value = text.trim();
    if (!value) return setError("Type the text first.");
    setError(null);
    const f = TEXT_FONTS.find((x) => x.key === font)!;
    const c = THREAD_COLORS.find((x) => x.key === thread)!;
    addItem(await renderText(value, f.css, c.hex), { kind: "text", text: value, font, thread });
    setText("");
  };

  const removeItem = (id: string) => {
    const r = runtime.current.get(id);
    if (r?.mesh) {
      three.current?.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
    }
    r?.texture?.dispose();
    runtime.current.delete(id);
    itemsRef.current = itemsRef.current.filter((i) => i.id !== id);
    setItems((l) => l.filter((i) => i.id !== id));
    if (selectedRef.current === id) setSelected(null);
  };

  /** Xu ly lai anh tu anh goc (vung cat + xoa nen), giu be ngang, cap nhat chieu cao theo ti le moi. */
  const reprocess = (id: string, patch: Pick<DesignItem, "removeBg" | "crop">) => {
    const it = itemsRef.current.find((i) => i.id === id);
    const r = runtime.current.get(id);
    if (!it || !r?.img) return;
    const merged = { ...it, ...patch };
    r.source = prepareImage(merged.crop ? cropImage(r.img, merged.crop) : r.img, !!merged.removeBg);
    r.texture?.dispose();
    r.texture = undefined;
    r.stitched = undefined;
    const heightMm = Math.round(((it.widthMm * r.source.height) / r.source.width) * 10) / 10;
    const next: Placed = { ...merged, heightMm, thumb: r.source.toDataURL("image/png") };
    if (!next.crop) delete next.crop;
    itemsRef.current = itemsRef.current.map((x) => (x.id === id ? next : x));
    setItems((l) => l.map((x) => (x.id === id ? next : x)));
    rebuildDecal(next);
  };
  /** Bat/tat xoa nen cho mot anh — khi tu xoa nen an mat mang trang trong hinh. */
  const toggleBg = (id: string) => reprocess(id, { removeBg: !itemsRef.current.find((i) => i.id === id)?.removeBg });

  /** Nhan ban mot hinh (Ctrl+C/Ctrl+V, Ctrl+D): cung anh, cung co, lech 10 mm sang ben canh tren be mat. */
  const duplicateItem = (id: string) => {
    const src = itemsRef.current.find((i) => i.id === id);
    const r = runtime.current.get(id);
    const t = three.current;
    if (!src || !r || !t?.target || !t.space) return;
    if (itemsRef.current.length >= DESIGN_LIMITS.maxItems) return setError(`Up to ${DESIGN_LIMITS.maxItems} images or texts per design.`);
    const n = new THREE.Vector3(...src.normal);
    // huong "sang phai" cua hinh tren mat phang tiep tuyen
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n);
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
    right.normalize();
    const shifted = new THREE.Vector3(...src.point).addScaledVector(right, 10).addScaledVector(n, 0);
    if (product !== "hat") shifted.z += 10;
    const surface = t.targets?.[src.zone] ?? t.target;
    let point: [number, number, number] = [shifted.x, shifted.y, shifted.z];
    let normal = src.normal;
    // chieu lai xuong be mat (mu cong)
    const from = t.space.localToWorld(shifted.clone().addScaledVector(n, 60));
    const hit = new THREE.Raycaster(from, n.clone().transformDirection(t.space.matrixWorld).negate()).intersectObject(surface, false)[0];
    if (hit?.face) {
      const lp = t.space.worldToLocal(hit.point.clone());
      const hn = hit.face.normal.clone().transformDirection(surface.matrixWorld);
      point = [lp.x, lp.y, lp.z];
      normal = [hn.x, hn.y, hn.z];
    }
    const nid = uid();
    runtime.current.set(nid, { source: r.source, file: r.file, img: r.img });
    const it: Placed = { ...src, id: nid, point, normal, zone: product === "hat" ? capZoneAt(new THREE.Vector3(...point)).key : src.zone };
    itemsRef.current = [...itemsRef.current, it];
    setItems((l) => [...l, it]);
    setSelected(nid);
    rebuildDecal(it);
  };

  // phim tat kieu Figma: Ctrl+C / Ctrl+V nhan ban, Ctrl+D nhan ban, Delete xoa; dan anh tu web/thu muc bang Ctrl+V
  const actions = useRef({ duplicateItem, removeItem, onFiles });
  actions.current = { duplicateItem, removeItem, onFiles };
  const copied = useRef<string | null>(null);
  useEffect(() => {
    const typing = (e: Event) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    // trinh duyet khong phat "paste" khi dang focus nut/khung 3D (khong phai o nhap) -> Ctrl+V xu ly ngay o keydown;
    // neu ngay sau do co "paste" mang anh (khach vua copy anh o noi khac) thi dan anh do thay vi nhan ban
    let pasteSeen = false;
    const key = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const sel = selectedRef.current;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "c" && sel) {
        copied.current = sel;
        // ghi de clipboard he thong de Ctrl+V sau do khong dan nham anh cu
        navigator.clipboard?.writeText(`${CLIP_PREFIX}${sel}`).catch(() => {});
        e.preventDefault();
      } else if (mod && k === "v") {
        pasteSeen = false;
        const id = copied.current;
        setTimeout(() => {
          if (!pasteSeen && id && itemsRef.current.some((i) => i.id === id)) actions.current.duplicateItem(id);
        }, 60);
      } else if (mod && k === "d" && sel) {
        e.preventDefault();
        actions.current.duplicateItem(sel);
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        actions.current.removeItem(sel);
      }
    };
    const paste = (e: ClipboardEvent) => {
      if (typing(e)) return;
      pasteSeen = true;
      const textData = e.clipboardData?.getData("text") ?? "";
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length && !textData.startsWith(CLIP_PREFIX)) {
        e.preventDefault();
        const dt = new DataTransfer();
        files.forEach((f, i) => dt.items.add(new File([f], f.name && f.name !== "image.png" ? f.name : `pasted-${Date.now()}-${i}.png`, { type: f.type })));
        actions.current.onFiles(dt.files);
        return;
      }
      const id = textData.startsWith(CLIP_PREFIX) ? textData.slice(CLIP_PREFIX.length) : copied.current;
      if (id && itemsRef.current.some((i) => i.id === id)) {
        e.preventDefault();
        actions.current.duplicateItem(id);
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("paste", paste);
    };
  }, []);

  const switchProduct = (p: Product) => {
    if (p === product) return;
    for (const id of [...runtime.current.keys()]) removeItem(id);
    setItems([]);
    setProduct(p);
    setColor((p === "hat" ? CAP_COLORS : p === "tshirt" ? TSHIRT_COLORS : mat.colors)[0].key);
  };

  /** Vi tri camera + diem nhin cho mot goc xem (mu / khan / ao). */
  const pose = (view: string): [[number, number, number], [number, number, number]] =>
    product === "tshirt" ? (TEE_VIEWS[view] ?? TEE_VIEWS.both) : [view === "napkin" ? coasterView(sizeMm) : (VIEWS[view] ?? VIEWS.front), [0, 0, 0]];
  const lookFrom = (view: string) => {
    const t = three.current;
    if (!t) return;
    const [pos, look] = pose(view);
    t.camera.position.set(...pos);
    t.controls.target.set(...look);
    t.controls.update();
    if (product === "tshirt" && view !== "both") setTeeSide(view as "front" | "back");
  };

  /** Phong to / thu nho quanh diem dang nhin (nut +/-), giu trong min/maxDistance. */
  const zoomBy = (f: number) => {
    const t = three.current;
    if (!t) return;
    const off = t.camera.position.clone().sub(t.controls.target);
    const len = THREE.MathUtils.clamp(off.length() * f, t.controls.minDistance, t.controls.maxDistance);
    t.camera.position.copy(t.controls.target).add(off.setLength(len));
    t.controls.update();
  };
  const resetView = () => lookFrom(product === "tshirt" ? "both" : product === "hat" ? "front" : "napkin");

  /** Chup cac goc nhin de gui kem thiet ke. */
  const snapshots = (): Record<string, string> => {
    const t = three.current!;
    const keep = t.camera.position.clone();
    const keepTarget = t.controls.target.clone();
    const out: Record<string, string> = {};
    const views = product === "hat" ? ["front", "left", "right", "back"] : product === "tshirt" ? ["front", "back"] : ["napkin"];
    for (const v of views) {
      const [pos, look] = pose(v);
      t.camera.position.set(...pos);
      t.camera.lookAt(...look);
      t.renderer.render(t.scene, t.camera);
      out[v] = t.renderer.domElement.toDataURL("image/png");
    }
    t.camera.position.copy(keep);
    t.controls.target.copy(keepTarget);
    t.controls.update();
    return out;
  };

  const sel = items.find((i) => i.id === selected) ?? null;
  // cac thiet ke da co thu tu mui (xem truoc thanh cong), theo thu tu theu: nen khan truoc, roi tung hinh
  const playable = [
    ...(stitchReports.background?.token && shapeKey === "image" && shapeImg ? [{ key: "background", label: shapeImg.file.name, token: stitchReports.background.token }] : []),
    ...items.flatMap((it) => (stitchReports[it.id]?.token ? [{ key: it.id, label: it.kind === "text" ? `“${it.text}”` : (it.fileName ?? "Image"), token: stitchReports[it.id].token! }] : [])),
  ];
  const warningsFor = (it: DesignItem) => warnings(product, it, outlineMm);
  const cropItem = items.find((i) => i.id === cropFor);
  const cropImg = cropFor ? runtime.current.get(cropFor)?.img : undefined;

  return (
    // md+: 2 cot; o xem truoc dinh (sticky) ben trai -> chinh tuy chon ben phai van thay khan, khong phai keo len xuong
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 md:sticky md:top-3 md:self-start" aria-label="3D preview">
        <div className="relative overflow-hidden rounded-2xl border border-az-border bg-az-bg">
          <div ref={mount} className="h-[380px] w-full sm:h-[480px] md:h-[calc(100vh-1.5rem)] md:max-h-[720px] md:min-h-[460px]" />
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
            <div className="flex rounded-full bg-white/95 p-0.5 text-xs font-medium shadow-sm" role="group" aria-label="Preview mode">
              <button type="button" aria-pressed={!stitchMode} onClick={() => setStitchMode(false)} className={`rounded-full px-3 py-1 ${!stitchMode ? "bg-az-header text-white" : "hover:bg-az-bg"}`}>
                Original
              </button>
              <button type="button" aria-pressed={stitchMode} onClick={() => setStitchMode(true)} className={`rounded-full px-3 py-1 ${stitchMode ? "bg-az-header text-white" : "hover:bg-az-bg"}`}>
                Stitched preview
              </button>
            </div>
            {stitchMode && (
              <p className="max-w-60 rounded-lg bg-white/95 px-2.5 py-1.5 text-right text-[11px] leading-4 shadow-sm" aria-live="polite">
                {stitchBusy > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Turning your design into real stitches...
                  </span>
                ) : stitchError ? (
                  <span className="text-az-deal">{stitchError}</span>
                ) : (
                  <>
                    <StitchTotals reports={Object.entries(stitchReports).filter(([k]) => k === "background" || items.some((i) => i.id === k)).map(([, v]) => v)} hasImage={items.some((i) => i.kind !== "text") || (shapeKey === "image" && !!shapeImg)} />
                    {playable.length > 0 && (
                      <button type="button" onClick={() => setPlayerOpen(true)} className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-az-header px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90">
                        <Play className="size-3" aria-hidden="true" /> Watch it stitch
                      </button>
                    )}
                  </>
                )}
              </p>
            )}
          </div>
          <svg ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" style={{ display: "none" }} aria-hidden="true">
            <polygon fill="none" stroke="#c8553d" strokeWidth={1.5} />
            {[0, 1, 2, 3].map((i) => (
              <g key={i} data-i={i}>
                {/* vung xoay: ngay ngoai goc, con tro vong cung */}
                <circle r={14} fill="transparent" style={{ pointerEvents: "all", cursor: ROTATE_CURSOR }} onPointerDown={startHandle("rotate")} />
                <rect width={10} height={10} rx={2} fill="#fff" stroke="#c8553d" strokeWidth={1.5} style={{ pointerEvents: "all", cursor: i % 2 === 0 ? "nwse-resize" : "nesw-resize" }} onPointerDown={startHandle("resize")} />
              </g>
            ))}
          </svg>
          {product !== "napkin" ? (
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {(product === "hat" ? ["front", "left", "right", "back"] : ["both", "front", "back"]).map((v) => (
                <button key={v} type="button" onClick={() => lookFrom(v)} className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium capitalize shadow-sm hover:bg-white">
                  {v === "both" ? "Both sides" : v}
                </button>
              ))}
            </div>
          ) : (
            <p className="pointer-events-none absolute top-4 left-4 text-xs font-medium text-az-muted">{shapeKey === "square" ? "6 × 6 in (15 × 15 cm)" : "6 in (15 cm) wide"}</p>
          )}
          <div className={`absolute right-3 flex flex-col overflow-hidden rounded-xl bg-white/95 shadow-sm ${sel ? "bottom-16" : "bottom-10"}`} role="group" aria-label="Zoom">
            <button type="button" onClick={() => zoomBy(0.8)} className="p-2 hover:bg-az-bg" aria-label="Zoom in" title="Zoom in">
              <Plus className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => zoomBy(1.25)} className="border-t border-az-border p-2 hover:bg-az-bg" aria-label="Zoom out" title="Zoom out">
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={resetView} className="border-t border-az-border p-2 hover:bg-az-bg" aria-label="Fit to view" title="Fit to view">
              <Maximize className="size-4" aria-hidden="true" />
            </button>
          </div>
          {sel ? (
            // thanh cong cu cho hinh dang chon: kich thuoc, cat anh, nhan ban, xoa; doi co/xoay keo truc tiep tren khung
            <div className="absolute bottom-3 left-1/2 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-white/95 px-4 py-1.5 text-xs shadow-md">
              <span className="max-w-32 truncate font-semibold">{sel.kind === "text" ? `“${sel.text}”` : sel.fileName}</span>
              <span className="tabular-nums text-az-muted">
                {sel.widthMm} × {sel.heightMm} mm · {sel.rotationDeg}°
              </span>
              {sel.kind === "image" && (
                <button type="button" onClick={() => setCropFor(sel.id)} className="flex items-center gap-1 hover:underline">
                  <Crop className="size-3.5" aria-hidden="true" /> Crop
                </button>
              )}
              <button type="button" onClick={() => duplicateItem(sel.id)} className="flex items-center gap-1 hover:underline" title="Ctrl+C, Ctrl+V">
                <Copy className="size-3.5" aria-hidden="true" /> Duplicate
              </button>
              <button type="button" onClick={() => removeItem(sel.id)} className="flex items-center gap-1 text-az-deal hover:underline">
                <Trash2 className="size-3.5" aria-hidden="true" /> Remove
              </button>
            </div>
          ) : (
            <p className="pointer-events-none absolute right-3 bottom-3 left-3 text-center text-xs text-az-muted">
              {product === "hat" ? "Drag the background to turn the hat, right-drag to pan · " : "Scroll to zoom, drag empty space to pan · "}Drag a design to move it · drag its corners to resize, just outside a corner to rotate
            </p>
          )}
        </div>
      </section>

      <aside className="min-w-0 space-y-3" aria-label="Design options">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-az-border bg-white p-1" role="group" aria-label="Product">
          {(
            [
              ["napkin", "Napkin", true],
              ["tshirt", "T-shirt", true],
              ["hat", "Dad hat", HAT_DESIGN_ENABLED],
            ] as const
          ).map(([k, label, ok]) => (
            <button
              key={k}
              type="button"
              disabled={!ok}
              onClick={() => ok && switchProduct(k)}
              aria-pressed={k === product}
              className={`rounded-lg px-2 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45 ${k === product ? "bg-az-header text-white" : "hover:bg-az-bg"}`}
            >
              {label}
              {!ok && <span className="block text-[10px] leading-3 font-normal">Coming soon</span>}
            </button>
          ))}
        </div>
        <Panel title={`Add designs · ${items.length}/${DESIGN_LIMITS.maxItems}`}>
          {product === "tshirt" && (
            <div className="mb-3 flex items-center gap-2 text-xs">
              <span className="text-az-muted">Add to</span>
              <div className="flex rounded-full bg-az-bg p-0.5" role="radiogroup" aria-label="Shirt side">
                {(["front", "back"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={teeSide === v}
                    onClick={() => setTeeSide(v)}
                    className={`rounded-full px-3 py-1 font-medium capitalize ${teeSide === v ? "bg-white shadow-sm" : ""}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-az-border bg-az-cream px-4 py-3.5 text-sm font-semibold hover:border-az-link">
            <ImagePlus className="size-5 text-az-link" aria-hidden="true" /> Upload images
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} className="accent-[#c8553d]" />
            Remove plain background around the image
          </label>
          <div className="mt-3 space-y-2 border-t border-az-border pt-3">
            <label htmlFor="d-text" className="az-label">
              Or add text
            </label>
            <div className="flex gap-2">
              <input
                id="d-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addText()}
                placeholder="Name, word or date"
                className="az-input"
                maxLength={60}
              />
              <button type="button" onClick={addText} className="az-btn az-btn-buy shrink-0">
                <Type className="size-4" aria-hidden="true" /> Add
              </button>
            </div>
            {/* bang font xem truoc ngay bang chu khach go (hoac ten font) */}
            <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-az-border p-1" role="radiogroup" aria-label="Font">
              {TEXT_FONTS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={f.key === font}
                  title={`${f.label} (${f.group})`}
                  onClick={() => setFont(f.key)}
                  className={`truncate rounded-md px-2 py-1 text-left text-lg leading-7 ${f.key === font ? "bg-az-cream ring-1 ring-az-cart" : "hover:bg-az-bg"}`}
                  style={{ font: f.css.replace(/\d+px/, "18px") }}
                >
                  {text.trim().split("\n")[0] || f.label}
                </button>
              ))}
            </div>
            <Swatches label="Thread color" value={thread} onChange={setThread} />
          </div>
          {error && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-[#fbe9e5] px-3 py-2 text-sm text-az-deal">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}
          <p className="mt-3 text-[11px] leading-4 text-az-muted">Paste an image with Ctrl+V. Select a design, then Ctrl+C / Ctrl+V to duplicate it, Delete to remove it.</p>
        </Panel>

        {items.length > 0 && (
          <Panel title="Your designs">
            <ul className="space-y-1">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(it.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border p-1.5 text-left ${it.id === selected ? "border-az-cart bg-az-cream" : "border-transparent hover:bg-az-bg"}`}
                  >
                    <img src={it.thumb} alt="" className="size-10 rounded bg-az-bg object-contain" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">{it.kind === "text" ? `“${it.text}”` : it.fileName}</span>
                      <span className="text-xs text-az-muted tabular-nums">
                        {product === "tshirt" ? `${zoneLabel(product, it.zone)} · ` : ""}
                        {it.widthMm} × {it.heightMm} mm{it.crop ? " · cropped" : ""}
                      </span>
                      {warningsFor(it).length > 0 && <AlertTriangle className="ml-1 inline size-3.5 text-[#b7791f]" aria-label="Has warnings" />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {sel && (
              <div className="mt-3 border-t border-az-border pt-3">
                <label htmlFor="d-w" className="az-label">
                  Width: {sel.widthMm} mm <span className="font-normal text-az-muted">(height {sel.heightMm} mm)</span>
                </label>
                <input
                  id="d-w"
                  type="range"
                  min={DESIGN_LIMITS.minWidth}
                  max={maxWidth}
                  value={sel.widthMm}
                  onChange={(e) => updateItem(sel.id, { widthMm: Number(e.target.value) })}
                  className="w-full accent-[#c8553d]"
                />
                <label htmlFor="d-r" className="az-label mt-1">
                  Rotation: {sel.rotationDeg}°
                </label>
                <input id="d-r" type="range" min={-180} max={180} value={sel.rotationDeg} onChange={(e) => updateItem(sel.id, { rotationDeg: Number(e.target.value) })} className="w-full accent-[#c8553d]" />
                {sel.kind === "image" && (
                  <label className="mt-1 flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={!!sel.removeBg} onChange={() => toggleBg(sel.id)} className="accent-[#c8553d]" />
                    Remove background
                  </label>
                )}
                <ul className="mt-2 space-y-1.5">
                  {warningsFor(sel).map((w) => (
                    <li key={w} className="flex items-start gap-2 rounded-lg bg-[#fdf3e1] px-3 py-2 text-xs text-[#7a5310]">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {w}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sel.kind === "image" && (
                    <button type="button" onClick={() => setCropFor(sel.id)} className="az-btn az-btn-secondary">
                      <Crop className="size-4" aria-hidden="true" /> Crop
                    </button>
                  )}
                  <button type="button" onClick={() => updateItem(sel.id, { rotationDeg: 0 })} className="az-btn az-btn-secondary">
                    <RotateCcw className="size-4" aria-hidden="true" /> Straighten
                  </button>
                </div>
              </div>
            )}
          </Panel>
        )}

        <Panel title={product === "napkin" ? "Napkin" : product === "tshirt" ? "T-shirt" : "Hat"}>
          {product === "tshirt" && (
            <>
              <p className="text-sm">
                <span className="font-semibold">Unisex cotton tee</span>
              </p>
              <p className="mt-0.5 text-xs text-az-muted">Embroidery up to 25 × 25 cm on the front and 28 × 30 cm on the back. Sizes are chosen when we send your proof.</p>
            </>
          )}
          {product === "napkin" && (
            <>
              <p className="text-sm">
                <span className="font-semibold">Cocktail napkin</span> <span className="text-az-muted">· 6 × 6 in (15 × 15 cm)</span>
              </p>
              <p className="mt-0.5 text-xs text-az-muted">Cotton canvas — {mat.note.charAt(0).toLowerCase() + mat.note.slice(1)}.</p>
              <p className="az-label mt-3">Shape</p>
              <div className="grid grid-cols-4 gap-1.5">
                {SHAPE_PRESETS.map((sh) => (
                  <button
                    key={sh.key}
                    type="button"
                    onClick={() => pickShape(sh.key)}
                    aria-pressed={shapeKey === sh.key}
                    title={sh.label}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border p-1 text-[10px] leading-tight ${shapeKey === sh.key ? "border-az-cart bg-az-cream font-semibold" : "border-az-border hover:border-az-link"}`}
                  >
                    <ShapeIcon pts={presetShape(sh.key)} />
                    {sh.label}
                  </button>
                ))}
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-center text-[10px] leading-tight ${shapeKey === "image" ? "border-az-cart bg-az-cream font-semibold" : "border-dashed border-az-border hover:border-az-link"}`}
                  title="Cut the napkin around any image"
                >
                  {shapeImg ? <ShapeIcon pts={shapeFromImage(shapeImg.canvas, shapeMargin / sizeMm, shapeSmooth / sizeMm)} /> : <ImagePlus className="size-9 p-1.5 text-az-link" aria-hidden="true" />}
                  Your image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      onShapeFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setDrawOpen(true)}
                  title="Draw your own shape"
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-[10px] leading-tight ${shapeKey === "custom" ? "border-az-cart bg-az-cream font-semibold" : "border-dashed border-az-border hover:border-az-link"}`}
                >
                  {customPts ? <ShapeIcon pts={customPts} /> : <PenLine className="size-9 p-1.5 text-az-link" aria-hidden="true" />}
                  Draw shape
                </button>
              </div>
              {shapeKey === "image" && shapeImg && (
                <div className="mt-2 space-y-1.5 rounded-lg bg-az-cream p-2.5 text-xs">
                  <p className="truncate">{shapeImg.keepBg ? "Napkin follows the edge of" : "Cut around"} {shapeImg.file.name}</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={shapeImg.keepBg}
                      onChange={(e) => {
                        const keepBg = e.target.checked;
                        setShapeImg({ ...shapeImg, keepBg, canvas: prepareImage(shapeImg.img, !keepBg) });
                      }}
                      className="accent-[#c8553d]"
                    />
                    Keep the image background (square icons, badges)
                  </label>
                  <label className="block">
                    Margin around the image: {shapeMargin} mm
                    <input type="range" min={0} max={12} value={shapeMargin} onChange={(e) => setShapeMargin(Number(e.target.value))} className="w-full accent-[#c8553d]" />
                  </label>
                  {!shapeImg.keepBg && (
                    <label className="block">
                      Cut: {shapeSmooth <= 2 ? "follows the shape of the image" : shapeSmooth >= 20 ? "very smooth" : "smoother"}
                      <input type="range" min={0} max={30} step={2} value={shapeSmooth} onChange={(e) => setShapeSmooth(Number(e.target.value))} className="w-full accent-[#c8553d]" aria-label="Edge smoothness" />
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={shapeImageOn} onChange={(e) => setShapeImageOn(e.target.checked)} className="accent-[#c8553d]" />
                    Also stitch this image on the napkin
                  </label>
                </div>
              )}
              {shapeKey === "custom" && customPts && (
                <button type="button" onClick={() => setDrawOpen(true)} className="az-link mt-1.5 text-xs">
                  Edit my shape
                </button>
              )}
            </>
          )}
          <p className="az-label mt-3">
            {product === "napkin" ? "Fabric color" : "Color"}: {(colors.find((c) => c.key === color) ?? colors[0]).label}
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColor(c.key)}
                aria-label={c.label}
                aria-pressed={c.key === color}
                className={`size-8 rounded-full border ${c.key === color ? "ring-2 ring-az-cart ring-offset-2" : "border-black/20"}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          {product === "napkin" && (
            <>
              <p className="az-label mt-3">Edge</p>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Edge">
                {edgeOptions.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    role="radio"
                    aria-checked={b.key === border}
                    title={b.note}
                    onClick={() => setBorder(b.key)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] leading-tight ${b.key === border ? "border-az-cart bg-az-cream font-semibold" : "border-az-border hover:border-az-link"}`}
                  >
                    <EdgeIcon kind={b.key} />
                    {b.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-az-muted">{NAPKIN_BORDERS.find((b) => b.key === border)?.note}</p>
              {border !== "none" && (
                <div className="mt-2">
                  <Swatches label="Edge thread color" value={borderThread} onChange={setBorderThread} />
                </div>
              )}
              <p className="mt-3 text-[11px] text-az-muted">Tote bags and hats are coming soon.</p>
            </>
          )}
        </Panel>

        <Panel title="Send to our workshop">
          <p className="text-xs leading-5 text-az-muted">
            Tip: switch to <span className="font-semibold text-az-text">Stitched preview</span> to see your design as real machine stitches. We check every design and
            email you a proof before stitching.
          </p>
          <button type="button" disabled={items.length === 0 && !(product === "napkin" && shapeKey === "image" && shapeImg && shapeImageOn)} onClick={() => setSendOpen(true)} className="az-btn az-btn-cart mt-3 w-full py-2.5">
            <Send className="size-4" aria-hidden="true" /> Send design
          </button>
        </Panel>
      </aside>

      {drawOpen && (
        <DrawShapeDialog
          initial={customPts}
          onClose={() => setDrawOpen(false)}
          onApply={(pts) => {
            setCustomPts(pts);
            pickShape("custom");
            setDrawOpen(false);
          }}
        />
      )}

      {playerOpen && playable.length > 0 && <StitchPlayer designs={playable} fabricHex={colorHex} onClose={() => setPlayerOpen(false)} />}

      {cropItem && cropImg && (
        <CropDialog
          img={cropImg}
          initial={cropItem.crop}
          onClose={() => setCropFor(null)}
          onApply={(crop) => {
            reprocess(cropItem.id, { crop });
            setCropFor(null);
          }}
        />
      )}

      {sendOpen && (
        <SendDialog
          onClose={() => setSendOpen(false)}
          collect={() => ({
            spec: {
              product,
              color,
              items: items.map(({ thumb: _t, ...rest }) => rest),
              ...(product === "napkin"
                ? {
                    material: mat.key,
                    backing: "none",
                    border,
                    borderColor: border === "none" ? undefined : borderThread,
                    shape: shapeKey,
                    ...(shapeKey === "image" ? { shapeMarginMm: shapeMargin, shapeSmoothMm: shapeSmooth, shapeImageOnCoaster: shapeImageOn, shapeKeepBg: shapeImg?.keepBg === true } : {}),
                    sizeMm,
                    // duong cat that (mm) de xuong cat vai / lam file theu vien
                    outline: outlineMm.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number]),
                  }
                : {}),
            },
            files: items.map((it) => ({ id: it.id, original: runtime.current.get(it.id)?.file, placed: runtime.current.get(it.id)!.source })),
            shape: product === "napkin" && shapeKey === "image" && shapeImg ? { original: shapeImg.file, placed: shapeImg.canvas } : null,
            views: snapshots(),
          })}
        />
      )}
    </div>
  );
}

/**
 * Khach tu ve dang khan: bam de them dinh, keo dinh de sua, bam dup vao dinh de xoa.
 * Tra ve da giac chuan hoa (be ngang = 1, tam o 0, y len tren) nhu cac hinh co san.
 */
function DrawShapeDialog({ initial, onClose, onApply }: { initial: Pt[] | null; onClose: () => void; onApply: (pts: Pt[]) => void }) {
  const S = 320; // khung ve, tuong ung be ngang khan
  const toView = (p: Pt): Pt => [S / 2 + p[0] * S * 0.8, S / 2 - p[1] * S * 0.8];
  const [pts, setPts] = useState<Pt[]>(() => (initial ?? []).map(toView));
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const at = (e: { clientX: number; clientY: number }): Pt => {
    const r = svg.current!.getBoundingClientRect();
    const k = S / r.width;
    // bat dinh theo luoi 5 px de canh thang de hon
    const snap = (v: number) => Math.min(S, Math.max(0, Math.round(v / 5) * 5));
    return [snap((e.clientX - r.left) * k), snap((e.clientY - r.top) * k)];
  };
  const addPoint = (e: React.PointerEvent) => setPts((l) => [...l, at(e)]);
  const dragPoint = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (ev: PointerEvent) => setPts((l) => l.map((p, j) => (j === i ? at(ev) : p)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const apply = () => onApply(normalize(pts.map(([x, y]) => [x, -y] as Pt)));
  const grid = Array.from({ length: 9 }, (_, i) => ((i + 1) * S) / 10);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="draw-h">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-5">
        <h2 id="draw-h" className="font-display text-xl font-semibold">
          Draw your napkin shape
        </h2>
        <p className="mt-1 text-xs text-az-muted">Click to add corners around the shape. Drag a corner to move it, double-click it to remove it. At least 3 corners.</p>
        <svg
          ref={svg}
          viewBox={`0 0 ${S} ${S}`}
          className="mt-3 aspect-square w-full touch-none cursor-crosshair rounded-xl border border-az-border bg-az-cream select-none"
          onPointerDown={addPoint}
        >
          {grid.map((g) => (
            <g key={g} stroke="#000" strokeOpacity={g === S / 2 ? 0.12 : 0.05}>
              <line x1={g} y1={0} x2={g} y2={S} />
              <line x1={0} y1={g} x2={S} y2={g} />
            </g>
          ))}
          {pts.length > 2 && <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="#e6e1d6" stroke="#6b645a" strokeWidth={1.5} />}
          {pts.length === 2 && <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#6b645a" strokeWidth={1.5} />}
          {pts.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={6}
              fill={i === 0 ? "#c8553d" : "#fff"}
              stroke="#c8553d"
              strokeWidth={2}
              className="cursor-move"
              onPointerDown={dragPoint(i)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setPts((l) => l.filter((_, j) => j !== i));
              }}
            />
          ))}
        </svg>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setPts((l) => l.slice(0, -1))} disabled={!pts.length} className="az-btn az-btn-secondary">
            <Undo2 className="size-4" aria-hidden="true" /> Undo
          </button>
          <button type="button" onClick={() => setPts([])} disabled={!pts.length} className="az-btn az-btn-secondary mr-auto">
            Clear
          </button>
          <button type="button" onClick={onClose} className="az-btn az-btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={apply} disabled={pts.length < 3} className="az-btn az-btn-cart">
            Use this shape
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hang o mau chi. */
function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {THREAD_COLORS.map((c) => (
        <button
          key={c.key}
          type="button"
          role="radio"
          aria-checked={c.key === value}
          aria-label={c.label}
          title={c.label}
          onClick={() => onChange(c.key)}
          className={`size-6 rounded-full border ${c.key === value ? "ring-2 ring-az-cart ring-offset-1" : "border-black/20"}`}
          style={{ background: c.hex }}
        />
      ))}
    </div>
  );
}

/** Hinh minh hoa kieu mep khan. */
function EdgeIcon({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
      {kind === "scallop" ? (
        <path d="M5 21 V6 a2.5 2.5 0 0 1 5 0 a2.5 2.5 0 0 1 5 0 a2.5 2.5 0 0 1 5 0 a2.5 2.5 0 0 1 5 0 a2.5 2.5 0 0 1 5 0 a2.5 2.5 0 0 1 5 0 V21 Z" fill="#e6e1d6" stroke="#6b645a" strokeWidth={1} />
      ) : (
        <rect x={5} y={4} width={30} height={17} fill="#e6e1d6" stroke="#6b645a" strokeWidth={1} />
      )}
      {kind === "none" && <rect x={7.5} y={6.5} width={25} height={12} fill="none" stroke="#6b645a" strokeOpacity={0.35} strokeWidth={0.6} />}
      {kind === "running" && <rect x={9} y={8} width={22} height={9} fill="none" stroke="#c8553d" strokeWidth={0.9} strokeDasharray="2 1.4" />}
    </svg>
  );
}

/**
 * Cat anh: khung chon keo duoc tren anh goc (keo trong khung de di chuyen, keo 4 goc de doi co).
 * Tra ve vung [x, y, w, h] theo ti le 0-1 cua anh goc (undefined = ca anh).
 */
function CropDialog({
  img,
  initial,
  onClose,
  onApply,
}: {
  img: HTMLImageElement;
  initial?: [number, number, number, number];
  onClose: () => void;
  onApply: (crop: [number, number, number, number] | undefined) => void;
}) {
  const [box, setBox] = useState<[number, number, number, number]>(initial ?? [0, 0, 1, 1]);
  const frame = useRef<HTMLDivElement>(null);
  const src = useMemo(() => {
    const c = document.createElement("canvas");
    const s = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }, [img]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  /** mode: "move" hoac goc "nw" | "ne" | "se" | "sw" */
  const start = (mode: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = frame.current!.getBoundingClientRect();
    const b0 = box;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const MIN = 0.04;
    const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / rect.width;
      const dy = (ev.clientY - y0) / rect.height;
      let [x, y, w, h] = b0;
      if (mode === "move") {
        x = clamp(x + dx, 0, 1 - w);
        y = clamp(y + dy, 0, 1 - h);
      } else {
        let x1 = x + w;
        let y1 = y + h;
        if (mode.includes("w")) x = clamp(x + dx, 0, x1 - MIN);
        if (mode.includes("e")) x1 = clamp(x1 + dx, x + MIN, 1);
        if (mode.includes("n")) y = clamp(y + dy, 0, y1 - MIN);
        if (mode.includes("s")) y1 = clamp(y1 + dy, y + MIN, 1);
        w = x1 - x;
        h = y1 - y;
      }
      setBox([x, y, w, h]);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const [x, y, w, h] = box;
  const pct = (v: number) => `${v * 100}%`;
  const full = x < 0.001 && y < 0.001 && w > 0.999 && h > 0.999;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="crop-h">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl sm:p-5">
        <h2 id="crop-h" className="font-display text-xl font-semibold">
          Crop image
        </h2>
        <p className="mt-1 text-xs text-az-muted">Drag the box over the part you want stitched; drag its corners to resize.</p>
        <div className="mt-3 grid place-items-center rounded-xl bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3">
          <div ref={frame} className="relative inline-block touch-none select-none overflow-hidden">
            <img src={src} alt="" draggable={false} className="block max-h-[60vh] max-w-full" />
            <div
              className="absolute cursor-move outline-2 outline-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] outline"
              style={{ left: pct(x), top: pct(y), width: pct(w), height: pct(h) }}
              onPointerDown={start("move")}
            >
              {(
                [
                  ["nw", "left-0 top-0 cursor-nwse-resize"],
                  ["ne", "right-0 top-0 cursor-nesw-resize"],
                  ["se", "right-0 bottom-0 cursor-nwse-resize"],
                  ["sw", "left-0 bottom-0 cursor-nesw-resize"],
                ] as const
              ).map(([k, cls]) => (
                <span key={k} onPointerDown={start(k)} className={`absolute size-4 border-2 border-az-cart bg-white ${cls}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setBox([0, 0, 1, 1])} className="az-btn az-btn-secondary mr-auto">
            Reset
          </button>
          <button type="button" onClick={onClose} className="az-btn az-btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(full ? undefined : (box.map((v) => Math.round(v * 10000) / 10000) as [number, number, number, number]))}
            className="az-btn az-btn-cart"
          >
            <Crop className="size-4" aria-hidden="true" /> Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}

/** Anh kin (khong trong suot) va 4 goc cung mot mau dam (khong trang/xam nhat) -> icon/badge co nen mau, nen giu nen. */
function coloredSquareBg(img: HTMLImageElement): boolean {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  const px = (x: number, y: number) => Array.from(d.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4));
  const corners = [px(1, 1), px(62, 1), px(1, 62), px(62, 62)];
  if (corners.some((p) => p[3] < 250)) return false;
  const [r, g, b] = corners[0];
  if (corners.some((p) => Math.abs(p[0] - r) + Math.abs(p[1] - g) + Math.abs(p[2] - b) > 30)) return false;
  return (r * 3 + g * 6 + b) / 10 < 200;
}

function zoneLabel(product: Product, key: string) {
  if (product === "napkin") return "Napkin";
  return ((product === "tshirt" ? TSHIRT_ZONES : CAP_ZONES).find((z) => z.key === key)?.label ?? key) + "";
}

/** Tam + 4 goc cua hinh (da xoay) co nam trong duong cat (outline lech offsetX mm) khong. */
function insideOutline(it: DesignItem, outline: Pt[], offsetX = 0) {
  const [x, , z] = it.point;
  const a = (-it.rotationDeg * Math.PI) / 180;
  const hw = it.widthMm / 2;
  const hh = it.heightMm / 2;
  const pts: Pt[] = [[0, 0], [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => [x - offsetX + dx * Math.cos(a) - dy * Math.sin(a), -z + dx * Math.sin(a) + dy * Math.cos(a)]);
  return pts.every((p) => pointInPolygon(p, outline));
}

function warnings(product: Product, it: DesignItem, outlineMm: Pt[]): string[] {
  const out: string[] = [];
  if (product === "tshirt") {
    const zone = TSHIRT_ZONES.find((z) => z.key === it.zone) ?? TSHIRT_ZONES[0];
    if (it.widthMm > zone.maxW || it.heightMm > zone.maxH) out.push(`${zone.label} embroidery fits up to ${zone.maxW / 10} × ${zone.maxH / 10} cm.`);
    if (!insideOutline(it, teeOutline(zone.key as "front" | "back"), TEE_X[zone.key])) out.push("Part of the design goes past the edge of the shirt.");
    if (it.kind === "text" && it.heightMm < 6) out.push("Text under 6 mm tall is hard to stitch clearly.");
    return out;
  }
  if (product === "napkin") {
    // khan: tam + 4 goc cua hinh (da xoay) phai nam trong duong cat
    if (!insideOutline(it, outlineMm)) out.push("Part of the design goes past the edge of the napkin.");
    if (it.kind === "text" && it.heightMm < 6) out.push("Text under 6 mm tall is hard to stitch clearly.");
    return out;
  }
  const zone = CAP_ZONES.find((z) => z.key === it.zone)!;
  if (it.widthMm > zone.maxW || it.heightMm > zone.maxH) out.push(`${zone.label} fits up to ${zone.maxW} × ${zone.maxH} mm.`);
  const y = it.point[1];
  if (y - it.heightMm / 2 < 8) out.push("Too close to the bottom edge of the hat.");
  if (y + it.heightMm / 2 > CAP.height - 12) out.push("Too close to the top button.");
  if (it.zone === "back" && y - it.heightMm / 2 < CAP.openingHeight + 4) out.push("Overlaps the strap opening at the back.");
  if (it.kind === "text" && it.heightMm < 6) out.push("Text under 6 mm tall is hard to stitch clearly.");
  return out;
}

/** Hinh thu nho cua mot dang lot coc (da giac chuan hoa, y len tren). */
function ShapeIcon({ pts }: { pts: Pt[] }) {
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${(x * 34 + 20).toFixed(1)},${(20 - y * 34).toFixed(1)}`).join(" ") + "Z";
  return (
    <svg viewBox="0 0 40 40" className="size-9" aria-hidden="true">
      <path d={d} fill="#e6e1d6" stroke="#6b645a" strokeWidth={1.2} />
    </svg>
  );
}

/** Tong so mui / mau chi / thoi gian may cua cac hinh dang xem truoc. */
type StitchRuns = { unit_mm: number; bounds: [number, number, number, number]; blocks: { hex: string; runs: number[][] }[] };

/**
 * Phat lai tung mui theu theo dung thu tu trong file may (tu Ink/Stitch): moi mau chi lan luot,
 * kim di tung doan, nhay/cat chi thi nhac kim. Ve tang dan len canvas mau vai.
 */
function StitchPlayer({ designs, fabricHex, onClose }: { designs: { key: string; label: string; token: string }[]; fabricHex: string; onClose: () => void }) {
  const [pick, setPick] = useState(0);
  const [data, setData] = useState<StitchRuns | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [pos, setPos] = useState({ done: 0, block: 0 });
  const board = useRef<HTMLCanvasElement>(null);
  const needle = useRef<HTMLCanvasElement>(null);
  const state = useRef({ block: 0, run: 0, point: 1, done: 0 });
  const design = designs[Math.min(pick, designs.length - 1)];

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetch(`/api/design/stitch-preview?token=${encodeURIComponent(design.token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not load the stitches.");
        return r.json() as Promise<StitchRuns>;
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the stitches."));
    return () => {
      alive = false;
    };
  }, [design.token]);

  const total = useMemo(() => (data ? data.blocks.reduce((t, b) => t + b.runs.reduce((u, r) => u + r.length / 2 - 1, 0), 0) : 0), [data]);

  // khung ve vua thiet ke, le 4 mm; be ngang soi chi ~0.42 mm
  const geom = useMemo(() => {
    if (!data) return null;
    const [x0, y0, x1, y1] = data.bounds;
    const pad = 4 / data.unit_mm;
    const W = 720;
    const k = W / (x1 - x0 + 2 * pad);
    const H = Math.round((y1 - y0 + 2 * pad) * k);
    return { W, H, k, ox: x0 - pad, oy: y0 - pad, line: Math.max(1, (0.42 / data.unit_mm) * k) };
  }, [data]);

  const restart = useCallback(() => {
    state.current = { block: 0, run: 0, point: 1, done: 0 };
    const c = board.current;
    if (c) {
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = fabricHex;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    needle.current?.getContext("2d")?.clearRect(0, 0, needle.current.width, needle.current.height);
    setPos({ done: 0, block: 0 });
    setPlaying(true);
  }, [fabricHex]);

  useEffect(() => {
    if (data && geom) restart();
  }, [data, geom, restart]);

  useEffect(() => {
    if (!playing || !data || !geom) return;
    let raf = 0;
    const tick = () => {
      const ctx = board.current?.getContext("2d");
      const nctx = needle.current?.getContext("2d");
      if (!ctx || !nctx) return;
      const st = state.current;
      // 1x ~ 150 mui/giay de xem duoc (may that ~12-15 mui/giay)
      let budget = Math.max(1, Math.round((speed * 150) / 60));
      ctx.lineCap = "round";
      let last: [number, number] | null = null;
      while (budget > 0 && st.block < data.blocks.length) {
        const b = data.blocks[st.block];
        const run = b.runs[st.run];
        if (!run) {
          st.block++;
          st.run = 0;
          st.point = 1;
          continue;
        }
        if (st.point * 2 + 1 >= run.length) {
          st.run++;
          st.point = 1;
          continue;
        }
        const i = st.point;
        const ax = (run[i * 2 - 2] - geom.ox) * geom.k;
        const ay = (run[i * 2 - 1] - geom.oy) * geom.k;
        const bx = (run[i * 2] - geom.ox) * geom.k;
        const by = (run[i * 2 + 1] - geom.oy) * geom.k;
        // soi chi: vien toi mo + loi mau chi de nhin ra tung mui
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = "rgba(0,0,0,0.28)";
        ctx.lineWidth = geom.line;
        ctx.stroke();
        ctx.strokeStyle = b.hex;
        ctx.lineWidth = Math.max(0.7, geom.line * 0.7);
        ctx.stroke();
        last = [bx, by];
        st.point++;
        st.done++;
        budget--;
      }
      nctx.clearRect(0, 0, geom.W, geom.H);
      if (last && st.block < data.blocks.length) {
        nctx.fillStyle = "#c8553d";
        nctx.beginPath();
        nctx.arc(last[0], last[1], 4, 0, Math.PI * 2);
        nctx.fill();
      }
      setPos({ done: st.done, block: Math.min(st.block, data.blocks.length - 1) });
      if (st.block >= data.blocks.length) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, data, geom, speed]);

  const finished = !!data && pos.done >= total;
  const block = data?.blocks[pos.block];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="player-h">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white p-4 shadow-xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="player-h" className="font-display text-xl font-semibold">
              Watch it stitch
            </h2>
            <p className="mt-0.5 text-xs text-az-muted">The real stitch order from the machine file, one thread color at a time.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm hover:bg-az-bg" aria-label="Close">
            ✕
          </button>
        </div>
        {designs.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Design">
            {designs.map((d, i) => (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={i === pick}
                onClick={() => setPick(i)}
                className={`max-w-48 truncate rounded-full px-3 py-1 text-xs font-medium ${i === pick ? "bg-az-header text-white" : "bg-az-bg hover:bg-az-cream"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 grid min-h-0 flex-1 place-items-center overflow-hidden rounded-xl border border-az-border bg-az-bg p-2">
          {error ? (
            <p className="p-6 text-sm text-az-deal">{error}</p>
          ) : !geom ? (
            <p className="inline-flex items-center gap-2 p-6 text-sm text-az-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading stitches...
            </p>
          ) : (
            <div className="relative w-full" style={{ aspectRatio: `${geom.W} / ${geom.H}`, maxWidth: `calc(58vh * ${geom.W / geom.H})` }}>
              <canvas ref={board} width={geom.W} height={geom.H} className="absolute inset-0 h-full w-full rounded-lg" />
              <canvas ref={needle} width={geom.W} height={geom.H} className="absolute inset-0 h-full w-full" aria-hidden="true" />
            </div>
          )}
        </div>
        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <button
              type="button"
              onClick={() => (finished ? restart() : setPlaying((p) => !p))}
              className="inline-flex items-center gap-1.5 rounded-full bg-az-header px-3 py-1.5 font-semibold text-white hover:opacity-90"
            >
              {playing ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
              {playing ? "Pause" : finished ? "Replay" : "Play"}
            </button>
            <div className="flex rounded-full bg-az-bg p-0.5" role="group" aria-label="Speed">
              {[1, 4, 16, 64].map((v) => (
                <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)} className={`rounded-full px-2.5 py-1 font-medium ${speed === v ? "bg-white shadow-sm" : ""}`}>
                  {v}×
                </button>
              ))}
            </div>
            {block && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-full border border-black/20" style={{ background: block.hex }} aria-hidden="true" />
                Thread {pos.block + 1} of {data.blocks.length}
              </span>
            )}
            <span className="tabular-nums text-az-muted">
              {pos.done.toLocaleString("en-US")} / {total.toLocaleString("en-US")} stitches
            </span>
            <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-az-bg" role="progressbar" aria-label="Stitching progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={pos.done}>
              <div className="h-full bg-az-cart" style={{ width: `${total ? (pos.done / total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StitchTotals({ reports, hasImage }: { reports: StitchSummary[]; hasImage?: boolean }) {
  if (!reports.length) return <span>Stitch preview ready.</span>;
  const stitches = reports.reduce((t, r) => t + (r.stitches || 0), 0);
  const minutes = reports.reduce((t, r) => t + (r.est_minutes || 0), 0);
  const colors = Math.max(...reports.map((r) => r.colors || 0));
  return (
    <span>
      About {stitches.toLocaleString("en-US")} stitches · up to {colors} thread colors · ~{Math.max(1, Math.round(minutes))} min on the machine
      {hasImage ? (
        // anh khach: may tu so hoa chi gan dung; xuong so hoa tay khi nhan don
        <span className="mt-1 block rounded-md bg-az-cream px-2 py-1 text-az-text">
          <span className="font-semibold">Rough preview.</span> When you order, our workshop digitizes images by hand, so the real embroidery is cleaner than this.
        </span>
      ) : (
        <span className="mt-0.5 block text-az-muted">Very thin lines are stitched as a fine running stitch. Compare with Original; if something is missing, make it bigger or pick a bolder font.</span>
      )}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-az-border bg-white p-4">
      <h2 className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-az-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

type Collected = {
  spec: DesignSpec;
  files: { id: string; original?: File; placed: HTMLCanvasElement }[];
  shape?: { original: File; placed: HTMLCanvasElement } | null;
  views: Record<string, string>;
};

function SendDialog({ onClose, collect }: { onClose: () => void; collect: () => Collected }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const c = collect();
    form.set("spec", JSON.stringify(c.spec));
    for (const f of c.files) {
      if (f.original) form.set(`original-${f.id}`, f.original);
      const blob = await new Promise<Blob | null>((res) => f.placed.toBlob(res, "image/png"));
      if (blob) form.set(`placed-${f.id}`, blob, `${f.id}.png`);
    }
    if (c.shape) {
      form.set("shape-original", c.shape.original);
      const blob = await new Promise<Blob | null>((res) => c.shape!.placed.toBlob(res, "image/png"));
      if (blob) form.set("shape-placed", blob, "shape.png");
    }
    for (const [k, v] of Object.entries(c.views)) form.set(`view-${k}`, await (await fetch(v)).blob(), `${k}.png`);
    try {
      const res = await fetch("/api/design/submit", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send your design.");
      setDone(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your design.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="send-h">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        {done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto size-10 text-az-success" aria-hidden="true" />
            <h2 id="send-h" className="mt-2 font-display text-2xl font-semibold">
              Design sent!
            </h2>
            <p className="mt-2 text-sm">
              Your design code is <span className="font-mono font-bold">{done}</span>. Our workshop will review it, prepare the stitch file and email you a proof
              and price.
            </p>
            <button type="button" onClick={onClose} className="az-btn az-btn-buy mt-4">
              Back to designer
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h2 id="send-h" className="font-display text-2xl font-semibold">
              Send design to workshop
            </h2>
            <p className="text-sm text-az-muted">We reply within 1–2 business days with a stitched proof and price. No payment now.</p>
            <div>
              <label htmlFor="s-name" className="az-label">
                Name
              </label>
              <input id="s-name" name="name" required maxLength={120} className="az-input" autoComplete="name" />
            </div>
            <div>
              <label htmlFor="s-email" className="az-label">
                Email
              </label>
              <input id="s-email" name="email" type="email" required maxLength={190} className="az-input" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="s-qty" className="az-label">
                Quantity
              </label>
              <input id="s-qty" name="quantity" type="number" min={1} max={500} defaultValue={1} className="az-input w-28" />
            </div>
            <div>
              <label htmlFor="s-notes" className="az-label">
                Notes <span className="font-normal text-az-muted">(optional)</span>
              </label>
              <textarea id="s-notes" name="notes" rows={3} maxLength={1000} className="az-input" placeholder="Thread colors, deadline, anything we should know" />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-[#fbe9e5] px-3 py-2 text-sm text-az-deal">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="az-btn az-btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="az-btn az-btn-cart">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />} Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
