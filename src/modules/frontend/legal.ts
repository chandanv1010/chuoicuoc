import "server-only";
import { getSystem } from "@/lib/language";
import { STORE } from "./store";

/**
 * Email nhan yeu cau quyen rieng tu / xoa du lieu cho cac trang /privacy-policy, /terms,
 * /data-deletion: systems.contact_email (sua trong admin > Cau hinh he thong), neu trong
 * thi dung STORE.supportEmail (src/modules/frontend/store.ts).
 */
export async function supportEmail(): Promise<string> {
  const system = await getSystem();
  const e = (system.contact_email ?? "").trim();
  return e && e !== "0" ? e : STORE.supportEmail;
}

/** Thong tin lien he da cau hinh (systems.contact_*); o trong / "0" -> "" de trang tu an. */
export async function storeContact(): Promise<{ email: string; phone: string; address: string; hours: string }> {
  const system = await getSystem();
  const v = (k: string) => {
    const s = (system[k] ?? "").trim();
    return s && s !== "0" ? s : "";
  };
  return { email: await supportEmail(), phone: v("contact_hotline") || v("contact_phone"), address: v("contact_address"), hours: v("contact_working_hours") };
}
