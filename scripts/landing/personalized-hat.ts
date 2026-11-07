/**
 * Landing page san pham: "Personalized Embroidered Cotton Hat – Custom Name Cap" (product #159) — trang day mot san pham
 * khi chay khuyen mai / muon day ban. Dung bang lop builder (sua tiep trong /builder/lp-personalized-name-hat/edit).
 * Gia / link / ten lay tu san pham that (khung "Gắn dữ liệu"); khong co so giam gia hay danh gia nao bia ra —
 * nhan "Holiday gift pick" la cho de doi thanh noi dung khuyen mai that.
 *   node scripts/landing/seed-landing.mjs personalized-hat > out.sql
 */
import type { Spec } from "../../src/modules/builder/library";
import type { NodeProps, PageSettings, Style } from "../../src/modules/builder/schema";

const PRODUCT = 159;
const IMG = "/userfiles/image/emhaus/4398440759";
const MOSS = "#1f3a33";
const BRICK = "#c8553d";
const MUSTARD = "#e9b04a";
const LINEN = "#f7f2ea";
const INK = "#1d1b18";
const MUTED = "#5f5a52";
const W = 1200;

export const path = "personalized-name-hat";
export const title = "Personalized Name Hat – Your Name, Your Style";
export const settings: PageSettings = {
  header: "none",
  seoTitle: "Personalized Embroidered Name Hat – Your Name, Your Style | CustomStitch House",
  seoDescription:
    "Your name, stitched in a style that's yours — racing, army, nature, street, moto, sport or old money. Custom embroidered cotton cap, preview before stitching, free US delivery.",
  seoImage: `${IMG}/01.jpg`,
};

/* ------------------------------------------------ helpers ------------------------------------------------ */

const text = (t: string, size: number, extra: Style = {}, tag: NodeProps["tag"] = "p", mobile?: Style): Spec => ({
  type: "text",
  name: t.replace(/\{\{|\}\}/g, "").slice(0, 40),
  props: { text: t, tag },
  style: { base: { fontSize: size, lineHeight: 1.55, color: INK, ...extra }, ...(mobile ? { mobile } : {}) },
});
const display = (t: string, size: number, extra: Style = {}, tag: NodeProps["tag"] = "h2", mobile?: Style): Spec =>
  text(t, size, { fontFamily: "display", fontWeight: 600, lineHeight: 1.12, letterSpacing: -0.5, ...extra }, tag, mobile);
const eyebrow = (t: string, color = BRICK): Spec => text(t, 13, { color, uppercase: true, letterSpacing: 2, fontWeight: 700 });
const button = (label: string, href: string, extra: Style = {}): Spec => ({
  type: "button",
  name: label,
  props: { label, href },
  style: { base: { background: BRICK, color: "#ffffff", padding: [15, 30, 15, 30], radius: 999, fontWeight: 700, fontSize: 16, hover: "lift", shadow: "md", ...extra } },
});
const img = (file: string, extra: Style = {}, props: NodeProps = {}): Spec => ({
  type: "image",
  name: file,
  props: { src: `${IMG}/${file}`, alt: "", fit: "cover", ...props },
  style: { base: { width: { mode: "fill" }, ...extra } },
});
const icon = (name: string, size: number, color: string): Spec => ({ type: "icon", props: { icon: name }, style: { base: { fontSize: size, color } } });
const frame = (name: string, base: Style, children: Spec[], extra: Partial<Record<"tablet" | "mobile", Style>> = {}, props: NodeProps = {}): Spec => ({
  type: "frame",
  name,
  props,
  style: { base, ...extra },
  children,
});
const section = (name: string, base: Style, children: Spec[], extra: Partial<Record<"tablet" | "mobile", Style>> = {}): Spec => ({
  type: "section",
  name,
  style: { base: { direction: "column", align: "stretch", contentWidth: W, padding: [80, 20, 80, 20], gap: 40, ...base }, mobile: { padding: [52, 18, 52, 18], gap: 28 }, ...extra },
  children,
});
/** Khung gan voi san pham that: con ben trong dung {{price}} / {{url}} / {{name}} */
const product = (name: string, base: Style, children: Spec[], extra: Partial<Record<"tablet" | "mobile", Style>> = {}, props: NodeProps = {}): Spec =>
  frame(name, base, children, extra, { bind: { kind: "products", id: PRODUCT, label: "Personalized Embroidered Cotton Hat" }, ...props });
