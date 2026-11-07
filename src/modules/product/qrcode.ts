import "server-only";

/**
 * Thay cho QrCode::size(400)->generate($url) (simplesoftwareio/simple-qrcode + BaconQrCode, ZXing port)
 * trong ProductService::qrCode(). Ma hoa byte mode, muc sua loi L, margin 0, chon mask theo
 * MaskUtil cua BaconQrCode (da doi chieu: ma tran trung khop voi ban Laravel). Ra SVG cung khung (400x400, rect trang, scale/translate) nhung path
 * ve theo tung doan hang thay vi duong vien (hinh hien thi giong nhau).
 */

const ECC_PER_BLOCK_L = [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30];
const NUM_BLOCKS_L = [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25];

function rawDataModules(ver: number) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(ver: number) {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK_L[ver] * NUM_BLOCKS_L[ver];
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const numAlign = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function gfMul(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number) {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
  }
  return result;
}

function interleave(data: number[], ver: number) {
  const numBlocks = NUM_BLOCKS_L[ver];
  const blockEccLen = ECC_PER_BLOCK_L[ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = [];
  const divisor = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

function maskBit(mask: number, x: number, y: number) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

type Matrix = { size: number; mod: boolean[][]; fn: boolean[][] };

function build(ver: number, codewords: number[], mask: number): Matrix {
  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    mod[y][x] = dark;
    fn[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const align = alignmentPositions(ver);
  const n = align.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  // type info: L = 01
  const data = (1 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (b: number, i: number) => ((b >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
  set(8, 7, bit(bits, 6));
  set(8, 8, bit(bits, 7));
  set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
  set(8, size - 8, true);
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const vb = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const b = bit(vb, i);
      const a = size - 11 + (i % 3);
      const c = Math.floor(i / 3);
      set(a, c, b);
      set(c, a, b);
    }
  }
  // du lieu (zigzag) + mask
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fn[y][x]) continue;
        let dark = false;
        if (i < codewords.length * 8) dark = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
        i++;
        mod[y][x] = maskBit(mask, x, y) ? !dark : dark;
      }
    }
  }
  return { size, mod, fn };
}

/** MaskUtil cua BaconQrCode (rule 1..4). */
function penalty({ size, mod }: Matrix) {
  let p = 0;
  for (const horizontal of [true, false]) {
    for (let i = 0; i < size; i++) {
      let run = 0;
      let prev: boolean | null = null;
      for (let j = 0; j < size; j++) {
        const b = horizontal ? mod[i][j] : mod[j][i];
        if (b === prev) run++;
        else {
          if (run >= 5) p += 3 + (run - 5);
          run = 1;
          prev = b;
        }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
  }
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const v = mod[y][x];
      if (v === mod[y][x + 1] && v === mod[y + 1][x] && v === mod[y + 1][x + 1]) p += 3;
    }
  // rule 3 cua BaconQrCode: can du 4 o trang nam trong ma tran (khong cat o mep)
  const pat = [true, false, true, true, true, false, true];
  const light4 = (get: (k: number) => boolean, from: number) => {
    if (from < 0 || from + 3 >= size) return false;
    for (let k = from; k < from + 4; k++) if (get(k)) return false;
    return true;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const row = (k: number) => mod[y][k];
      const col = (k: number) => mod[k][x];
      if (x + 6 < size && pat.every((v, k) => mod[y][x + k] === v) && (light4(row, x + 7) || light4(row, x - 4))) p += 40;
      if (y + 6 < size && pat.every((v, k) => mod[y + k][x] === v) && (light4(col, y + 7) || light4(col, y - 4))) p += 40;
    }
  // rule 4: (int)(abs($darkRatio - 0.5) * 20) * N4
  let dark = 0;
  for (const r of mod) for (const b of r) if (b) dark++;
  p += Math.trunc(Math.abs(dark / (size * size) - 0.5) * 20) * 10;
  return p;
}

export function qrMatrix(text: string): Matrix {
  const bytes = [...Buffer.from(text, "utf8")];
  let ver = 1;
  for (; ver <= 40; ver++) {
    const needed = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= dataCodewords(ver) * 8) break;
  }
  if (ver > 40) throw new Error("Du lieu qua dai cho QR code");
  const bits: number[] = [];
  const append = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  append(0b0100, 4);
  append(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) append(b, 8);
  const cap = dataCodewords(ver) * 8;
  append(0, Math.min(4, cap - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) append(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  const codewords = interleave(data, ver);
  let best: Matrix | null = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = build(ver, codewords, mask);
    const pen = penalty(m);
    if (pen < bestPenalty) {
      bestPenalty = pen;
      best = m;
    }
  }
  return best as Matrix;
}

/** round($x, 3) cua PHP, in ra nhu %s */
function num(x: number) {
  return String(Math.round(x * 1000) / 1000);
}

/** QrCode::size($size)->generate($text) — chuoi SVG. */
export function qrSvg(text: string, size = 400) {
  const { size: n, mod } = qrMatrix(text);
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; ) {
      if (!mod[y][x]) {
        x++;
        continue;
      }
      let w = 0;
      while (x + w < n && mod[y][x + w]) w++;
      d += `M${x} ${y}L${x + w} ${y}L${x + w} ${y + 1}L${x} ${y + 1}Z`;
      x += w;
    }
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect x="0" y="0" width="${size}" height="${size}" fill="#ffffff"/>` +
    `<g transform="scale(${num(size / n)})"><g transform="translate(0,0)">` +
    `<path fill-rule="evenodd" d="${d}" fill="#000000"/></g></g></svg>\n`
  );
}
