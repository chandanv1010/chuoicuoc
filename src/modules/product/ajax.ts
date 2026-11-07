import "server-only";
import { phpJsonEncode } from "./payload";

/** response()->json() cua Laravel: json_encode mac dinh (escape "/" va unicode). */
export function laravelJson(data: unknown, status = 200) {
  return new Response(phpJsonEncode(data), { status, headers: { "content-type": "application/json" } });
}
