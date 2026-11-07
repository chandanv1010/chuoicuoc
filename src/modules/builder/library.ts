import { PLACEHOLDER } from "@/modules/frontend/image";
import { SITE_NAME_FALLBACK } from "@/lib/constants";
import { CONTAINERS, SLOTS, uid, type Breakpoint, type PageKind, type BuilderDoc, type BuilderNode, type Fragment, type NodeProps, type NodeType, type Style } from "./schema";

/** Khoi dung san cho bang "Chèn" cua editor + ham dung cay tu mo ta long nhau. */

export type Spec = {
  type: NodeType;
  name?: string;
  props?: NodeProps;
  style?: Partial<Record<Breakpoint, Style>>;
  children?: Spec[];
};

const WITH_CHILDREN: NodeType[] = [...CONTAINERS, "collection"];

export function build(spec: Spec): Fragment {
  const nodes: Fragment["nodes"] = {};
  const walk = (s: Spec, parent: string | null): string => {
    const id = uid();
    nodes[id] = { id, type: s.type, name: s.name, props: s.props ?? {}, style: s.style ?? {}, parent };
    if (WITH_CHILDREN.includes(s.type)) nodes[id].children = (s.children ?? []).map((c) => walk(c, id));
    return id;
  };
  return { root: walk(spec, null), nodes };
}

export function buildDoc(spec: Spec): BuilderDoc {
  const f = build(spec);
  return { version: 1, root: f.root, nodes: f.nodes };
}

const MUTED = "#6b645a";
const ACCENT = "#c8553d";
/** Anh mau trung tinh cho khoi moi — nguoi dung chon anh that trong thu vien (khong tro vao anh rieng cua shop nao). */
const SAMPLE_IMAGE = PLACEHOLDER;
const SAMPLE_IMAGE_2 = PLACEHOLDER;

export const heading = (text: string, size = 32, extra: Style = {}): Spec => ({
  type: "text",
  props: { text, tag: "h2" },
  style: { base: { fontFamily: "display", fontSize: size, fontWeight: 700, lineHeight: 1.15, ...extra } },
});
export const paragraph = (text: string, extra: Style = {}): Spec => ({
  type: "text",
  props: { text, tag: "p" },
  style: { base: { fontSize: 16, lineHeight: 1.6, color: MUTED, ...extra } },
});
export const button = (label: string, href: string, extra: Style = {}): Spec => ({
  type: "button",
  props: { label, href },
  style: { base: { background: ACCENT, color: "#ffffff", padding: [12, 24, 12, 24], radius: 999, fontWeight: 600, fontSize: 15, ...extra } },
});
/** Lien ket chu (nut khong nen) */
export const link = (label: string, href: string, extra: Style = {}): Spec => ({
  type: "button",
  name: label,
  props: { label, href },
  style: { base: { fontSize: 14, color: "inherit", ...extra } },
});
const image = (src: string, extra: Style = {}, props: NodeProps = {}): Spec => ({
  type: "image",
  props: { src, alt: "", fit: "cover", ...props },
  style: { base: { width: { mode: "fixed", value: 320 }, radius: 12, ...extra } },
});
const icon = (name: string, extra: Style = {}): Spec => ({ type: "icon", props: { icon: name }, style: { base: { fontSize: 28, color: ACCENT, ...extra } } });

const sliderOpts = { effect: "slide" as const, autoplay: false, loop: true, arrows: true, dots: "below" as const };

/* ------------------------------ Kieu the cho "Danh sách dữ liệu" ------------------------------ */

const DARK = "#22201c";
const LINK = "#2d6a5b";
const txt = (text: string, size: number, extra: Style = {}, tag: NodeProps["tag"] = "p", mobile?: Style): Spec => ({
  type: "text",
  props: { text, tag },
  style: { base: { fontSize: size, lineHeight: 1.35, color: DARK, ...extra }, ...(mobile ? { mobile } : {}) },
});
const dataImage = (extra: Style = {}): Spec => image("", { width: { mode: "fill" }, radius: 12, ...extra }, { bindImage: true });
const card = (style: Style, children: Spec[], props: NodeProps = {}, extra: Partial<Record<Breakpoint, Style>> = {}): Spec => ({
  type: "frame",
  name: "Thẻ mẫu",
  props: { href: "{{url}}", ...props },
  style: { base: style, ...extra },
  children,
});

type Grid = Partial<Record<Breakpoint, Style>>;
const grid = (d: number, t: number, m: number, gap = 16): Grid => ({ base: { layout: "grid", columns: d, gap }, tablet: { columns: t }, mobile: { columns: m, gap: 12 } });
const slider = (d: number, t: number, m: number, gap = 16): Grid => ({ base: { layout: "slider", perView: d, gap }, tablet: { perView: t }, mobile: { perView: m, gap: 12, peek: 32 } });

/**
 * Kieu the dung san theo loai du lieu: moi kieu = the mau (khung thuong, sua tu do sau khi chon) + bo cuc goi y.
 * Inspector cua "Danh sách dữ liệu" hien danh sach nay de doi kieu ma giu nguyen nguon du lieu.
 */
export type CardDesign = { key: string; label: string; hint: string; card: () => Spec; layout: () => Grid; props?: NodeProps };

