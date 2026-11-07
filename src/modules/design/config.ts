/**
 * Cau hinh trang Design: khach dat hinh/chu len mu 3D hoac khan, roi GUI THIET KE ve xuong
 * (xuong lam file may theu va theu that). Dung chung client + server.
 * Kich thuoc vung theu la so tham khao nganh — do lai tren phoi that va khung theu cua may theu tai xuong.
 */

export type Zone = { key: string; label: string; maxW: number; maxH: number };
export type Border = { key: string; label: string; note: string };
export type ColorOpt = { key: string; label: string; hex: string };

export const CAP_COLORS: ColorOpt[] = [
  { key: "black", label: "Black", hex: "#3a3b3d" },
  { key: "navy", label: "Navy", hex: "#1f2c45" },
  { key: "khaki", label: "Khaki", hex: "#a39a78" },
  { key: "stone", label: "Stone", hex: "#d8d0bd" },
  { key: "white", label: "White", hex: "#f1efe9" },
  { key: "olive", label: "Olive", hex: "#5d6340" },
  { key: "pink", label: "Pink", hex: "#e7b9c0" },
];

/** Ao phong unisex cotton: mau vai, vung theu mat truoc / mat sau (gioi han khung theu lon). */
export const TSHIRT_COLORS: ColorOpt[] = [
  { key: "white", label: "White", hex: "#f5f4f0" },
  { key: "natural", label: "Natural", hex: "#e9e1cf" },
  { key: "sand", label: "Sand", hex: "#cbb592" },
  { key: "grey", label: "Heather grey", hex: "#a7a7a5" },
  { key: "sage", label: "Sage", hex: "#a7b39b" },
  { key: "navy", label: "Navy", hex: "#1f2a44" },
  { key: "forest", label: "Forest", hex: "#24412f" },
  { key: "maroon", label: "Maroon", hex: "#6b2430" },
  { key: "black", label: "Black", hex: "#1f1f21" },
];
export const TSHIRT_ZONES: Zone[] = [
  { key: "front", label: "Front", maxW: 250, maxH: 250 },
  { key: "back", label: "Back", maxW: 280, maxH: 300 },
];

export const CAP_ZONES: Zone[] = [
  { key: "front", label: "Front", maxW: 100, maxH: 55 },
  { key: "left", label: "Left side", maxW: 55, maxH: 50 },
  { key: "right", label: "Right side", maxW: 55, maxH: 50 },
  { key: "back", label: "Back", maxW: 90, maxH: 25 },
];

/**
 * Chat lieu lot coc theu pho bien (product key "napkin" giu nguyen de khong vo du lieu cu).
 * texture: kieu van ve tren trang Design (xem materialTile trong textures.ts).
 */
