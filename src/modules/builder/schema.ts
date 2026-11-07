/**
 * Trinh dung giao dien (page builder) — mo hinh du lieu dung chung cho editor (client) va storefront (server).
 *
 * Mot trang = cay node luu PHANG trong `nodes` (map id -> node, con tro `children`/`parent`), de editor sua
 * mot node khong phai sao chep ca cay. Container (page / section / frame) co 3 kieu xep con:
 *  - stack: Auto Layout cua Figma (flexbox doc / ngang, Fill / Hug / Fixed) — "cot" chi la frame doc trong frame ngang
 *  - grid: luoi N cot deu nhau
 *  - slider: con thanh tung slide (truot hoac mo dan), co mui ten / cham / tu chay
 *  - free: dat tu do theo toa do x/y nhu frame khong Auto Layout cua Figma
 * Con trong stack cung co the "tach khoi bo cuc" (position absolute) de dat tu do.
 * Kieu xep la style theo breakpoint, nen mot khung co the la luoi tren desktop va slider tren mobile.
 *
 * Style theo breakpoint, desktop-first: `base` (desktop) -> `tablet` (<1024px) -> `mobile` (<640px); breakpoint
 * nho ke thua breakpoint lon roi ghi de tung thuoc tinh. CSS sinh ra la class `.b-<id>` + @media (xem toCss).
 */

export type Breakpoint = "base" | "tablet" | "mobile";
export const BREAKPOINTS: { key: Breakpoint; label: string; width: number | null; max: number | null }[] = [
  { key: "base", label: "Desktop", width: null, max: null },
  { key: "tablet", label: "Tablet", width: 820, max: 1023 },
  { key: "mobile", label: "Mobile", width: 390, max: 639 },
];

export type SizeMode = "fill" | "hug" | "fixed";
export type Size = { mode: SizeMode; value?: number };
export type Align = "start" | "center" | "end";
export type Layout = "stack" | "grid" | "slider" | "free";
export type Hover = "none" | "lift" | "grow" | "shadow" | "dim" | "zoomImage";

export type Style = {
  // Kieu xep con (container, khoi san pham)
  layout?: Layout;
  // stack (Auto layout)
  direction?: "row" | "column";
  gap?: number;
  wrap?: boolean;
  justify?: Align | "between";
  align?: Align | "stretch";
  padding?: [number, number, number, number];
  /** section / page: be rong noi dung (canh giua bang padding, nen van tran man hinh) */
  contentWidth?: number;
  // grid
  columns?: number;
  /** grid: chieu cao moi hang (px) — dat de o chiem nhieu hang deu nhau (kieu bento) */
  rowHeight?: number;
  /** grid: o dau tien chiem N cot / N hang (the noi bat) */
  firstColSpan?: number;
  firstRowSpan?: number;
  /** con cua luoi: chiem N cot / N hang */
  colSpan?: number;
  rowSpan?: number;
  /** con: can rieng trong o luoi / trong hang (ghi de can cua khung cha) */
  selfAlign?: "auto" | "start" | "center" | "end" | "stretch";
  selfJustify?: "auto" | "start" | "center" | "end" | "stretch";
  /** khoang cach ngoai: tren, phai, duoi, trai (px, cho phep am) */
  margin?: [number, number, number, number];
  // slider
  perView?: number;
  /** px cua slide ke tiep lo ra o mep phai (goi y "con nua, vuot tiep") */
  peek?: number;
  /** grid / slider: chi hien N con dau (vd. mobile 4 san pham) */
  maxItems?: number;
  /** Dat tu do: toa do so voi goc tren trai cua khung cha (px) */
  position?: "auto" | "absolute";
  x?: number;
  y?: number;
  z?: number;
  // Kich thuoc
  width?: Size;
  height?: Size;
  maxWidth?: number;
  minHeight?: number;
  aspectRatio?: string;
  /** chu: cat sau N dong (them "…") */
  maxLines?: number;
  /** anh: diem lay noi dung khi crop (object-position), vd "50% 30%" */
  objectPosition?: string;
  // Giao dien
  background?: string;
  backgroundImage?: string;
  /** cach dat anh nen (giong Figma): cover = Phu kin, contain = Vua khung, crop = Cat (phong to + keo vung), auto = Lap lai */
  bgSize?: "cover" | "contain" | "crop" | "auto";
  bgPosition?: string;
  /** Crop: phong to anh nen (%, 100 = vua phu kin) */
  bgZoom?: number;
  /** Lap lai: be rong moi o anh (px) */
  bgTile?: number;
  /** chinh mau anh (anh nen va anh thuong) — moi gia tri -100..100, blur 0..20px */
  adjust?: ImageAdjust;
  /** lop mau phu len anh nen (rgba) de chu de doc */
  overlay?: string;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
  shadow?: "none" | "sm" | "md" | "lg";
  opacity?: number;
  hover?: Hover;
  // Chu
  fontFamily?: "sans" | "display";
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  uppercase?: boolean;
  // Hien thi
  hidden?: boolean;
};

export type NodeType =
  | "page"
  | "section"
  | "frame"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "video"
  | "icon"
  | "logo"
  | "search"
  | "cart"
  | "account"
  | "nav"
  | "productRow"
  | "productGrid"
  | "categoryHero"
  | "collection"
  | "slot";

export type ProductSource = "bestsellers" | "newest" | "christmas" | "catalogue" | "keyword" | "manual" | "related" | "listing";
export type CatalogueSource = "all" | "top" | "manual";
export type RecordKind = "categories" | "products" | "posts";

/**
 * Loai trang con co template: trang san pham, danh muc san pham, bai viet, danh muc bai viet. Template tu gan voi
 * ban ghi dang xem ({{name}}... o moi cho) va co cac "khoi trang" (slot) lay tu giao dien code san co.
 */
export type PageKind = "product" | "catalogue" | "post" | "postcat";
export const PAGE_KIND_LABEL: Record<PageKind, string> = { product: "Trang sản phẩm", catalogue: "Trang danh mục sản phẩm", post: "Trang bài viết", postcat: "Trang danh mục bài viết" };
/** Truong {{...}} dung duoc trong template theo loai trang */
export const KIND_RECORD: Record<PageKind, RecordKind> = { product: "products", catalogue: "categories", post: "posts", postcat: "categories" };

/**
 * Khoi trang: tung phan giao dien san co (anh san pham, hop mua hang, bo loc, sap xep, phan trang...) dat nhu mot
 * khoi rieng — keo tha, boc khung, doi nen tu do. Chi chay trong template / thiet ke rieng cua loai trang tuong ung.
 */