export const CARD_DESIGNS: Record<"categories" | "products" | "posts", CardDesign[]> = {
  categories: [
    {
      key: "pastel",
      label: "Thẻ lớn pastel",
      hint: "Tiêu đề lớn phía trên, ảnh phía dưới, nền màu nhạt",
      layout: () => grid(3, 3, 2, 20),
      card: () =>
        card(
          { direction: "column", gap: 0, radius: 16, shadow: "sm", hover: "lift", height: { mode: "fixed", value: 440 } },
          [
            {
              type: "frame",
              name: "Chữ",
              style: { base: { direction: "column", gap: 8, padding: [24, 24, 16, 24] }, mobile: { padding: [14, 14, 10, 14], gap: 4 } },
              children: [
                txt("{{name}}", 32, { fontFamily: "display", fontWeight: 700, lineHeight: 1.05 }, "h2", { fontSize: 20 }),
                txt("{{description}}", 14, { color: "#5c564d", maxLines: 2 }, "p", { fontSize: 12 }),
                txt("Shop now →", 14, { color: LINK, fontWeight: 600 }),
              ],
            },
            dataImage({ height: { mode: "fill" }, radius: 0 }),
          ],
          { bindBg: true },
          { mobile: { height: { mode: "fixed", value: 260 } } },
        ),
    },
    {
      key: "tile",
      label: "Ảnh + tên",
      hint: "Ảnh 4:3, tên và số sản phẩm bên dưới",
      layout: () => grid(4, 2, 2),
      card: () =>
        card(
          { direction: "column", gap: 10, padding: [14, 14, 16, 14], radius: 16, hover: "lift" },
          [dataImage({ aspectRatio: "4 / 3" }), txt("{{name}}", 18, { fontWeight: 700 }, "h3"), txt("{{count}} items · Shop now →", 13, { color: LINK })],
          { bindBg: true },
        ),
    },
    {
      key: "overlay",
      label: "Ảnh phủ chữ",
      hint: "Ảnh nền toàn thẻ, chữ trắng ở góc dưới",
      layout: () => grid(3, 2, 1),
      card: () =>
        card(
          { direction: "column", justify: "end", gap: 4, padding: [20, 20, 20, 20], radius: 16, minHeight: 320, color: "#ffffff", hover: "lift" },
          [txt("{{name}}", 26, { fontFamily: "display", fontWeight: 700, color: "#ffffff" }, "h3"), txt("{{count}} items →", 14, { color: "rgba(255,255,255,.85)" })],
          { bindBgImage: true },
        ),
    },
    {
      key: "circle",
      label: "Ảnh tròn",
      hint: "Ảnh tròn nhỏ + tên, hợp để lướt ngang",
      layout: () => slider(6, 4, 3, 20),
      props: { slider: { ...sliderOpts, dots: "none" } },
      card: () =>
        card({ direction: "column", gap: 10, align: "center", hover: "grow" }, [
          dataImage({ width: { mode: "fixed", value: 120 }, aspectRatio: "1 / 1", radius: 999 }),
          txt("{{name}}", 15, { fontWeight: 600, textAlign: "center" }, "h3"),
        ]),
    },
    {
      key: "pill",
      label: "Nút bo tròn",
      hint: "Chỉ có tên, dạng nút — gọn cho thanh danh mục",
      layout: () => ({ base: { layout: "stack", direction: "row", wrap: true, gap: 10 } }),
      card: () =>
        card(
          { direction: "row", align: "center", gap: 6, padding: [10, 18, 10, 18], radius: 999, background: "#ffffff", borderWidth: 1, borderColor: "#e2d9cb", hover: "shadow", width: { mode: "hug" } },
          [txt("{{name}}", 14, { fontWeight: 600 })],
        ),
    },
    {
      key: "list",
      label: "Danh sách chữ",
      hint: "Tên + số lượng theo dòng — hợp cho cột bên / footer",
      layout: () => ({ base: { layout: "stack", direction: "column", align: "stretch", gap: 0 } }),
      card: () => card({ direction: "row", align: "center", justify: "between", padding: [12, 4, 12, 4], hover: "dim" }, [txt("{{name}}", 15, { fontWeight: 500 }), txt("{{count}} →", 13, { color: MUTED })]),
    },
  ],
  products: [
    {
      key: "white",
      label: "Thẻ trắng",
      hint: "Khung trắng đổ bóng, ảnh 4:5, tên + giá",
      layout: () => grid(4, 3, 2),
      card: () =>
        card({ direction: "column", gap: 6, padding: [10, 10, 14, 10], radius: 14, background: "#ffffff", shadow: "sm", hover: "zoomImage" }, [
          dataImage({ aspectRatio: "4 / 5", radius: 10 }),
          txt("{{name}}", 14, { maxLines: 2 }, "h3"),
          txt("{{price}}", 16, { fontWeight: 700 }),
        ]),
    },
    {
      key: "minimal",
      label: "Tối giản (slider)",
      hint: "Ảnh vuông, không khung, chữ nhỏ bên dưới",
      layout: () => slider(5, 3, 2),
      card: () =>
        card({ direction: "column", gap: 6, hover: "zoomImage" }, [
          dataImage({ aspectRatio: "1 / 1", radius: 8 }),
          txt("{{name}}", 13, { color: LINK, maxLines: 2 }, "h3"),
          txt("{{price}}", 15, { fontWeight: 700 }),
        ]),
    },
    {
      key: "overlay",
      label: "Ảnh phủ tên",
      hint: "Ảnh nền cả thẻ, tên + giá chữ trắng",
      layout: () => grid(3, 2, 1),
      card: () =>
        card(
          { direction: "column", justify: "end", gap: 4, padding: [18, 18, 18, 18], radius: 16, minHeight: 360, color: "#ffffff", hover: "lift" },
          [txt("{{name}}", 18, { fontWeight: 700, color: "#ffffff", maxLines: 2 }, "h3"), txt("{{price}}", 16, { color: "#ffffff" })],
          { bindBgImage: true },
        ),
    },
    {
      key: "horizontal",
      label: "Ngang (ảnh trái)",
      hint: "Ảnh nhỏ bên trái, tên + giá + nút bên phải",
      layout: () => grid(2, 1, 1),
      card: () =>
        card({ direction: "row", gap: 16, align: "center", padding: [12, 12, 12, 12], radius: 14, background: "#ffffff", shadow: "sm", hover: "lift" }, [
          dataImage({ width: { mode: "fixed", value: 120 }, aspectRatio: "1 / 1", radius: 10 }),
          {
            type: "frame",
            style: { base: { direction: "column", gap: 6 } },
            children: [txt("{{name}}", 15, { fontWeight: 600, maxLines: 2 }, "h3"), txt("{{price}}", 17, { fontWeight: 700 }), button("View", "{{url}}", { padding: [6, 14, 6, 14], fontSize: 13 })],
          },
        ]),
    },
  ],
  posts: [
    {
      key: "classic",
      label: "Ảnh trên, chữ dưới",
      hint: "Ảnh 16:10, ngày, tiêu đề, tóm tắt",
      layout: () => grid(3, 2, 1, 24),
      card: () =>
        card({ direction: "column", gap: 8, hover: "zoomImage" }, [
          dataImage({ aspectRatio: "16 / 10" }),
          txt("{{date}}", 12, { color: MUTED }),
          txt("{{name}}", 20, { fontFamily: "display", fontWeight: 700, maxLines: 2 }, "h3"),
          txt("{{description}}", 14, { color: MUTED, maxLines: 3 }),
        ]),
    },
    {
      key: "overlay",
      label: "Ảnh phủ tiêu đề",
      hint: "Ảnh nền, tiêu đề trắng",
      layout: () => grid(3, 2, 1),
      card: () =>
        card(
          { direction: "column", justify: "end", gap: 6, padding: [20, 20, 20, 20], radius: 16, minHeight: 300, color: "#ffffff", hover: "lift" },
          [txt("{{date}}", 12, { color: "rgba(255,255,255,.8)" }), txt("{{name}}", 22, { fontFamily: "display", fontWeight: 700, color: "#ffffff", maxLines: 3 }, "h3")],
          { bindBgImage: true },
        ),
    },
  ],
};