const HUG: Style = { width: { mode: "hug" } };
const head = (eb: string, h: string, sub?: string, light = false): Spec =>
  frame("Tiêu đề khối", { direction: "column", align: "center", gap: 12 }, [
    { ...eyebrow(eb, light ? MUSTARD : BRICK), style: { base: { fontSize: 13, color: light ? MUSTARD : BRICK, uppercase: true, letterSpacing: 2, fontWeight: 700, textAlign: "center" } } },
    display(h, 44, { textAlign: "center", color: light ? "#ffffff" : INK }, "h2", { fontSize: 30 }),
    ...(sub ? [text(sub, 17, { textAlign: "center", color: light ? "rgba(255,255,255,.78)" : MUTED, maxWidth: 640, selfAlign: "center" })] : []),
  ]);

/* ------------------------------------------------ sections ------------------------------------------------ */

const topBar = (): Spec =>
  product(
    "Thanh trên cùng",
    { direction: "row", align: "center", justify: "between", gap: 16, padding: [12, 24, 12, 24], background: MOSS },
    [
      { type: "logo", name: "Logo", props: { alt: "CustomStitch House", tone: "light" }, style: { base: { width: { mode: "fixed", value: 170 } } } },
      frame("Nhãn ưu đãi", { direction: "row", align: "center", gap: 8 }, [icon("gift", 16, MUSTARD), text("Holiday gift pick · Free US delivery", 14, { color: "#ffffff", fontWeight: 600, ...HUG })], {
        mobile: { hidden: true },
      }),
      button("Design my hat", "{{url}}", { padding: [9, 20, 9, 20], fontSize: 14, shadow: "none" }),
    ],
  );

const hero = (): Spec =>
  section("Hero", { background: LINEN, padding: [64, 20, 72, 20] }, [
    product(
      "2 cột",
      { direction: "row", align: "center", gap: 56 },
      [
        frame("Chữ", { direction: "column", gap: 22, width: { mode: "fill" } }, [
          frame("Nhãn", { ...HUG, direction: "row", align: "center", gap: 8, padding: [7, 14, 7, 14], radius: 999, background: "#ffffff", borderWidth: 1, borderColor: "#e6dccb" }, [
            icon("sparkles", 15, BRICK),
            text("Personalized embroidered cap", 13, { fontWeight: 700, color: MOSS, ...HUG }),
          ]),
          display("Your name. Your style. Stitched for good.", 60, {}, "h1", { fontSize: 38 }),
          text(
            "Tell us a name and the vibe that fits it — racing car, army, nature, street, moto, sport or old money. We turn it into a one-of-a-kind embroidered design on a soft cotton cap, and send you a preview before a single stitch.",
            18,
            { color: MUTED, lineHeight: 1.7 },
          ),
          frame("Giá", { direction: "row", align: "end", gap: 10 }, [
            text("From", 15, { color: MUTED, fontWeight: 600, ...HUG }),
            text("{{price}}", 40, { fontWeight: 800, color: BRICK, lineHeight: 1, ...HUG }),
          ]),
          frame("Nút", { direction: "row", align: "center", gap: 14, wrap: true }, [
            button("Design my hat", "{{url}}"),
            {
              type: "button",
              name: "See all hats",
              props: { label: "See all hats →", href: "/products.html?keyword=hat" },
              style: { base: { color: MOSS, fontWeight: 700, fontSize: 15, padding: [15, 8, 15, 8] } },
            },
          ]),
          frame("Cam kết nhỏ", { direction: "row", gap: 18, wrap: true }, [
            frame("Preview", { direction: "row", align: "center", gap: 6 }, [icon("check-circle", 16, MOSS), text("Preview before stitching", 14, { color: MOSS, fontWeight: 600, ...HUG })]),
            frame("Free", { direction: "row", align: "center", gap: 6 }, [icon("truck", 16, MOSS), text("Free US delivery", 14, { color: MOSS, fontWeight: 600, ...HUG })]),
          ]),
        ]),
        frame("Ảnh", { width: { mode: "fill" }, maxWidth: 440 }, [
          img("01.jpg", { aspectRatio: "1588 / 2382", radius: 28, shadow: "lg" }, { alt: "Personalized embroidered name hat – JAMES in racing car style", fit: "cover" }),
        ], { tablet: { maxWidth: 560 } }),
      ],
      { tablet: { direction: "column", align: "stretch", gap: 36 } },
    ),
  ]);

