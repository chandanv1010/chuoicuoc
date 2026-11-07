import "server-only";
import { sessionId } from "./session";

/**
 * Flash session giong Laravel: ->with('success', ...), withErrors(), withInput().
 * Luu trong bo nho tien trinh theo nc_sid (khong nhet vao cookie vi old input
 * co the la noi dung CKEditor rat dai). Chay nhieu instance thi doi sang Redis.
 */
export type FlashData = {
  success?: string;
  error?: string;
  errors?: Record<string, string[]>;
  old?: Record<string, unknown>;
  [key: string]: unknown;
};

type Entry = { data: FlashData; readAt?: number; createdAt: number };

const store: Map<string, Entry> = ((globalThis as { __ncFlash?: Map<string, Entry> }).__ncFlash ??= new Map());

// Mot request co the doc flash nhieu lan (layout + page + generateMetadata),
// nen sau lan doc dau van giu them vai giay roi moi xoa.
const GRACE_MS = 5_000;
const TTL_MS = 10 * 60_000;

function sweep() {
  const now = Date.now();
  for (const [k, e] of store) {
    if ((e.readAt && now - e.readAt > GRACE_MS) || now - e.createdAt > TTL_MS) store.delete(k);
  }
}

export async function flash(data: FlashData) {
  sweep();
  const sid = await sessionId();
  const prev = store.get(sid);
  store.set(sid, { data: { ...(prev && !prev.readAt ? prev.data : {}), ...data }, createdAt: Date.now() });
}

export function flashFor(sid: string, data: FlashData) {
  sweep();
  const prev = store.get(sid);
  store.set(sid, { data: { ...(prev && !prev.readAt ? prev.data : {}), ...data }, createdAt: Date.now() });
}

export async function getFlash(): Promise<FlashData> {
  const sid = await sessionId();
  const entry = store.get(sid);
  if (!entry) return {};
  if (entry.readAt && Date.now() - entry.readAt > GRACE_MS) {
    store.delete(sid);
    return {};
  }
  entry.readAt ??= Date.now();
  return entry.data;
}

/** old('field', fallback) cua Blade. Ho tro key dang 'attribute.1' cho mang. */
export async function oldInput() {
  const { old } = await getFlash();
  // Ten ham khong duoc trung 'old' (se che bien old lay tu flash o tren)
  return function readOld<T = unknown>(field: string, fallback?: T): T {
    if (!old) return fallback as T;
    let node: unknown = old;
    for (const part of field.split(".")) {
      if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return fallback as T;
      }
    }
    // Arr::get: key co ton tai thi tra ve ca gia tri null
    return (node === undefined ? fallback : node) as T;
  };
}

export async function errorBag() {
  const { errors = {} } = await getFlash();
  return {
    all: Object.values(errors).flat(),
    has: (field: string) => Boolean(errors[field]?.length),
    first: (field: string) => errors[field]?.[0],
    any: () => Object.keys(errors).length > 0,
  };
}
