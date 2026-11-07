/**
 * Hinh dang lot coc (khong chi hinh vuong): hinh co san + hinh lay tu anh bat ky cua khach (cat theo duong vien anh).
 * Moi hinh la mot da giac kin, chuan hoa be ngang = 1, tam bounding box o (0,0), truc y huong len.
 * Nhan voi kich thuoc (mm) de ra duong cat that gui xuong xuong.
 */

export type Pt = [number, number];

export const SHAPE_PRESETS: { key: string; label: string }[] = [
  { key: "square", label: "Square" },
  { key: "circle", label: "Round" },
  { key: "tree", label: "Christmas tree" },
  { key: "star", label: "Star" },
  { key: "ornament", label: "Ornament" },
  { key: "stocking", label: "Stocking" },
  { key: "heart", label: "Heart" },
];

const N = 120;
const range = (n: number) => Array.from({ length: n }, (_, i) => i / n);

function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 24): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / steps;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

/** Lam tron goc da giac (Chaikin 2 lan) — duong cat mem nhu lot coc that. */
function smooth(pts: Pt[], iterations = 2): Pt[] {
  let p = pts;
  for (let k = 0; k < iterations; k++) {
    const out: Pt[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

const RAW: Record<string, () => Pt[]> = {
  square: () => {
    const r = 0.07;
    const h = 0.5 - r;
    return [...arc(h, h, r, 0, Math.PI / 2, 8), ...arc(-h, h, r, Math.PI / 2, Math.PI, 8), ...arc(-h, -h, r, Math.PI, 1.5 * Math.PI, 8), ...arc(h, -h, r, 1.5 * Math.PI, 2 * Math.PI, 8)];
  },
  circle: () => range(N).map((t) => [0.5 * Math.cos(t * 2 * Math.PI), 0.5 * Math.sin(t * 2 * Math.PI)] as Pt),
  heart: () =>
    range(N).map((t) => {
      const a = t * 2 * Math.PI;
      return [16 * Math.sin(a) ** 3, 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)] as Pt;
    }),
  star: () =>
    smooth(
      range(10).map((t, i) => {
        const a = Math.PI / 2 + t * 2 * Math.PI;
        const r = i % 2 === 0 ? 1 : 0.48;
        return [r * Math.cos(a), r * Math.sin(a)] as Pt;
      }),
      1,
    ),
  tree: () =>
    smooth(
      [
        [0, 1],
        [0.32, 0.62],
        [0.18, 0.62],
        [0.52, 0.2],
        [0.32, 0.2],
        [0.7, -0.28],
        [0.12, -0.28],
        [0.12, -0.45],
        [-0.12, -0.45],
        [-0.12, -0.28],
        [-0.7, -0.28],
        [-0.32, 0.2],
        [-0.52, 0.2],
        [-0.18, 0.62],
        [-0.32, 0.62],
      ],
      1,
    ),
  ornament: () => {
    // qua cau + nap tren
    const ball = arc(0, 0, 0.5, Math.PI / 2 + 0.28, Math.PI / 2 + 2 * Math.PI - 0.28, 90);
    const capW = 0.14;
    const top = 0.5 * Math.cos(0.28);
    return [...ball, [capW, top], [capW, top + 0.12], [0.05, top + 0.12], [0.05, top + 0.17], [-0.05, top + 0.17], [-0.05, top + 0.12], [-capW, top + 0.12], [-capW, top]] as Pt[];
  },
  stocking: () =>
    smooth(
      [
        [-0.28, 0.6],
        [0.2, 0.6],
        [0.2, 0.42],
        [0.16, 0.42],
        [0.16, -0.05],
        [0.48, -0.22],
        [0.6, -0.42],
        [0.5, -0.6],
        [0.2, -0.62],
        [-0.12, -0.5],
        [-0.24, -0.3],
        [-0.24, 0.42],
        [-0.28, 0.42],
      ],
      2,
    ),
};

/** Chuan hoa: tam bbox ve 0, be ngang = 1. */
export function normalize(pts: Pt[]): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = x1 - x0 || 1;
  return pts.map(([x, y]) => [(x - (x0 + x1) / 2) / w, (y - (y0 + y1) / 2) / w]);
}

export function presetShape(key: string): Pt[] {
  return normalize((RAW[key] ?? RAW.square)());
}

/** Duong cat theo mm voi be ngang sizeMm. */
export function scaleShape(pts: Pt[], sizeMm: number): Pt[] {
  return pts.map(([x, y]) => [x * sizeMm, y * sizeMm]);
}

/**
 * Khan vuong mep luon song (scalloped) theo mm: moi canh ~`n` vong cung loi ra ngoai sau `depth` mm,
 * be ngang ngoai cung dung bang sizeMm. Truc y huong len, nguoc chieu kim dong ho.
 */
export function scallopSquare(sizeMm: number, n = 10, depth = 2.5): Pt[] {
  const h = sizeMm / 2 - depth;
  const corners: Pt[] = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const out: Pt[] = [];
  for (let side = 0; side < 4; side++) {
    const [ax, ay] = corners[side];
    const [bx, by] = corners[(side + 1) % 4];
    // phap tuyen ngoai cua canh (da giac nguoc chieu kim dong ho)
    const nx = by - ay ? Math.sign(by - ay) : 0;
    const ny = bx - ax ? -Math.sign(bx - ax) : 0;
    for (let k = 0; k < n; k++)
      for (let j = 0; j < 8; j++) {
        const t = (k + j / 8) / n;
        const d = depth * Math.sin((Math.PI * j) / 8);
        out.push([ax + (bx - ax) * t + nx * d, ay + (by - ay) * t + ny * d]);
      }
  }
  return out;
}

/**
 * Dang ao phong trai phang (mm, size M: ngang nguc ~51 cm, dai ~72 cm), tam bbox o (0,0), y len tren.
 * Mat truoc co tron sau ~9 cm, mat sau co cao ~2 cm.
 */
export function teeOutline(side: "front" | "back"): Pt[] {
  const H = 722;
  const depth = side === "front" ? 90 : 22;
  const body: Pt[] = [[255, 0], [262, 300], [255, 500], [392, 432], [452, 545], [205, 702], [98, H]];
  const neck = Array.from({ length: 12 }, (_, i) => {
    const a = (((i + 1) / 12) * Math.PI) / 2;
    return [98 * Math.cos(a), H - depth * Math.sin(a)] as Pt;
  });
  const right = [...body, ...neck]; // ket thuc o giua co (0, H - depth)
  const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Pt);
  return [...right, ...left].map(([x, y]) => [x, y - H / 2] as Pt);
}

