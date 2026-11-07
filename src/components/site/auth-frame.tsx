import { getFlash } from "@/lib/flash";
import type { Seo } from "@/modules/frontend/helpers";
import { siteName } from "@/lib/site";
import { BrandLogo } from "./brand";
import { SeoHead } from "./seo-head";
import { FlashAlerts } from "./site-frame";

/** Khung toi gian cua trang dang nhap / dang ky kieu Amazon: logo, the hep o giua, footer nho. */
export async function AuthFrame({ seo, children }: { seo: Seo; children: React.ReactNode }) {
  const [f, shop] = await Promise.all([getFlash(), siteName()]);
  return (
    <>
      <SeoHead seo={seo} />
      <main id="main" className="flex-1 bg-white px-4 pb-8">
        <div className="pt-4 pb-3 text-center">
          <a href="/" className="inline-block" aria-label={`${shop} home`}>
            <BrandLogo name={shop} tone="dark" />
          </a>
        </div>
        <div className="mx-auto max-w-[350px]">
          <FlashAlerts success={typeof f.success === "string" ? f.success : ""} error={typeof f.error === "string" ? f.error : ""} />
          <div className="mt-3">{children}</div>
        </div>
      </main>
      <footer className="border-t border-az-border bg-gradient-to-b from-[#f6f6f6] to-white px-4 py-6 text-center text-[11px]">
        <ul className="mb-2 flex justify-center gap-6">
          <li>
            <a href="/terms" className="az-link">
              Conditions of Use
            </a>
          </li>
          <li>
            <a href="/privacy-policy" className="az-link">
              Privacy Notice
            </a>
          </li>
          <li>
            <a href="/contact.html" className="az-link">
              Help
            </a>
          </li>
        </ul>
        <p className="text-az-muted">© {new Date().getFullYear()} {shop}</p>
      </footer>
    </>
  );
}
