import "server-only";
import { db } from "./db";
import type { Input } from "./http";
import enMessages from "@/lang/validation.en.json";

/**
 * Validator kieu Laravel cho cac FormRequest. Chi gom nhung rule ma source
 * waco dung. Thong bao mac dinh lay tu lang/en/validation.php cua Laravel
 * (giong het khi Request khong khai bao messages()).
 *
 *   await validate(input, {
 *     name: "required",
 *     canonical: ["required", unique("routers", "canonical", { ignore: id, column: "module_id" })],
 *   }, { "name.required": "Bạn chưa nhập vào ô tiêu đề." })
 */
export type Rule = string | RuleFn;
export type RuleFn = (ctx: {
  value: unknown;
  field: string;
  input: Input;
}) => Promise<string | null> | string | null; // tra ve key message (vd "unique") hoac null

export type Rules = Record<string, Rule | Rule[]>;
export type ErrorMap = Record<string, string[]>;

const MESSAGES = enMessages as unknown as Record<string, string | Record<string, string>>;

function get(input: Input, path: string): unknown {
  let node: unknown = input;
  for (const p of path.split(".")) {
    if (node && typeof node === "object") node = (node as Record<string, unknown>)[p];
    else return undefined;
  }
  return node;
}

function isEmpty(v: unknown) {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (v instanceof File) return v.size === 0;
  return false;
}

// Laravel chi so sanh nhu so khi field co rule numeric|integer; con lai chuoi so do do dai.
function sizeOf(v: unknown, numeric: boolean): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return numeric && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : [...v].length;
  if (Array.isArray(v)) return v.length;
  if (v instanceof File) return v.size / 1024;
  return 0;
}

function typeKey(v: unknown, numeric: boolean) {
  if (Array.isArray(v)) return "array";
  if (v instanceof File) return "file";
  if (typeof v === "number" || (numeric && typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()))) return "numeric";
  return "string";
}

/** unique:table,column — bo qua ban ghi co ignoreColumn = ignore (giong ->ignore()). */
export function unique(table: string, column: string, opts: { ignore?: unknown; ignoreColumn?: string; where?: Record<string, unknown> } = {}): RuleFn {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) throw new Error("Ten bang/cot khong hop le");
  return async ({ value }) => {
    if (isEmpty(value)) return null;
    const params: unknown[] = [String(value)];
    let sql = `SELECT COUNT(*) AS c FROM \`${table}\` WHERE \`${column}\` = ?`;
    if (opts.ignore !== undefined && opts.ignore !== null && opts.ignore !== "") {
      const ic = opts.ignoreColumn ?? "id";
      if (!/^[a-z_]+$/.test(ic)) throw new Error("Cot ignore khong hop le");
      sql += ` AND \`${ic}\` <> ?`;
      params.push(String(opts.ignore));
    }
    for (const [k, v] of Object.entries(opts.where ?? {})) {
      if (!/^[a-z_]+$/.test(k)) throw new Error("Cot where khong hop le");
      sql += ` AND \`${k}\` = ?`;
      params.push(v);
    }
    const rows = await db.$queryRawUnsafe<{ c: bigint }[]>(sql, ...params);
    return Number(rows[0].c) > 0 ? "unique" : null;
  };
}

/** exists:table,column */
export function exists(table: string, column = "id"): RuleFn {
  return async ({ value }) => {
    if (isEmpty(value)) return null;
    const rows = await db.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT COUNT(*) AS c FROM \`${table}\` WHERE \`${column}\` = ?`,
      String(value),
    );
    return Number(rows[0].c) > 0 ? null : "exists";
  };
}