const trustItem = (ic: string, h: string, d: string): Spec =>
  frame(h, { direction: "row", align: "start", gap: 14 }, [
    frame("Icon", { width: { mode: "fixed", value: 46 }, height: { mode: "fixed", value: 46 }, radius: 14, background: "rgba(233,176,74,.18)", justify: "center", align: "center" }, [icon(ic, 22, MUSTARD)]),
    frame("Chữ", { direction: "column", gap: 3, width: { mode: "fill" } }, [text(h, 16, { color: "#ffffff", fontWeight: 700 }), text(d, 14, { color: "rgba(255,255,255,.72)" })]),
  ]);

const trust = (): Spec =>
  section("Cam kết", { background: MOSS, padding: [36, 20, 36, 20] }, [
    frame(
      "4 cam kết",
      { layout: "grid", columns: 4, gap: 28 },
      [
        trustItem("truck", "Free US delivery", "Tracked shipping, usually 10–18 days"),
        trustItem("check-circle", "Preview first", "We send your design for approval before stitching"),
        trustItem("award", "Premium embroidery", "Dense, detailed stitching that lasts"),
        trustItem("scissors", "Made to order", "Stitched in our own workshop, just for you"),
      ],
      { tablet: { columns: 2 }, mobile: { columns: 1, gap: 20 } },
    ),
  ]);

const STYLES: [string, string, string][] = [
  ["04.jpg", "Racing car", "JAMES"],
  ["05.jpg", "Army", "ALEX"],
  ["06.jpg", "Nature", "EMILY"],
  ["07.jpg", "Street style", "CLARK"],
  ["08.jpg", "Moto", "MATEO"],
  ["09.jpg", "Sport", "SOPHIA"],
  ["10.jpg", "Old money", "ANDY"],
];
const styleCard = ([file, style, name]: [string, string, string]): Spec =>
  product(
    style,
    { direction: "column", gap: 12, hover: "zoomImage" },
    [
      img(file, { aspectRatio: "1 / 1", radius: 18 }, { alt: `${name} embroidered in ${style.toLowerCase()} style` }),
      frame("Chú thích", { direction: "row", align: "center", justify: "between", gap: 8 }, [
        text(style, 17, { fontWeight: 700 }),
        { ...text(name, 12, { color: MUTED, letterSpacing: 1.5, fontWeight: 700, ...HUG }), style: { base: { fontSize: 12, color: MUTED, letterSpacing: 1.5, fontWeight: 700, width: { mode: "hug" } }, mobile: { hidden: true } } },
      ]),
    ],
    {},
    { href: "{{url}}" },
  );

const styles = (): Spec =>
  section("Các phong cách", {}, [
    head("Every name has a style", "What's yours?", "Seven ways we've stitched a name so far — or tell us your own idea and we'll design it."),
    frame(
      "Lưới phong cách",
      { layout: "grid", columns: 4, gap: 24 },
      [
        ...STYLES.map(styleCard),
        product(
          "Thẻ: ý tưởng của bạn",
          { direction: "column", justify: "center", align: "center", gap: 14, padding: [28, 24, 28, 24], radius: 18, background: LINEN, borderWidth: 2, borderColor: "#e6dccb", hover: "lift" },
          [
            icon("pen-tool", 34, BRICK),
            display("Your idea", 26, { textAlign: "center" }, "h3"),
            text("Fishing, music, a pet, a team… describe it and we'll sketch it.", 14, { textAlign: "center", color: MUTED }),
            text("Start my design →", 15, { color: BRICK, fontWeight: 700 }),
          ],
          {},
          { href: "{{url}}" },
        ),
      ],
      { tablet: { columns: 3 }, mobile: { columns: 2, gap: 14 } },
    ),
  ]);

const step = (no: string, h: string, d: string): Spec =>
  frame(h, { direction: "row", align: "start", gap: 18 }, [
    frame("Số", { width: { mode: "fixed", value: 48 }, height: { mode: "fixed", value: 48 }, radius: 999, background: BRICK, justify: "center", align: "center" }, [
      text(no, 20, { color: "#ffffff", fontWeight: 800, lineHeight: 1, textAlign: "center" }),
    ]),
    frame("Chữ", { direction: "column", gap: 4, width: { mode: "fill" } }, [text(h, 19, { fontWeight: 700 }), text(d, 15, { color: MUTED, lineHeight: 1.65 })]),
  ]);