/** global: khoi dung o moi trang (trang chu, landing...), khong can ban ghi dang xem. */
export const SLOTS: Record<string, { label: string; kinds: PageKind[]; hint: string; group: string; global?: boolean }> = {
  customRequest: { label: "Form yêu cầu thiết kế riêng", kinds: [], hint: "Nút chat WhatsApp + form để lại thông tin, mô tả ý tưởng", group: "Liên hệ", global: true },
  breadcrumb: { label: "Đường dẫn (breadcrumb)", kinds: ["product"], hint: "All Products › Danh mục", group: "Sản phẩm" },
  productGallery: { label: "Bộ ảnh sản phẩm", kinds: ["product"], hint: "Ảnh lớn + ảnh nhỏ, phóng to", group: "Sản phẩm" },
  productRating: { label: "Sao đánh giá", kinds: ["product"], hint: "4.8 ★★★★★ 12 ratings", group: "Mua hàng" },
  productPrice: { label: "Giá", kinds: ["product"], hint: "Đổi theo biến thể đang chọn", group: "Mua hàng" },
  productOptions: { label: "Chọn biến thể", kinds: ["product"], hint: "Màu, size... nút / ô màu / dropdown", group: "Mua hàng" },
  productStock: { label: "Tình trạng hàng", kinds: ["product"], hint: "In Stock / hết hàng", group: "Mua hàng" },
  productQty: { label: "Số lượng", kinds: ["product"], hint: "Ô chọn hoặc nút − / +", group: "Mua hàng" },
  productAddToCart: { label: "Nút Thêm vào giỏ", kinds: ["product"], hint: "Kèm thông báo đã thêm", group: "Mua hàng" },
  productBuyNow: { label: "Nút Mua ngay", kinds: ["product"], hint: "Thêm giỏ rồi sang thanh toán", group: "Mua hàng" },
  productDelivery: { label: "Giao hàng", kinds: ["product"], hint: "FREE delivery + ngày dự kiến", group: "Mua hàng" },
  productShipInfo: { label: "Thông tin bán hàng", kinds: ["product"], hint: "Bảo mật, gửi từ, người bán, đổi trả", group: "Mua hàng" },
  productSku: { label: "Mã SKU", kinds: ["product"], hint: "Đổi theo biến thể", group: "Mua hàng" },
  productBullets: { label: "Điểm nổi bật (About this item)", kinds: ["product"], hint: "Các dòng chính trong mô tả", group: "Mua hàng" },
  productBuy: { label: "Hộp mua hàng (1 khối, kiểu cũ)", kinds: ["product"], hint: "Nên dùng các widget Mua hàng", group: "Kiểu cũ" },
  productDescription: { label: "Mô tả sản phẩm", kinds: ["product"], hint: "Nội dung mô tả đầy đủ", group: "Sản phẩm" },
  productDetails: { label: "Bảng thông số", kinds: ["product"], hint: "Thương hiệu, danh mục, mã, thông số", group: "Sản phẩm" },
  productReviews: { label: "Đánh giá khách hàng", kinds: ["product"], hint: "Điểm trung bình, biểu đồ, form, danh sách", group: "Sản phẩm" },
  productRelated: { label: "Sản phẩm liên quan (kiểu Amazon)", kinds: ["product"], hint: "Hàng cuộn sản phẩm cùng danh mục", group: "Sản phẩm" },
  filterCategories: { label: "Bộ lọc: Danh mục", kinds: ["catalogue"], hint: "Cây danh mục, danh mục đang xem tô đậm", group: "Bộ lọc" },
  filterPrice: { label: "Bộ lọc: Khoảng giá", kinds: ["catalogue"], hint: "Nút khoảng giá + ô Min / Max", group: "Bộ lọc" },
  filterColors: { label: "Bộ lọc: Màu", kinds: ["catalogue"], hint: "Ô màu theo thuộc tính Color", group: "Bộ lọc" },
  filterRating: { label: "Bộ lọc: Đánh giá", kinds: ["catalogue"], hint: "4★ trở lên, 3★ trở lên", group: "Bộ lọc" },
  filterClear: { label: "Xóa bộ lọc", kinds: ["catalogue"], hint: "Chỉ hiện khi khách đang lọc", group: "Bộ lọc" },
  resultCount: { label: "Số kết quả", kinds: ["catalogue"], hint: "1-16 of 66 results", group: "Danh sách" },
  sortBar: { label: "Sắp xếp", kinds: ["catalogue"], hint: "Ô chọn: nổi bật, giá, mới nhất, đánh giá", group: "Danh sách" },
  pagination: { label: "Phân trang", kinds: ["catalogue", "postcat"], hint: "< Previous 1 2 3 Next >", group: "Danh sách" },
  postBreadcrumb: { label: "Đường dẫn bài viết", kinds: ["post"], hint: "Home › Danh mục bài viết", group: "Bài viết" },
  postContent: { label: "Nội dung bài viết", kinds: ["post"], hint: "Nội dung + album ảnh", group: "Bài viết" },
  postShare: { label: "Nút chia sẻ", kinds: ["post"], hint: "Facebook, Pinterest, X, copy link", group: "Bài viết" },
  postShopStory: { label: "Shop the story", kinds: ["post"], hint: "Sản phẩm theo từ khóa của bài", group: "Bài viết" },
  catalogueListing: { label: "Toàn bộ trang danh mục (1 khối, kiểu cũ)", kinds: ["catalogue"], hint: "Nên dùng các khối lẻ ở trên", group: "Kiểu cũ" },
  postBody: { label: "Toàn bộ bài viết (1 khối, kiểu cũ)", kinds: ["post"], hint: "Nên dùng các khối lẻ ở trên", group: "Kiểu cũ" },
  postListing: { label: "Toàn bộ danh sách bài (1 khối, kiểu cũ)", kinds: ["postcat"], hint: "Nên dùng Danh sách dữ liệu + Phân trang", group: "Kiểu cũ" },
};

/**
 * Kieu hien thi cua tung khoi trang (props.design). Muc dau la mac dinh. heading: widget co tieu de doi / an / thu
 * gon duoc; label: nhan chu (nut, tieu de) sua duoc.
 */
