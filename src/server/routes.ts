import "server-only";
import { parseForm, type Input } from "@/lib/http";
import { formRoutes } from "@/modules";

/**
 * Bang dinh tuyen cho form POST/PUT/DELETE, giong routes/web/*.php cua Laravel.
 * Moi module khai bao trong src/modules/<module>/routes.ts:
 *
 *   export const routes: FormRoute[] = [
 *     { method: "POST", path: "post/store", handler: store },
 *     { method: "POST", path: "post/{id:\\d+}/update", handler: update },
 *     { method: "DELETE", path: "post/{id:\\d+}/destroy", handler: destroy },
 *   ];
 *
 * Form HTML chi gui duoc POST; ho tro _method=DELETE/PUT nhu @method() cua Blade.
 */
export type FormContext = { req: Request; params: Record<string, string>; input: Input };
export type FormHandler = (ctx: FormContext) => Promise<Response>;
export type FormRoute = {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  handler: FormHandler;
};

type Compiled = FormRoute & { regex: RegExp; keys: string[] };

let compiled: Compiled[] | null = null;

function compile(): Compiled[] {
  return (compiled ??= formRoutes.map((route) => {
    const keys: string[] = [];
    const source = route.path
      .replace(/^\/+/, "")
      .split(/(\{[^}]+\})/)
      .map((part) => {
        const m = part.match(/^\{(\w+)(?::(.+))?\}$/);
        if (!m) return part.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
        keys.push(m[1]);
        return `(${m[2] ?? "[^/]+"})`;
      })
      .join("");
    return { ...route, regex: new RegExp(`^${source}$`), keys };
  }));
}

export async function dispatch(req: Request, path: string): Promise<Response> {
  const contentType = req.headers.get("content-type") ?? "";
  let input: Input = {};
  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    input = parseForm(await req.formData());
  } else if (contentType.includes("application/json")) {
    input = (await req.json()) as Input;
  }
  for (const [k, v] of new URL(req.url).searchParams) input[k] ??= v;

  const method = (typeof input._method === "string" ? input._method : req.method).toUpperCase();

  for (const route of compile()) {
    if (route.method !== method && !(route.method === "PATCH" && method === "PUT")) continue;
    const m = route.regex.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    return route.handler({ req, params, input });
  }
  return new Response("404 | Not Found", { status: 404 });
}