const how = (): Spec =>
  section("Cách đặt", { background: LINEN }, [
    frame(
      "2 cột",
      { direction: "row", align: "center", gap: 56 },
      [
        img("02.jpg", { aspectRatio: "1 / 1", radius: 24, shadow: "md", maxWidth: 480 }, { alt: "We send a preview of your custom design before stitching" }),
        frame("Các bước", { direction: "column", gap: 28, width: { mode: "fill" } }, [
          eyebrow("How it works"),
          display("Three easy steps to a hat that's only yours", 40, {}, "h2", { fontSize: 30 }),
          step("1", "Pick your hat color", "Black, navy, olive and more — choose on the product page."),
          step("2", "Share the name + the style", "Type the name or word, then tell us the vibe: racing, army, nature, street, moto, sport, old money — or your own idea."),
          step("3", "Approve your preview, we stitch", "We design it and send you a preview. Once you approve, we embroider and ship it to your door."),
          product("Nút", { direction: "row" }, [button("Start my design", "{{url}}")]),
        ]),
      ],
      { tablet: { direction: "column", align: "stretch" } },
    ),
  ]);

const chip = (ic: string, label: string): Spec =>
  frame(label, { ...HUG, direction: "row", align: "center", gap: 8, padding: [10, 16, 10, 16], radius: 999, background: "#ffffff", borderWidth: 1, borderColor: "#e6dccb" }, [
    icon(ic, 16, BRICK),
    text(label, 15, { fontWeight: 600, ...HUG }),
  ]);

const gift = (): Spec =>
  section("Quà tặng", {}, [
    frame(
      "2 cột",
      { direction: "row", align: "center", gap: 56 },
      [
        frame("Chữ", { direction: "column", gap: 22, width: { mode: "fill" } }, [
          eyebrow("A gift with their name on it"),
          display("The present they'll actually wear", 40, {}, "h2", { fontSize: 30 }),
          text(
            "A hat with someone's name — stitched in a style that fits them — says you thought about it. Simple, personal and made to be worn every day.",
            17,
            { color: MUTED, lineHeight: 1.7 },
          ),
          frame("Dịp tặng", { direction: "row", gap: 10, wrap: true }, [
            chip("gift", "Christmas"),
            chip("star", "Birthdays"),
            chip("heart", "Anniversaries"),
            chip("user", "Father's Day"),
            chip("flower", "Mother's Day"),
            chip("smile", "Couples & friends"),
          ]),
          text("Unisex · breathable cotton · adjustable strap — one size fits most.", 14, { color: MOSS, fontWeight: 600 }),
        ]),
        img("03.jpg", { aspectRatio: "1 / 1", radius: 24, shadow: "md", maxWidth: 520 }, { alt: "Five personalized name hats in different embroidery styles" }),
      ],
      { tablet: { direction: "column", align: "stretch" } },
    ),
  ]);

const bullet = (t: string, ic = "check"): Spec => frame(t.slice(0, 30), { direction: "row", align: "start", gap: 10 }, [icon(ic, 18, BRICK), text(t, 15, { color: INK, width: { mode: "fill" } })]);
const card = (name: string, children: Spec[]): Spec =>
  frame(name, { direction: "column", gap: 14, padding: [30, 30, 30, 30], radius: 22, background: "#ffffff", borderWidth: 1, borderColor: "#ebe3d6", width: { mode: "fill" } }, children);

const details = (): Spec =>
  section("Chi tiết", { background: LINEN }, [
    head("The details", "Made to look good for years"),
    frame(
      "2 thẻ",
      { direction: "row", align: "stretch", gap: 24 },
      [
        card("Highlights", [
          display("Highlights", 24, {}, "h3"),
          bullet("Fully personalized: a name, initials or a word that means something"),
          bullet("Premium embroidery thread with dense, detailed stitching"),
          bullet("Breathable cotton with an adjustable strap for a comfortable fit"),
          bullet("Unisex, minimal design that goes with casual, sporty or street outfits"),
        ]),
        card("Care", [
          display("Care instructions", 24, {}, "h3"),
          bullet("Hand wash gently in cold water with a mild detergent", "info"),
          bullet("No bleach, no machine wash, no tumble dry", "info"),
          bullet("Air dry in the shade; reshape while damp", "info"),
          bullet("Store somewhere cool and dry, out of direct sunlight", "info"),
        ]),
      ],
      { tablet: { direction: "column" } },
    ),
  ]);

