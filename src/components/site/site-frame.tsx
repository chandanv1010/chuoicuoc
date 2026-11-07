import { CircleAlert, CircleCheck } from "lucide-react";
import { getFlash } from "@/lib/flash";
import { getSystem } from "@/lib/language";
import { siteName } from "@/lib/site";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";
import type { Seo } from "@/modules/frontend/helpers";
import { getCatalogueTree } from "@/modules/frontend/product";
import { Cart } from "@/modules/frontend/shop/cart";
import { currentCustomer } from "@/modules/frontend/shop/customer";
import { shopSession } from "@/modules/frontend/shop/session";
import { resolveBlockData } from "@/modules/builder/data";
import { getPublishedDoc } from "@/modules/builder/pages";
import { BuilderTree } from "@/modules/builder/render";
import { partSlug, type PageSettings } from "@/modules/builder/schema";
import { getFloatingConfig } from "@/modules/floating/store";
import { formToken } from "@/modules/frontend/info/antispam";
import { FloatingButtons } from "./floating-buttons";
import { Footer } from "./footer";
import { Header } from "./header";
import { SeoHead } from "./seo-head";

/**
 * Khung chung cua moi trang storefront: SEO + header + thong bao flash + noi dung + footer.
 * Thay homepage/layout.blade.php (header, footer, support-widget, popup tu van, PHPFlasher).
 * Thong bao flash success/error hien thanh hop canh bao kieu Amazon ngay duoi header.
 */
export async function SiteFrame({
  seo,
  children,
  search,
  bg = "white",
  showFlash = true,
  chrome = true,
  settings,
}: {
  seo: Seo;
  children: React.ReactNode;
  search?: { keyword: string; catalogueId: number | null };
  bg?: "white" | "gray";
  /** false: trang tu hien thong bao rieng (vd trang dat hang thanh cong) */
  showFlash?: boolean;
  /** false: khong ve header / footer (canvas cua trinh dung giao dien khi sua chinh header / footer) */
  chrome?: boolean;
  /** cai dat trang cua builder: header / footer dung chung, an, hay ban thiet ke rieng */
  settings?: PageSettings;
}) {
  const headerSlug = chrome ? partSlug(settings?.header, "header") : null;
  const footerSlug = chrome ? partSlug(settings?.footer, "footer") : null;
  const [system, shop, customer, s, tree, f, builtHeader, builtFooter, floating] = await Promise.all([
    getSystem(),
    siteName(),
    currentCustomer(),
    shopSession(),
    getCatalogueTree(FRONTEND_LANGUAGE),
    getFlash(),
    headerSlug ? partDoc(headerSlug) : null,
    footerSlug ? partDoc(footerSlug) : null,
    chrome ? getFloatingConfig() : null,
  ]);
  // Danh muc cap 1 + cap 2 cho thanh dieu huong / drawer / footer
  const categories = tree.map((c) => ({
    id: Number(c.id),
    name: c.name,
    href: `/${c.canonical}.html`,
    children: c.children.map((k) => ({ id: Number(k.id), name: k.name, href: `/${k.canonical}.html` })),
  }));
  const cartCount = new Cart(s, "shopping").count();
  // Header / footer da xuat ban tu trinh dung giao dien thay cho ban code cung
  const site = { cartCount, customer: customer?.name ?? null };
  const [headerData, footerData] = await Promise.all([
    builtHeader ? resolveBlockData(builtHeader) : null,
    builtFooter ? resolveBlockData(builtFooter) : null,
  ]);
  return (
    <>
      <SeoHead seo={seo} />
      {!headerSlug ? null : builtHeader && headerData ? (
        <header>
          <BuilderTree doc={builtHeader} data={headerData} site={site} />
        </header>
      ) : (
        <Header
          customer={customer ? { name: customer.name } : null}
          cartCount={cartCount}
          categories={categories}
          search={search ?? { keyword: "", catalogueId: null }}
          shopName={shop}
        />
      )}
      <main id="main" className={`flex-1 ${bg === "gray" ? "bg-az-bg" : "bg-white"}`}>
        {showFlash && <FlashAlerts success={typeof f.success === "string" ? f.success : ""} error={typeof f.error === "string" ? f.error : ""} />}
        {children}
      </main>
      {!footerSlug ? null : builtFooter && footerData ? (
        <footer className="mt-auto">
          <BuilderTree doc={builtFooter} data={footerData} site={site} />
        </footer>
      ) : (
        <Footer system={system} shopName={shop} categories={categories} />
      )}
      {floating?.enabled && <FloatingButtons config={floating} token={formToken("consult")} />}
    </>
  );
}

/** Header / footer da xuat ban; ban thiet ke rieng chua xuat ban (hoac da xoa) -> dung phan chung. */
async function partDoc(slug: string) {
  const own = await getPublishedDoc(slug);
  return own ?? (slug.includes("-") ? getPublishedDoc(slug.split("-")[0]) : null);
}

export function FlashAlerts({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return (
    <div className="mx-auto max-w-[1500px] space-y-2 px-4 pt-4">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

export function Alert({ tone, title, children }: { tone: "success" | "error" | "info"; title?: string; children: React.ReactNode }) {
  const styles = {
    success: "border-az-success shadow-[0_0_0_4px_#e6f4f1_inset]",
    error: "border-az-deal shadow-[0_0_0_4px_#fcf4f4_inset]",
    info: "border-az-link shadow-[0_0_0_4px_#e7f3f5_inset]",
  }[tone];
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  const color = tone === "error" ? "text-az-deal" : tone === "success" ? "text-az-success" : "text-az-link";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-lg border bg-white px-4 py-3 ${styles}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${color}`} aria-hidden="true" />
      <div className="text-sm">
        {title ? <p className={`font-bold ${color}`}>{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Khung trang hoac chi phan than (bare) — trang con dat lam khoi trong template cua trinh dung giao dien. */
export function MaybeFrame({ bare, children, ...props }: Parameters<typeof SiteFrame>[0] & { bare?: boolean }) {
  if (bare) return <>{children}</>;
  return <SiteFrame {...props}>{children}</SiteFrame>;
}
