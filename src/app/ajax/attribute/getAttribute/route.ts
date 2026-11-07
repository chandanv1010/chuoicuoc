import { parseForm } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import { searchAttributes } from "@/modules/attribute/attribute";
import { laravelJson } from "@/modules/product/ajax";
import { laravelInput } from "@/modules/product/payload";

/**
 * GET ajax/attribute/getAttribute?search=&option[attributeCatalogueId]= — Ajax\AttributeController@getAttribute
 * (select2 trong variant.js). Tra ve {items: [{id, text}]}.
 */
export async function GET(req: Request) {
  const admin = await authorizeHandler(req);
  if (admin instanceof Response) return admin;
  const form = new FormData();
  for (const [k, v] of new URL(req.url).searchParams) form.append(k, v);
  const input = laravelInput(parseForm(form));
  const option = input.option as Record<string, unknown> | undefined;
  // searchAttributes(string $keyword, array $option, ...): thieu search/option -> TypeError (500)
  if (typeof input.search !== "string" || !option || typeof option !== "object") {
    return laravelJson({ message: "Server Error" }, 500);
  }
  const catId = option.attributeCatalogueId === null || option.attributeCatalogueId === undefined ? "" : String(option.attributeCatalogueId);
  const items = await searchAttributes(input.search, catId);
  return laravelJson({ items });
}