export function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function pointInPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------------------- hinh tu anh: cat theo duong vien ---------------------- */

/**
 * Anh (da bo nen, co alpha) -> duong vien ngoai cua manh lon nhat, no ra marginRatio (ti le be ngang)
 * de chua le may quanh hinh nhu lot coc cat theo hinh / sticker. Bo qua lo ben trong.
 */
export function shapeFromImage(src: HTMLCanvasElement, marginRatio: number, smoothRatio = 0): Pt[] {
  const S = 220;
  const k = S / Math.max(src.width, src.height);
  // lam muot ban kinh smoothRatio * be ngang: lap khe giua cac chi tiet nho (qua chau, la, ngoi sao...)
  // -> duong cat tron trinh, cat vai / theu vien duoc; khong thi vien lom chom theo tung chi tiet
  const close = Math.round(S * smoothRatio);
  const pad = Math.ceil(marginRatio * S) + Math.max(close, Math.round(S * 0.2)) + 3;
  const W = Math.round(src.width * k) + pad * 2;
  const H = Math.round(src.height * k) + pad * 2;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, pad, pad, W - pad * 2, H - pad * 2);
  const a = ctx.getImageData(0, 0, W, H).data;
  let mask = new Uint8Array(W * H);
  // gan nhu dac (alpha > 80%): bo bong do / quang sang ban trong suot ma anh AI hay co quanh hinh
  for (let i = 0; i < W * H; i++) mask[i] = a[i * 4 + 3] > 204 ? 1 : 0;
  // bo cac dom nho li ti (sot lai khi xoa nen caro/nen tron): khong thi duong cat phai no ra om ca dom
  mask = dropSpecks(mask, W, H, 0.003);
  // no ra theo le (hinh tron xap xi bang 2 lan no hinh vuong cheo)
  const r = Math.round(marginRatio * S);
  const art = mask;
  let artPx = 0;
  for (let i = 0; i < W * H; i++) artPx += art[i];
  // le an toan toi thieu ~1.5 mm quanh hinh: duong cat khong bao gio sat/an vao hinh du lam muot manh
  const safe = dilate(art, W, H, Math.max(1, Math.min(r, Math.round(S * 0.01))));
  const grown = r > 0 ? dilate(art, W, H, r) : art;
  // mac dinh cat sat theo dang hinh; neu hinh gom nhieu manh roi (vong hoa, chu tach chu) ma manh lon nhat
  // bo sot > 2% hinh thi tu tang do muot cho toi khi cac manh dinh vao nhau
  const maxClose = Math.round(S * 0.2);
  for (let cl = close; ; cl = Math.max(cl + 4, Math.round(cl * 1.5))) {
    const m = Uint8Array.from(grown);
    if (cl > 0) {
      // lam mo mat na da no le (3 lan box blur ~ Gauss) roi lay nguong: lap khe giua chi tiet VA bo tron cac u loi nho
      const soft = blurMask(grown, W, H, Math.max(1, Math.round(cl / 2)));
      for (let i = 0; i < W * H; i++) m[i] = soft[i] > 0.4 || safe[i] ? 1 : 0;
    }
    mask = largestComponent(m, W, H);
    let kept = 0;
    for (let i = 0; i < W * H; i++) kept += art[i] & mask[i];
    if (kept >= artPx * 0.98 || cl >= maxClose) break;
  }
  const outline = trace(mask, W, H);
  if (outline.length < 8) return presetShape("square");
  // lat truc y (anh y xuong -> hinh y len), don gian hoa, lam muot
  const pts = rdp(
    outline.map(([x, y]) => [x, -y] as Pt),
    1.2,
  );
  return normalize(smooth(pts, 3));
}

