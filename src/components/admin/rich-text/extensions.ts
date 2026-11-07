import { Extension, mergeAttributes, Node } from "@tiptap/core";

/**
 * Cac extension giu lai HTML cu (soan bang CKEditor 4) khi mo bang TipTap:
 * class/style tren cac the thuong gap, va cac the TipTap khong co san
 * (div, figure, figcaption, iframe). Khong co thi TipTap se bo chung khi luu.
 */

const keep = (name: string) => ({
  default: null,
  parseHTML: (el: HTMLElement) => el.getAttribute(name),
  renderHTML: (attrs: Record<string, unknown>) => (attrs[name] ? { [name]: attrs[name] } : {}),
});

export const GlobalAttributes = Extension.create({
  name: "globalAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "table", "tableRow", "tableCell", "tableHeader", "textStyle", "link"],
        attributes: { class: keep("class"), style: keep("style") },
      },
      {
        types: ["image"],
        attributes: { class: keep("class"), style: keep("style"), width: keep("width"), height: keep("height") },
      },
    ];
  },
});

/** <div class=...> bao cac khoi (vd .image-content cua nut "Upload nhieu hinh anh" cu). */
export const Div = Node.create({
  name: "div",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { class: keep("class"), style: keep("style"), id: keep("id") };
  },
  parseHTML() {
    return [{ tag: "div" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },
});

export const Figure = Node.create({
  name: "figure",
  group: "block",
  // Anh la inline (de giu <p><img></p> cua noi dung cu) nen <img> trong figure duoc boc vao doan van
  content: "block+ figcaption?",
  defining: true,
  addAttributes() {
    return { class: keep("class"), style: keep("style") };
  },
  parseHTML() {
    return [{ tag: "figure" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes), 0];
  },
});

export const Figcaption = Node.create({
  name: "figcaption",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "figcaption" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figcaption", mergeAttributes(HTMLAttributes), 0];
  },
});

/** iframe nhung (Google Maps, video...) — giu nguyen thuoc tinh. */
export const Iframe = Node.create({
  name: "iframe",
  group: "block",
  atom: true,
  addAttributes() {
    return Object.fromEntries(
      ["src", "width", "height", "style", "class", "frameborder", "allow", "allowfullscreen", "loading", "referrerpolicy", "title"].map((a) => [a, keep(a)]),
    );
  },
  parseHTML() {
    return [{ tag: "iframe" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["iframe", mergeAttributes(HTMLAttributes)];
  },
});
