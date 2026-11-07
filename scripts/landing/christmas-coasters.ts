/**
 * Landing page Giang sinh: bo suu tap lot coc theu phong cach Noel (thiet ke trong Figma — nha banh gung, xuong qua,
 * lang don Santa, meo, cho, Santa, bo tron). Phong cach: nen kem, xanh xo thom, tieu de serif nau, diem do qua mong.
 * Anh xuat tu Figma: storage/userfiles/image/emhaus/christmas-coasters (thiet ke phang); trang dung ban da mo phong
 * theu (scripts/landing/embroider.py) o christmas-coasters-embroidered.
 * Cac mau trong Figma chua phai san pham dang ban -> nut mua dan toi danh muc "Christmas Coasters" (#109); cuoi trang
 * la luoi san pham that cua danh muc (tu cap nhat).
 *   node scripts/landing/seed-landing.mjs christmas-coasters > out.sql
 */
import type { Spec } from "../../src/modules/builder/library";
import type { NodeProps, PageSettings, Style } from "../../src/modules/builder/schema";

const IMG = "/userfiles/image/emhaus/christmas-coasters-embroidered";
const CATALOGUE = 109;
const SHOP = "/christmas-coasters.html";
const CREAM = "#fbf4ec";
const PAPER = "#fffaf3";
const SAGE = "#6f7f52";
const SAGE_DARK = "#4c5a36";
const BROWN = "#7a4528";
const BERRY = "#b22234";
const INK = "#2b2420";
const MUTED = "#6e625a";
const LINE = "#ecdccb";
const W = 1200;

export const path = "christmas-village";
export const title = "Christmas Coasters – The Embroidered Christmas Village";
export const settings: PageSettings = {
  header: "header-christmas",
  footer: "footer-christmas",
  seoTitle: "Embroidered Christmas Coasters – Gingerbread Houses, Cats, Dogs & Santa | CustomStitch House",
  seoDescription:
    "Meet our embroidered Christmas village: gingerbread bakery, tiny toy workshop and waiting-for-Santa house coasters, plus cat, dog and Santa sets. Cozy, gift-ready and stitched to order.",
  seoImage: `${IMG}/share.jpg`,
};

/* ------------------------------------------------ helpers ------------------------------------------------ */

const HUG: Style = { width: { mode: "hug" } };
const text = (t: string, size: number, extra: Style = {}, tag: NodeProps["tag"] = "p", mobile?: Style): Spec => ({
  type: "text",
  name: t.replace(/\{\{|\}\}/g, "").slice(0, 40),
  props: { text: t, tag },
  style: { base: { fontSize: size, lineHeight: 1.6, color: INK, ...extra }, ...(mobile ? { mobile } : {}) },
});
const serif = (t: string, size: number, extra: Style = {}, tag: NodeProps["tag"] = "h2", mobile?: Style): Spec =>
  text(t, size, { fontFamily: "display", fontWeight: 500, lineHeight: 1.12, color: BROWN, ...extra }, tag, mobile);
const eyebrow = (t: string, extra: Style = {}): Spec => text(t, 13, { color: SAGE, uppercase: true, letterSpacing: 2.5, fontWeight: 700, ...extra });
const button = (label: string, href: string, extra: Style = {}): Spec => ({
  type: "button",
  name: label,
  props: { label, href },
  style: { base: { background: SAGE, color: "#ffffff", padding: [15, 30, 15, 30], radius: 12, fontWeight: 700, fontSize: 16, hover: "lift", shadow: "sm", ...extra } },
});
const ghost = (label: string, href: string): Spec => ({
  type: "button",
  name: label,
  props: { label, href },
  style: { base: { color: SAGE_DARK, padding: [13, 26, 13, 26], radius: 12, borderWidth: 2, borderColor: SAGE, fontWeight: 700, fontSize: 16, hover: "lift" } },
});
const img = (file: string, alt: string, extra: Style = {}, props: NodeProps = {}): Spec => ({
  type: "image",
  name: file,
  props: { src: `${IMG}/${file}`, alt, fit: "contain", ...props },
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
  style: { base: { direction: "column", align: "stretch", contentWidth: W, padding: [88, 20, 88, 20], gap: 44, background: CREAM, ...base }, mobile: { padding: [56, 18, 56, 18], gap: 30 }, ...extra },
  children,
});
const head = (eb: string, h: string, sub?: string, color = BROWN): Spec =>
  frame("Tiêu đề khối", { direction: "column", align: "center", gap: 12 }, [
    eyebrow(eb, { textAlign: "center" }),
    serif(h, 46, { textAlign: "center", color }, "h2", { fontSize: 32 }),
    ...(sub ? [text(sub, 17, { textAlign: "center", color: MUTED, maxWidth: 660, selfAlign: "center" })] : []),
  ]);