export type Material = { key: string; label: string; note: string; texture: "linen" | "canvas" | "felt" | "burlap" | "velvet" | "leather" | "twill" | "cork"; colors: ColorOpt[] };
export const COASTER_MATERIALS: Material[] = [
  {
    key: "linen",
    label: "Linen",
    note: "Classic cocktail-napkin linen, soft and absorbent",
    texture: "linen",
    colors: [
      { key: "natural", label: "Natural", hex: "#d9d0bf" },
      { key: "oatmeal", label: "Oatmeal", hex: "#e6dfd1" },
      { key: "white", label: "White", hex: "#f4f2ec" },
      { key: "sage", label: "Sage", hex: "#b5bfa6" },
      { key: "blush", label: "Blush", hex: "#e9c9c1" },
      { key: "charcoal", label: "Charcoal", hex: "#4a4a48" },
    ],
  },
  {
    key: "linen-cotton",
    label: "Linen-cotton blend",
    note: "Smoother than pure linen, keeps its shape better",
    texture: "linen",
    colors: [
      { key: "ivory", label: "Ivory", hex: "#efe9dc" },
      { key: "flax", label: "Flax", hex: "#cdbf9f" },
      { key: "red", label: "Holiday red", hex: "#a8282c" },
      { key: "green", label: "Pine green", hex: "#2f5a3e" },
    ],
  },
  {
    key: "canvas",
    label: "Cotton canvas",
    note: "Sturdy plain weave, crisp edges, great for bold designs",
    texture: "canvas",
    colors: [
      { key: "natural", label: "Natural", hex: "#e2d7bf" },
      { key: "white", label: "White", hex: "#f3f1ea" },
      { key: "navy", label: "Navy", hex: "#22304d" },
      { key: "red", label: "Red", hex: "#9e2a2b" },
      { key: "black", label: "Black", hex: "#262626" },
    ],
  },
  {
    key: "wool-felt",
    label: "Wool-blend felt",
    note: "Thick, does not fray: best for shaped coasters and ornaments",
    texture: "felt",
    colors: [
      { key: "cream", label: "Cream", hex: "#efe4cc" },
      { key: "red", label: "Cranberry", hex: "#a8282c" },
      { key: "green", label: "Forest", hex: "#2f5a3e" },
      { key: "grey", label: "Heather grey", hex: "#9a9893" },
      { key: "mustard", label: "Mustard", hex: "#c9993a" },
      { key: "white", label: "Snow white", hex: "#f5f3ef" },
      { key: "brown", label: "Gingerbread", hex: "#8a5a36" },
    ],
  },
  {
    key: "burlap",
    label: "Jute burlap",
    note: "Rustic open weave; simple bold designs stitch best",
    texture: "burlap",
    colors: [
      { key: "natural", label: "Natural jute", hex: "#b89a6c" },
      { key: "bleached", label: "Bleached", hex: "#d8c9a8" },
    ],
  },
  {
    key: "velvet",
    label: "Cotton velvet",
    note: "Plush and festive, rich color",
    texture: "velvet",
    colors: [
      { key: "red", label: "Ruby", hex: "#8e1f2a" },
      { key: "green", label: "Emerald", hex: "#1f5a43" },
      { key: "navy", label: "Midnight", hex: "#1d2747" },
      { key: "pink", label: "Rose", hex: "#c98a93" },
    ],
  },
  {
    key: "twill",
    label: "Cotton twill",
    note: "Durable diagonal weave, like our caps",
    texture: "twill",
    colors: [
      { key: "khaki", label: "Khaki", hex: "#a39a78" },
      { key: "stone", label: "Stone", hex: "#d8d0bd" },
      { key: "black", label: "Black", hex: "#3a3b3d" },
    ],
  },
  {
    key: "faux-leather",
    label: "Faux leather",
    note: "Wipe-clean surface, modern look",
    texture: "leather",
    colors: [
      { key: "tan", label: "Tan", hex: "#a8703f" },
      { key: "brown", label: "Brown", hex: "#5b3a25" },
      { key: "black", label: "Black", hex: "#242322" },
    ],
  },
  {
    key: "cork",
    label: "Cork",
    note: "Natural cork sheet, embroidered with a light design",
    texture: "cork",
    colors: [{ key: "natural", label: "Natural cork", hex: "#b88a5c" }],
  },
];

/** Lop de duoi lot coc (chong truot, tham nuoc). */
export const COASTER_BACKINGS: { key: string; label: string; note: string }[] = [
  { key: "none", label: "Single layer", note: "Just the top fabric" },
  { key: "felt", label: "Felt backing", note: "Soft felt underneath, a little thicker" },
  { key: "cork", label: "Cork backing", note: "Non-slip, protects the table" },
];

/** Moi mau lot coc (tat ca chat lieu) — giu cho cac cho tra cuu theo key mau cu. */
export const NAPKIN_COLORS: ColorOpt[] = COASTER_MATERIALS.flatMap((m) => m.colors.map((c) => ({ ...c, label: `${c.label} ${m.label.toLowerCase()}` })));

