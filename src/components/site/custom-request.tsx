import { getSystem } from "@/lib/language";
import { siteName } from "@/lib/site";
import { getFloatingConfig } from "@/modules/floating/store";
import { FORM_TS_FIELD, HONEYPOT_FIELD, formToken } from "@/modules/frontend/info/antispam";
import { CustomRequestForm } from "./custom-request-form";

/** So WhatsApp dung that (bo so gia kieu "+84 000 000 000"); khong co -> null. */
function realNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 8 || /^\d{1,3}0{6,}$/.test(digits)) return null;
  return digits;
}

/**
 * Khoi "Yêu cầu thiết kế riêng" cua trinh dung giao dien: nut chat WhatsApp ngay + form de lai thong tin / mo ta y tuong.
 * So WhatsApp: o "Số WhatsApp" cua khoi -> nut WhatsApp trong "Nút liên hệ nổi" -> hotline o Cau hinh chung. Chua co so
 * that thi an nut WhatsApp, chi con form.
 */
export async function CustomRequest({ label, phone, topic }: { label?: string; phone?: string; topic?: string }) {
  const [floating, system, shop] = await Promise.all([getFloatingConfig(), getSystem(), siteName()]);
  const wa = floating.buttons.find((b) => b.kind === "whatsapp" && b.enabled && b.value);
  const number = realNumber(phone) ?? realNumber(wa?.value) ?? realNumber(system.contact_hotline) ?? realNumber(system.contact_phone);
  const text = encodeURIComponent(`Hi ${shop}! I'd like a custom design${topic ? ` (${topic})` : ""}: `);
  return (
    <div className="grid gap-5 rounded-3xl border border-[#ecdccb] bg-[#fffaf3] p-5 shadow-[0_10px_40px_-20px_rgba(60,40,20,.25)] sm:p-8">
      {number && (
        <>
          <a
            href={`https://wa.me/${number}?text=${text}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl bg-[#25d366] px-5 py-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1fbe5b]"
          >
            <svg viewBox="0 0 32 32" className="size-9 shrink-0" fill="currentColor" aria-hidden="true">
              <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.6c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.8 5.1 2.2.9 3 1 4.1.8.7-.1 1.9-.8 2.2-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.3Z" />
            </svg>
            <span className="min-w-0">
              <span className="block text-[17px] font-bold">Chat with us on WhatsApp</span>
              <span className="block text-sm text-white/85">Fastest way — send us a photo or your idea</span>
            </span>
          </a>
          <div className="flex items-center gap-3 text-[13px] font-semibold tracking-wider text-[#8a7d72] uppercase">
            <span className="h-px flex-1 bg-[#ecdccb]" />
            or leave your details
            <span className="h-px flex-1 bg-[#ecdccb]" />
          </div>
        </>
      )}
      <CustomRequestForm token={formToken("consult")} tsField={FORM_TS_FIELD} honeypotField={HONEYPOT_FIELD} label={label} topic={topic} />
    </div>
  );
}
