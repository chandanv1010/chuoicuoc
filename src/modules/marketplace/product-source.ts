import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ProductSnapshot } from "./types";

/** Doc san pham website thanh ProductSnapshot (ngon ngu 1 = English). */

function parseJson<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&ndash;": "–", "&mdash;": "—" };

/** HTML trinh soan thao -> van ban thuan giu xuong dong / gach dau dong (san chi nhan text). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h\d|ul|ol|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? (/^&#\d+;$/.test(e) ? String.fromCharCode(Number(e.slice(2, -1))) : e))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ProductRow = {
  id: bigint;
  image: string | null;
  album: string | null;
  price: string | number;
  stock: number;
  code: string;
  attributeCatalogue: string | null;
  attribute: string | null;
  name: string | null;
  description: string | null;
  content: string | null;
  canonical: string | null;
};

export async function loadProduct(productId: bigint): Promise<ProductSnapshot | null> {
  const rows = await db.$queryRaw<ProductRow[]>`
    SELECT p.id, p.image, p.album, p.price, p.stock, p.code, p.attributeCatalogue, p.attribute,
      pl.name, pl.description, pl.content, pl.canonical
    FROM products p LEFT JOIN product_language pl ON pl.product_id = p.id AND pl.language_id = 1
    WHERE p.id = ${productId} AND p.deleted_at IS NULL LIMIT 1`;
  const p = rows[0];
  if (!p) return null;

  const images = [p.image, ...parseJson<string[]>(p.album, [])].filter((u): u is string => typeof u === "string" && u.trim() !== "").map((u) => u.trim());

  // Nhom thuoc tinh dung cho bien the (thu tu = thu tu trong ma bien the)
  const catalogueIds = parseJson<string[]>(p.attributeCatalogue, []).map(String);
  const attrByCatalogue = parseJson<Record<string, string[]>>(p.attribute, {});
  const catalogueOfAttr = new Map<string, number>();
  catalogueIds.forEach((cid, i) => (attrByCatalogue[cid] ?? []).forEach((aid) => catalogueOfAttr.set(String(aid), i)));

  const [catNames, variantRows] = await Promise.all([
    catalogueIds.length
      ? db.$queryRaw<{ id: bigint; name: string }[]>`SELECT attribute_catalogue_id AS id, name FROM attribute_catalogue_language WHERE language_id = 1 AND attribute_catalogue_id IN (${Prisma.join(catalogueIds.map((c) => BigInt(c)))})`.catch(() => [])
      : Promise.resolve([] as { id: bigint; name: string }[]),
    db.$queryRaw<{ code: string | null; sku: string | null; price: string | number; quantity: number; publish: number }[]>`
      SELECT code, sku, price, quantity, publish FROM product_variants WHERE product_id = ${productId} AND deleted_at IS NULL ORDER BY id`,
  ]);
  const catName = new Map(catNames.map((c) => [String(c.id), c.name]));
  const options = catalogueIds.map((c) => catName.get(c) ?? `Option ${c}`);

  const attrIds = [...new Set(variantRows.flatMap((v) => (v.code ?? "").split(",").map((s) => s.trim()).filter(Boolean)))];
  const attrNames = attrIds.length
    ? await db.$queryRaw<{ id: bigint; name: string }[]>`SELECT attribute_id AS id, name FROM attribute_language WHERE language_id = 1 AND attribute_id IN (${Prisma.join(attrIds.map((a) => BigInt(a)))})`
    : [];
  const attrName = new Map(attrNames.map((a) => [String(a.id), a.name]));

  const variants = variantRows.map((v) => {
    const values = options.map(() => "");
    (v.code ?? "").split(",").map((s) => s.trim()).filter(Boolean).forEach((aid, i) => {
      const slot = catalogueOfAttr.get(aid) ?? i;
      if (slot < values.length) values[slot] = attrName.get(aid) ?? aid;
    });
    return { sku: v.sku, price: Number(v.price), quantity: Number(v.quantity), values, enabled: Number(v.publish) !== 0 };
  });

  const description = htmlToText(p.description) || htmlToText(p.content);
  return {
    id: p.id,
    name: (p.name ?? "").trim(),
    description,
    price: Number(p.price),
    stock: Number(p.stock),
    code: p.code,
    images,
    options: variants.length ? options : [],
    variants,
    canonical: p.canonical,
  };
}