export const designOf = (kind: keyof typeof CARD_DESIGNS, key: string | undefined) => CARD_DESIGNS[kind].find((d) => d.key === key) ?? CARD_DESIGNS[kind][0];

/** Khoi "Danh sách dữ liệu" theo kieu the; `props` (nguon du lieu...) ghi de mac dinh. */
export function collectionSpec(kind: keyof typeof CARD_DESIGNS, designKey: string, props: NodeProps = {}): Spec {
  const d = designOf(kind, designKey);
  return {
    type: "collection",
    props: {
      collection: kind,
      limit: kind === "posts" ? 3 : 8,
      catSource: "top",
      source: kind === "products" ? "newest" : undefined,
      slider: sliderOpts,
      ...d.props,
      ...props,
      design: d.key,
    },
    style: d.layout(),
    children: [d.card()],
  };
}

const slide = (title: string, img: string): Spec => ({
  type: "frame",
  name: title,
  style: {
    base: { direction: "column", gap: 16, justify: "center", padding: [48, 56, 48, 56], minHeight: 420, backgroundImage: img, overlay: "rgba(20,30,25,.45)", color: "#ffffff" },
    mobile: { padding: [32, 20, 48, 20], minHeight: 320 },
  },
  children: [
    heading(title, 52, { color: "#ffffff", maxWidth: 620 }),
    paragraph("New arrivals every week. Fast, tracked delivery.", { color: "rgba(255,255,255,.88)", fontSize: 18 }),
    button("Shop now", "/products.html", { background: "#e9b04a", color: "#22201c" }),
  ],
});

/** thumb: id hinh minh hoa (editor/thumbs.tsx) — muc co thumb hien dang the lon trong bang Chen. */
export type LibraryItem = { key: string; label: string; hint?: string; thumb?: string; make: () => Spec; kinds?: PageKind[] };

const slot = (name: string, extra: Partial<Record<Breakpoint, Style>> = {}): Spec => ({ type: "slot", props: { slot: name }, style: extra });
/** Widget khoi trang co kieu (SLOT_DESIGNS) va nhan rieng */
const widget = (name: string, design?: string, base: Style = {}, label?: string, extra: Partial<Record<Breakpoint, Style>> = {}): Spec => ({
  type: "slot",
  props: { slot: name, ...(design ? { design } : {}), ...(label ? { label } : {}) },
  style: { base, ...extra },
});

/* --------------------- Hop mua hang dung tu cac widget (template SP + thu vien mau) --------------------- */

/** Cot thong tin: ten, sao, gia, bien the, SKU, diem noi bat. */
export function productInfoSpec(): Spec {
  return {
    type: "frame",
    name: "Thông tin sản phẩm",
    style: { base: { direction: "column", align: "stretch", gap: 10, width: { mode: "fill" } } },
    children: [
      {
        type: "text",
        name: "Tên sản phẩm",
        props: { text: "{{name}}", tag: "h1" },
        style: { base: { fontSize: 24, lineHeight: 1.3, color: "#0f1111" }, mobile: { fontSize: 20 } },
      },
      widget("productRating"),
      { type: "divider", style: { base: { height: { mode: "fixed", value: 1 }, background: "#e2d9cb" } } },
      widget("productPrice"),
      widget("productOptions", undefined, { margin: [6, 0, 0, 0] }),
      widget("productSku"),
      widget("productBullets", undefined, { margin: [8, 0, 0, 0] }),
    ],
  };
}

export function buyBoxSpec(style: "amazon" | "minimal" | "card" | "bar"): Spec {
  if (style === "bar")
    return {
      type: "frame",
      name: "Thanh mua hàng",
      style: { base: { direction: "row", align: "center", wrap: true, gap: 12, padding: [12, 16, 12, 16], radius: 12, borderWidth: 1, borderColor: "#e2d9cb", background: "#ffffff" } },
      children: [
        widget("productPrice", "plain", { fontSize: 22, fontWeight: 700 }),
        widget("productQty", "stepper"),
        widget("productAddToCart", "dark", { width: { mode: "fill" } }),
        widget("productBuyNow", "outline", { width: { mode: "fill" } }),
      ],
    };
  if (style === "minimal")
    return {
      type: "frame",
      name: "Hộp mua tối giản",
      style: { base: { direction: "column", align: "stretch", gap: 16 } },
      children: [
        widget("productPrice", "plain", { fontSize: 30, fontWeight: 700, color: "#22201c" }),
        widget("productOptions", "pills"),
        widget("productStock", "badge"),
        {
          type: "frame",
          name: "Số lượng + thêm giỏ",
          style: { base: { direction: "row", align: "center", gap: 10 } },
          children: [widget("productQty", "stepper"), widget("productAddToCart", "accent", { width: { mode: "fill" } })],
        },
        widget("productShipInfo", "badges"),
      ],
    };
  if (style === "card")
    return {
      type: "frame",
      name: "Thẻ mua nổi",
      style: { base: { direction: "column", align: "stretch", gap: 14, padding: [24, 24, 24, 24], radius: 20, background: "#f4efe6", shadow: "md" } },
      children: [
        widget("productPrice", "sale", { fontSize: 28, fontWeight: 700 }),
        widget("productDelivery", "box"),
        widget("productOptions", "buttons"),
        widget("productQty", "stepper"),
        widget("productAddToCart", "dark"),
        widget("productBuyNow", "outline"),
        widget("productShipInfo", "inline"),
      ],
    };
  return {
    type: "frame",
    name: "Hộp mua hàng",
    style: {
      base: { direction: "column", align: "stretch", gap: 12, padding: [16, 16, 16, 16], radius: 8, borderWidth: 1, borderColor: "#d5d9d9", width: { mode: "fixed", value: 250 } },
      tablet: { width: { mode: "fill" } },
    },
    children: [
      widget("productPrice", "small"),
      widget("productDelivery"),
      widget("productStock"),
      widget("productQty"),
      widget("productAddToCart"),
      widget("productBuyNow"),
      widget("productShipInfo"),
    ],
  };
}

