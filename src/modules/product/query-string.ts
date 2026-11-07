import "server-only";
import type { SearchParams } from "@/server/admin-list";

/**
 * Cac thao tac query string cua controller/blade Laravel ma module product + attribute dung:
 *  - table.blade.php: $queryUrl = rtrim(base64_encode(http_build_query(request()->query())), '=')
 *  - edit(): $queryUrl = $request->getQueryString() (Laravel chuan hoa: ksort + RFC3986)
 *  - update(): base64_decode($request->getQueryString()) roi route('x.index', $queryString)
 */

/** urlencode() cua PHP (khoang trang -> '+'). */
export function phpUrlencode(s: string) {
  return encodeURIComponent(s)
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

/** rawurlencode() cua PHP (RFC3986). */
export function rawUrlencode(s: string) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function flatten(sp: SearchParams): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => out.push([k, x]));
    else out.push([k, v]);
  }
  return out;
}

/** rtrim(base64_encode(http_build_query(request()->query())), '=') — dung cho link sua o trang index. */
export function tableQueryUrl(sp: SearchParams) {
  const qs = flatten(sp)
    .map(([k, v]) => `${phpUrlencode(k)}=${phpUrlencode(v)}`)
    .join("&");
  return Buffer.from(qs, "utf8").toString("base64").replace(/=+$/, "");
}

/** $request->getQueryString(): tach cap key=value, ksort, ma hoa RFC3986. Rong -> "". */
export function normalizeQueryString(raw: string) {
  if (!raw) return "";
  const pairs: [string, string][] = [];
  for (const part of raw.split("&")) {
    if (!part) continue;
    const i = part.indexOf("=");
    const dec = (x: string) => {
      try {
        return decodeURIComponent(x.replace(/\+/g, " "));
      } catch {
        return x;
      }
    };
    pairs.push(i < 0 ? [dec(part), ""] : [dec(part.slice(0, i)), dec(part.slice(i + 1))]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return pairs.map(([k, v]) => `${rawUrlencode(k)}=${rawUrlencode(v)}`).join("&");
}

/** getQueryString() cua trang GET tu searchParams (dung cho action form update). */
export function queryStringOf(sp: SearchParams) {
  return normalizeQueryString(
    flatten(sp)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&"),
  );
}

/** route('x.update', [$id, $queryUrl]): tham so so them vao query thô. */
export function withRawQuery(path: string, query: string) {
  return query ? `${path}?${query}` : path;
}

/** base64_decode($request->getQueryString()) trong update(). */
export function decodedQueryOf(req: Request) {
  const raw = new URL(req.url).search.replace(/^\?/, "");
  const qs = normalizeQueryString(raw);
  if (!qs) return "";
  // base64_decode khong strict: bo ky tu ngoai bang ma
  return Buffer.from(qs.replace(/[^A-Za-z0-9+/]/g, ""), "base64").toString("utf8");
}

/** route('x.edit', [$id, 'query' => base64_encode($queryString)]) */
export function stayQuery(decoded: string) {
  return `query=${rawUrlencode(Buffer.from(decoded, "utf8").toString("base64"))}`;
}
