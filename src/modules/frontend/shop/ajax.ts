import "server-only";
import { parseForm, type Input } from "@/lib/http";
import { laravelJson } from "@/modules/product/ajax";
import { laravelInput } from "@/modules/promotion/php";
import { cartContentJson } from "./cart";
import { PhpException } from "./php";
import { expectsJson } from "./routes";
import type { CartItem } from "./session";

/** $request->input() cua ajax: body (form/json) + query, qua TrimStrings/ConvertEmptyStringsToNull. */
export async function ajaxInput(req: Request): Promise<Input> {
  const type = req.headers.get("content-type") ?? "";
  let input: Input = {};
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) input = parseForm(await req.formData());
    else if (type.includes("application/json")) input = ((await req.json().catch(() => ({}))) ?? {}) as Input;
  }
  for (const [k, v] of new URL(req.url).searchParams) input[k] ??= v;
  return laravelInput(input);
}

/** Collection rong -> [] khi json_encode, con lai object theo rowId. */
export function contentJson(items: CartItem[]) {
  return items.length ? cartContentJson(items) : [];
}

/**
 * Loi cua CartService: ban goc `echo $e->getMessage() . $e->getCode(); die();` (200, text).
 * ModelNotFoundException ngoai try (findOrFail) -> 404.
 */
export function cartError(req: Request, e: unknown, mode: "die" | "uncaught" = "die"): Response {
  if (!(e instanceof PhpException)) throw e;
  if (mode === "die") return new Response(`${e.message}${e.code}`, { headers: { "content-type": "text/html; charset=UTF-8" } });
  const notFound = e.message.startsWith("No query results");
  const status = notFound ? 404 : 500;
  if (expectsJson(req)) return laravelJson({ message: notFound ? `${e.message}.` : e.message }, status);
  return new Response(notFound ? "404 | Not Found" : `500 | ${e.message}`, { status });
}