export function coasterColor(material: string | undefined, color: string): ColorOpt | undefined {
  return COASTER_MATERIALS.find((m) => m.key === (material ?? "linen"))?.colors.find((c) => c.key === color);
}
export const NAPKIN_ZONE: Zone = { key: "center", label: "Coaster", maxW: 150, maxH: 150 };
export const NAPKIN_BORDERS: Border[] = [
  { key: "none", label: "Hemmed edge", note: "Narrow folded hem, like most of our napkins" },
  { key: "scallop", label: "Scalloped edge", note: "Soft waves with a fine satin edge" },
  { key: "satin", label: "Satin edge", note: "Fine satin band following the shape" },
  { key: "running", label: "Stitched outline", note: "Fine running stitch just inside the hem" },
];
/**
 * Trang Design hien chi lam khan cocktail giong mau trong shop: be ngang 15 cm (vuong hoac cat theo hinh), cotton canvas.
 * (product key van la "napkin"; chat lieu khac trong COASTER_MATERIALS giu lai cho don cu.)
 */
export const NAPKIN_MATERIAL = "canvas";
export const NAPKIN_SIZE_MM = 150;
/** Be ngang lot coc (mm): lot coc pho bien 9-11 cm; cat theo hinh cho phep 70-150 mm. */
export const COASTER_SIZE = { min: 70, max: 150, default: 105 };
/** Tam thoi chi mo thiet ke lot coc; mu se mo lai khi co mo hinh 3D phoi that (.glb). */
export const HAT_DESIGN_ENABLED = false;
/** Tam tat ca trang Design tren web (an menu, /design tra 404, API design tu choi); bat lai = true. */
export const SITE_DESIGN_ENABLED = false;

/** Mau chi cho chu (bang tam, thay bang bang mau chi that cua xuong). */
export const THREAD_COLORS: ColorOpt[] = [
  { key: "white", label: "White", hex: "#f7f6f2" },
  { key: "black", label: "Black", hex: "#1b1b1b" },
  { key: "navy", label: "Navy", hex: "#1c2a4a" },
  { key: "red", label: "Red", hex: "#c8102e" },
  { key: "gold", label: "Gold", hex: "#e9b04a" },
  { key: "forest", label: "Forest", hex: "#1f4d36" },
  { key: "pink", label: "Pink", hex: "#f4a6c0" },
  { key: "sky", label: "Sky Blue", hex: "#7fb7e3" },
];

/**
 * Font chu theu. family: ten tren Google Fonts (trang Design tai qua mot link, xem designFontsHref);
 * Fraunces / Inter da co san tren site. Chon kieu net day vua, it chi tiet qua manh de theu ro.
 */