function dilate(m: Uint8Array, W: number, H: number, r: number) {
  const out = new Uint8Array(W * H);
  const r2 = r * r;
  const offs: [number, number][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r2) offs.push([dx, dy]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      // chi no tu pixel vien de nhanh
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || !m[y * W + x - 1] || !m[y * W + x + 1] || !m[(y - 1) * W + x] || !m[(y + 1) * W + x];
      if (!edge) {
        out[y * W + x] = 1;
        continue;
      }
      for (const [dx, dy] of offs) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) out[yy * W + xx] = 1;
      }
    }
  return out;
}

/** Mat na 0/1 -> gia tri 0..1 sau 3 lan box blur ban kinh r (xap xi Gauss), tach ngang/doc. */
function blurMask(m: Uint8Array, W: number, H: number, r: number): Float32Array {
  let a = Float32Array.from(m);
  const pass = (src: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(W * H);
    const n = horizontal ? W : H;
    const lines = horizontal ? H : W;
    for (let l = 0; l < lines; l++) {
      const at = (i: number) => (horizontal ? l * W + i : i * W + l);
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += i >= 0 && i < n ? src[at(i)] : 0;
      for (let i = 0; i < n; i++) {
        out[at(i)] = sum / (2 * r + 1);
        const add = i + r + 1, drop = i - r;
        if (add < n) sum += src[at(add)];
        if (drop >= 0) sum -= src[at(drop)];
      }
    }
    return out;
  };
  for (let k = 0; k < 3; k++) a = pass(pass(a, true), false);
  return a;
}

/** Bo cac manh nho hon minShare tong dien tich hinh. */
function dropSpecks(m: Uint8Array, W: number, H: number, minShare: number) {
  const { lab, sizes } = label(m, W, H);
  const total = sizes.reduce((a, b) => a + b, 0);
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (lab[i] && sizes[lab[i]] >= total * minShare) out[i] = 1;
  return out;
}

/** Gan nhan cac manh lien thong (4 huong); sizes[id] = so diem anh cua manh id (id tu 1). */
function label(m: Uint8Array, W: number, H: number) {
  const lab = new Int32Array(W * H);
  const sizes = [0];
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || lab[s]) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [s];
    lab[s] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q >= 0 && q < W * H && m[q] && !lab[q]) {
          lab[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
  }
  return { lab, sizes };
}

function largestComponent(m: Uint8Array, W: number, H: number) {
  const lab = new Int32Array(W * H);
  let best = 0;
  let bestSize = 0;
  let id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || lab[s]) continue;
    id++;
    let size = 0;
    const stack = [s];
    lab[s] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q >= 0 && q < W * H && m[q] && !lab[q]) {
          lab[q] = id;
          stack.push(q);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = lab[i] === best ? 1 : 0;
  return out;
}

/** Do theo vien Moore-neighbor tu diem tren cung ben trai. */
function trace(m: Uint8Array, W: number, H: number): Pt[] {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
  let start = -1;
  for (let i = 0; i < W * H && start < 0; i++) if (m[i]) start = i;
  if (start < 0) return [];
  const dirs: [number, number][] = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const sx = start % W;
  const sy = (start / W) | 0;
  const out: Pt[] = [[sx, sy]];
  let x = sx;
  let y = sy;
  let d = 6; // dang di len -> bat dau xet tu trai
  for (let guard = 0; guard < W * H * 4; guard++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (d + 6 + k) % 8;
      const nx = x + dirs[nd][0];
      const ny = y + dirs[nd][1];
      if (at(nx, ny)) {
        x = nx;
        y = ny;
        d = nd;
        found = true;
        break;
      }
    }
    if (!found || (x === sx && y === sy)) break;
    out.push([x, y]);
  }
  return out;
}

/** Ramer–Douglas–Peucker. */
function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0;
  let dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], a, b);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

function segDist([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt) {
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
