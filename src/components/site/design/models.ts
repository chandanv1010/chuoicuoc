import * as THREE from "three";

/**
 * Mo hinh 3D cho trang Design, don vi mm (de vi tri/kich thuoc hinh theu la mm that).
 * Mu: dad hat 6 manh (unstructured, low profile) dung theo so do pho bien: vong dau ~58 cm, cao ~90 mm,
 * luoi trai ~70 mm. Truc: y len tren, z huong ra phia truoc (mat truoc mu), x sang trai nguoi doi.
 * Khi co phoi that da do, chi can chinh cac hang so trong CAP.
 */
export const CAP = {
  halfWidth: 86, // nua be ngang (trai-phai)
  halfLength: 98, // nua be dai (truoc-sau)
  height: 88,
  topShift: -14, // dinh mu lui ve sau
  shape: 2.45, // >2: than thang hon, dinh phang hon (superellipse); dad hat mem nen gan 2
  brimLength: 80,
  brimPitchDeg: 16,
  brimCurveRadius: 92, // luoi trai uon cong ngang (kieu "taco") — ban kinh cung, nho = cong nhieu
  brimSpanDeg: 80, // luoi trai om quanh vanh tu -74 do den +74 do
  brimThickness: 2.4,
  openingHalfWidth: 36,
  openingHeight: 44,
};

const SEGS_PHI = 144;
const SEGS_T = 48;

/** Diem tren be mat chop mu theo goc phuong vi phi (0 = chinh giua mat truoc) va tham so do cao t (0 = vanh, 1 = dinh). */
export function crownPoint(phi: number, t: number, out = new THREE.Vector3()) {
  const th = (t * Math.PI) / 2;
  const e = 2 / CAP.shape;
  const r = Math.pow(Math.cos(th), e);
  const y = CAP.height * Math.pow(Math.sin(th), e);
  const s = Math.sin(th);
  return out.set(Math.sin(phi) * CAP.halfWidth * r, y, Math.cos(phi) * CAP.halfLength * r + CAP.topShift * s);
}

/** Do vong xuong cua luoi trai tai hoanh do x (cung tron ban kinh brimCurveRadius). */
export function brimBend(x: number) {
  const R = CAP.brimCurveRadius;
  return R - Math.sqrt(Math.max(R * R * 0.05, R * R - x * x));
}

/** Diem + phap tuyen huong ra ngoai tai (phi, t) — dung de dat hinh mac dinh cho tung vi tri. */
export function capSurface(phi: number, t: number) {
  const point = crownPoint(phi, t);
  const a = crownPoint(phi + 0.002, t).sub(point);
  const b = crownPoint(phi, Math.min(1, t + 0.002)).sub(point);
  const normal = new THREE.Vector3().crossVectors(a, b).normalize();
  if (normal.dot(new THREE.Vector3(point.x, 0, point.z)) < 0) normal.negate();
  return { point, normal };
}

/** Vung ho phia sau (cho quai dieu chinh). */
function inOpening(phi: number, y: number) {
  const dphi = Math.abs(((phi + Math.PI) % (2 * Math.PI)) - Math.PI) - Math.PI; // 0 tai chinh sau
  const arc = Math.abs(dphi) * CAP.halfLength;
  if (y > CAP.openingHeight) return false;
  const w = CAP.openingHalfWidth * Math.sqrt(1 - (y / CAP.openingHeight) ** 2);
  return arc < w;
}