export const LIBRARY: { group: string; items: LibraryItem[] }[] = [
  {
    // Chi hien khi dang sua template / thiet ke rieng cua dung loai trang (panels.tsx loc theo kinds)
    group: "Khối của trang",
    items: Object.entries(SLOTS).map(([key, d]) => ({ key: `slot-${key}`, label: d.label, hint: `${d.group} · ${d.hint}`, kinds: d.global ? undefined : d.kinds, make: () => slot(key) })),
  },
  {
    group: "Thư viện mẫu · Hộp mua hàng",
    items: [
      { key: "buy-amazon", label: "Hộp mua kiểu Amazon", hint: "Khung viền: giá, giao hàng, tình trạng, số lượng, 2 nút, thông tin bán", kinds: ["product"], make: () => buyBoxSpec("amazon") },
      { key: "buy-minimal", label: "Hộp mua tối giản", hint: "Giá lớn, biến thể bo tròn, nút − / + cạnh nút thêm giỏ, 3 huy hiệu", kinds: ["product"], make: () => buyBoxSpec("minimal") },
      { key: "buy-card", label: "Thẻ mua nổi", hint: "Nền kem bo góc, đổ bóng, nút đen", kinds: ["product"], make: () => buyBoxSpec("card") },
      { key: "buy-bar", label: "Thanh mua ngang", hint: "Giá · số lượng · thêm giỏ · mua ngay trên một hàng", kinds: ["product"], make: () => buyBoxSpec("bar") },
      { key: "buy-info", label: "Cột thông tin sản phẩm", hint: "Tên, sao, giá, biến thể, SKU, điểm nổi bật", kinds: ["product"], make: () => productInfoSpec() },
    ],
  },
  {
    group: "Bố cục",
    items: [
      {
        key: "section",
        label: "Section",
        hint: "Khối tràn màn hình, nội dung canh giữa",
        make: () => ({
          type: "section",
          style: { base: { direction: "column", gap: 24, padding: [64, 24, 64, 24], contentWidth: 1200, background: "#ffffff" }, mobile: { padding: [40, 16, 40, 16] } },
        }),
      },
      { key: "frameV", label: "Frame dọc", hint: "Xếp con từ trên xuống", make: () => ({ type: "frame", style: { base: { direction: "column", gap: 12 } } }) },
      {
        key: "frameH",
        label: "Frame ngang",
        hint: "Xếp con từ trái sang, mobile tự xuống dòng",
        make: () => ({ type: "frame", style: { base: { direction: "row", gap: 16 }, mobile: { direction: "column" } } }),
      },
      {
        key: "grid",
        label: "Lưới cột",
        hint: "3 cột desktop, 2 tablet, 1 mobile",
        make: () => ({ type: "frame", style: { base: { layout: "grid", columns: 3, gap: 20 }, tablet: { columns: 2 }, mobile: { columns: 1 } } }),
      },
      {
        key: "slider",
        label: "Slider",
        hint: "Mỗi khối con là một slide",
        make: () => ({
          type: "frame",
          props: { slider: { ...sliderOpts, dots: "inside" } },
          style: { base: { layout: "slider", perView: 1, gap: 0 } },
          children: [slide("Slide 1", SAMPLE_IMAGE), slide("Slide 2", SAMPLE_IMAGE_2)],
        }),
      },
      {
        key: "free",
        label: "Khung tự do",
        hint: "Đặt khối ở vị trí bất kỳ như Figma",
        make: () => ({ type: "frame", style: { base: { layout: "free", minHeight: 360, background: "#f4efe6", radius: 12 } } }),
      },
      { key: "spacer", label: "Khoảng trống", make: () => ({ type: "frame", name: "Khoảng trống", style: { base: { height: { mode: "fixed", value: 48 } } } }) },
    ],
  },
  {
    group: "Cơ bản",
    items: [
      { key: "heading", label: "Tiêu đề", make: () => heading("New heading") },
      { key: "paragraph", label: "Đoạn văn", make: () => paragraph("Write a short description for this block.") },
      { key: "image", label: "Ảnh", make: () => image(SAMPLE_IMAGE) },
      { key: "button", label: "Nút", make: () => button("Shop now", "/products.html") },
      { key: "link", label: "Liên kết", make: () => link("Text link", "/products.html", { color: "#2d6a5b" }) },
      { key: "icon", label: "Icon", make: () => icon("sparkles") },
      { key: "video", label: "Video", make: () => ({ type: "video", props: { url: "" }, style: { base: { radius: 12 } } }) },
      { key: "divider", label: "Đường kẻ", make: () => ({ type: "divider", style: { base: { height: { mode: "fixed", value: 1 }, background: "#e2d9cb" } } }) },
    ],
  },
  {
    group: "Sản phẩm",
    items: [
      {
        key: "productSlider",
        label: "Sản phẩm – slider",
        make: () => ({
          type: "productRow",
          props: { display: "custom", title: "Best sellers", source: "bestsellers", limit: 12, href: "/products.html", linkLabel: "See more", slider: sliderOpts },
          style: {
            base: { layout: "slider", perView: 5, gap: 16, padding: [20, 20, 20, 20], background: "#ffffff" },
            tablet: { perView: 3 },
            mobile: { perView: 2, peek: 40, gap: 12, padding: [16, 12, 16, 12] },
          },
        }),
      },
      {
        key: "productGrid",
        label: "Sản phẩm – lưới",
        make: () => ({
          type: "productRow",
          props: { display: "custom", title: "New arrivals", source: "newest", limit: 8, href: "/products.html?sort=newest", cardStyle: "boxed" },
          style: { base: { layout: "grid", columns: 4, gap: 16 }, tablet: { columns: 3 }, mobile: { columns: 2, gap: 12 } },
        }),
      },
      {
        key: "productRow",
        label: "Hàng kiểu Amazon",
        hint: "Giống các hàng trang chủ hiện tại",
        make: () => ({ type: "productRow", props: { title: "Best sellers", source: "bestsellers", limit: 16, href: "/products.html", linkLabel: "See more" } }),
      },
      {
        key: "productCards",
        label: "Thẻ sản phẩm tự thiết kế",
        hint: "Sửa thẻ mẫu, lặp cho từng sản phẩm",
        make: () => collectionSpec("products", "white"),
      },
      {
        key: "boundProduct",
        label: "Khung gắn 1 sản phẩm",
        hint: "Chọn sản phẩm, chữ / ảnh tự lấy theo",
        make: () => ({
          type: "frame",
          name: "Sản phẩm nổi bật",
          props: { href: "{{url}}" },
          style: { base: { direction: "row", gap: 24, align: "center", padding: [20, 20, 20, 20], radius: 16, background: "#ffffff" }, mobile: { direction: "column", align: "stretch" } },
          children: [
            image("", { width: { mode: "fixed", value: 280 }, aspectRatio: "1 / 1", radius: 12 }, { bindImage: true }),
            {
              type: "frame",
              style: { base: { direction: "column", gap: 10 } },
              children: [heading("{{name}}", 28), paragraph("{{description}}", { fontSize: 15 }), heading("{{price}}", 24, { fontFamily: "sans" }), button("View product", "{{url}}")],
            },
          ],
        }),
      },
    ],
  },
  {
    group: "Header & Footer",
    items: [
      { key: "logo", label: "Logo", make: () => ({ type: "logo", props: { tone: "light" } }) },
      { key: "search", label: "Ô tìm kiếm", make: () => ({ type: "search", props: { placeholder: "Search products" } }) },
      { key: "cart", label: "Giỏ hàng", make: () => ({ type: "cart", props: { label: "Cart" }, style: { base: { fontWeight: 700 } } }) },
      { key: "account", label: "Tài khoản", make: () => ({ type: "account", style: { base: { fontSize: 14 } } }) },
      { key: "nav", label: "Menu", hint: "Liên kết + danh mục, ☰ trên mobile", make: () => ({ type: "nav", props: { links: DEFAULT_LINKS, withCategories: true, collapse: "mobile" } }) },
    ],
  },
  {
    group: "Thư viện mẫu · Section",
    items: [
      {
        key: "hero2",
        thumb: "section:hero2",
        label: "Hero 2 cột",
        hint: "Chữ + nút bên trái, ảnh bên phải",
        make: () => ({
          type: "section",
          name: "Hero",
          style: {
            base: { direction: "row", gap: 48, align: "center", padding: [72, 24, 72, 24], contentWidth: 1200, background: "#fbf7f0" },
            mobile: { direction: "column", gap: 24, padding: [40, 16, 40, 16], align: "stretch" },
          },
          children: [
            {
              type: "frame",
              name: "Nội dung",
              props: { anim: { type: "fade-up", stagger: 120 } },
              style: { base: { direction: "column", gap: 16 } },
              children: [
                heading("Made for everyday life", 48, { color: "#22201c" }),
                paragraph("Thoughtfully chosen products, carefully packed and delivered to your door."),
                button("Shop the collection", "/products.html"),
              ],
            },
            { ...image(SAMPLE_IMAGE, { width: { mode: "fill" }, radius: 20 }), props: { src: SAMPLE_IMAGE, alt: "", fit: "cover", anim: { type: "zoom", duration: 900 } } },
          ],
        }),
      },
      {
        key: "bannerSlider",
        thumb: "section:bannerSlider",
        label: "Banner slider",
        hint: "Ảnh nền + chữ, tự chạy, mờ dần",
        make: () => ({
          type: "frame",
          name: "Banner slider",
          props: { slider: { effect: "fade", autoplay: true, interval: 5000, loop: true, arrows: true, dots: "inside" } },
          style: { base: { layout: "slider", perView: 1, gap: 0, radius: 16 } },
          children: [slide("New season collection", SAMPLE_IMAGE), slide("Gifts for every occasion", SAMPLE_IMAGE_2)],
        }),
      },
      {
        key: "features3",
        thumb: "section:features3",
        label: "3 ô tính năng",
        make: () => ({
          type: "section",
          name: "Tính năng",
          props: { anim: { type: "fade-up", stagger: 150 } },
          style: { base: { layout: "grid", columns: 3, gap: 24, padding: [48, 24, 48, 24], contentWidth: 1200, background: "#ffffff" }, mobile: { columns: 1, padding: [32, 16, 32, 16] } },
          children: (
            [
              ["lock", "Secure checkout"],
              ["truck", "Fast delivery"],
              ["star", "Quality checked"],
            ] as const
          ).map(([ic, t]) => ({
            type: "frame" as const,
            style: { base: { direction: "column" as const, gap: 8, padding: [24, 24, 24, 24] as [number, number, number, number], radius: 14, background: "#f4efe6", hover: "lift" as const } },
            children: [icon(ic), heading(t, 18, { fontFamily: "sans" }), paragraph("Short supporting text for this feature.", { fontSize: 14 })],
          })),
        }),
      },
      {
        key: "cta",
        thumb: "section:cta",
        label: "Banner kêu gọi",
        hint: "Nền đậm, tiêu đề + nút ở giữa",
        make: () => ({
          type: "section",
          name: "Kêu gọi",
          props: { anim: { type: "fade-up", stagger: 120 } },
          style: { base: { direction: "column", align: "center", gap: 14, padding: [64, 24, 64, 24], contentWidth: 900, background: "#1f3a33", color: "#ffffff" }, mobile: { padding: [44, 16, 44, 16] } },
          children: [
            heading("Ready to make it yours?", 40, { color: "#ffffff", textAlign: "center" }),
            paragraph("Tell us your idea — we reply within 24 hours.", { color: "rgba(255,255,255,.8)", textAlign: "center" }),
            button("Get started", "/contact.html", { background: "#e9b04a", color: "#22201c" }),
          ],
        }),
      },
      {
        key: "testimonials",
        thumb: "section:testimonials",
        label: "Đánh giá khách hàng",
        hint: "3 thẻ trích dẫn có sao",
        make: () => ({
          type: "section",
          name: "Đánh giá",
          props: { anim: { type: "fade-up", stagger: 120 } },
          style: { base: { layout: "grid", columns: 3, gap: 20, padding: [56, 24, 56, 24], contentWidth: 1200, background: "#f4efe6" }, mobile: { layout: "slider", perView: 1, peek: 40, padding: [40, 16, 40, 16] } },
          children: ["Beautiful quality and fast shipping!", "Exactly what I asked for. Will order again.", "Great quality — the gift was a hit."].map((q, i) => ({
            type: "frame" as const,
            style: { base: { direction: "column" as const, gap: 10, padding: [22, 22, 22, 22] as [number, number, number, number], radius: 14, background: "#ffffff", shadow: "sm" as const } },
            children: [
              { type: "text" as const, props: { text: "★★★★★", tag: "p" as const }, style: { base: { color: "#e0a526", fontSize: 16, letterSpacing: 2 } } },
              paragraph(`“${q}”`, { color: "#22201c", fontSize: 16 }),
              paragraph(["Emma, Texas", "Liam, Oregon", "Sofia, Florida"][i], { fontSize: 13, fontWeight: 600 }),
            ],
          })),
        }),
      },
    ],
  },
  ...(["categories", "products", "posts"] as const).map((kind) => ({
    group: `Thư viện mẫu · ${{ categories: "Danh mục", products: "Sản phẩm", posts: "Bài viết" }[kind]}`,
    items: CARD_DESIGNS[kind].map((d) => ({
      key: `${kind}-${d.key}`,
      thumb: `${kind}:${d.key}`,
      label: d.label,
      hint: d.hint,
      make: () => collectionSpec(kind, d.key, kind === "categories" && d.key === "pastel" ? { limit: 3 } : {}),
    })),
  })),
];