/** Thiet ke rieng: chu ben trai + khoi "Form yêu cầu thiết kế riêng" (nut WhatsApp + form) ben phai */
const customRequest = (): Spec =>
  section("Thiết kế riêng", { background: LINEN }, [
    frame(
      "2 cột",
      { direction: "row", align: "center", gap: 48 },
      [
        frame("Chữ", { direction: "column", gap: 18, width: { mode: "fill" } }, [
          eyebrow("Your idea, stitched"),
          display("Got something special in mind?", 42, {}, "h2", { fontSize: 30 }),
          text(
            "A team logo, a nickname, your pet, a style we haven't done yet — tell us what you want on your hat. Chat with us on WhatsApp right now, or leave your details and a short description and we'll get back to you.",
            17,
            { color: MUTED, lineHeight: 1.7 },
          ),
          frame("Ảnh", { direction: "row", gap: 12 }, ["05.jpg", "08.jpg", "10.jpg"].map((f) =>
            ({ ...img(f, { aspectRatio: "1 / 1", radius: 14 }), style: { base: { width: { mode: "fixed", value: 96 }, aspectRatio: "1 / 1", radius: 14 }, mobile: { width: { mode: "fixed", value: 76 } } } }),
          )),
        ]),
        frame("Form", { width: { mode: "fill" }, maxWidth: 560 }, [
          { type: "slot", name: "Form yêu cầu thiết kế riêng", props: { slot: "customRequest", label: "Send my idea", heading: "Personalized name hat" }, style: { base: {} } },
        ], { tablet: { maxWidth: 9999 } }),
      ],
      { tablet: { direction: "column", align: "stretch", gap: 32 } },
    ),
  ]);

const faq = (q: string, a: string): Spec =>
  frame(q, { direction: "column", gap: 8, padding: [22, 0, 22, 0], borderWidth: 0 }, [
    text(q, 18, { fontWeight: 700 }, "h3"),
    text(a, 15, { color: MUTED, lineHeight: 1.7 }),
    { type: "divider", style: { base: { borderColor: "#e6dccb", borderWidth: 1, margin: [14, 0, 0, 0] } } },
  ]);

const faqs = (): Spec =>
  section("Hỏi đáp", { gap: 24 }, [
    head("Questions", "Good to know"),
    frame("Danh sách", { direction: "column", maxWidth: 820, selfAlign: "center", width: { mode: "fill" } }, [
      faq("How long does delivery take?", "Every hat is embroidered to order, then shipped with tracking. Most US orders arrive in 10–18 days, and US delivery is free."),
      faq("Will I see the design before you stitch it?", "Yes. After you order we design your name in the style you chose and send you a preview. We only stitch once you approve it."),
      faq("What should I write in the order?", "Choose the hat color on the product page, then add the exact name or word and the style you'd like (or describe your own idea) in the order note."),
      faq("Can I return a personalized hat?", "Because it's made just for you it can't be resold — but if anything arrives damaged or not as approved, contact us within 30 days and we'll make it right."),
    ]),
  ]);

const finalCta = (): Spec =>
  section("Kêu gọi cuối", { backgroundImage: `${IMG}/03.jpg`, bgSize: "cover", overlay: "rgba(18,34,29,.86)", padding: [96, 20, 96, 20] }, [
    product("Nội dung", { direction: "column", align: "center", gap: 22 }, [
      { ...eyebrow("Ready when you are", MUSTARD), style: { base: { fontSize: 13, color: MUSTARD, uppercase: true, letterSpacing: 2, fontWeight: 700, textAlign: "center" } } },
      display("Put a name on it — and make it theirs.", 50, { textAlign: "center", color: "#ffffff" }, "h2", { fontSize: 32 }),
      text("Personalized embroidered cap · preview before stitching · free US delivery", 17, { textAlign: "center", color: "rgba(255,255,255,.8)" }),
      frame("Giá", { direction: "row", align: "end", gap: 10 }, [
        text("From", 16, { color: "rgba(255,255,255,.75)", fontWeight: 600, ...HUG }),
        text("{{price}}", 44, { fontWeight: 800, color: MUSTARD, lineHeight: 1, ...HUG }),
      ]),
      button("Design my hat", "{{url}}", { padding: [17, 38, 17, 38], fontSize: 17 }),
    ]),
  ]);

export function spec(): Spec {
  return {
    type: "page",
    name: title,
    style: { base: { direction: "column", align: "stretch", gap: 0, background: "#ffffff" } },
    children: [topBar(), hero(), trust(), styles(), how(), gift(), details(), customRequest(), faqs(), finalCta()],
  };
}