/** The mot chiec lot coc: anh + chu thich */
const coaster = (file: string, caption: string, bg = PAPER): Spec =>
  frame(
    caption,
    { direction: "column", align: "center", gap: 12, padding: [22, 18, 18, 18], radius: 20, background: bg, borderWidth: 1, borderColor: LINE, hover: "lift" },
    [img(`${file}.webp`, `${caption} embroidered Christmas coaster`, { aspectRatio: "1 / 1" }), text(caption, 15, { fontWeight: 700, textAlign: "center", color: INK })],
    {},
    { href: SHOP },
  );

/* ------------------------------------------------ sections ------------------------------------------------ */

const hero = (): Spec =>
  section("Hero", { padding: [72, 20, 80, 20] }, [
    frame(
      "2 cột",
      { direction: "row", align: "center", gap: 48 },
      [
        frame("Chữ", { direction: "column", gap: 22, width: { mode: "fill" } }, [
          frame("Nhãn", { ...HUG, direction: "row", align: "center", gap: 8, padding: [7, 14, 7, 14], radius: 999, background: "#ffffff", borderWidth: 1, borderColor: LINE }, [
            icon("sparkles", 15, BERRY),
            text("Christmas 2026 collection", 13, { fontWeight: 700, color: SAGE_DARK, ...HUG }),
          ]),
          serif("Merry little coasters for every cozy cup", 62, { fontWeight: 500 }, "h1", { fontSize: 40 }),
          text(
            "Welcome to our embroidered Christmas village — a gingerbread bakery, a tiny toy workshop and a house waiting up for Santa, plus cats, dogs and a very clumsy Santa. Every coaster tells a little holiday story.",
            18,
            { color: MUTED, lineHeight: 1.75 },
          ),
          frame("Nút", { direction: "row", gap: 14, wrap: true }, [button("Shop Christmas coasters", SHOP), ghost("All embroidered coasters", "/embroidered-coasters.html")]),
          frame("Cam kết", { direction: "row", gap: 20, wrap: true }, [
            frame("1", { ...HUG, direction: "row", align: "center", gap: 6 }, [icon("truck", 16, SAGE), text("Free US delivery", 14, { color: SAGE_DARK, fontWeight: 600, ...HUG })]),
            frame("2", { ...HUG, direction: "row", align: "center", gap: 6 }, [icon("gift", 16, SAGE), text("Gift-ready sets", 14, { color: SAGE_DARK, fontWeight: 600, ...HUG })]),
          ]),
        ]),
        frame("Ảnh", { width: { mode: "fill" } }, [img("hero-village.webp", "Embroidered Christmas house coasters: gingerbread bakery, toy workshop and Santa's house", { aspectRatio: "1200 / 784" })]),
      ],
      { tablet: { direction: "column", align: "stretch", gap: 36 } },
    ),
  ]);

const promise = (ic: string, h: string, d: string): Spec =>
  frame(h, { direction: "column", align: "center", gap: 10 }, [
    frame("Icon", { width: { mode: "fixed", value: 54 }, height: { mode: "fixed", value: 54 }, radius: 999, background: "rgba(255,255,255,.14)", justify: "center", align: "center" }, [icon(ic, 24, "#ffffff")]),
    text(h, 17, { color: "#ffffff", fontWeight: 700, textAlign: "center" }),
    text(d, 14, { color: "rgba(255,255,255,.78)", textAlign: "center" }),
  ]);