export const TEXT_FONTS: { key: string; label: string; css: string; family?: string; group: "Serif" | "Sans" | "Script" | "Display" }[] = [
  { key: "serif", label: "Classic serif", css: "700 120px Fraunces, Georgia, serif", group: "Serif" },
  { key: "playfair", label: "Playfair", css: "700 120px 'Playfair Display', Georgia, serif", family: "Playfair+Display:wght@700", group: "Serif" },
  { key: "cinzel", label: "Cinzel", css: "700 120px Cinzel, Georgia, serif", family: "Cinzel:wght@700", group: "Serif" },
  { key: "slab", label: "Slab", css: "400 120px 'Alfa Slab One', Georgia, serif", family: "Alfa+Slab+One", group: "Serif" },
  { key: "sans", label: "Clean sans", css: "700 120px Inter, Arial, sans-serif", group: "Sans" },
  { key: "montserrat", label: "Montserrat", css: "800 120px Montserrat, Arial, sans-serif", family: "Montserrat:wght@800", group: "Sans" },
  { key: "rounded", label: "Rounded", css: "700 120px Fredoka, Arial, sans-serif", family: "Fredoka:wght@700", group: "Sans" },
  { key: "varsity", label: "Varsity", css: "400 130px 'Bebas Neue', Impact, sans-serif", family: "Bebas+Neue", group: "Display" },
  { key: "oswald", label: "Oswald", css: "700 120px Oswald, Impact, sans-serif", family: "Oswald:wght@700", group: "Display" },
  { key: "block", label: "College block", css: "400 120px 'Graduate', Impact, serif", family: "Graduate", group: "Display" },
  { key: "western", label: "Western", css: "400 120px Rye, Georgia, serif", family: "Rye", group: "Display" },
  { key: "marker", label: "Marker", css: "400 120px 'Permanent Marker', cursive", family: "Permanent+Marker", group: "Display" },
  { key: "script", label: "Script", css: "400 130px Pacifico, cursive", family: "Pacifico", group: "Script" },
  { key: "dancing", label: "Dancing", css: "700 130px 'Dancing Script', cursive", family: "Dancing+Script:wght@700", group: "Script" },
  { key: "lobster", label: "Lobster", css: "400 130px Lobster, cursive", family: "Lobster", group: "Script" },
  { key: "satisfy", label: "Satisfy", css: "400 130px Satisfy, cursive", family: "Satisfy", group: "Script" },
  { key: "kaushan", label: "Brush", css: "400 130px 'Kaushan Script', cursive", family: "Kaushan+Script", group: "Script" },
  { key: "greatvibes", label: "Elegant", css: "400 150px 'Great Vibes', cursive", family: "Great+Vibes", group: "Script" },
  { key: "caveat", label: "Handwritten", css: "700 140px Caveat, cursive", family: "Caveat:wght@700", group: "Script" },
];

/** Mot link Google Fonts cho moi font chu theu tren trang Design. */
export const designFontsHref = () =>
  `https://fonts.googleapis.com/css2?${TEXT_FONTS.filter((f) => f.family)
    .map((f) => `family=${f.family}`)
    .join("&")}&display=swap`;

export const DESIGN_LIMITS = { maxUploadBytes: 8 * 1024 * 1024, maxItems: 6, minWidth: 10 };

/** Mot hinh hoac dong chu da dat len san pham (don vi mm, toa do trong mo hinh 3D). */
export type DesignItem = {
  id: string;
  kind: "image" | "text";
  zone: string;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  /** diem dat va phap tuyen be mat (he toa do mo hinh, mm) */
  point: [number, number, number];
  normal: [number, number, number];
  text?: string;
  font?: string;
  thread?: string;
  fileName?: string;
  /** anh: da tu xoa nen trơn quanh hinh hay chua */
  removeBg?: boolean;
  /** anh: vung cat tren anh goc [x, y, w, h], ti le 0-1 (khong co = ca anh) */
  crop?: [number, number, number, number];
};

export type DesignSpec = {
  product: "hat" | "napkin" | "tshirt";
  color: string;
  border?: string;
  /** lot coc: mau chi cua vien */
  borderColor?: string;
  /** lot coc: chat lieu (COASTER_MATERIALS) va lop de (COASTER_BACKINGS); color la mau trong chat lieu do */
  material?: string;
  backing?: string;
  /** lot coc: hinh co san (square, tree...) hoac "image" (cat theo anh khach) */
  shape?: string;
  /** lot coc: be ngang (mm) */
  sizeMm?: number;
  /** lot coc: duong cat that (mm, y len tren) — xuong dung de cat vai / lam file theu vien */
  outline?: [number, number][];
  /** lot coc cat theo anh: le quanh anh (mm), co in/theu anh do lam nen hay khong */
  shapeMarginMm?: number;
  /** do muot duong cat quanh anh, mm */
  shapeSmoothMm?: number;
  shapeImageOnCoaster?: boolean;
  /** giu nen anh (khan theo khung anh), khong bo nen roi cat quanh hinh */
  shapeKeepBg?: boolean;
  items: DesignItem[];
};

export const DESIGN_ID_RE = /^[a-z0-9]{20}$/;