export const SLOT_DESIGNS: Record<string, { options: { key: string; label: string }[]; heading?: boolean; label?: string; gallery?: boolean }> = {
  productGallery: {
    gallery: true,
    options: [
      { key: "left", label: "Ảnh nhỏ dọc bên trái" },
      { key: "right", label: "Ảnh nhỏ dọc bên phải" },
      { key: "bottom", label: "Ảnh nhỏ ngang bên dưới" },
      { key: "top", label: "Ảnh nhỏ ngang bên trên" },
      { key: "none", label: "Không ảnh nhỏ (mũi tên + chấm)" },
    ],
  },
  filterCategories: {
    heading: true,
    options: [
      { key: "list", label: "Cây danh mục" },
      { key: "accordion", label: "Xổ xuống từng nhóm" },
      { key: "checkbox", label: "Ô tích" },
      { key: "chips", label: "Chip bo tròn" },
      { key: "tiles", label: "Ô vuông 2 cột" },
      { key: "dropdown", label: "Ô chọn (dropdown)" },
    ],
  },
  filterPrice: {
    heading: true,
    options: [
      { key: "chips", label: "Chip + ô Min/Max" },
      { key: "radio", label: "Nút tròn + Min/Max" },
      { key: "checkbox", label: "Ô tích + Min/Max" },
      { key: "tiles", label: "Ô vuông 2 cột" },
      { key: "inputs", label: "Chỉ ô Min / Max" },
      { key: "dropdown", label: "Ô chọn (dropdown)" },
    ],
  },
  filterColors: {
    heading: true,
    options: [
      { key: "list", label: "Chấm màu + tên, 2 cột" },
      { key: "swatches", label: "Chỉ ô màu tròn" },
      { key: "chips", label: "Chip có chấm màu" },
      { key: "checkbox", label: "Ô tích" },
      { key: "dropdown", label: "Ô chọn (dropdown)" },
    ],
  },
  filterRating: {
    heading: true,
    options: [
      { key: "chips", label: "Chip 4★ / 3★" },
      { key: "list", label: "Danh sách 4★ → 1★" },
      { key: "radio", label: "Nút tròn 4★ → 1★" },
      { key: "dropdown", label: "Ô chọn (dropdown)" },
    ],
  },
  filterClear: {
    label: "Clear all filters",
    options: [
      { key: "link", label: "Liên kết chữ" },
      { key: "button", label: "Nút viền" },
      { key: "chip", label: "Chip có dấu ×" },
    ],
  },
  productRating: {
    options: [
      { key: "full", label: "Điểm + sao + số đánh giá" },
      { key: "compact", label: "Gọn: ★ 4.8 (12)" },
      { key: "stars", label: "Chỉ sao" },
    ],
  },
  productPrice: {
    options: [
      { key: "amazon", label: "Kiểu Amazon (số xu nhỏ)" },
      { key: "small", label: "Kiểu Amazon nhỏ" },
      { key: "plain", label: "Chữ thường (chỉnh ở mục Chữ)" },
      { key: "sale", label: "Chữ thường + khoảng giá" },
    ],
  },
  productOptions: {
    options: [
      { key: "buttons", label: "Nút vuông" },
      { key: "pills", label: "Nút bo tròn" },
      { key: "swatches", label: "Ô màu tròn (nhóm Color)" },
      { key: "list", label: "Danh sách nút tròn" },
      { key: "dropdown", label: "Ô chọn (dropdown)" },
    ],
  },
  productStock: {
    options: [
      { key: "text", label: "Chữ + lựa chọn đang chọn" },
      { key: "simple", label: "Chỉ chữ" },
      { key: "badge", label: "Nhãn màu" },
    ],
  },
  productQty: {
    options: [
      { key: "select", label: "Ô chọn kiểu Amazon" },
      { key: "stepper", label: "Nút − số +" },
    ],
  },
  productAddToCart: {
    label: "Add to Cart",
    options: [
      { key: "yellow", label: "Vàng (Amazon)" },
      { key: "orange", label: "Cam (Amazon)" },
      { key: "accent", label: "Màu nhấn, bo tròn" },
      { key: "dark", label: "Đen, bo tròn" },
      { key: "outline", label: "Viền" },
      { key: "inherit", label: "Theo nền / chữ của khối" },
    ],
  },
  productBuyNow: {
    label: "Buy Now",
    options: [
      { key: "orange", label: "Cam (Amazon)" },
      { key: "yellow", label: "Vàng (Amazon)" },
      { key: "accent", label: "Màu nhấn, bo tròn" },
      { key: "dark", label: "Đen, bo tròn" },
      { key: "outline", label: "Viền" },
      { key: "inherit", label: "Theo nền / chữ của khối" },
    ],
  },
  productDelivery: {
    options: [
      { key: "full", label: "Ngày giao + nơi nhận" },
      { key: "compact", label: "Một dòng" },
      { key: "box", label: "Hộp có biểu tượng" },
    ],
  },
  productShipInfo: {
    options: [
      { key: "table", label: "Bảng (kiểu Amazon)" },
      { key: "inline", label: "Một dòng" },
      { key: "badges", label: "3 huy hiệu có biểu tượng" },
    ],
  },
  productBullets: {
    label: "About this item",
    options: [
      { key: "bullets", label: "Chấm đầu dòng" },
      { key: "checks", label: "Dấu tích xanh" },
      { key: "plain", label: "Dòng trơn" },
    ],
  },
};

/** Hanh vi slider (khong theo breakpoint). */
export type SliderOpts = {
  effect?: "slide" | "fade";
  autoplay?: boolean;
  /** ms */
  interval?: number;
  loop?: boolean;
  arrows?: boolean;
  dots?: "none" | "below" | "inside";
  pauseOnHover?: boolean;
};

export type AnimType = "none" | "fade" | "fade-up" | "fade-down" | "zoom" | "slide-left" | "slide-right" | "blur";
/** Hieu ung xuat hien khi cuon toi. stagger: ap cho tung con lan luot (ms giua hai con) thay vi ca khoi. */
export type Anim = { type: AnimType; duration?: number; delay?: number; stagger?: number };

export type NodeProps = {
  text?: string;
  tag?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  src?: string;
  alt?: string;
  fit?: "cover" | "contain";
  href?: string;
  newTab?: boolean;
  label?: string;
  title?: string;
  source?: ProductSource;
  catalogueId?: number;
  keyword?: string;
  limit?: number;
  linkLabel?: string;
  /** productRow: "amazon" = hang cuon kieu Amazon co san (mac dinh), "custom" = tu chon luoi / slider + kieu the */
  display?: "amazon" | "custom";
  cardRatio?: string;
  cardStyle?: "plain" | "boxed";
  showRating?: boolean;
  showPrice?: boolean;
  titleAlign?: "left" | "center";
  slider?: SliderOpts;
  anim?: Anim;
  /** video: link YouTube / Vimeo / file .mp4 */
  url?: string;
  /** source "manual": san pham chi dinh, theo thu tu */
  productIds?: number[];
  /** khoi danh muc / the danh muc: nguon + danh muc chi dinh */
  catSource?: CatalogueSource;
  catalogueIds?: number[];
  /** icon: ten trong bo icon (icons.tsx) */
  icon?: string;
  /** khoi trang: ten phan (SLOTS) */
  slot?: string;
  /** khoi trang bo loc: doi chu tieu de, an tieu de, cho thu gon */
  heading?: string;
  hideHeading?: boolean;
  collapsible?: boolean;
  /** bo anh san pham: canh anh nho (px), tat phong to khi re chuot (limit = so anh nho hien) */
  thumbSize?: number;
  noZoom?: boolean;
  /** collection: lap the mau (con duy nhat) cho tung danh muc / san pham */
  collection?: RecordKind;
  /** container: gan voi MOT ban ghi cu the — con ben trong dung {{truong}} cua ban ghi do */
  bind?: { kind: RecordKind; id: number; label?: string };
  /** header: nav — them danh muc san pham vao menu; links: lien ket tu nhap */
  links?: { label: string; href: string }[];
  withCategories?: boolean;
  /** nav: thu gon thanh nut ☰ tu breakpoint nay tro xuong */
  collapse?: "tablet" | "mobile" | "never";
  tone?: "light" | "dark";
  placeholder?: string;
  /** trong the mau: anh lay tu du lieu ({{image}}) */
  bindImage?: boolean;
  /** trong the mau: mau nen lay tu du lieu ({{bg}} — bang mau pastel xoay vong) */
  bindBg?: boolean;
  /** trong the mau: anh nen cua khung lay tu du lieu (kieu "anh phu chu") */
  bindBgImage?: boolean;
  /** collection: kieu the dang dung (library.ts CARD_DESIGNS) — de inspector danh dau */
  design?: string;
  /** collection: tuy chinh rieng tung the — the thu i (tinh tu 0) -> id node trong the mau -> style / props ghi de */
  perItem?: Record<string, Record<string, ItemOverride>>;
};

export type ImageAdjust = { exposure?: number; contrast?: number; saturation?: number; temperature?: number; tint?: number; blur?: number };

/** CSS filter tu thong so chinh mau; nhiet do am = lanh (xanh), duong = am (vang); sac do = xoay mau. */
export function adjustFilter(a: ImageAdjust | undefined): string | null {
  if (!a) return null;
  const f: string[] = [];
  if (a.exposure) f.push(`brightness(${(1 + a.exposure / 100).toFixed(2)})`);
  if (a.contrast) f.push(`contrast(${(1 + a.contrast / 100).toFixed(2)})`);
  if (a.saturation) f.push(`saturate(${(1 + a.saturation / 100).toFixed(2)})`);
  if (a.temperature && a.temperature > 0) f.push(`sepia(${(a.temperature / 250).toFixed(2)})`);
  if (a.temperature && a.temperature < 0) f.push(`hue-rotate(${Math.round(a.temperature * 0.25)}deg) saturate(${(1 - a.temperature / 400).toFixed(2)})`);
  if (a.tint) f.push(`hue-rotate(${Math.round(a.tint * 0.9)}deg)`);
  if (a.blur) f.push(`blur(${a.blur}px)`);
  return f.length ? f.join(" ") : null;
}

