/**
 * Xu ly anh phia trinh duyet cho trang Design: bo nen anh khach, ve chu, lop "gia theu" de khach hinh dung,
 * texture vai mu va khan (van twill that tu anh vai cua shop, to theo mau chon).
 * Day chi la hinh minh hoa de dat vi tri — file theu that do xuong lam tu anh goc.
 */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Cat sat phan co noi dung (alpha > 8). */
export function trim(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return src;
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext("2d")!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Anh -> canvas toi da 1024 px. removeBg: lam trong suot vung nen cung mau voi vien anh va noi voi vien
 * (khong dong vao mau trang nam ben trong hinh).
 */
/** Cat mot vung [x, y, w, h] (ti le 0-1) khoi anh goc. */
export function cropImage(img: HTMLImageElement, [x, y, w, h]: [number, number, number, number]): HTMLCanvasElement {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = canvas(w * W, h * H);
  c.getContext("2d")!.drawImage(img, x * W, y * H, w * W, h * H, 0, 0, c.width, c.height);
  return c;
}

export function prepareImage(img: HTMLImageElement | HTMLCanvasElement, removeBg: boolean): HTMLCanvasElement {
  const iw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const ih = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const s = Math.min(1, 1024 / Math.max(iw, ih));
  const c = canvas(iw * s, ih * s);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (!removeBg) return trim(c);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const W = c.width, H = c.height;
  // da co nen trong suot thi giu nguyen
  let transparent = 0;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 250) transparent++;
  if (transparent > d.length / 16 / 50) return trim(c);
  if (removeChecker(d, W, H)) {
    ctx.putImageData(im, 0, 0);
    return trim(c);
  }
  const corners = [0, W - 1, (H - 1) * W, H * W - 1].map((p) => [d[p * 4], d[p * 4 + 1], d[p * 4 + 2]]);
  const bg = [0, 1, 2].map((k) => corners.map((cc) => cc[k]).sort((a, b) => a - b)[1]);
  const near = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    near[p] = Math.abs(d[p * 4] - bg[0]) + Math.abs(d[p * 4 + 1] - bg[1]) + Math.abs(d[p * 4 + 2] - bg[2]) < 48 ? 1 : 0;
  }
  // co vung "giong nen" lai R px truoc khi loang: loang khong chui qua khe mong (vd khe giua rau trang va nen trang)
  const R = Math.max(2, Math.round(Math.max(W, H) / 300));
  const core = morph(near, W, H, R, "erode");
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p] || !core[p]) continue;
    seen[p] = 1;
    const x = p % W;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (p >= W) stack.push(p - W);
    if (p < W * (H - 1)) stack.push(p + W);
  }
  // no lai R px (chi trong vung giong nen) de an het vien nen sat hinh
  const bgMask = morph(seen, W, H, R + 1, "dilate");
  for (let p = 0; p < W * H; p++) if (bgMask[p] && near[p]) d[p * 4 + 3] = 0;
  ctx.putImageData(im, 0, 0);
  return trim(c);
}

/**
 * Nen caro gia: anh "PNG trong suot" tai tu mang hay ve san o caro 2 mau xam vao diem anh.
 * Nhan dien: 2 dinh xam (it sac) trong histogram + doi mau A<->B lap lai deu theo chu ky o.
 * Xoa: diem xam A/B (hoac pha tron giua A-B o mep o) ma xung quanh co du CA HAI mau -> mang xam tron
 * cua thiet ke (chi 1 mau) duoc giu, o caro trong long hinh (vd lo thung cua logo) van bi xoa.
 * Tra ve true neu da xoa.
 */
