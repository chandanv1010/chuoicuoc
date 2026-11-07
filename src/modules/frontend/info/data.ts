import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/language";

/**
 * Du lieu cho cac trang tinh WACO (gioi thieu, cong nghe, phan phoi, dai ly,
 * lien he). Khac getSystem()/getWaco() cua dot 1: GIU NULL nhu convert_array()
 * / pluck() cua PHP, vi view dung toan tu ?? de lui ve gia tri mac dinh
 * (vd $intro['contact_heading'] ?? 'Thông tin liên hệ').
 */
export type Dict = Record<string, string | null>;

async function systemsOf(languageId: bigint): Promise<Dict> {
  const rows = await db.systems.findMany({ where: { language_id: languageId }, orderBy: { id: "asc" } });
  const out: Dict = {};
  for (const r of rows) out[r.keyword] = r.content;
  return out;
}

/** FrontendController::setSystem(): systems cua language_id = 1 (ghi cung) — chi dung cho $seo. */
export const loadSystem = cache(async (): Promise<Dict> => systemsOf(1n));

/**
 * $system trong view: SystemComposer (ngon ngu hien tai) ghi de bien $system
 * ma controller truyen vao.
 */
export const loadViewSystem = cache(async (): Promise<Dict> => systemsOf((await getCurrentLanguage()).id));

/** WacoComposer $intro: introduces theo ngon ngu hien tai, pluck('content','keyword'). */
export const loadIntro = cache(async (): Promise<Dict> => {
  const lang = await getCurrentLanguage();
  const rows = await db.introduces.findMany({ where: { language_id: lang.id }, orderBy: { id: "asc" } });
  const out: Dict = {};
  for (const r of rows) out[r.keyword] = r.content;
  return out;
});

/** TechnologyController: introduceRepository->findByCondition([language_id = 1]) -> convert_array. */
export const loadIntroduces = cache(async (): Promise<Dict> => {
  const rows = await db.introduces.findMany({ where: { language_id: 1n }, orderBy: { id: "asc" } });
  const out: Dict = {};
  for (const r of rows) out[r.keyword] = r.content;
  return out;
});

/** $request->integer('x'): intval() cua chuoi (rong/khong phai so -> 0). */
export function phpInt(v: unknown): number {
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return 0;
  const m = v.trim().match(/^[+-]?\d+/);
  return m ? Number.parseInt(m[0], 10) : 0;
}

/** Frontend\DistributionController@index */
export async function distributionData(provinceId: number, districtId: number) {
  const regions = await db.distribution_areas.findMany({ where: { parent_id: 0n, publish: 2 } });
  const cities =
    provinceId > 0
      ? await db.distribution_areas.findMany({ where: { parent_id: BigInt(provinceId), publish: 2 } })
      : [];
  const distributors = await db.distributions.findMany({
    where: {
      publish: 2,
      deleted_at: null, // SoftDeletes
      ...(provinceId > 0 ? { province_id: BigInt(provinceId) } : {}),
      ...(districtId > 0 ? { district_id: BigInt(districtId) } : {}),
    },
    orderBy: { name: "asc" },
  });
  return { regions, cities, distributors };
}