const DEFAULT_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about.html" },
  { label: "Promotion", href: "/promotions" },
  { label: "News", href: "/news.html" },
  { label: "Contact Us", href: "/contact.html" },
];

/* --------------------------- Trang chu mac dinh (giong ban code cung) --------------------------- */

export function homeSpec(): Spec {
  const usp = (h: string, d: string): Spec => ({
    type: "frame",
    style: { base: { direction: "column", gap: 4 } },
    children: [heading(h, 16, { fontFamily: "sans", lineHeight: 1.4 }), paragraph(d, { fontSize: 14, lineHeight: 1.45 })],
  });
  return {
    type: "page",
    name: "Trang chủ",
    style: { base: { direction: "column", align: "stretch", contentWidth: 1500, background: "#f4efe6" } },
    children: [
      { type: "categoryHero", name: "Thẻ danh mục" },
      {
        type: "frame",
        name: "Các hàng sản phẩm",
        style: { base: { direction: "column", align: "stretch", gap: 20, padding: [20, 20, 20, 20] }, mobile: { padding: [20, 12, 20, 12] } },
        children: [
          { type: "productRow", props: { title: "Best sellers", source: "bestsellers", limit: 16, href: "/products.html", linkLabel: "See more" } },
          {
            type: "productRow",
            props: { title: "Christmas favourites", source: "keyword", keyword: "Christmas", limit: 16, href: "/products.html?keyword=Christmas", linkLabel: "See more" },
          },
          { type: "productRow", props: { title: "New arrivals", source: "newest", limit: 16, href: "/products.html?sort=newest", linkLabel: "See more" } },
          {
            type: "frame",
            name: "Vì sao chọn chúng tôi",
            style: { base: { direction: "row", gap: 16, padding: [20, 20, 20, 20], background: "#ffffff" }, mobile: { direction: "column" } },
            children: [
              usp("Secure checkout", "Your details are protected and only used to process your order."),
              usp("Fast, friendly support", "Questions about an order? Contact us and we'll get back to you quickly."),
              usp("Quality checked", "Every item is checked before it ships, and we make it right if anything is wrong."),
            ],
          },
        ],
      },
    ],
  };
}

