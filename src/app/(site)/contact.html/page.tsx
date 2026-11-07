import { Clock, Mail, MapPin, Phone, Store } from "lucide-react";
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
    meta_title: "Contact Us",
    meta_description: `Contact CustomStitch House customer service about orders, personalization and shipping to the United States.`,
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
    ["How long does delivery take?", `Items are embroidered to order in Vietnam, then shipped with tracking. Most US orders arrive in ${STORE.deliveryDays[0]}–${STORE.deliveryDays[1]} days.`],
    ["How do I personalize a hat?", "Choose a style with “Text” or “Name” on the product page, then type the exact wording in the order note at checkout. We confirm before stitching."],
    ["Can I return or exchange?", "Personalized items can't be resold, but if anything arrives damaged or wrong, contact us within 30 days and we'll make it right."],
  ];

  return (
    <SiteFrame seo={seo}>
      <div className="mx-auto max-w-[1100px] px-4 py-6" id="contact">
        <h1 className="az-h1">Hello. What can we help you with?</h1>
        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="form-h" className="rounded-lg border border-az-border p-5">
            <h2 id="form-h" className="mb-3 text-lg font-bold">
              Send us a message
            </h2>
            {success && (
              <div className="mb-3">
                <Alert tone="success">{success}</Alert>
              </div>
            )}
            {errs.length > 0 && (
              <div className="mb-3">
                <Alert tone="error" title="There was a problem">
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
                <label htmlFor="ct-ref">Leave this field empty</label>
                <input id="ct-ref" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ct-name" className="az-label">
                  Your name
                </label>
                <input id="ct-name" name="name" required autoComplete="name" defaultValue={old("name")} className="az-input" />
              </div>
              <div>
                <label htmlFor="ct-phone" className="az-label">
                  Phone number
                </label>
                <input id="ct-phone" name="phone" type="tel" required autoComplete="tel" defaultValue={old("phone")} className="az-input" />
              </div>
              <div>
                <label htmlFor="ct-email" className="az-label">
                  Email <span className="font-normal text-az-muted">(optional)</span>
                </label>
                <input id="ct-email" name="email" type="email" autoComplete="email" defaultValue={old("email")} className="az-input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ct-address" className="az-label">
                  Order number or address <span className="font-normal text-az-muted">(optional)</span>
                </label>
                <input id="ct-address" name="address" defaultValue={old("address")} className="az-input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ct-message" className="az-label">
                  Message
                </label>
                <textarea id="ct-message" name="message" rows={5} defaultValue={old("message")} className="az-input" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="az-btn az-btn-cart rounded-lg">
                  Send message
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-4 text-sm">
            <div className="rounded-lg border border-az-border p-5">
              <h2 className="mb-3 text-lg font-bold">Contact information</h2>
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
                <li className="flex gap-2">
                  <Store className="size-4 shrink-0 text-az-link" aria-hidden="true" />
                  <a href={STORE.etsyUrl} target="_blank" rel="noopener noreferrer" className="az-link">
                    CustomStitch House on Etsy
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </div>

        <section className="mt-8" aria-labelledby="faq-h">
          <h2 id="faq-h" className="az-h2 mb-3">
            Frequently asked questions
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
