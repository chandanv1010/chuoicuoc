import { getCurrentLanguage } from "@/lib/language";
import { authorizeHandler } from "@/server/auth";
import { findAttributeByIdArray } from "@/modules/attribute/attribute";
import { laravelJson } from "@/modules/product/ajax";

/**
 * GET ajax/attribute/loadAttribute?attribute=<base64 json>&attributeCatalogueId= — Ajax\AttributeController@loadAttribute
 * (variant.js nap lai cac gia tri da chon khi sua san pham). Tra ve {items: [{id, text}]}.
 */
export async function GET(req: Request) {
  const admin = await authorizeHandler(req);
  if (admin instanceof Response) return admin;
  const sp = new URL(req.url).searchParams;
  let decoded: unknown = null;
  try {
    decoded = JSON.parse(Buffer.from((sp.get("attribute") ?? "").replace(/[^A-Za-z0-9+/]/g, ""), "base64").toString("utf8"));
  } catch {
    decoded = null;
  }
  const catId = sp.get("attributeCatalogueId") ?? "";
  const group = decoded && typeof decoded === "object" ? (decoded as Record<string, unknown>)[catId] : undefined;
  // count(null) -> TypeError (500) giong ban goc
  if (!group || typeof group !== "object") return laravelJson({ message: "Server Error" }, 500);
  const ids = Array.isArray(group) ? group : Object.values(group);
  const language = await getCurrentLanguage();
  const attributes = ids.length ? await findAttributeByIdArray(ids, language.id) : [];
  return laravelJson({ items: attributes.map((a) => ({ id: Number(a.id), text: a.name })) });
}