/** Header mac dinh: thanh chinh (logo, tim kiem, tai khoan, gio) + thanh menu; mobile tim kiem xuong hang rieng. */
export function headerSpec(): Spec {
  const search = (hiddenOn: "mobile" | "desktop"): Spec => ({
    type: "search",
    name: hiddenOn === "mobile" ? "Tìm kiếm (desktop)" : "Tìm kiếm (mobile)",
    props: { placeholder: "Search products" },
    style: hiddenOn === "mobile" ? { base: { width: { mode: "fill" } }, mobile: { hidden: true } } : { base: { hidden: true, width: { mode: "fill" } }, mobile: { hidden: false } },
  });
  return {
    type: "page",
    name: "Header",
    style: { base: { direction: "column", align: "stretch", color: "#ffffff" } },
    children: [
      {
        type: "frame",
        name: "Thanh chính",
        style: { base: { direction: "row", align: "center", gap: 16, padding: [8, 16, 8, 16], background: "#1f3a33" }, mobile: { gap: 10, padding: [8, 12, 8, 12] } },
        children: [
          { type: "logo", props: { tone: "light" } },
          search("mobile"),
          { type: "frame", name: "Đẩy sang phải", style: { base: { hidden: true }, mobile: { hidden: false, width: { mode: "fill" } } } },
          { type: "account", style: { base: { fontSize: 14, fontWeight: 600 } } },
          { type: "cart", props: { label: "Cart" }, style: { base: { fontWeight: 700 } } },
        ],
      },
      { type: "frame", name: "Tìm kiếm mobile", style: { base: { hidden: true, padding: [0, 12, 10, 12], background: "#1f3a33" }, mobile: { hidden: false } }, children: [search("desktop")] },
      {
        type: "frame",
        name: "Thanh menu",
        style: { base: { direction: "row", align: "center", padding: [6, 16, 6, 16], background: "#2c4d44" }, mobile: { padding: [2, 8, 2, 8] } },
        children: [{ type: "nav", props: { links: DEFAULT_LINKS, withCategories: true, collapse: "mobile" }, style: { base: { fontSize: 14, fontWeight: 500 } } }],
      },
    ],
  };
}

