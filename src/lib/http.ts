import "server-only";
import { NextResponse } from "next/server";
import { flash, type FlashData } from "./flash";
import { absoluteUrl, requestOrigin } from "./origin";

export type Input = Record<string, unknown>;

/**
 * Doc FormData theo kieu PHP: name="album[]", name="attribute[3][]",
 * name="variant[sku][]" thanh mang/obj long nhau, giong $request->input().
 */
export function parseForm(form: FormData): Input {
  const out: Input = {};
  for (const [rawKey, value] of form.entries()) {
    if (rawKey.startsWith("$ACTION")) continue;
    const head = rawKey.match(/^[^[]+/)?.[0] ?? rawKey;
    const rest = [...rawKey.slice(head.length).matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
    const path = [head, ...rest];
    let node: Record<string, unknown> | unknown[] = out;
    for (let i = 0; i < path.length; i++) {
      const part = path[i];
      const last = i === path.length - 1;
      const nextIsPush = path[i + 1] === "";
      if (Array.isArray(node)) {
        if (last) {
          if (part === "") node.push(value);
          else node[Number(part)] = value;
        } else {
          const idx = part === "" ? node.length : Number(part);
          node[idx] ??= nextIsPush ? [] : {};
          node = node[idx] as Record<string, unknown> | unknown[];
        }
      } else if (last) {
        if (part === "") continue;
        node[part] = value;
      } else {
        node[part] ??= nextIsPush ? [] : {};
        node = node[part] as Record<string, unknown> | unknown[];
      }
    }
  }
  return out;
}

/** Lay chuoi tu input (File -> ""), giong $request->input('x'). */
export function str(input: Input, key: string, fallback = ""): string {
  const v = input[key];
  if (v === undefined || v === null || v instanceof File) return fallback;
  return String(v);
}

export function int(input: Input, key: string, fallback = 0): number {
  const n = Number.parseInt(str(input, key), 10);
  return Number.isNaN(n) ? fallback : n;
}

export function arr(input: Input, key: string): string[] {
  const v = input[key];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string") as string[];
  if (v && typeof v === "object") return Object.values(v).filter((x) => typeof x === "string") as string[];
  return [];
}

/** Bo File ra khoi old input truoc khi luu flash. */
function sanitizeOld(input: Input): Input {
  return JSON.parse(JSON.stringify(input, (_k, v) => (v instanceof File ? undefined : v)));
}

/** 303 de trinh duyet chuyen POST thanh GET (giong redirect() cua Laravel sau form). */
export function redirectTo(req: Request, path: string) {
  return NextResponse.redirect(absoluteUrl(req, path), 303);
}

/** redirect()->back(): ve trang truoc (Referer), mac dinh la fallback. */
export function back(req: Request, fallback = "/") {
  const referer = req.headers.get("referer");
  const target = referer && new URL(referer).origin === requestOrigin(req) ? referer : fallback;
  return NextResponse.redirect(absoluteUrl(req, target), 303);
}

/** redirect()->back()->withErrors($errors)->withInput() */
export async function backWithErrors(req: Request, errors: Record<string, string[]>, input: Input, extra: FlashData = {}) {
  await flash({ errors, old: sanitizeOld(input), ...extra });
  return back(req);
}

export async function redirectWith(req: Request, path: string, data: FlashData) {
  await flash(data);
  return redirectTo(req, path);
}
