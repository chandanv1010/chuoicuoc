import { buildDoc, footerSpec, headerSpec, homeSpec, templateSpec } from "./library";
import type { BuilderDoc, PageKind } from "./schema";

/** Ban mau khi trang chua tung duoc luu trong builder (giong giao dien code cung hien tai). */
export function defaultDoc(slug: string, siteName?: string): BuilderDoc {
  if (slug === "home") return buildDoc(homeSpec());
  if (slug === "header") return buildDoc(headerSpec());
  if (slug === "footer") return buildDoc(footerSpec(siteName || undefined));
  const t = slug.match(/^tpl-(product|catalogue|post|postcat)$/);
  if (t) return buildDoc(templateSpec(t[1] as PageKind));
  return buildDoc({ type: "page", style: { base: { direction: "column", align: "stretch" } } });
}