const promises = (): Spec =>
  section("Cam kết", { background: SAGE, padding: [44, 20, 44, 20] }, [
    frame(
      "4 cột",
      { layout: "grid", columns: 4, gap: 28 },
      [
        promise("scissors", "Embroidered, not printed", "Raised, textured stitching you can feel"),
        promise("gift", "Gift-ready sets", "Each house comes as a story set of four"),
        promise("truck", "Free US delivery", "Tracked shipping, usually 10–18 days"),
        promise("heart", "Made to order", "Stitched in our own workshop"),
      ],
      { tablet: { columns: 2 }, mobile: { columns: 2, gap: 22 } },
    ),
  ]);

type House = { key: string; name: string; tagline: string; story: string; accent: string; items: [string, string][] };
const HOUSES: House[] = [
  {
    key: "red",
    name: "The Gingerbread Bakery",
    tagline: "Mixing · Baking · Decorating · Sharing",
    story: "Follow a batch of gingerbread from the mixing bowl to the cooling rack — four red-roofed coasters that turn a tray of mugs into a little bakery street.",
    accent: BERRY,
    items: [
      ["house-red-mixing", "Mixing"],
      ["house-red-baking", "Baking"],
      ["house-red-decorating", "Decorating"],
      ["house-red-sharing", "Sharing"],
    ],
  },
  {
    key: "mint",
    name: "The Tiny Toy Workshop",
    tagline: "Wishes · Toymaking · Wrapping · Ready to go",
    story: "Elves read the wish list, build the toys, wrap every present and load the sleigh. A soft mint set that feels like Christmas Eve at the workshop.",
    accent: SAGE_DARK,
    items: [
      ["house-mint-wishes", "Wishes"],
      ["house-mint-toymaking", "Toymaking"],
      ["house-mint-wrapping", "Wrapping"],
      ["house-mint-ready", "Ready to go"],
    ],
  },
  {
    key: "navy",
    name: "Waiting for Santa",
    tagline: "Stockings · Waiting · Santa arrives · Christmas morning",
    story: "Hang the stockings, stay up late, catch Santa on the rooftop — and wake up to Christmas morning. A starry navy set for the coziest night of the year.",
    accent: "#23407a",
    items: [
      ["house-navy-stocking", "Stockings"],
      ["house-navy-waiting", "Waiting"],
      ["house-navy-santa-arrives", "Santa arrives"],
      ["house-navy-morning", "Christmas morning"],
    ],
  },
];

const houseSet = (h: House, i: number): Spec =>
  frame(
    h.name,
    { direction: "column", gap: 26, padding: [40, 40, 40, 40], radius: 28, background: i % 2 ? "#f4eadc" : PAPER, borderWidth: 1, borderColor: LINE },
    [
      frame("Tiêu đề bộ", { direction: "row", align: "end", justify: "between", gap: 24, wrap: true }, [
        frame("Chữ", { direction: "column", gap: 8, width: { mode: "fill" }, maxWidth: 640 }, [
          text(`Set ${i + 1} · ${h.tagline}`, 13, { color: h.accent, uppercase: true, letterSpacing: 1.5, fontWeight: 700 }),
          serif(h.name, 36, {}, "h3", { fontSize: 28 }),
          text(h.story, 16, { color: MUTED, lineHeight: 1.7 }),
        ]),
        ghost("Shop this set →", SHOP),
      ], { tablet: { direction: "column", align: "start", gap: 16 } }),
      frame("4 lót cốc", { layout: "grid", columns: 4, gap: 18 }, h.items.map(([f, c]) => coaster(f, c, "#ffffff")), { tablet: { columns: 2 }, mobile: { columns: 2, gap: 12 } }),
    ],
    { mobile: { padding: [24, 16, 24, 16] } },
  );

const village = (): Spec =>
  section("Christmas Village", { gap: 32 }, [
    head("The Christmas Village", "Three houses, twelve little stories", "Each house is a set of four coasters that tell one Christmas story, scene by scene. Mix them, match them — or line them up on the table."),
    ...HOUSES.map(houseSet),
  ]);

