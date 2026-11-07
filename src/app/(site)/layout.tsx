import type { Viewport } from "next";
import "./site.css";
import { brandFavicon } from "@/components/site/brand";
import { siteName } from "@/lib/site";

/**
 * Root layout cua storefront (thay homepage/layout.blade.php + head.blade.php).
 * Bo cuc kieu san TMDT, bang mau "Linen & Thread" bang Tailwind v4 (./site.css) —
 * khong con jQuery, Swiper, app.scss cua ban Laravel. Header/footer nam trong <SiteFrame>.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f3a33",
};

// Pinterest: ma xac nhan so huu ten mien (Settings > Claim) cua tung site, de trong thi khong in
const PINTEREST_VERIFY = process.env.PINTEREST_DOMAIN_VERIFY ?? "";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const shop = await siteName();
  return (
    <html lang="vi">
      <head>
        <meta name="format-detection" content="telephone=no" />
        <meta name="robots" content="index,follow" />
        <meta name="author" content={shop} />
        {PINTEREST_VERIFY && <meta name="p:domain_verify" content={PINTEREST_VERIFY} />}
        {/* Favicon: chu cai dau cua ten shop tren nen xanh reu (brand.tsx) */}
        <link rel="icon" href={brandFavicon(shop)} type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-az-cream">{children}</body>
    </html>
  );
}
