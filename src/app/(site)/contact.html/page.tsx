import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Alert, SiteFrame } from "@/components/site/site-frame";
import { getFlash } from "@/lib/flash";
import { writeUrl } from "@/modules/frontend/helpers";
import { FORM_TS_FIELD, HONEYPOT_FIELD, formToken } from "@/modules/frontend/info/antispam";
import { loadViewSystem } from "@/modules/frontend/info/data";
import { STORE } from "@/modules/frontend/store";

/**
 * GET /contact.html — Frontend\ContactController@index (trang "Contact Us / Customer Service").
 * Form POST /contact.html (contactStore trong src/modules/frontend/info/routes.ts): name,
 * phone, email, address, message; ket qua qua flash contact_success / contact_errors / old.
 * Chong spam: o honeypot an + token thoi gian render (src/modules/frontend/info/antispam.ts).
 */
export default async function ContactPage() {
  const [system, f] = await Promise.all([loadViewSystem(), getFlash()]);
  const seo = {
    meta_title: "Liên hệ",
    meta_description: `Liên hệ ${""}Chổi Cước Việt Nam để được tư vấn và báo giá chổi cước công nghiệp.`,
    meta_keyword: "",
    meta_image: "",
    canonical: writeUrl("contact"),
  };
  const ok = (s: string | null | undefined): s is string => !!s && s !== "0";
  const email = ok(system.contact_email) ? system.contact_email : STORE.supportEmail;
  const phone = system.contact_hotline ?? system.contact_phone;
  const success = typeof f.contact_success === "string" ? f.contact_success : "";
  const errs = Object.values((f.contact_errors as Record<string, string[]> | undefined) ?? {}).flat();
  const old = (k: string) => {
    const v = (f.old as Record<string, unknown> | undefined)?.[k];
    return typeof v === "string" ? v : "";
  };

  const faqs: [string, string][] = [
    ["Có nhận gia công theo yêu cầu không?", "Có. Chúng tôi nhận làm chổi cước theo kích thước, loại sợi (nylon, PP, inox), đường kính và kiểu trục theo bản vẽ hoặc mẫu của bạn."],
    ["Thời gian giao hàng bao lâu?", "Hàng có sẵn giao nhanh toàn quốc; hàng gia công theo yêu cầu tùy số lượng, chúng tôi báo thời gian cụ thể khi nhận đơn."],
    ["Có xuất hóa đơn và báo giá sỉ không?", "Có. Vui lòng để lại thông tin hoặc gọi hotline để được báo giá, chiết khấu theo số lượng và xuất hóa đơn VAT."],
  ];

  return (
    <SiteFrame seo={seo}>
      <div className="mx-auto max-w-[1100px] px-4 py-6" id="contact">
        <h1 className="az-h1">Chúng tôi có thể giúp gì cho bạn?</h1>
        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="form-h" className="rounded-lg border border-az-border p-5">
            <h2 id="form-h" className="mb-3 text-lg font-bold">
              Gửi tin nhắn cho chúng tôi
            </h2>
            {success && (
              <div className="mb-3">
                <Alert tone="success">{success}</Alert>
              </div>
            )}
            {errs.length > 0 && (
              <div className="mb-3">
                <Alert tone="error" title="Có lỗi xảy ra">
                  <ul className="list-disc pl-5">
                    {errs.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </Alert>
              </div>
            )}
            <form action="/contact.html" method="post" className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name={FORM_TS_FIELD} value={formToken("contact")} />
              {/* honeypot: an khoi nguoi that va trinh doc man hinh, bot dien vao se bi chan */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="ct-ref">Để trống ô này</label>
                <input id="ct-ref" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ct-name" className="az-label">
                  Họ và tên
                </label>
                <input id="ct-name" name="name" required autoComplete="name" defaultValue={old("name")} className="az-input" />
              </div>
              <div>
                <label htmlFor="ct-phone" className="az-label">
                  Số điện thoại
                </label>
                <input id="ct-phone" name="phone" type="tel" required autoComplete="tel" defaultValue={old("phone")} className="az-input" />
              </div>
              <div>
                <label htmlFor="ct-email" className="az-label">
                  Email <span className="font-normal text-az-muted">(không bắt buộc)</span>
                </label>
                <input id="ct-email" name="email" type="email" autoComplete="email" defaultValue={old("email")} className="az-input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ct-address" className="az-label">
                  Địa chỉ hoặc nội dung cần tư vấn <span className="font-normal text-az-muted">(không bắt buộc)</span>
                </label>
                <input id="ct-address" name="address" defaultValue={old("address")} className="az-input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ct-message" className="az-label">
                  Nội dung
                </label>
                <textarea id="ct-message" name="message" rows={5} defaultValue={old("message")} className="az-input" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="az-btn az-btn-cart rounded-lg">
                  Gửi tin nhắn
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-4 text-sm">
            <div className="rounded-lg border border-az-border p-5">
              <h2 className="mb-3 text-lg font-bold">Thông tin liên hệ</h2>
              <ul className="space-y-3">
                <li className="flex gap-2">
                  <Mail className="size-4 shrink-0 text-az-link" aria-hidden="true" />
                  <a href={`mailto:${email}`} className="az-link">
                    {email}
                  </a>
                </li>
                {ok(phone) && (
                  <li className="flex gap-2">
                    <Phone className="size-4 shrink-0 text-az-link" aria-hidden="true" />
                    <a href={`tel:${phone.split("|")[0].replace(/[^0-9+]/g, "")}`} className="az-link">
                      {phone}
                    </a>
                  </li>
                )}
                {ok(system.contact_working_hours) && (
                  <li className="flex gap-2">
                    <Clock className="size-4 shrink-0 text-az-link" aria-hidden="true" />
                    {system.contact_working_hours}
                  </li>
                )}
                {ok(system.contact_address) && (
                  <li className="flex gap-2">
                    <MapPin className="size-4 shrink-0 text-az-link" aria-hidden="true" />
                    {system.contact_address}
                  </li>
                )}
              </ul>
            </div>
          </aside>
        </div>

        <section className="mt-8" aria-labelledby="faq-h">
          <h2 id="faq-h" className="az-h2 mb-3">
            Câu hỏi thường gặp
          </h2>
          <div className="divide-y divide-az-border rounded-lg border border-az-border">
            {faqs.map(([q, a]) => (
              <details key={q} className="group p-4">
                <summary className="cursor-pointer font-bold">{q}</summary>
                <p className="mt-2 text-sm">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </SiteFrame>
  );
}