type Friends = { name: string; sub: string; items: [string, string][] };
const friendsSet = (f: Friends): Spec =>
  frame(
    f.name,
    { direction: "column", gap: 20, padding: [32, 28, 32, 28], radius: 28, background: "#ffffff", borderWidth: 1, borderColor: LINE, width: { mode: "fill" } },
    [
      frame("Chữ", { direction: "column", gap: 6 }, [serif(f.name, 30, {}, "h3", { fontSize: 26 }), text(f.sub, 15, { color: MUTED })]),
      frame("Lưới", { layout: "grid", columns: 2, gap: 14 }, f.items.map(([file, c]) => coaster(file, c))),
    ],
    { mobile: { padding: [22, 14, 22, 14] } },
  );

const friends = (): Spec =>
  section("Mèo & chó", { background: "#f4eadc" }, [
    head("Furry friends", "For the cat people and the dog people", "Two playful sets for pet lovers — and a great Secret Santa pick."),
    frame(
      "2 bộ",
      { direction: "row", align: "stretch", gap: 24 },
      [
        friendsSet({
          name: "Meowy Christmas",
          sub: "Four cats, zero respect for the wrapping paper.",
          items: [
            ["cat-dear-santa", "Dear Santa…"],
            ["cat-wrapping-chaos", "Wrapping chaos"],
            ["cat-golden-tree", "Golden ribbon tree"],
            ["cat-meowy-christmas", "Meowy Christmas"],
          ],
        }),
        friendsSet({
          name: "Merry Mail",
          sub: "The dog postal team delivers every letter to the North Pole.",
          items: [
            ["dog-mail-captain", "Mail captain"],
            ["dog-snow-mail", "Snow mail express"],
            ["dog-merry-mail", "Merry Mail"],
            ["dog-custom-name", "Your dog's name"],
          ],
        }),
      ],
      { tablet: { direction: "column" } },
    ),
  ]);

const santa = (): Spec =>
  section("Santa & bộ tròn", {}, [
    head("More to love", "A little Christmas mischief"),
    frame(
      "2 bộ",
      { direction: "row", align: "stretch", gap: 24 },
      [
        friendsSet({
          name: "Ho Ho Oops",
          sub: "Santa's night doesn't quite go to plan — chimneys, candy breaks and all.",
          items: [
            ["santa-chimney", "Chimney trouble"],
            ["santa-candy-break", "Candy break"],
            ["santa-ho-ho-oops", "Ho ho… oops!"],
            ["santa-sleigh", "Back on the sleigh"],
          ],
        }),
        friendsSet({
          name: "Christmas Gift Mix-up",
          sub: "Classic round coasters with a cheerful red stitched border.",
          items: [
            ["round-santa", "Santa"],
            ["round-reindeer", "Reindeer"],
            ["round-walking-tree", "Walking tree"],
            ["round-merry-christmas", "Merry Christmas"],
          ],
        }),
      ],
      { tablet: { direction: "column" } },
    ),
  ]);

const personalize = (): Spec =>
  section("Cá nhân hoá", { background: SAGE_DARK, padding: [72, 20, 72, 20] }, [
    frame(
      "2 cột",
      { direction: "row", align: "center", gap: 48 },
      [
        frame("Ảnh", { width: { mode: "fill" }, maxWidth: 520 }, [img("dog-custom-name.webp", "Gingerbread bone coaster with a custom dog name", { aspectRatio: "760 / 482" })]),
        frame("Chữ", { direction: "column", gap: 18, width: { mode: "fill" } }, [
          eyebrow("Make it personal", { color: "#e9d6a8" }),
          serif("Add a name — theirs, or their dog's", 40, { color: "#ffffff" }, "h2", { fontSize: 30 }),
          text(
            "Some designs have room for a name, like our gingerbread bone. Tell us the name in your order note and we'll stitch it in — the kind of gift that gets kept long after the holidays.",
            17,
            { color: "rgba(255,255,255,.8)", lineHeight: 1.7 },
          ),
          frame("Nút", { direction: "row" }, [button("Shop Christmas coasters", SHOP, { background: BERRY })]),
        ]),
      ],
      { tablet: { direction: "column", align: "stretch" } },
    ),
  ]);