async function checkString(rule: string, value: unknown, field: string, input: Input, numeric = false): Promise<{ key: string; params: Record<string, string> } | null> {
  const [name, arg = ""] = rule.split(/:(.*)/s);
  const args = arg ? arg.split(",") : [];
  const empty = isEmpty(value);
  switch (name) {
    case "required":
      return empty ? { key: "required", params: {} } : null;
    case "nullable":
    case "sometimes":
    case "bail":
      return null;
    case "string":
      return !empty && typeof value !== "string" ? { key: "string", params: {} } : null;
    case "array":
      return !empty && !Array.isArray(value) && typeof value !== "object" ? { key: "array", params: {} } : null;
    case "email":
      return !empty && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? { key: "email", params: {} } : null;
    case "numeric":
      return !empty && !/^-?\d+(\.\d+)?$/.test(String(value).trim()) ? { key: "numeric", params: {} } : null;
    case "integer":
      return !empty && !/^-?\d+$/.test(String(value).trim()) ? { key: "integer", params: {} } : null;
    case "min": {
      if (empty) return null;
      return sizeOf(value, numeric) < Number(args[0]) ? { key: `min.${typeKey(value, numeric)}`, params: { min: args[0] } } : null;
    }
    case "max": {
      if (empty) return null;
      return sizeOf(value, numeric) > Number(args[0]) ? { key: `max.${typeKey(value, numeric)}`, params: { max: args[0] } } : null;
    }
    case "gt":
      return !empty && !(Number(value) > Number(args[0])) ? { key: `gt.${typeKey(value, true)}` /* shouldBeNumeric: gt luon so nhu so neu gia tri la so */, params: { value: args[0] } } : null;
    case "in":
      return !empty && !args.includes(String(value)) ? { key: "in", params: {} } : null;
    case "confirmed":
      return !empty && value !== get(input, `${field}_confirmation`) ? { key: "confirmed", params: {} } : null;
    case "same":
      return value !== get(input, args[0]) ? { key: "same", params: { other: args[0].replaceAll("_", " ") } } : null;
    case "regex": {
      if (empty) return null;
      const m = arg.match(/^\/(.*)\/([a-z]*)$/s);
      const re = m ? new RegExp(m[1], m[2]) : new RegExp(arg);
      return re.test(String(value)) ? null : { key: "regex", params: {} };
    }
    case "date":
      return !empty && Number.isNaN(Date.parse(String(value))) ? { key: "date", params: {} } : null;
    case "image":
    case "file":
      return !empty && !(value instanceof File) ? { key: name, params: {} } : null;
    default:
      throw new Error(`Rule chua ho tro: ${name}`);
  }
}

function render(key: string, field: string, params: Record<string, string>, custom: Record<string, string>, attributes: Record<string, string>) {
  const ruleName = key.split(".")[0];
  const template =
    custom[`${field}.${ruleName}`] ??
    custom[ruleName] ??
    (() => {
      const node = MESSAGES[ruleName];
      if (typeof node === "string") return node;
      if (node && typeof node === "object") return node[key.split(".")[1] ?? "string"];
      return `The :attribute field is invalid.`;
    })();
  const attribute = attributes[field] ?? field.replaceAll("_", " ").replaceAll(".", " ");
  let out = template.replaceAll(":attribute", attribute);
  for (const [k, v] of Object.entries(params)) out = out.replaceAll(`:${k}`, v);
  return out;
}

export async function validate(
  input: Input,
  rules: Rules,
  messages: Record<string, string> = {},
  attributes: Record<string, string> = {},
): Promise<ErrorMap | null> {
  const errors: ErrorMap = {};
  for (const [field, ruleDef] of Object.entries(rules)) {
    // Giong Laravel: chi tach '|' khi rule la mot chuoi; dang mang thi moi phan tu la mot rule (regex co the chua '|')
    const list: Rule[] = Array.isArray(ruleDef) ? ruleDef : typeof ruleDef === "string" ? ruleDef.split("|") : [ruleDef];
    const value = get(input, field);
    const nullable = list.includes("nullable");
    const numeric = list.includes("numeric") || list.includes("integer");
    if (nullable && isEmpty(value)) continue;
    for (const rule of list) {
      let failed: { key: string; params: Record<string, string> } | null = null;
      if (typeof rule === "function") {
        const key = await rule({ value, field, input });
        if (key) failed = { key, params: {} };
      } else if (rule) {
        failed = await checkString(rule as string, value, field, input, numeric);
      }
      if (failed) {
        (errors[field] ??= []).push(render(failed.key, field, failed.params, messages, attributes));
        if (list.includes("bail")) break; // khong co 'bail' thi Laravel bao het cac rule loi
      }
    }
  }
  return Object.keys(errors).length ? errors : null;
}
