import "server-only";
import { cache } from "react";
import { SITE_NAME_FALLBACK } from "./constants";
import { getSystem } from "./language";

export { SITE_NAME_FALLBACK };

/**
 * Ten shop cua site hien tai: systems.homepage_company (Cau hinh chung > Thong tin chung)
 * da trim, trong thi SITE_NAME_FALLBACK. Dung getSystem() (da cache theo request) nen
 * goi nhieu lan khong them truy van. Client component nhan ten qua prop tu server cha.
 */
export const siteName = cache(async (): Promise<string> => {
  const system = await getSystem();
  return (system.homepage_company ?? "").trim() || SITE_NAME_FALLBACK;
});

