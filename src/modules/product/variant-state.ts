import "server-only";
import { db } from "@/lib/db";
import { formatMoneyPlain } from "@/lib/money";
import type { oldInput } from "@/lib/flash";
import { findAttributeByIdArray } from "@/modules/attribute/attribute";
import type { getProductById } from "./product";
import type { VariantData, VariantInit } from "./variant-builder";

type Product = Awaited<ReturnType<typeof getProductById>>;
type Old = Awaited<ReturnType<typeof oldInput>>;

/**
 * Du lieu ban dau cho VariantBuilder — thay phan nap lai cua variant.blade.php + variant.js
 * (old('attributeCatalogue') / old('attribute') / old('variant') hoac JSON tren products,
 * ajax/attribute/loadAttribute de lay ten gia tri, HT.productVariant() de dien SKU/gia...).
 */

/** json_decode($s, TRUE): rong / loi -> null */
function jsonDecode(s: string | null | undefined): unknown {
  if (s === null || s === undefined || s === "") return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Gia bien the (Decimal) -> chuoi o nhap "1,234.50" */
const priceInput = (n: unknown) => formatMoneyPlain(n);

/** sortString() cua ProductService: code cua product_variants */
const sortCode = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .sort((a, b) => (Number.parseFloat(a) || 0) - (Number.parseFloat(b) || 0))
    .join(",");

export async function loadVariantState(product: Product, old: Old, languageId: bigint): Promise<VariantInit> {
  // checked: old('accept') == 1 || count($product->product_variants) > 0
  const enabled = text(old("accept", "")) === "1" || (!!product && product.variantCount > 0);

  const oldCatalogue = old<unknown>("attributeCatalogue", undefined);
  const catalogueIds = listOf(oldCatalogue !== undefined ? oldCatalogue : jsonDecode(product?.attributeCatalogue))
    .map(text)
    .filter((x) => /^\d+$/.test(x));

  const oldAttribute = old<unknown>("attribute", undefined);
  const attributeMap = (oldAttribute !== undefined ? oldAttribute : jsonDecode(product?.attribute)) as Record<string, unknown> | null;

  // loadAttribute: ten gia tri theo ngon ngu hien tai (publish = 2), giu thu tu da luu
  const groups = await Promise.all(
    [...new Set(catalogueIds)].map(async (catId) => {
      const ids = listOf(attributeMap && typeof attributeMap === "object" ? attributeMap[catId] : null).map(text).filter(Boolean);
      const found = ids.length ? await findAttributeByIdArray(ids, languageId) : [];
      const byId = new Map(found.map((a) => [a.id.toString(), a.name]));
      return { catId, values: ids.filter((id) => byId.has(id)).map((id) => ({ id, text: byId.get(id) ?? "" })) };
    }),
  );

  const rows: Record<string, VariantData> = {};
  let legacy: VariantInit["legacy"] = null;
  const oldVariant = old<Record<string, unknown> | undefined>("variant", undefined);
  const oldProductVariant = old<Record<string, unknown> | undefined>("productVariant", undefined);

  if (oldVariant && typeof oldVariant === "object") {
    // Quay lai form sau khi loi validate: khop theo productVariant[id][]
    const ids = listOf(oldProductVariant?.id);
    const at = (k: string, i: number) => text(listOf(oldVariant[k])[i]);
    ids.forEach((id, i) => {
      rows[sortCode(text(id))] = {
        quantity: at("quantity", i),
        sku: at("sku", i),
        price: at("price", i),
        barcode: at("barcode", i),
        file_name: at("file_name", i),
        file_url: at("file_url", i),
        album: at("album", i),
      };
    });
  } else if (product) {
    // product_variants (code = id thuoc tinh da sap) — on dinh hon viec do SKU cua variant.js
    const variants = await db.product_variants.findMany({
      where: { product_id: product.id, deleted_at: null },
      select: { code: true, quantity: true, sku: true, price: true, barcode: true, file_name: true, file_url: true, album: true },
      orderBy: { id: "asc" },
    });
    for (const v of variants) {
      if (!v.code) continue;
      rows[sortCode(v.code)] = {
        quantity: v.quantity ? String(v.quantity) : "",
        sku: v.sku ?? "",
        price: priceInput(v.price),
        barcode: v.barcode ?? "",
        file_name: v.file_name ?? "",
        file_url: v.file_url ?? "",
        album: v.album ?? "",
      };
    }
    if (!variants.length) {
      const json = jsonDecode(product.variant);
      if (json && typeof json === "object") {
        legacy = Object.fromEntries(Object.entries(json as Record<string, unknown>).map(([k, v]) => [k, listOf(v).map(text)]));
      }
    }
  }

  return { enabled, groups, rows, legacy };
}
