import "server-only";
import { NextResponse } from "next/server";
import { flash, type FlashData } from "@/lib/flash";
import { parseForm, type Input } from "@/lib/http";
import { absoluteUrl, requestOrigin } from "@/lib/origin";

/**
 * Tien ich rieng cho cac form/ajax cua module info (lien he, dai ly, tu van).
 */

/**
 * Middleware toan cuc cua Laravel (app/Http/Kernel.php): TrimStrings +
 * ConvertEmptyStringsToNull. Chuoi duoc trim, chuoi rong -> null (de quy).
 */
export function laravelInput(input: Input): Input {
  const conv = (v: unknown): unknown => {
    if (typeof v === "string") {
      const t = v.replace(/^[\s﻿​‎]+|[\s﻿​‎]+$/gu, "");
      return t === "" ? null : t;
    }
    if (Array.isArray(v)) return v.map(conv);
    if (v && typeof v === "object" && !(v instanceof File)) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, conv(x)]));
    }
    return v;
  };
  return conv(input) as Input;
}

/** Gia tri chuoi hoac null (sau laravelInput). */
export function val(input: Input, key: string): string | null {
  const v = input[key];
  return typeof v === "string" ? v : null;
}

/** old input: bo File, giu null nhu session cua Laravel. */
function sanitizeOld(input: Input): Input {
  const out: Input = {};
  for (const [k, v] of Object.entries(input)) if (!(v instanceof File) && k !== "_token") out[k] = v;
  return out;
}

/** redirect()->back()->withFragment($f): Referer cung origin, mac dinh "/". */
export function backWithFragment(req: Request, fragment: string) {
  const referer = req.headers.get("referer");
  let target = "/";
  if (referer) {
    try {
      if (new URL(referer).origin === requestOrigin(req)) target = referer;
    } catch {
      /* referer hong -> "/" */
    }
  }
  const u = absoluteUrl(req, target);
  u.hash = fragment;
  // Laravel tra 302; dung 303 de trinh duyet chac chan doi POST -> GET
  return NextResponse.redirect(u, 303);
}

/** ->withErrors($v, $bag)->withInput()->withFragment() */
export async function backWithBag(
  req: Request,
  bag: string,
  errors: Record<string, string[]>,
  input: Input,
  fragment: string,
) {
  await flash({ [`${bag}_errors`]: errors, old: sanitizeOld(input) } as FlashData);
  return backWithFragment(req, fragment);
}

/** urlencode() cua PHP: giu [A-Za-z0-9_.-], dau cach -> '+'. */
export function phpUrlencode(s: string): string {
  return Array.from(new TextEncoder().encode(s))
    .map((b) => {
      const c = String.fromCharCode(b);
      if (/[A-Za-z0-9_.-]/.test(c)) return c;
      if (c === " ") return "+";
      return `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
    })
    .join("");
}

/** substr($s, 0, $n): cat theo byte (co the cat giua ky tu nhieu byte). */
export function substrBytes(s: string, n: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= n) return s;
  // MySQL utf8mb4 tu choi byte hong; bo ky tu bi cat do (TextDecoder bo qua phan du)
  return new TextDecoder("utf-8", { fatal: false }).decode(buf.subarray(0, n)).replace(/�$/u, "");
}

/**
 * Laravel cau hinh 'strict' => false (config/database.php) nen MySQL tu cat
 * chuoi qua do dai cot thay vi bao loi. Prisma chay o che do strict -> cat truoc.
 */
export function fit(s: string | null, chars: number): string | null {
  if (s === null) return null;
  const a = Array.from(s);
  return a.length > chars ? a.slice(0, chars).join("") : s;
}

/** $request->all() cho route ajax: body (form/json) + query string, qua laravelInput(). */
export async function readAjaxInput(req: Request): Promise<Input> {
  const ct = req.headers.get("content-type") ?? "";
  let input: Input = {};
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    input = parseForm(await req.formData());
  } else if (ct.includes("application/json")) {
    input = (await req.json().catch(() => ({}))) as Input;
  }
  for (const [k, v] of new URL(req.url).searchParams) input[k] ??= v;
  return laravelInput(input);
}

/** $request->expectsJson(): (ajax && !pjax && chap nhan moi kieu) || wantsJson. */
export function expectsJson(req: Request): boolean {
  const accept = (req.headers.get("accept") ?? "").toLowerCase();
  const ajax = req.headers.get("x-requested-with") === "XMLHttpRequest";
  const pjax = req.headers.get("x-pjax") === "true";
  const first = accept.split(",")[0]?.split(";")[0]?.trim() ?? "";
  const anyType = accept === "" || first === "*/*" || first === "*";
  const wantsJson = first.includes("/json") || first.includes("+json");
  return (ajax && !pjax && anyType) || wantsJson;
}