/** Footer mac dinh: 4 cot lien ket (cot "Shop" la danh sach danh muc tu DB) + dai cuoi. */
export function footerSpec(siteName: string = SITE_NAME_FALLBACK): Spec {
  const col = (title: string, links: [string, string][]): Spec => ({
    type: "frame",
    name: title,
    style: { base: { direction: "column", gap: 8 } },
    children: [heading(title, 16, { fontFamily: "sans", color: "#ffffff" }), ...links.map(([l, h]) => link(l, h, { color: "#dddddd" }))],
  });
  return {
    type: "page",
    name: "Footer",
    style: { base: { direction: "column", align: "stretch", color: "#ffffff", background: "#2c4d44" } },
    children: [
      {
        type: "frame",
        name: "Các cột",
        style: { base: { layout: "grid", columns: 4, gap: 32, padding: [40, 24, 40, 24], contentWidth: 1000 }, mobile: { columns: 2, gap: 24 } },
        children: [
          col("Get to Know Us", [
            ["About Us", "/about.html"],
            ["News", "/news.html"],
            ["Contact Us", "/contact.html"],
          ]),
          {
            type: "frame",
            name: "Shop with Us",
            style: { base: { direction: "column", gap: 8 } },
            children: [
              heading("Shop with Us", 16, { fontFamily: "sans", color: "#ffffff" }),
              link("All Products", "/products.html", { color: "#dddddd" }),
              {
                type: "collection",
                name: "Danh mục",
                props: { collection: "categories", catSource: "all", limit: 12 },
                style: { base: { layout: "stack", direction: "column", gap: 8 } },
                children: [link("{{name}}", "{{url}}", { color: "#dddddd" })],
              },
            ],
          },
          col("Let Us Help You", [
            ["Your Account", "/account.html"],
            ["Your Orders", "/account/orders.html"],
            ["Shipping & Delivery", "/contact.html"],
          ]),
          col("Policies", [
            ["Privacy Policy", "/privacy-policy"],
            ["Terms of Service", "/terms"],
            ["Data Deletion", "/data-deletion"],
          ]),
        ],
      },
      {
        type: "frame",
        name: "Dải cuối",
        style: { base: { direction: "column", align: "center", gap: 6, padding: [20, 16, 24, 16], background: "#172b26" } },
        children: [
          heading(siteName, 20, { fontFamily: "sans", color: "#ffffff" }),
          paragraph(`© ${new Date().getFullYear()} ${siteName}. All rights reserved.`, { fontSize: 12, color: "#cccccc", textAlign: "center" }),
        ],
      },
    ],
  };
}

/**
 * Chuyen khoi co dinh (the danh muc lon, hang san pham kieu Amazon) sang dang tuy bien: "Danh sách dữ liệu"
 * voi the mau sua duoc, giu nguon du lieu. Hang san pham co tieu de thi them dong tieu de + "See more" phia tren.
 */
export function customizableSpec(n: BuilderNode): Spec | null {
  const p = n.props;
  if (n.type === "categoryHero") {
    return collectionSpec("categories", "pastel", { catSource: p.catSource ?? "top", catalogueIds: p.catalogueIds, limit: p.limit ?? 3 });
  }
  if (n.type !== "productRow" && n.type !== "productGrid") return null;
  const list = collectionSpec("products", n.type === "productRow" ? "minimal" : "white", {
    source: p.source ?? "bestsellers",
    catalogueId: p.catalogueId,
    keyword: p.keyword,
    productIds: p.productIds,
    limit: p.limit ?? 12,
  });
  if (!p.title && !p.href) return list;
  return {
    type: "frame",
    name: p.title || "Khối sản phẩm",
    style: { base: { direction: "column", gap: 12, padding: [16, 20, 16, 20], background: "#ffffff" }, mobile: { padding: [14, 12, 14, 12] } },
    children: [
      {
        type: "frame",
        name: "Tiêu đề",
        style: { base: { direction: "row", align: "end", gap: 16 } },
        children: [
          { type: "text", props: { text: p.title ?? "", tag: "h2" }, style: { base: { fontSize: 20, fontWeight: 700, width: { mode: "hug" } } } },
          ...(p.href ? [link(p.linkLabel || "See more", p.href, { color: "#2d6a5b" })] : []),
        ],
      },
      list,
    ],
  };
}

/* --------------------- Template trang con mac dinh (dung tu cac lop nho, sua tu do) --------------------- */

const titleText = (text: string, size: number, extra: Style = {}, tag: NodeProps["tag"] = "h1", mobile?: Style): Spec => ({
  type: "text",
  props: { text, tag },
  style: { base: { fontSize: size, lineHeight: 1.15, color: "#22201c", ...extra }, ...(mobile ? { mobile } : {}) },
});