export function buildCrownGeometry(fabricMm: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const perim = Math.PI * (CAP.halfWidth + CAP.halfLength);
  for (let j = 0; j <= SEGS_T; j++) {
    const t = j / SEGS_T;
    for (let i = 0; i <= SEGS_PHI; i++) {
      const phi = (i / SEGS_PHI) * Math.PI * 2;
      crownPoint(phi, t, p);
      pos.push(p.x, p.y, p.z);
      // vai lat theo mm that: u theo chu vi, v theo do cao
      uv.push(((i / SEGS_PHI) * perim) / fabricMm, (t * CAP.height * 1.25) / fabricMm);
    }
  }
  const row = SEGS_PHI + 1;
  for (let j = 0; j < SEGS_T; j++) {
    for (let i = 0; i < SEGS_PHI; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      const phi = ((i + 0.5) / SEGS_PHI) * Math.PI * 2;
      const y = (pos[a * 3 + 1] + pos[c * 3 + 1]) / 2;
      if (inOpening(phi, y)) continue;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Luoi trai: cong xuong hai ben, chuc xuong theo brimPitchDeg, mep ngoai bo tron. */
export function buildBrimGeometry(fabricMm: number) {
  const NU = 60;
  const NV = 14;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const base = new THREE.Vector3();
  const pitch = (CAP.brimPitchDeg * Math.PI) / 180;
  const span = (CAP.brimSpanDeg * Math.PI) / 180;
  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    for (let i = 0; i <= NU; i++) {
      const u = (i / NU) * 2 - 1;
      const phi = u * span;
      crownPoint(phi, 0, base);
      // huong: tron giua phap tuyen elip day mu va huong thang truoc -> luoi hinh chu D chia ra truoc
      const ex = Math.sin(phi) / CAP.halfWidth;
      const ez = Math.cos(phi) / CAP.halfLength;
      const el = Math.hypot(ex, ez);
      const nx = (ex / el) * 0.45;
      const nz = (ez / el) * 0.45 + 0.55;
      const nl = Math.hypot(nx, nz);
      const len = CAP.brimLength * Math.pow(Math.max(0, 1 - u * u), 0.45) * v;
      const x = base.x + (nx / nl) * len;
      const z = base.z + (nz / nl) * len;
      // luoi cong ngang nhu mot cung tron (cung cong voi mep chop) + chuc xuong phia truoc
      const drop = Math.tan(pitch) * len + (brimBend(x) - brimBend(base.x));
      pos.push(x, base.y - drop + 0.3, z);
      uv.push((x + 100) / fabricMm, (z - 60) / fabricMm);
    }
  }
  const row = NU + 1;
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * row + i;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  // mat duoi (lech xuong theo do day) + dai vien mep ngoai -> luoi trai co do day nhu that
  const n0 = pos.length / 3;
  for (let k = 0; k < n0; k++) {
    pos.push(pos[k * 3], pos[k * 3 + 1] - CAP.brimThickness, pos[k * 3 + 2]);
    uv.push(uv[k * 2], uv[k * 2 + 1]);
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = n0 + j * row + i;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const edge = NV * row;
  for (let i = 0; i < NU; i++) {
    const a = edge + i;
    idx.push(a, a + 1 + n0, a + 1, a, a + n0, a + 1 + n0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, rowPoints: (v: number) => Array.from({ length: NU + 1 }, (_, i) => new THREE.Vector3(pos[(Math.round(v * NV) * row + i) * 3], pos[(Math.round(v * NV) * row + i) * 3 + 1] + 0.3, pos[(Math.round(v * NV) * row + i) * 3 + 2])) };
}

function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 2), radius, 6, false), mat);
}

/** Lap rap mu: chop (mesh nhan decal), luoi trai, duong may, nut dinh, lo thoang, quai sau. */
export function buildCap(fabric: THREE.Texture, fabricMm: number) {
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ map: fabric, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const crown = new THREE.Mesh(buildCrownGeometry(fabricMm), cloth);
  crown.name = "crown";
  group.add(crown);

  const brim = buildBrimGeometry(fabricMm);
  const brimMesh = new THREE.Mesh(brim.geometry, cloth);
  brimMesh.name = "brim";
  group.add(brimMesh);

  // duong may: gan noi cung vai (bong do cua go may lam lo duong may, giong mu that) + chi may mau toi hon
  const seamMat = cloth;
  const stitchMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.28, roughness: 1 });
  const p = new THREE.Vector3();
  // 6 duong may doc (dad hat co duong may giua mat truoc)
  for (let k = 0; k < 6; k++) {
    const phi = (k / 6) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 30; j++) {
      const t = j / 30;
      crownPoint(phi, t, p);
      if (inOpening(phi, p.y)) continue;
      pts.push(p.clone().multiplyScalar(1.003));
    }
    if (pts.length > 2) group.add(tube(pts, 0.75, seamMat));
  }
  // cac hang chi chay song song mep luoi trai (mu that co 6-8 hang)
  for (const v of [0.58, 0.66, 0.74, 0.82, 0.9]) group.add(tube(brim.rowPoints(v), 0.22, stitchMat));

  // nut dinh
  const button = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 12), cloth);
  button.scale.set(1, 0.38, 1);
  crownPoint(0, 1, p);
  button.position.copy(p).add(new THREE.Vector3(0, 0.5, 0));
  group.add(button);

  // lo thoang khi tren 6 manh
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  for (let k = 0; k < 6; k++) {
    const phi = ((k + 0.5) / 6) * Math.PI * 2;
    const t = 0.72;
    const a = crownPoint(phi, t, new THREE.Vector3());
    const b = crownPoint(phi, t + 0.01, new THREE.Vector3());
    const c = crownPoint(phi + 0.01, t, new THREE.Vector3());
    const n = new THREE.Vector3().crossVectors(c.clone().sub(a), b.clone().sub(a)).normalize();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.9, 8, 20), eyeMat);
    ring.position.copy(a).addScaledVector(n, 0.3);
    ring.lookAt(a.clone().add(n));
    group.add(ring);
  }

  // quai dieu chinh + khoa kim loai phia sau
  const strapPts: THREE.Vector3[] = [];
  for (let k = -12; k <= 12; k++) {
    const phi = Math.PI + (k / 12) * ((CAP.openingHalfWidth + 6) / CAP.halfLength);
    strapPts.push(crownPoint(phi, 0.08, new THREE.Vector3()).multiplyScalar(1.01));
  }
  const strap = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strapPts), 40, 5, 4, false),
    cloth,
  );
  strap.scale.y = 0.5;
  strap.position.y = 3;
  group.add(strap);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 2.5), new THREE.MeshStandardMaterial({ color: 0xb9b3a6, metalness: 0.85, roughness: 0.35 }));
  crownPoint(Math.PI + 0.12, 0.1, p);
  buckle.position.copy(p).multiplyScalar(1.03);
  buckle.position.y = 8;
  buckle.lookAt(new THREE.Vector3(0, 8, -400));
  group.add(buckle);

  group.position.y = -CAP.height * 0.45;
  return { group, crown, brim: brimMesh, material: cloth };
}