const shopNow = (): Spec =>
  section("Đang bán", { background: PAPER }, [
    head("In the shop now", "Ready to order this Christmas", "Our current Christmas pieces, straight from the shop — new village designs are added to the collection as they're stitched."),
    {
      type: "collection",
      name: "Sản phẩm Giáng sinh",
      props: { collection: "products", source: "catalogue", catalogueId: CATALOGUE, limit: 8 },
      style: { base: { layout: "grid", columns: 4, gap: 20 }, tablet: { columns: 3 }, mobile: { columns: 2, gap: 12 } },
      children: [
        frame(
          "Thẻ mẫu",
          { direction: "column", gap: 10, padding: [12, 12, 16, 12], radius: 18, background: "#ffffff", borderWidth: 1, borderColor: LINE, hover: "lift", height: { mode: "fill" } },
          [
            { type: "image", name: "Ảnh", props: { src: "", alt: "", fit: "cover", bindImage: true }, style: { base: { width: { mode: "fill" }, aspectRatio: "1 / 1", radius: 12 } } },
            text("{{name}}", 14, { fontWeight: 600, lineHeight: 1.4, maxLines: 2 }, "h3"),
            text("{{price}}", 17, { fontWeight: 800, color: BERRY }),
          ],
          {},
          { href: "{{url}}" },
        ),
      ],
    },
    frame("Nút", { direction: "row", justify: "center" }, [button("See the whole collection", SHOP)]),
  ]);

/** Thiet ke rieng: chu ben trai + khoi "Form yêu cầu thiết kế riêng" (nut WhatsApp + form) ben phai */
const customRequest = (): Spec =>
  section("Thiết kế riêng", { background: "#f4eadc" }, [
    frame(
      "2 cột",
      { direction: "row", align: "center", gap: 48 },
      [
        frame("Chữ", { direction: "column", gap: 18, width: { mode: "fill" } }, [
          eyebrow("Made just for you"),
          serif("Want it your way?", 46, {}, "h2", { fontSize: 32 }),
          text(
            "Your pet, your house, your family name, your colors — tell us the idea and we'll design a coaster set just for you. Chat with us on WhatsApp right now, or leave your details and a short description and we'll get back to you.",
            17,
            { color: MUTED, lineHeight: 1.75 },
          ),
          frame("Ý", { direction: "column", gap: 10 }, [
            frame("1", { direction: "row", align: "center", gap: 10 }, [icon("paw-print", 18, BERRY), text("Your pet as a Christmas coaster", 15, { fontWeight: 600, ...HUG })]),
            frame("2", { direction: "row", align: "center", gap: 10 }, [icon("home", 18, BERRY), text("Your own home as a gingerbread house", 15, { fontWeight: 600, ...HUG })]),
            frame("3", { direction: "row", align: "center", gap: 10 }, [icon("pen-tool", 18, BERRY), text("Names, dates and colors that match your table", 15, { fontWeight: 600, ...HUG })]),
          ]),
          frame("Ảnh", { direction: "row", gap: 12 }, ["house-navy-morning", "cat-meowy-christmas", "dog-merry-mail"].map((f) =>
            ({ ...img(`${f}.webp`, "", { aspectRatio: "1 / 1" }), style: { base: { width: { mode: "fixed", value: 96 }, aspectRatio: "1 / 1" }, mobile: { width: { mode: "fixed", value: 76 } } } }),
          )),
        ]),
        frame("Form", { width: { mode: "fill" }, maxWidth: 560 }, [
          { type: "slot", name: "Form yêu cầu thiết kế riêng", props: { slot: "customRequest", label: "Send my idea", heading: "Christmas coasters" }, style: { base: {} } },
        ], { tablet: { maxWidth: 9999 } }),
      ],
      { tablet: { direction: "column", align: "stretch", gap: 32 } },
    ),
  ]);

const faq = (q: string, a: string): Spec =>
  frame(q, { direction: "column", gap: 8, padding: [20, 0, 20, 0] }, [
    text(q, 18, { fontWeight: 700, color: INK }, "h3"),
    text(a, 15, { color: MUTED, lineHeight: 1.7 }),
    { type: "divider", style: { base: { borderColor: LINE, borderWidth: 1, margin: [12, 0, 0, 0] } } },
  ]);