export function templateSpec(kind: PageKind): Spec {
  const page = (name: string, children: Spec[], bg = "#ffffff"): Spec => ({
    type: "page",
    name,
    style: { base: { direction: "column", align: "stretch", background: bg } },
    children,
  });

  if (kind === "product")
    return page("Trang sản phẩm", [
      { ...slot("breadcrumb"), name: "Đường dẫn" },
      {
        type: "frame",
        name: "Ảnh + mua hàng",
        style: {
          base: { layout: "grid", columns: 2, gap: 24, padding: [16, 16, 16, 16], contentWidth: 1500, align: "start" },
          mobile: { columns: 1, padding: [12, 12, 12, 12] },
        },
        children: [
          slot("productGallery"),
          {
            type: "frame",
            name: "Thông tin + hộp mua",
            style: { base: { direction: "row", align: "start", gap: 24 }, tablet: { direction: "column", align: "stretch", gap: 16 } },
            children: [productInfoSpec(), buyBoxSpec("amazon")],
          },
        ],
      },
      slot("productRelated"),
      {
        type: "frame",
        name: "Mô tả, thông số, đánh giá",
        style: { base: { direction: "column", align: "stretch", gap: 32, padding: [24, 16, 24, 16], contentWidth: 1500 } },
        children: [slot("productDescription"), slot("productDetails"), slot("productReviews")],
      },
    ]);

  if (kind === "catalogue") {
    const grid = collectionSpec("products", "white", { source: "listing", limit: 16 });
    grid.name = "Lưới sản phẩm";
    grid.style = { base: { layout: "grid", columns: 4, gap: 16 }, tablet: { columns: 3 }, mobile: { columns: 2, gap: 10 } };
    return page("Trang danh mục sản phẩm", [
      {
        type: "frame",
        name: "Thanh kết quả",
        style: {
          base: { direction: "row", justify: "between", align: "center", wrap: true, gap: 8, padding: [8, 16, 8, 16], background: "#ffffff", shadow: "sm" },
        },
        children: [slot("resultCount"), slot("sortBar")],
      },
      {
        type: "frame",
        name: "Thân trang",
        style: {
          base: { direction: "row", align: "start", gap: 24, padding: [16, 16, 24, 16], contentWidth: 1500 },
          mobile: { direction: "column", align: "stretch", gap: 16, padding: [12, 12, 20, 12] },
        },
        children: [
          {
            type: "frame",
            name: "Cột bộ lọc",
            style: {
              base: { direction: "column", align: "stretch", gap: 24, padding: [20, 20, 20, 20], width: { mode: "fixed", value: 250 }, radius: 16, borderWidth: 1, borderColor: "#e2d9cb", background: "#ffffff" },
              mobile: { width: { mode: "fill" } },
            },
            children: [slot("filterCategories"), slot("filterPrice"), slot("filterColors"), slot("filterRating"), slot("filterClear")],
          },
          {
            type: "frame",
            name: "Nội dung",
            style: { base: { direction: "column", align: "stretch", gap: 12 } },
            children: [
              titleText("{{name}}", 28, { fontWeight: 700 }, "h1", { fontSize: 22 }),
              titleText("{{description}}", 14, { color: "#6b645a", lineHeight: 1.5, maxLines: 3 }, "p"),
              grid,
              slot("pagination"),
            ],
          },
        ],
      },
    ]);
  }

  if (kind === "post") {
    const more = collectionSpec("posts", "classic", { source: "related", limit: 3 });
    more.name = "Bài cùng chủ đề";
    return page("Trang bài viết", [
      {
        type: "section",
        name: "Đầu bài",
        style: { base: { direction: "column", align: "stretch", gap: 14, padding: [28, 16, 36, 16], contentWidth: 760, background: "#f4efe6" } },
        children: [
          slot("postBreadcrumb"),
          titleText("{{name}}", 44, { fontFamily: "display", fontWeight: 600, lineHeight: 1.12 }, "h1", { fontSize: 32 }),
          titleText("{{description}}", 17, { color: "#3d3a35", lineHeight: 1.6 }, "p"),
          titleText("{{date}}", 13, { color: "#6b645a" }, "p"),
        ],
      },
      {
        type: "frame",
        name: "Ảnh bìa",
        style: { base: { direction: "column", align: "stretch", padding: [24, 16, 0, 16], contentWidth: 1040 } },
        children: [{ type: "image", props: { bindImage: true, alt: "", fit: "cover" }, style: { base: { width: { mode: "fill" }, aspectRatio: "16 / 9", radius: 16 } } }],
      },
      {
        type: "frame",
        name: "Nội dung",
        style: { base: { direction: "column", align: "stretch", gap: 28, padding: [32, 16, 40, 16], contentWidth: 720 } },
        children: [slot("postContent"), slot("postShare")],
      },
      slot("postShopStory"),
      {
        type: "section",
        name: "Bài khác",
        style: { base: { direction: "column", align: "stretch", gap: 20, padding: [40, 16, 48, 16], contentWidth: 1200 } },
        children: [titleText("More stories", 26, { fontFamily: "display", fontWeight: 600 }, "h2"), more],
      },
    ]);
  }

  const list = collectionSpec("posts", "classic", { source: "listing", limit: 15 });
  list.name = "Danh sách bài";
  return page("Trang danh mục bài viết", [
    {
      type: "section",
      name: "Đầu trang",
      style: { base: { direction: "column", align: "stretch", gap: 10, padding: [40, 16, 32, 16], contentWidth: 1200, background: "#f4efe6" } },
      children: [
        titleText("The journal", 12, { fontWeight: 600, letterSpacing: 2.5, uppercase: true, color: "#c8553d" }, "p"),
        titleText("{{name}}", 44, { fontFamily: "display", fontWeight: 600 }, "h1", { fontSize: 34 }),
        titleText("{{description}}", 15, { color: "#6b645a", lineHeight: 1.6, maxWidth: 640 }, "p"),
      ],
    },
    {
      type: "section",
      name: "Bài viết",
      style: { base: { direction: "column", align: "stretch", gap: 28, padding: [32, 16, 48, 16], contentWidth: 1200 } },
      children: [list, slot("pagination")],
    },
  ]);
}