/** Ghi de cho mot node cua the mau, chi ap cho mot the trong "Danh sách dữ liệu". */
export type ItemOverride = { style?: Partial<Record<Breakpoint, Style>>; props?: Partial<NodeProps> };

export type BuilderNode = {
  id: string;
  type: NodeType;
  name?: string;
  props: NodeProps;
  style: Partial<Record<Breakpoint, Style>>;
  children?: string[];
  parent: string | null;
};

/**
 * Cai dat ca trang (luu trong doc nen theo ban nhap / xuat ban va undo):
 *  - header / footer: "global" (mac dinh, phan chung), "none" (an), hoac slug thiet ke rieng "header-xxx" / "footer-xxx"
 *  - seo*: rieng cho landing page
 */
export type PageSettings = { header?: string; footer?: string; seoTitle?: string; seoDescription?: string; seoImage?: string };
export type BuilderDoc = { version: 1; root: string; nodes: Record<string, BuilderNode>; settings?: PageSettings };

export type PartKind = "header" | "footer";
/** Slug header / footer: phan chung "header" hoac thiet ke rieng "header-<ten>" */
export const PART_SLUG = /^(header|footer)(-[a-z0-9][a-z0-9-]{0,59})?$/;
export const partKindOf = (slug: string): PartKind | null => (PART_SLUG.test(slug) ? (slug.split("-")[0] as PartKind) : null);
/** Lua chon trong cai dat trang -> slug header / footer can ve (null = an). Slug sai loai -> dung phan chung. */
export function partSlug(choice: string | undefined, kind: PartKind): string | null {
  if (choice === "none") return null;
  return choice && partKindOf(choice) === kind ? choice : kind;
}

function cleanSettings(raw: unknown): PageSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const part = (v: unknown) => (v === "none" || (typeof v === "string" && PART_SLUG.test(v)) ? (v as string) : undefined);
  const s: PageSettings = {
    header: part(r.header),
    footer: part(r.footer),
    seoTitle: str(r.seoTitle, 200),
    seoDescription: str(r.seoDescription, 500),
    seoImage: str(r.seoImage, 500),
  };
  for (const k of Object.keys(s) as (keyof PageSettings)[]) if (s[k] === undefined) delete s[k];
  return Object.keys(s).length ? s : undefined;
}

/** Du lieu cua cac khoi lay tu DB (san pham, danh muc), theo id node — do server tinh (data.ts). */
export type BlockData = Record<string, unknown>;

export const CONTAINERS: NodeType[] = ["page", "section", "frame"];
export const isContainer = (n: BuilderNode | undefined) => !!n && CONTAINERS.includes(n.type);
/** Khoi san pham tu chon bo cuc (luoi / slider) — productRow kieu Amazon dung component co san. */
export const isProducts = (n: BuilderNode | undefined) => !!n && (n.type === "productGrid" || (n.type === "productRow" && n.props.display === "custom"));
/** Khoi lay du lieu tu DB (editor hoi lai server khi doi nguon). */
export const DATA_TYPES: NodeType[] = ["productRow", "productGrid", "categoryHero", "collection", "nav"];
/** Node co the doi kieu xep (stack / grid / slider). */
export const hasLayout = (n: BuilderNode | undefined) => isContainer(n) || isProducts(n) || n?.type === "collection";

export const TYPE_LABEL: Record<NodeType, string> = {
  page: "Trang",
  section: "Section",
  frame: "Frame",
  text: "Chữ",
  image: "Ảnh",
  button: "Nút",
  divider: "Đường kẻ",
  video: "Video",
  icon: "Icon",
  logo: "Logo",
  search: "Ô tìm kiếm",
  cart: "Giỏ hàng",
  account: "Tài khoản",
  nav: "Menu",
  productRow: "Khối sản phẩm",
  productGrid: "Lưới sản phẩm",
  categoryHero: "Thẻ danh mục",
  collection: "Danh sách dữ liệu",
  slot: "Khối trang",
};

export const SOURCE_LABEL: Record<ProductSource, string> = {
  bestsellers: "Bán chạy",
  newest: "Mới nhất",
  christmas: "Christmas (cũ)",
  catalogue: "Theo danh mục",
  keyword: "Theo từ khóa",
  manual: "Chọn tay",
  related: "Liên quan trang đang xem",
  listing: "Danh sách của trang đang xem",
};

/** Truong dung duoc trong {{...}} theo loai du lieu (data.ts dien gia tri). */
export const RECORD_FIELDS: Record<RecordKind, { key: string; label: string }[]> = {
  products: [
    { key: "name", label: "Tên" },
    { key: "price", label: "Giá" },
    { key: "description", label: "Mô tả" },
    { key: "category", label: "Danh mục" },
    { key: "rating", label: "Sao" },
    { key: "reviews", label: "Số đánh giá" },
    { key: "url", label: "Link" },
    { key: "image", label: "Ảnh" },
  ],
  categories: [
    { key: "name", label: "Tên" },
    { key: "count", label: "Số sản phẩm" },
    { key: "description", label: "Mô tả" },
    { key: "url", label: "Link" },
    { key: "image", label: "Ảnh" },
  ],
  posts: [
    { key: "name", label: "Tiêu đề" },
    { key: "description", label: "Tóm tắt" },
    { key: "date", label: "Ngày" },
    { key: "url", label: "Link" },
    { key: "image", label: "Ảnh" },
  ],
};

export const KIND_LABEL: Record<RecordKind, string> = { products: "Sản phẩm", categories: "Danh mục", posts: "Bài viết" };

/** Loai du lieu ma node dung duoc qua {{...}}: khung gan ban ghi gan nhat, hoac the mau cua collection. */
export function dataKindOf(doc: BuilderDoc, id: string): RecordKind | null {
  let cur: BuilderNode | undefined = doc.nodes[id];
  while (cur) {
    if (cur.props.bind) return cur.props.bind.kind;
    const p: BuilderNode | undefined = cur.parent ? doc.nodes[cur.parent] : undefined;
    if (p?.type === "collection") return p.props.collection ?? "categories";
    cur = p;
  }
  return null;
}

export const ANIM_LABEL: Record<AnimType, string> = {
  none: "Không",
  fade: "Hiện dần",
  "fade-up": "Trồi lên",
  "fade-down": "Rơi xuống",
  zoom: "Phóng to",
  "slide-left": "Trượt từ trái",
  "slide-right": "Trượt từ phải",
  blur: "Rõ dần",
};

export const HOVER_LABEL: Record<Hover, string> = {
  none: "Không",
  lift: "Nổi lên",
  grow: "Phóng to",
  shadow: "Đổ bóng",
  dim: "Mờ đi",
  zoomImage: "Zoom ảnh bên trong",
};