/**
 * Lot coc theo hinh bat ky: da giac duong cat (mm, y len tren) dun day 2.5 mm.
 * Mat tren nhan texture ve trong khung bbox cua hinh (xem coasterCanvas); nam phang tren mat ban (y len).
 */
export function buildCoaster(outlineMm: [number, number][], texture: THREE.Texture, edgeColor: string) {
  const shape = new THREE.Shape(outlineMm.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 2, curveSegments: 1 });
  // uv mat tren = toa do mm -> dua ve [0,1] theo bbox de khop canvas texture
  const xs = outlineMm.map((p) => p[0]);
  const ys = outlineMm.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1;
  const h = Math.max(...ys) - minY || 1;
  texture.repeat.set(1 / w, 1 / h);
  texture.offset.set(-minX / w, -minY / h);
  geo.rotateX(-Math.PI / 2); // mat tren (z = depth) huong len y
  geo.translate(0, -1.5, 0);
  const top = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });
  const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(edgeColor).multiplyScalar(0.85), roughness: 1 });
  const mesh = new THREE.Mesh(geo, [top, side]);
  mesh.name = "coaster";
  const group = new THREE.Group();
  group.add(mesh);
  return { group, surface: mesh };
}

/** Khan napkin 150 x 150 mm, phang, vien ve len texture. */
export function buildNapkin(texture: THREE.Texture) {
  const g = new THREE.PlaneGeometry(150, 150, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, side: THREE.DoubleSide }));
  mesh.name = "napkin";
  const group = new THREE.Group();
  group.add(mesh);
  return { group, surface: mesh };
}

/** Xac dinh vi tri theu tren mu tu toa do diem (trong he toa do cua chop mu). */
export function capZoneAt(local: THREE.Vector3): { key: string; y: number } {
  const phi = Math.atan2(local.x, local.z - CAP.topShift * 0.5); // 0 = truoc
  const deg = (phi * 180) / Math.PI;
  const a = Math.abs(deg);
  const key = a < 38 ? "front" : a > 142 ? "back" : deg > 0 ? "left" : "right";
  return { key, y: local.y };
}

/**
 * Mo hinh mu that (.glb) do nguoi lam 3D dung hoac quet 3D tu phoi that (Polycam, Luma...).
 * Quy uoc file: mat truoc huong +z, truc y huong len. Trang tu doi ve mm (be ngang chop = 2*halfWidth),
 * dat day chop o y = 0, va to vai theo mau chon. Mesh nhan hinh: ten chua "crown", khong thi mesh lon nhat
 * (bo qua luoi trai/nut/quai theo ten).
 */
export const CAP_MODEL_URL = "/design/models/cap.glb";
let glbCache: Promise<THREE.Group | null> | null = null;

export async function loadCapModel(fabric: THREE.Texture) {
  glbCache ??= import("three/examples/jsm/loaders/GLTFLoader.js")
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(CAP_MODEL_URL))
    .then((g) => g.scene)
    .catch(() => null);
  const template = await glbCache;
  if (!template) return null;
  const root = template.clone(true);
  let crown: THREE.Mesh | null = null;
  let best = -1;
  const skip = /brim|visor|peak|bill|button|strap|buckle|eyelet/i;
  const material = new THREE.MeshStandardMaterial({ map: fabric, roughness: 0.9, side: THREE.DoubleSide });
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const old = m.material as THREE.MeshStandardMaterial;
    const mat = material.clone();
    if (old?.normalMap) mat.normalMap = old.normalMap;
    if (!m.geometry.getAttribute("uv")) mat.map = null;
    m.material = mat;
    m.geometry.computeBoundingBox();
    const s = m.geometry.boundingBox!.getSize(new THREE.Vector3());
    const vol = s.x * s.y * s.z;
    if (/crown/i.test(m.name)) best = Infinity, (crown = m);
    else if (!skip.test(m.name) && vol > best) (best = vol), (crown = m);
  });
  if (!crown) return null;
  root.updateMatrixWorld(true);
  const cb = new THREE.Box3().setFromObject(crown);
  const k = (2 * CAP.halfWidth) / cb.getSize(new THREE.Vector3()).x;
  root.scale.multiplyScalar(k);
  root.updateMatrixWorld(true);
  const cb2 = new THREE.Box3().setFromObject(crown);
  const c = cb2.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(c.x, cb2.min.y, c.z));
  const group = new THREE.Group();
  group.add(root);
  group.position.y = -cb2.getSize(new THREE.Vector3()).y * 0.45;
  return { group, crown: crown as THREE.Mesh, material };
}