const faqs = (): Spec =>
  section("Hỏi đáp", { gap: 20 }, [
    head("Good to know", "Before you order"),
    frame("Danh sách", { direction: "column", maxWidth: 820, selfAlign: "center", width: { mode: "fill" } }, [
      faq("When will it arrive?", "Every piece is embroidered to order, then shipped with tracking. Most US orders arrive in 10–18 days, and US delivery is free — order early for Christmas."),
      faq("Are these printed?", "No — every design is machine-embroidered, so the colors are thread you can feel, not ink that fades."),
      faq("Can I add a name?", "Some designs have space for a name. Add it to your order note and we'll confirm the details before we stitch."),
      faq("What if something arrives damaged?", "Contact us within 30 days and we'll make it right."),
    ]),
  ]);

const finalCta = (): Spec =>
  section("Kêu gọi cuối", { background: BERRY, padding: [80, 20, 80, 20] }, [
    frame(
      "Nội dung",
      { direction: "row", align: "center", gap: 40 },
      [
        frame("Ảnh", { width: { mode: "fixed", value: 220 } }, [img("round-merry-christmas.webp", "Merry Christmas candy cane round coaster", { aspectRatio: "1 / 1" })], { mobile: { width: { mode: "fixed", value: 160 } } }),
        frame("Chữ", { direction: "column", gap: 16, width: { mode: "fill" } }, [
          serif("Set the table for Christmas", 46, { color: "#ffffff" }, "h2", { fontSize: 32 }),
          text("Embroidered coasters · gift-ready sets · free US delivery", 17, { color: "rgba(255,255,255,.85)" }),
          frame("Nút", { direction: "row" }, [button("Shop Christmas coasters", SHOP, { background: "#ffffff", color: BERRY })]),
        ]),
      ],
      { mobile: { direction: "column", align: "center" } },
    ),
  ]);

export function spec(): Spec {
  return {
    type: "page",
    name: title,
    style: { base: { direction: "column", align: "stretch", gap: 0, background: CREAM } },
    children: [hero(), promises(), village(), friends(), santa(), personalize(), shopNow(), customRequest(), faqs(), finalCta()],
  };
}

/* ---------------------------------- header / footer rieng (phong cach Giang sinh) ---------------------------------- */

const NAV = [
  { label: "Christmas Village", href: "/christmas-village.html" },
  { label: "Christmas Coasters", href: SHOP },
  { label: "All Coasters", href: "/embroidered-coasters.html" },
  { label: "Hats", href: "/embroidered-hats.html" },
  { label: "Gifts", href: "/products.html?keyword=Custom" },
];

export function header(): Spec {
  return {
    type: "page",
    name: "Header Giáng sinh",
    style: { base: { direction: "column", align: "stretch", background: CREAM } },
    children: [
      frame("Dải thông báo", { direction: "row", align: "center", justify: "center", gap: 8, padding: [8, 16, 8, 16], background: BERRY }, [
        icon("snowflake", 14, "#ffe9c7"),
        { ...text("Free US delivery on Christmas orders · every piece is stitched to order, so order early", 13, { color: "#ffffff", fontWeight: 600, textAlign: "center", ...HUG }), style: { base: { fontSize: 13, color: "#ffffff", fontWeight: 600, textAlign: "center", width: { mode: "hug" } }, mobile: { fontSize: 12 } } },
        icon("snowflake", 14, "#ffe9c7"),
      ]),
      {
        type: "section",
        name: "Thanh menu",
        style: { base: { direction: "column", align: "stretch", contentWidth: W, padding: [14, 20, 14, 20], background: CREAM }, mobile: { padding: [10, 16, 10, 16] } },
        children: [
          frame("Hàng", { direction: "row", align: "center", justify: "between", gap: 24 }, [
            { type: "logo", name: "Logo", props: { alt: "CustomStitch House", tone: "dark" }, style: { base: { width: { mode: "fixed", value: 180 } }, mobile: { width: { mode: "fixed", value: 150 } } } },
            { type: "nav", name: "Menu", props: { links: NAV, collapse: "tablet" }, style: { base: { fontSize: 14, fontWeight: 600, color: BROWN } } },
            { ...button("Shop coasters", SHOP), style: { base: { background: SAGE, color: "#ffffff", padding: [10, 20, 10, 20], radius: 999, fontWeight: 700, fontSize: 14, hover: "lift", width: { mode: "hug" } }, mobile: { hidden: true } } },
          ], { tablet: { gap: 12 } }),
        ],
      },
      { type: "divider", name: "Đường kẻ", style: { base: { borderColor: LINE, borderWidth: 1, margin: [0, 0, 0, 0] } } },
    ],
  };
}