function removeChecker(d: Uint8ClampedArray, W: number, H: number): boolean {
  const N = W * H;
  const lum = new Uint8Array(N);
  const neutral = new Uint8Array(N);
  const hist = new Uint32Array(64);
  for (let p = 0; p < N; p++) {
    const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2];
    lum[p] = (r * 3 + g * 6 + b) / 10;
    if (Math.max(r, g, b) - Math.min(r, g, b) < 20) {
      neutral[p] = 1;
      hist[lum[p] >> 2]++;
    }
  }
  // 2 dinh xam: dinh lon nhat, roi dinh lon nhat cach no >= 3 bin (12 muc sang)
  const peak = (skip: number) => {
    let best = -1;
    for (let i = 0; i < 64; i++) if ((skip < 0 || Math.abs(i - skip) >= 3) && (best < 0 || hist[i] > hist[best])) best = i;
    return best;
  };
  const pa = peak(-1), pb = peak(pa);
  if (hist[pa] < N * 0.04 || hist[pb] < N * 0.04) return false;
  // tam dinh chinh xac = trung binh trong bin +-1
  const center = (bin: number) => {
    let s = 0, n = 0;
    for (let i = Math.max(0, bin - 1); i <= Math.min(63, bin + 1); i++) {
      s += hist[i] * (i * 4 + 2);
      n += hist[i];
    }
    return s / n;
  };
  const la = center(pa), lb = center(pb);
  const lo = Math.min(la, lb), hi = Math.max(la, lb);
  // 1 = A, 2 = B, 3 = pha tron o mep o
  const cls = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    if (!neutral[p]) continue;
    const l = lum[p];
    if (Math.abs(l - la) <= 6) cls[p] = 1;
    else if (Math.abs(l - lb) <= 6) cls[p] = 2;
    else if (l > lo && l < hi) cls[p] = 3;
  }
  // chu ky: khoang cach giua cac lan doi A<->B (cho phep 2 px pha tron) tren tung hang
  const gaps = new Uint32Array(129);
  let flips = 0;
  for (let y = 0; y < H; y++) {
    let last = 0, lastX = -1, lastFlip = -1;
    for (let x = 0; x < W; x++) {
      const k = cls[y * W + x];
      if (k === 3) continue;
      if (k === 0) {
        last = 0;
        lastFlip = -1;
        continue;
      }
      if (last && k !== last && x - lastX <= 3) {
        flips++;
        if (lastFlip >= 0 && x - lastFlip <= 128) gaps[x - lastFlip]++;
        lastFlip = x;
      }
      last = k;
      lastX = x;
    }
  }
  if (flips < 40) return false;
  let cell = 1, total = 0;
  for (let i = 1; i <= 128; i++) {
    total += gaps[i];
    if (gaps[i] > gaps[cell]) cell = i;
  }
  // o vuong co the bi thu nho le (vd 7.5 px): gop 2 bin canh nhau; doi phai deu dan
  const regular = gaps[cell] + Math.max(gaps[cell - 1] ?? 0, gaps[cell + 1] ?? 0);
  if (cell < 2 || regular < total * 0.5) return false;

  // dem A, B quanh moi diem bang anh tich phan
  const ia = new Uint32Array((W + 1) * (H + 1));
  const ib = new Uint32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let ra = 0, rb = 0;
    for (let x = 0; x < W; x++) {
      const k = cls[y * W + x];
      if (k === 1) ra++;
      else if (k === 2) rb++;
      const q = (y + 1) * (W + 1) + x + 1;
      ia[q] = ia[q - W - 1] + ra;
      ib[q] = ib[q - W - 1] + rb;
    }
  }
  const r = Math.ceil(cell * 1.5) + 1;
  const sum = (t: Uint32Array, x0: number, y0: number, x1: number, y1: number) =>
    t[y1 * (W + 1) + x1] - t[y0 * (W + 1) + x1] - t[y1 * (W + 1) + x0] + t[y0 * (W + 1) + x0];
  let removed = 0;
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!cls[p]) continue;
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
      const area = (x1 - x0) * (y1 - y0);
      if (sum(ia, x0, y0, x1, y1) >= area * 0.15 && sum(ib, x0, y0, x1, y1) >= area * 0.15) {
        d[p * 4 + 3] = 0;
        removed++;
      }
    }
  }
  return removed > N * 0.03;
}

/** Co (erode) / no (dilate) mat na nhi phan voi o vuong ban kinh r (tach 2 chieu cho nhanh). */
function morph(src: Uint8Array, W: number, H: number, r: number, mode: "erode" | "dilate"): Uint8Array {
  const want = mode === "erode" ? 0 : 1;
  const pass = (a: Uint8Array, horizontal: boolean) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let hit = false;
        for (let k = -r; k <= r && !hit; k++) {
          const xx = horizontal ? x + k : x;
          const yy = horizontal ? y : y + k;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          if (a[yy * W + xx] === want) hit = true;
        }
        out[y * W + x] = hit ? want : 1 - want;
      }
    }
    return out;
  };
  return pass(pass(src, true), false);
}

