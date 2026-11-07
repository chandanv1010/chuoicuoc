import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { PUBLISH } from "./constants";
import { db } from "./db";

/** session('app_locale', config('app.locale')) — mac dinh 'vn' nhu config/app.php. */
export const LOCALE_COOKIE = "app_locale";
export const DEFAULT_LOCALE = process.env.APP_LOCALE ?? "vn";

export const getLocale = cache(async () => (await cookies()).get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);

/** Middleware SetLocale: language_id theo locale cua phien (khong co thi id 1). */
export const getCurrentLanguage = cache(async () => {
  const locale = await getLocale();
  const lang =
    (await db.languages.findFirst({ where: { canonical: locale } })) ??
    (await db.languages.findFirst({ where: { id: 1n } })) ??
    (await db.languages.findFirst({ orderBy: { id: "asc" } }));
  if (!lang) throw new Error("Bang languages dang trong");
  return lang;
});

/** LanguageComposer: ngon ngu dang xuat ban, ngon ngu current dung dau. */
export const getLanguages = cache(async () =>
  db.languages.findMany({ where: { publish: PUBLISH.ON, deleted_at: null }, orderBy: { current: "desc" } }),
);

/** Doc bang systems thanh object { keyword: content } cho ngon ngu hien tai. */
export const getSystem = cache(async () => {
  const lang = await getCurrentLanguage();
  const rows = await db.systems.findMany({ where: { language_id: lang.id } });
  return Object.fromEntries(rows.map((r) => [r.keyword, r.content ?? ""])) as Record<string, string>;
});