const flink = (label: string, href: string): Spec => ({
  type: "button",
  name: label,
  props: { label, href },
  style: { base: { fontSize: 14, color: "rgba(255,255,255,.78)", padding: [0, 0, 0, 0] } },
});
const fcol = (h: string, links: [string, string][]): Spec =>
  frame(h, { direction: "column", gap: 10 }, [
    text(h, 14, { color: "#f3e2c3", uppercase: true, letterSpacing: 1.5, fontWeight: 700, margin: [0, 0, 4, 0] }, "h3"),
    ...links.map(([l, href]) => flink(l, href)),
  ]);
const GARLAND = ["house-red-baking", "round-santa", "cat-golden-tree", "house-mint-wishes", "round-reindeer", "house-navy-santa-arrives", "round-walking-tree"];

export function footer(): Spec {
  return {
    type: "page",
    name: "Footer Giáng sinh",
    style: { base: { direction: "column", align: "stretch", background: SAGE_DARK } },
    children: [
      frame("Dải lót cốc", { direction: "row", align: "center", justify: "center", gap: 18, padding: [26, 16, 26, 16], background: "#f4eadc", wrap: true }, GARLAND.map((f) =>
        ({ ...img(`${f}.webp`, "", { aspectRatio: "1 / 1" }), style: { base: { width: { mode: "fixed", value: 84 }, aspectRatio: "1 / 1", hover: "grow" }, mobile: { width: { mode: "fixed", value: 40 } } } }),
      ), { mobile: { gap: 6, padding: [16, 8, 16, 8], wrap: false } }),
      {
        type: "section",
        name: "Các cột",
        style: { base: { direction: "column", align: "stretch", contentWidth: W, padding: [56, 20, 44, 20], gap: 36 }, mobile: { padding: [40, 18, 32, 18] } },
        children: [
          frame(
            "Lưới",
            { layout: "grid", columns: 4, gap: 36 },
            [
              frame("Thương hiệu", { direction: "column", gap: 14 }, [
                { type: "logo", name: "Logo", props: { alt: "CustomStitch House", tone: "light" }, style: { base: { width: { mode: "fixed", value: 180 } } } },
                text("Coasters, hats and gifts, machine-embroidered to order in our own workshop in Vietnam.", 14, { color: "rgba(255,255,255,.72)", lineHeight: 1.7 }),
                flink("Visit our Etsy shop →", "https://www.etsy.com/shop/Emhausvn"),
              ]),
              fcol("Christmas shop", [
                ["The Christmas Village", "/christmas-village.html"],
                ["Christmas Coasters", SHOP],
                ["All Embroidered Coasters", "/embroidered-coasters.html"],
                ["Personalized Gifts", "/products.html?keyword=Custom"],
              ]),
              fcol("Help", [
                ["Contact us", "/contact.html"],
                ["Shipping & delivery", "/contact.html"],
                ["Your orders", "/account/orders.html"],
                ["About us", "/about.html"],
              ]),
              fcol("Policies", [
                ["Privacy Policy", "/privacy-policy"],
                ["Terms of Service", "/terms"],
                ["Data Deletion", "/data-deletion"],
              ]),
            ],
            { tablet: { columns: 2 }, mobile: { columns: 2, gap: 28 } },
          ),
        ],
      },
      frame("Bản quyền", { direction: "row", align: "center", justify: "center", gap: 8, padding: [14, 16, 14, 16], background: BERRY }, [
        icon("tree-pine", 14, "#ffe9c7"),
        { ...text("© 2026 CustomStitch House · Merry Christmas & happy stitching", 13, { color: "#ffffff", textAlign: "center", ...HUG }) },
        icon("tree-pine", 14, "#ffe9c7"),
      ]),
    ],
  };
}

/** Header / footer rieng ghi kem (slug -> ten trong trinh dung); trang chon dung qua settings.header / footer */
export const parts = [
  { slug: "header-christmas", title: "Header · Christmas", spec: header },
  { slug: "footer-christmas", title: "Footer · Christmas", spec: footer },
];