/** Ve mot dong chu (cho phep xuong dong) bang font da chon, mau chi da chon. */
export async function renderText(text: string, fontCss: string, color: string): Promise<HTMLCanvasElement> {
  try {
    await document.fonts.load(fontCss, text);
  } catch {
    /* font chua tai duoc thi dung font du phong */
  }
  const lines = text.split("\n").map((l) => l.trimEnd()).filter((l, i, a) => l || i < a.length - 1);
  const probe = canvas(10, 10).getContext("2d")!;
  probe.font = fontCss;
  const size = parseInt(/(\d+)px/.exec(fontCss)?.[1] ?? "120", 10);
  const lh = size * 1.15;
  const w = Math.max(...lines.map((l) => probe.measureText(l || " ").width)) + size;
  const c = canvas(w, lh * lines.length + size);
  const ctx = c.getContext("2d")!;
  ctx.font = fontCss;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, size / 2 + lh * (i + 0.5)));
  return trim(c);
}

/**
 * Lop "gia theu" de khach hinh dung tren mu: soi chi cheo, mep noi nhe. Khong phai file theu.
 */
export function embroideryLook(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(src.width, src.height);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const W = c.width;
  const period = Math.max(3, Math.round(W / 140));
  for (let p = 0; p < d.length / 4; p++) {
    const a = d[p * 4 + 3];
    if (a < 8) continue;
    const x = p % W;
    const y = (p / W) | 0;
    const stripe = 0.92 + 0.09 * Math.sin(((x + y) / period) * Math.PI);
    // mep: pixel ke ben trong suot -> toi hon (chi bi nen xuong vai)
    const edge = (x > 0 && d[(p - 1) * 4 + 3] < 8) || (p >= W && d[(p - W) * 4 + 3] < 8) ? 0.8 : 1;
    const hi = (x + y) % (period * 2) === 0 ? 1.08 : 1;
    for (let k = 0; k < 3; k++) d[p * 4 + k] = Math.min(255, d[p * 4 + k] * stripe * edge * hi);
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

/** O vai lat: mau chon x van twill (anh xam da chuan hoa). */
export function fabricTile(twill: HTMLImageElement, hex: string, size = 256): HTMLCanvasElement {
  const c = canvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.55; // van vai nhe, tranh lo o lap lai
  ctx.drawImage(twill, 0, 0, size, size);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return c;
}

/** Texture khan 150 x 150 mm (10 px/mm) gom van lanh + vien da chon. */
export function napkinCanvas(twill: HTMLImageElement, hex: string, border: string): HTMLCanvasElement {
  const PX = 10;
  const S = 150 * PX;
  const c = canvas(S, S);
  const ctx = c.getContext("2d")!;
  const tile = fabricTile(twill, hex, 220);
  ctx.fillStyle = ctx.createPattern(tile, "repeat")!;
  ctx.fillRect(0, 0, S, S);
  // mep gap
  ctx.strokeStyle = "rgba(0,0,0,.12)";
  ctx.lineWidth = 3;
  ctx.strokeRect(4 * PX, 4 * PX, S - 8 * PX, S - 8 * PX);

  if (border === "hemstitch") {
    const inset = 13 * PX;
    const L = S - 2 * inset;
    ctx.fillStyle = "rgba(0,0,0,.28)";
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate((k * Math.PI) / 2);
      ctx.translate(-L / 2, -L / 2);
      for (let x = 0; x < L; x += 2.2 * PX) ctx.fillRect(x, -0.8 * PX, 1.3 * PX, 1.6 * PX);
      ctx.restore();
    }
  } else if (border === "scallop") {
    ctx.strokeStyle = "#c8553d";
    ctx.lineWidth = 2.6 * PX;
    ctx.lineCap = "round";
    const inset = 7 * PX;
    const L = S - 2 * inset;
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate((k * Math.PI) / 2);
      ctx.translate(-L / 2, -L / 2);
      ctx.beginPath();
      for (let x = 0; x <= L; x += 2) ctx.lineTo(x, Math.sin((x / (12 * PX)) * Math.PI * 2) * 2.2 * PX);
      ctx.stroke();
      ctx.restore();
    }
  } else if (border === "cross") {
    ctx.strokeStyle = "#b3261e";
    ctx.lineWidth = 0.7 * PX;
    const inset = 10 * PX;
    const L = S - 2 * inset;
    const r = 1.4 * PX;
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate((k * Math.PI) / 2);
      ctx.translate(-L / 2, -L / 2);
      for (let x = 0; x < L; x += 4.5 * PX) {
        ctx.beginPath();
        ctx.moveTo(x - r, -r);
        ctx.lineTo(x + r, r);
        ctx.moveTo(x + r, -r);
        ctx.lineTo(x - r, r);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  return c;
}

/**
 * Mat tren lot coc theo hinh bat ky (khop uv cua buildCoaster): vai, anh nen (hinh khach chon lam dang lot coc),
 * vien tuy chon chay theo duong cat — "satin" (dai satin mau sat mep) hoac "running" (duong chi chay cach mep 5 mm).
 */
export function coasterCanvas(opts: {
  twill: HTMLImageElement;
  fabricHex: string;
  /** kieu van chat lieu (Material.texture) */
  material: string;
  outlineMm: [number, number][];
  background?: HTMLCanvasElement | null;
  /** le (mm) giua anh nen va mep khung duong cat; anh phu kin phan con lai (giong compose.py ben xuong) */
  backgroundMarginMm?: number;
  border: string;
  borderHex: string;
  /** do phan giai (px/mm); vat lon nhu ao thi giam de canvas khong qua to */
  pxPerMm?: number;
}): HTMLCanvasElement {
  const PX = opts.pxPerMm ?? 8;
  const xs = opts.outlineMm.map((p) => p[0]);
  const ys = opts.outlineMm.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const c = canvas((maxX - minX) * PX, (maxY - minY) * PX);
  const ctx = c.getContext("2d")!;
  const at = ([x, y]: [number, number]) => [(x - minX) * PX, (maxY - y) * PX] as const;
  const path = (scale = 1) => {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const p = new Path2D();
    opts.outlineMm.forEach(([x, y], i) => {
      const [u, v] = at([cx + (x - cx) * scale, cy + (y - cy) * scale]);
      if (i) p.lineTo(u, v);
      else p.moveTo(u, v);
    });
    p.closePath();
    return p;
  };
  // o van ~25 mm (200 px / 8 px/mm) lat kin mat lot coc
  ctx.fillStyle = ctx.createPattern(materialTile(opts.material, opts.fabricHex, opts.twill, 200), "repeat")!;
  ctx.fillRect(0, 0, c.width, c.height);
  if (opts.background) {
    // anh lam dang khan: nam giua, giu ti le, phu kin khung duong cat tru le -> mep vai trung mep hinh
    const b = opts.background;
    const m = (opts.backgroundMarginMm ?? 0) * PX * 2;
    const s = Math.min((c.width - m) / b.width, (c.height - m) / b.height);
    ctx.drawImage(b, (c.width - b.width * s) / 2, (c.height - b.height * s) / 2, b.width * s, b.height * s);
  }
  // vien nhe nhu khan that: gap mep may (mac dinh), mep luon song vien satin manh, hoac duong chi chay manh
  const size = Math.max(maxX - minX, maxY - minY);
  ctx.lineJoin = "round";
  if (opts.border === "scallop" || opts.border === "satin") {
    ctx.save();
    ctx.clip(path());
    ctx.strokeStyle = opts.borderHex;
    ctx.lineWidth = 3 * PX; // nua trong hinh = 1.5 mm satin
    ctx.stroke(path());
    ctx.restore();
  } else if (opts.border === "plain") {
    // ao: chi lam ro mep (bo co, gau, tay) bang vien toi nhe
    ctx.save();
    ctx.clip(path());
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.lineWidth = 4 * PX;
    ctx.stroke(path());
    ctx.restore();
  } else {
    // nep gap cua mep may ~4 mm: bong mo, khong phai chi mau
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 0.5 * PX;
    ctx.stroke(path(1 - 8 / size));
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 0.3 * PX;
    ctx.stroke(path(1 - 9 / size));
  }
  if (opts.border === "running") {
    ctx.strokeStyle = opts.borderHex;
    ctx.lineWidth = 0.4 * PX;
    ctx.setLineDash([2 * PX, 1.2 * PX]);
    ctx.stroke(path(1 - 13 / size));
    ctx.setLineDash([]);
  }
  return c;
}

/* --------------------------- van chat lieu lot coc --------------------------- */

const detailCache = new Map<string, HTMLCanvasElement>();

/** So ngau nhien co dinh (LCG) de van vai giong nhau moi lan ve. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Lam mo hop 1 chieu nhieu lan (xap xi Gauss) tren mang gia tri. */
function blurValues(v: Float32Array, W: number, H: number, r: number, passes = 2) {
  const tmp = new Float32Array(v.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += v[y * W + ((x + k + W) % W)];
        tmp[y * W + x] = s / (2 * r + 1);
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += tmp[((y + k + H) % H) * W + x];
        v[y * W + x] = s / (2 * r + 1);
      }
  }
}

/**
 * Anh xam (0..1, trung binh ~0.9) mo ta van be mat cua tung chat lieu, lat lien mach.
 * Nhan voi mau vai de ra o vai (materialTile).
 */
function materialDetail(kind: string, S = 192): HTMLCanvasElement {
  const hit = detailCache.get(kind);
  if (hit) return hit;
  const r = rng(kind.length * 7919 + kind.charCodeAt(0));
  const v = new Float32Array(S * S);
  const noise = () => {
    const n = new Float32Array(S * S);
    for (let i = 0; i < n.length; i++) n[i] = r();
    return n;
  };
  if (kind === "linen") {
    // soi to/nho khong deu (slub) theo ca 2 chieu + dan cheo nhe
    const row = Array.from({ length: S }, () => r());
    const col = Array.from({ length: S }, () => r());
    const fine = noise();
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const weave = ((x >> 1) + (y >> 1)) % 2 ? 0.035 : -0.035;
        v[y * S + x] = 0.86 + (row[y] - 0.5) * 0.12 + (col[x] - 0.5) * 0.12 + weave + (fine[y * S + x] - 0.5) * 0.06;
      }
  } else if (kind === "canvas") {
    const fine = noise();
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) v[y * S + x] = (((x >> 2) + (y >> 2)) % 2 ? 0.95 : 0.83) - ((x % 4 === 0 || y % 4 === 0) ? 0.04 : 0) + (fine[y * S + x] - 0.5) * 0.05;
  } else if (kind === "felt") {
    const n = noise();
    blurValues(n, S, S, 2);
    const fibers = noise();
    for (let i = 0; i < v.length; i++) v[i] = 0.8 + (n[i] - 0.5) * 0.9 + (fibers[i] > 0.985 ? 0.08 : 0);
  } else if (kind === "burlap") {
    // det thua: soi 5 px, lo 3 px de lo lop duoi toi
    const shade = Array.from({ length: S }, () => 0.85 + r() * 0.15);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        // soi ~1.5 mm, lo ~0.8 mm (o 192 px ~ 25 mm)
        const tx = x % 16 < 11;
        const ty = y % 16 < 11;
        v[y * S + x] = tx || ty ? shade[tx ? y : x] * (tx && ty ? 0.94 : 1) : 0.42;
      }
  } else if (kind === "velvet") {
    const n = noise();
    blurValues(n, S, S, 6, 3);
    const fine = noise();
    for (let i = 0; i < v.length; i++) v[i] = 0.78 + (n[i] - 0.5) * 2.2 * 0.2 + (fine[i] - 0.5) * 0.03;
  } else if (kind === "leather") {
    const n = noise();
    blurValues(n, S, S, 1);
    for (let i = 0; i < v.length; i++) v[i] = 0.88 + (n[i] - 0.5) * 0.5;
    // nep nhan nho
    for (let k = 0; k < 40; k++) {
      let x = r() * S;
      let y = r() * S;
      const a = r() * Math.PI;
      for (let s = 0; s < 14; s++) {
        x += Math.cos(a);
        y += Math.sin(a);
        v[((Math.round(y) + S) % S) * S + ((Math.round(x) + S) % S)] *= 0.86;
      }
    }
  } else if (kind === "cork") {
    for (let i = 0; i < v.length; i++) v[i] = 0.88;
    for (let k = 0; k < 900; k++) {
      const cx = r() * S;
      const cy = r() * S;
      const rad = 1 + r() * 3;
      const val = 0.62 + r() * 0.45;
      for (let y = -4; y <= 4; y++)
        for (let x = -4; x <= 4; x++) if (x * x + y * y <= rad * rad) v[((Math.round(cy + y) + S) % S) * S + ((Math.round(cx + x) + S) % S)] = val;
    }
  } else {
    for (let i = 0; i < v.length; i++) v[i] = 0.9;
  }
  const c = canvas(S, S);
  const ctx = c.getContext("2d")!;
  const im = ctx.createImageData(S, S);
  for (let i = 0; i < v.length; i++) {
    const g = Math.max(0, Math.min(255, Math.round(v[i] * 255)));
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = g;
    im.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  detailCache.set(kind, c);
  return c;
}

/** O vai lat cua mot chat lieu: mau x van be mat (twill dung anh van that cua shop). */
export function materialTile(kind: string, hex: string, twill: HTMLImageElement, size = 200): HTMLCanvasElement {
  if (kind === "twill") return fabricTile(twill, hex, size);
  const c = canvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(materialDetail(kind), 0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";
  if (kind === "velvet" || kind === "leather") {
    // anh bong nhe cua nhung / da
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }
  return c;
}