export function nodeName(n: BuilderNode) {
  if (n.name) return n.name;
  if (n.type === "text" && n.props.text) return n.props.text.slice(0, 40);
  if (n.type === "button" && n.props.label) return n.props.label;
  if ((n.type === "productRow" || n.type === "productGrid") && n.props.title) return n.props.title;
  if (n.type === "slot" && n.props.slot) return SLOTS[n.props.slot]?.label ?? TYPE_LABEL.slot;
  return TYPE_LABEL[n.type];
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------ Style theo breakpoint ------------------------------ */

/** Style hieu luc tai breakpoint: desktop-first, breakpoint nho ke thua breakpoint lon. */
export function effectiveStyle(n: BuilderNode, bp: Breakpoint): Style {
  const s = { ...n.style.base };
  if (bp === "tablet" || bp === "mobile") Object.assign(s, n.style.tablet);
  if (bp === "mobile") Object.assign(s, n.style.mobile);
  return s;
}

/** Kieu xep hieu luc (null: node khong xep con). Container mac dinh stack, khoi san pham mac dinh luoi. */
export function layoutOf(n: BuilderNode, s: Style): Layout | null {
  if (isContainer(n)) return s.layout ?? "stack";
  if (n.type === "collection") return s.layout === "free" ? "grid" : (s.layout ?? "grid");
  if (isProducts(n)) return s.layout === "slider" ? "slider" : "grid";
  return null;
}

/** "Danh sách dữ liệu" chua node (node nam trong the mau cua no), hoac null. */
export function collectionOf(doc: BuilderDoc, id: string): BuilderNode | null {
  let cur: BuilderNode | undefined = doc.nodes[id];
  while (cur?.parent) {
    const p: BuilderNode | undefined = doc.nodes[cur.parent];
    if (p?.type === "collection") return p;
    cur = p;
  }
  return null;
}

/** Style hieu luc cua node trong mot the cu the (style chung + ghi de rieng cua the do). */
export function itemStyle(n: BuilderNode, o: ItemOverride | undefined, bp: Breakpoint): Style {
  const s = effectiveStyle(n, bp);
  if (!o?.style) return s;
  Object.assign(s, o.style.base);
  if (bp === "tablet" || bp === "mobile") Object.assign(s, o.style.tablet);
  if (bp === "mobile") Object.assign(s, o.style.mobile);
  return s;
}

/** Co breakpoint nao la slider khong — co thi renderer boc con trong .bb-track va gan Slider (client). */
export function hasSlider(n: BuilderNode) {
  return BREAKPOINTS.some(({ key }) => layoutOf(n, effectiveStyle(n, key)) === "slider");
}

const SHADOWS = {
  none: "none",
  sm: "0 1px 3px rgba(60,45,30,.12)",
  md: "0 6px 18px rgba(60,45,30,.14)",
  lg: "0 16px 40px rgba(60,45,30,.18)",
};
const FLEX: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", between: "space-between", stretch: "stretch" };

type Decls = Record<string, string>;
/** Khai bao theo selector: "" = chinh node (.b-id), con lai la hau to (">.bb-track", ":hover"...). */
type Rules = Record<string, Decls>;

/** Slider: khung thuong mac dinh 1 slide / lan (banner), khoi san pham / danh sach 4 the / lan. */
export function defaultPerView(n: BuilderNode) {
  return isContainer(n) ? 1 : 4;
}

function defaultWidth(t: NodeType): SizeMode {
  return ["image", "button", "icon", "logo", "cart", "account", "nav"].includes(t) ? "hug" : "fill";
}

/** CSS cua mot node tai mot breakpoint (can node + style cua cha de hieu Fill / Hug va kieu xep cua cha). */
function rules(n: BuilderNode, s: Style, parent: BuilderNode | null, ps: Style | null, slider: boolean): Rules {
  const r: Rules = { "": {} };
  const d = r[""];
  const at = (sel: string) => (r[sel] ??= {});
  if (s.hidden) {
    d.display = "none";
    return r;
  }
  const container = isContainer(n);

  /* ---- Kieu xep con ---- */
  const L = layoutOf(n, s);
  // Container / collection xep con ngay tren chinh no; khoi san pham xep cac the trong .bb-items
  const T = container || n.type === "collection" ? "" : ">.bb-items";
  if (L) {
    const t = at(T);
    if (L === "stack") {
      t.display = "flex";
      t["flex-direction"] = s.direction ?? "column";
      t["flex-wrap"] = s.wrap ? "wrap" : "nowrap";
      t.gap = `${s.gap ?? 0}px`;
      t["justify-content"] = FLEX[s.justify ?? "start"];
      t["align-items"] = FLEX[s.align ?? "start"];
    } else if (L === "free") {
      t.display = "block";
      // Khung tu do khong tu cao theo con (con dat absolute): mac dinh 320px, keo / dat Fixed thi theo do
      if (s.height?.mode !== "fixed") t["min-height"] = `${s.minHeight ?? 320}px`;
    } else if (L === "grid") {
      t.display = "grid";
      const cols = s.columns ?? 3;
      t["grid-template-columns"] = `repeat(${cols}, minmax(0, 1fr))`;
      t.gap = `${s.gap ?? 16}px`;
      t["align-items"] = FLEX[s.align ?? "stretch"];
      if (s.rowHeight) t["grid-auto-rows"] = `${s.rowHeight}px`;
      // The dau tien noi bat: chiem nhieu cot / hang (khong vuot so cot cua breakpoint)
      if ((s.firstColSpan ?? 1) > 1 || (s.firstRowSpan ?? 1) > 1) {
        const first = at(`${T}${slider ? ">.bb-track" : ""}>:first-child`);
        if ((s.firstColSpan ?? 1) > 1) first["grid-column"] = `span ${Math.min(s.firstColSpan!, cols)}`;
        if ((s.firstRowSpan ?? 1) > 1) first["grid-row"] = `span ${s.firstRowSpan}`;
      }
    } else {
      const g = s.gap ?? 16;
      const per = Math.max(1, s.perView ?? defaultPerView(n));
      const fade = n.props.slider?.effect === "fade";
      t.display = "block";
      t.position = "relative";
      const track = at(`${T}>.bb-track`);
      const item = at(`${T}>.bb-track>*`);
      if (fade) {
        track.display = "grid";
        track.overflow = "hidden";
        Object.assign(item, { "grid-area": "1 / 1", opacity: "0", visibility: "hidden", transition: "opacity .7s ease, visibility .7s", "min-width": "0" });
        Object.assign(at(`${T}>.bb-track>[data-active]`), { opacity: "1", visibility: "visible", "z-index": "1" });
        Object.assign(at(`${T}:not([data-ready])>.bb-track>:first-child`), { opacity: "1", visibility: "visible" });
      } else {
        Object.assign(track, {
          display: "flex",
          "flex-direction": "row",
          "flex-wrap": "nowrap",
          "overflow-x": "auto",
          "scroll-snap-type": "x mandatory",
          "scroll-behavior": "smooth",
          "overscroll-behavior-x": "contain",
          gap: `${g}px`,
          "align-items": FLEX[s.align ?? "stretch"],
        });
        Object.assign(item, {
          flex: `0 0 calc((100% - ${(per - 1) * g + (s.peek ?? 0)}px) / ${per})`,
          "max-width": "none",
          "min-width": "0",
          "scroll-snap-align": "start",
        });
      }
      at(`${T}>.bb-nav`).display = "block";
    }
    // Khung co slider o breakpoint khac: o day bo lop .bb-track (display: contents) va an mui ten
    if (slider && L !== "slider") {
      at(`${T}>.bb-track`).display = "contents";
      at(`${T}>.bb-nav`).display = "none";
    }
    if (s.maxItems && L !== "stack") at(`${T}${slider ? ">.bb-track" : ""}>*:nth-child(n+${s.maxItems + 1})`).display = "none";
  }

  // Moi container la goc toa do cho con dat tu do
  if (container) d.position = "relative";

  /* ---- Rieng tung loai ---- */
  if (n.type === "text") {
    d["white-space"] = "pre-line";
    d["overflow-wrap"] = "break-word";
    if (s.maxLines) {
      d.display = "-webkit-box";
      d["-webkit-box-orient"] = "vertical";
      d["-webkit-line-clamp"] = String(s.maxLines);
      d.overflow = "hidden";
    }
  } else if (n.type === "image") {
    d.display = "block";
    d["object-fit"] = n.props.fit ?? "cover";
    if (s.objectPosition) d["object-position"] = s.objectPosition;
    const fx = adjustFilter(s.adjust);
    if (fx) d.filter = fx;
  } else if (n.type === "icon") {
    d.display = "inline-flex";
    d["flex-shrink"] = "0";
  } else if (n.type === "button") {
    d.display = "inline-flex";
    d["align-items"] = "center";
    d["justify-content"] = "center";
    d["text-decoration"] = "none";
  } else if (n.type === "divider") {
    d.display = "block";
    d.border = "0";
  } else if (n.type === "video") {
    d.display = "block";
    d["aspect-ratio"] = "16 / 9";
  } else if (container && n.props.href) {
    d["text-decoration"] = "none";
    d.color = "inherit";
  }

  const p = s.padding ?? [0, 0, 0, 0];
  if (p.some(Boolean) || s.contentWidth) {
    d.padding = `${p[0]}px ${p[1]}px ${p[2]}px ${p[3]}px`;
    if (s.contentWidth) {
      // Nen tran man hinh, noi dung canh giua trong be rong contentWidth
      d["padding-left"] = `max(${p[3]}px, calc((100% - ${s.contentWidth}px) / 2))`;
      d["padding-right"] = `max(${p[1]}px, calc((100% - ${s.contentWidth}px) / 2))`;
    }
  }

  /* ---- Kich thuoc: phu thuoc kieu xep cua cha ---- */
  const w = s.width ?? { mode: defaultWidth(n.type) };
  const h = s.height ?? { mode: "hug" };
  const pl = parent && ps ? layoutOf(parent, ps) : "stack";
  const free = pl === "free" || s.position === "absolute";
  if (free && parent) {
    // Dat tu do: toa do x/y trong khung cha; Fill = rong het khung cha
    d.position = "absolute";
    d.left = `${s.x ?? 0}px`;
    d.top = `${s.y ?? 0}px`;
    if (s.z) d["z-index"] = String(s.z);
    if (w.mode === "fixed") d.width = `${w.value ?? 100}px`;
    else if (w.mode === "fill") d.width = `calc(100% - ${s.x ?? 0}px)`;
    else d.width = "max-content";
    if (h.mode === "fixed") d.height = `${h.value ?? 100}px`;
  } else if (pl === "stack") {
    // Fill tren truc chinh = flex:1, tren truc phu = stretch; moi node chi co mot truc phu nen align-self khong ghi de
    const wMain = (ps?.direction ?? "column") === "row";
    const sizeAxis = (sz: Size, isMain: boolean, prop: "width" | "height") => {
      if (sz.mode === "fixed") {
        d[prop] = `${sz.value ?? 100}px`;
        if (isMain) d["flex-shrink"] = "0";
      } else if (sz.mode === "fill") {
        if (isMain) {
          d.flex = "1 1 0";
          d[prop === "width" ? "min-width" : "min-height"] = "0";
        } else {
          d["align-self"] = "stretch";
        }
      } else if (!isMain && ps?.align === "stretch") {
        // Hug tren truc phu: rong theo noi dung, khong de align-items: stretch cua cha keo gian
        d["align-self"] = "flex-start";
      }
    };
    sizeAxis(w, wMain, "width");
    sizeAxis(h, !wMain, "height");
  } else {
    // Trong luoi / slider: be rong do cot / slide quyet dinh; Hug = sat trai, Fixed = px
    if (w.mode === "fixed") d.width = `${w.value ?? 100}px`;
    else if (w.mode === "hug" && pl === "grid") d["justify-self"] = "start";
    if (h.mode === "fixed") d.height = `${h.value ?? 100}px`;
    if (pl === "grid") {
      // O luoi chiem nhieu cot / hang (gioi han theo so cot cua khung cha o breakpoint nay)
      if ((s.colSpan ?? 1) > 1) d["grid-column"] = `span ${Math.min(s.colSpan!, ps?.columns ?? 3)}`;
      if ((s.rowSpan ?? 1) > 1) d["grid-row"] = `span ${s.rowSpan}`;
      if (s.selfJustify && s.selfJustify !== "auto") d["justify-self"] = FLEX[s.selfJustify];
    }
  }
  // Can rieng (ghi de can cua khung cha) — trong hang / cot Auto layout va trong o luoi
  if (!free && s.selfAlign && s.selfAlign !== "auto") d["align-self"] = FLEX[s.selfAlign];
  if (s.margin?.some(Boolean)) d.margin = s.margin.map((v) => `${v}px`).join(" ");
  d["max-width"] = s.maxWidth ? `${s.maxWidth}px` : "100%";
  if (s.minHeight && L !== "free") d["min-height"] = `${s.minHeight}px`;
  if (s.aspectRatio) d["aspect-ratio"] = s.aspectRatio;

  /* ---- Giao dien ---- */
  if (s.background) d["background-color"] = s.background;
  if (s.background && /gradient\(/.test(s.background)) {
    delete d["background-color"];
    d["background-image"] = s.background;
  }
  if (s.backgroundImage) {
    // Anh nen la lop ::before rieng phia sau noi dung: phong to (crop) / chinh mau chi tac dong len anh, khong len chu.
    // Lop phu mau la ::after nam tren anh, duoi noi dung (isolation tao ngu canh xep lop rieng cho khung).
    const url = `url("${s.backgroundImage.replace(/["\\]/g, "")}")`;
    const mode = s.bgSize ?? "cover";
    const pos = s.bgPosition ?? "center";
    d.isolation = "isolate";
    const bg = at("::before");
    Object.assign(bg, {
      content: '""',
      position: "absolute",
      inset: "0",
      "z-index": "-2",
      "border-radius": "inherit",
      "pointer-events": "none",
      "background-image": url,
      "background-position": pos,
      "background-repeat": mode === "auto" ? "repeat" : "no-repeat",
      "background-size": mode === "contain" ? "contain" : mode === "auto" ? `${s.bgTile ?? 160}px auto` : "cover",
    });
    if (mode === "crop" && (s.bgZoom ?? 100) > 100) {
      // Phong to quanh diem dang chon (background-position) — khung cat phan thua
      bg.transform = `scale(${(s.bgZoom! / 100).toFixed(2)})`;
      bg["transform-origin"] = pos.includes("%") ? pos : "center";
      d.overflow = "hidden";
    }
    const fx = adjustFilter(s.adjust);
    if (fx) bg.filter = fx;
    if (s.overlay) Object.assign(at("::after"), { content: '""', position: "absolute", inset: "0", "z-index": "-1", "border-radius": "inherit", "pointer-events": "none", background: s.overlay });
  }
  if (s.radius) {
    d["border-radius"] = `${s.radius}px`;
    if (container || n.type === "image" || n.type === "video") d.overflow = "hidden";
  }
  if (s.borderWidth) d.border = `${s.borderWidth}px solid ${s.borderColor ?? "#e2d9cb"}`;
  if (s.shadow && s.shadow !== "none") d["box-shadow"] = SHADOWS[s.shadow];
  if (s.opacity !== undefined && s.opacity < 1) d.opacity = String(s.opacity);

  if (s.hover && s.hover !== "none") {
    d.transition = "transform .3s cubic-bezier(.2,.7,.2,1), box-shadow .3s, opacity .3s";
    const hv = at(":hover");
    if (s.hover === "lift") Object.assign(hv, { transform: "translateY(-4px)", "box-shadow": SHADOWS.md });
    else if (s.hover === "grow") hv.transform = "scale(1.03)";
    else if (s.hover === "shadow") hv["box-shadow"] = SHADOWS.lg;
    else if (s.hover === "dim") hv.opacity = ".82";
    else if (s.hover === "zoomImage") {
      d.overflow = "hidden";
      at(" img").transition = "transform .5s cubic-bezier(.2,.7,.2,1)";
      at(":hover img").transform = "scale(1.06)";
    }
  }

  // Luon ghi display: khoi an o breakpoint lon roi hien lai o breakpoint nho khong bi "display: unset" (= inline)
  d.display ??= DISPLAY[n.type] ?? "block";

  /* ---- Chu ---- */
  if (s.fontFamily) d["font-family"] = s.fontFamily === "display" ? "var(--font-display)" : "var(--font-sans)";
  if (s.fontSize) d["font-size"] = `${s.fontSize}px`;
  if (s.fontWeight) d["font-weight"] = String(s.fontWeight);
  if (s.lineHeight) d["line-height"] = String(s.lineHeight);
  if (s.letterSpacing) d["letter-spacing"] = `${s.letterSpacing}px`;
  if (s.color) d.color = s.color;
  if (s.textAlign) d["text-align"] = s.textAlign;
  if (s.uppercase) d["text-transform"] = "uppercase";
  return r;
}

const DISPLAY: Partial<Record<NodeType, string>> = { search: "flex", cart: "inline-flex", account: "inline-flex", logo: "inline-flex" };

/** CSS chung: nut, slider (mui ten / cham), the san pham, hieu ung xuat hien. */
const BASE_CSS = `
.bb-btn{transition:filter .15s}.bb-btn:hover{filter:brightness(.93)}
.bb-track{scrollbar-width:none}.bb-track::-webkit-scrollbar{display:none}
.bb-nav{display:none}
.bb-arrow{position:absolute;top:50%;z-index:3;display:grid;place-items:center;width:40px;height:40px;margin-top:-20px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.16);color:#22201c;cursor:pointer;transition:opacity .2s,transform .2s}
.bb-arrow:hover{transform:scale(1.08)}.bb-arrow:disabled{opacity:0;pointer-events:none}
.bb-prev{left:8px}.bb-next{right:8px}
.bb-dots{display:flex;justify-content:center;gap:6px;margin-top:14px}
.bb-dots-inside .bb-dots{position:absolute;left:0;right:0;bottom:16px;z-index:3;margin:0}
.bb-dot{width:8px;height:8px;padding:0;border:0;border-radius:999px;background:rgba(34,32,28,.22);cursor:pointer;transition:width .3s,background .3s}
.bb-dots-inside .bb-dot{background:rgba(255,255,255,.55)}
.bb-dot[aria-current=true]{width:22px;background:#22201c}.bb-dots-inside .bb-dot[aria-current=true]{background:#fff}
.bb-phead{display:flex;align-items:baseline;gap:16px;margin-bottom:12px}.bb-phead[data-align=center]{justify-content:center}
.bb-ptitle{font-size:20px;font-weight:700;line-height:1.2}
.bb-search{display:flex;min-width:0;height:40px;border-radius:8px;overflow:hidden;background:#fff}
.bb-search input{flex:1;min-width:0;border:0;padding:0 12px;font:inherit;font-size:14px;color:#22201c;outline:none;background:transparent}
.bb-search button{display:grid;place-items:center;width:46px;border:0;background:#e9b04a;color:#22201c;cursor:pointer}
.bb-cart,.bb-account{display:inline-flex;align-items:center;gap:6px;color:inherit;text-decoration:none;white-space:nowrap}
.bb-cart-count{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#e9b04a;color:#22201c;font-size:11px;font-weight:700}
.bb-navlist{display:flex;align-items:center;gap:20px;margin:0;padding:0;list-style:none;flex-wrap:wrap}
.bb-navlist a{color:inherit;text-decoration:none;white-space:nowrap}.bb-navlist a:hover{text-decoration:underline}
.bb-navitem{position:relative}
.bb-sub{display:none;position:absolute;left:0;top:100%;z-index:40;min-width:210px;margin:0;padding:8px 0;list-style:none;border-radius:8px;background:#fff;color:#22201c;box-shadow:0 10px 30px rgba(0,0,0,.16)}
.bb-sub a{display:block;padding:7px 16px}
.bb-navitem:hover>.bb-sub,.bb-navitem:focus-within>.bb-sub{display:block}
.bb-navtoggle,.bb-burger,.bb-navclose{display:none}
.bb-burger{place-items:center;width:40px;height:40px;cursor:pointer}
@media (max-width:1023px){.bb-collapse-tablet .bb-burger{display:grid}.bb-collapse-tablet .bb-navlist{display:none}}
@media (max-width:639px){.bb-collapse-mobile .bb-burger{display:grid}.bb-collapse-mobile .bb-navlist{display:none}}
.bb-navtoggle:checked~.bb-navlist{display:flex;position:fixed;inset:0 auto 0 0;z-index:60;width:min(320px,86vw);flex-direction:column;align-items:stretch;flex-wrap:nowrap;gap:0;overflow:auto;padding:56px 20px 24px;background:#fff;color:#22201c;box-shadow:0 0 40px rgba(0,0,0,.25)}
.bb-navtoggle:checked~.bb-navlist a{display:block;padding:10px 0;font-size:16px}
.bb-navtoggle:checked~.bb-navlist .bb-sub{display:block;position:static;box-shadow:none;padding:0 0 0 14px;min-width:0}
.bb-navtoggle:checked~.bb-navclose{display:block;position:fixed;inset:0;z-index:59;background:rgba(0,0,0,.4)}
@keyframes bb-fade{from{opacity:0}}
@keyframes bb-fade-up{from{opacity:0;transform:translateY(28px)}}
@keyframes bb-fade-down{from{opacity:0;transform:translateY(-28px)}}
@keyframes bb-zoom{from{opacity:0;transform:scale(.9)}}
@keyframes bb-slide-left{from{opacity:0;transform:translateX(-48px)}}
@keyframes bb-slide-right{from{opacity:0;transform:translateX(48px)}}
@keyframes bb-blur{from{opacity:0;filter:blur(14px)}}
html:not(.bb-editor) [data-anim]:not(.bb-in){opacity:0}
[data-anim].bb-in{animation:var(--bb-anim) var(--bb-dur,700ms) cubic-bezier(.2,.7,.2,1) var(--bb-delay,0ms) backwards}
@media (prefers-reduced-motion:reduce){[data-anim]{animation:none!important;opacity:1!important}}
`;

const MEDIA: Record<Breakpoint, string | null> = { base: null, tablet: "(max-width: 1023px)", mobile: "(max-width: 639px)" };

/**
 * CSS cua ca trang: moi node mot class `.b-<id>` (+ cac selector phu cho slider / hover); breakpoint nho chi ghi
 * nhung khai bao khac breakpoint lon (thuoc tinh bien mat thi tra ve `unset`).
 */
export function toCss(doc: BuilderDoc): string {
  const blocks: Record<Breakpoint, string[]> = { base: [], tablet: [], mobile: [] };
  const visit = (id: string, parent: BuilderNode | null) => {
    const n = doc.nodes[id];
    if (!n) return;
    const slider = hasSlider(n);
    let prev: Rules | null = null;
    for (const { key } of BREAKPOINTS) {
      const cur = rules(n, effectiveStyle(n, key), parent, parent ? effectiveStyle(parent, key) : null, slider);
      for (const sel of new Set([...Object.keys(cur), ...Object.keys(prev ?? {})])) {
        const c = cur[sel] ?? {};
        const p = prev?.[sel];
        const out: string[] = [];
        for (const [k, v] of Object.entries(c)) if (!p || p[k] !== v) out.push(`${k}:${v}`);
        if (p) for (const k of Object.keys(p)) if (!(k in c)) out.push(`${k}:unset`);
        if (out.length) blocks[key].push(`.b-${n.id}${sel}{${out.join(";")}}`);
      }
      prev = cur;
    }
    n.children?.forEach((c) => visit(c, n));
    if (n.type === "collection" && n.props.perItem) perItemCss(n, slider);
  };

  /**
   * The tuy chinh rieng: selector ".b-<danh sach>>:nth-child(i)" (+ " .b-<node>" cho node ben trong the) nen manh
   * hon CSS chung cua the mau; moi breakpoint chi ghi phan khac breakpoint lon hon, nhu node thuong.
   */
  const perItemCss = (coll: BuilderNode, slider: boolean) => {
    const template = coll.children?.[0];
    if (!template) return;
    for (const [idx, nodes] of Object.entries(coll.props.perItem ?? {})) {
      const cardSel = `.b-${coll.id}${slider ? ">.bb-track" : ""}>:nth-child(${Number(idx) + 1})`;
      for (const [nid, o] of Object.entries(nodes)) {
        const n = doc.nodes[nid];
        if (!n || !o.style) continue;
        const parent = n.parent ? doc.nodes[n.parent] : null;
        const sel = nid === template ? cardSel : `${cardSel} .b-${nid}`;
        let prev: Rules | null = null;
        for (const { key } of BREAKPOINTS) {
          const ps = parent ? (parent.id === coll.id ? effectiveStyle(parent, key) : itemStyle(parent, nodes[parent.id], key)) : null;
          const cur = rules(n, itemStyle(n, o, key), parent, ps, false);
          for (const suffix of new Set([...Object.keys(cur), ...Object.keys(prev ?? {})])) {
            const c = cur[suffix] ?? {};
            const pv = prev?.[suffix];
            const out: string[] = [];
            for (const [k, v] of Object.entries(c)) if (!pv || pv[k] !== v) out.push(`${k}:${v}`);
            if (pv) for (const k of Object.keys(pv)) if (!(k in c)) out.push(`${k}:unset`);
            if (out.length) blocks[key].push(`${sel}${suffix}{${out.join(";")}}`);
          }
          prev = cur;
        }
      }
    }
  };
  visit(doc.root, null);
  blocks.base.unshift(BASE_CSS.trim());
  return BREAKPOINTS.map(({ key }) => {
    const css = blocks[key].join("\n");
    if (!css) return "";
    return MEDIA[key] ? `@media ${MEDIA[key]}{\n${css}\n}` : css;
  }).join("\n");
}

/* ------------------------------ Thao tac tren cay ------------------------------ */

export function isAncestor(doc: BuilderDoc, ancestorId: string, id: string | null): boolean {
  let cur = id ? doc.nodes[id] : undefined;
  while (cur) {
    if (cur.id === ancestorId) return true;
    cur = cur.parent ? doc.nodes[cur.parent] : undefined;
  }
  return false;
}

export function ancestors(doc: BuilderDoc, id: string): string[] {
  const out: string[] = [];
  let cur = doc.nodes[id];
  while (cur) {
    out.unshift(cur.id);
    cur = cur.parent ? doc.nodes[cur.parent] : (undefined as unknown as BuilderNode);
  }
  return out;
}

/** Mot cay con doc lap (dung cho khoi moi, mau dung san, copy) truoc khi gan vao trang. */
export type Fragment = { root: string; nodes: Record<string, BuilderNode> };

/** Gan cay con vao `parentId` tai vi tri `index` (doi id moi de khong trung). Tra ve id goc moi. */
export function insertFragment(doc: BuilderDoc, frag: Fragment, parentId: string, index: number): string {
  const map: Record<string, string> = {};
  for (const id of Object.keys(frag.nodes)) map[id] = uid();
  for (const n of Object.values(frag.nodes)) {
    doc.nodes[map[n.id]] = {
      ...structuredClone(n),
      id: map[n.id],
      parent: n.id === frag.root ? parentId : map[n.parent!],
      children: n.children?.map((c) => map[c]),
    };
  }
  const parent = doc.nodes[parentId];
  parent.children = parent.children ?? [];
  parent.children.splice(Math.max(0, Math.min(index, parent.children.length)), 0, map[frag.root]);
  return map[frag.root];
}

export function extractFragment(doc: BuilderDoc, id: string): Fragment {
  const nodes: Record<string, BuilderNode> = {};
  const walk = (k: string) => {
    nodes[k] = structuredClone(doc.nodes[k]);
    doc.nodes[k].children?.forEach(walk);
  };
  walk(id);
  return { root: id, nodes };
}

export function removeNode(doc: BuilderDoc, id: string) {
  const n = doc.nodes[id];
  if (!n || !n.parent) return;
  const parent = doc.nodes[n.parent];
  parent.children = parent.children?.filter((c) => c !== id);
  const drop = (k: string) => {
    doc.nodes[k]?.children?.forEach(drop);
    delete doc.nodes[k];
  };
  drop(id);
}

/** Chuyen node sang cha moi; `index` tinh tren danh sach con SAU khi da go node ra. */
export function moveNode(doc: BuilderDoc, id: string, parentId: string, index: number) {
  const n = doc.nodes[id];
  if (!n || !n.parent || isAncestor(doc, id, parentId)) return;
  const from = doc.nodes[n.parent];
  from.children = from.children?.filter((c) => c !== id);
  const to = doc.nodes[parentId];
  to.children = to.children ?? [];
  to.children.splice(Math.max(0, Math.min(index, to.children.length)), 0, id);
  n.parent = parentId;
}

/* ------------------------------ Kiem tra du lieu luu ------------------------------ */

export function parseDoc(raw: unknown): BuilderDoc | null {
  try {
    const doc = (typeof raw === "string" ? JSON.parse(raw) : raw) as BuilderDoc;
    if (!doc || doc.version !== 1 || typeof doc.root !== "string" || !doc.nodes?.[doc.root]) return null;
    for (const [id, n] of Object.entries(doc.nodes)) {
      if (n.id !== id || !(n.type in TYPE_LABEL) || typeof n.props !== "object" || typeof n.style !== "object") return null;
      // id dung lam ten class CSS va data-node-id
      if (!/^[a-z0-9]+$/i.test(id)) return null;
    }
    const settings = cleanSettings(doc.settings);
    if (settings) doc.settings = settings;
    else delete doc.settings;
    return doc;
  } catch {
    return null;
  }
}
