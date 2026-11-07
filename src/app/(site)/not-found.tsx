/**
 * Trang 404 cua storefront (abort(404) o RouterController...). Dung lai trong
 * src/app/global-not-found.tsx (khong nap CSS cua (site)) nen chi dung style inline.
 */
import { brandMarkSvg } from "@/components/site/brand";
import type { Metadata } from "next";
import { siteName } from "@/lib/site";

// 404 trong nhom (site) (notFound() o [slug]...): tieu de vao <head> qua metadata, giong ban cu dung metadata tinh
export async function generateMetadata(): Promise<Metadata> {
  return { title: `Không tìm thấy trang | ${await siteName()}` };
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  background: "#fff",
  color: "#0f1111",
  fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  display: "flex",
  flexDirection: "column",
};

// not-found.js duoc phep async (Server Component, khong nhan props) -> doc ten shop o systems
export default async function NotFound() {
  const shop = await siteName();
  return (
    <div style={wrap}>
      <header style={{ background: "#1f3a33", padding: "10px 16px" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#fbf7f0", fontWeight: 700, fontSize: 22, textDecoration: "none", fontFamily: "Georgia, serif" }}>
          <span style={{ display: "block", width: 34, height: 34 }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: brandMarkSvg({ name: shop }) }} />
          {shop}
        </a>
      </header>
      <main style={{ flex: 1, maxWidth: 640, margin: "0 auto", padding: "48px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#565959", margin: 0 }}>404 — Không tìm thấy</p>
        <h1 style={{ fontSize: 28, fontWeight: 400, margin: "8px 0 12px" }}>Rất tiếc, không tìm thấy trang này</h1>
        <p style={{ fontSize: 14, margin: "0 0 24px" }}>Thử tìm kiếm hoặc quay về trang chủ {shop}.</p>
        <form action="/products.html" method="get" role="search" style={{ display: "flex", maxWidth: 420, margin: "0 auto 20px" }}>
          <label htmlFor="nf-q" style={{ position: "absolute", left: -9999 }}>
            Tìm trong {shop}
          </label>
          <input
            id="nf-q"
            name="keyword"
            placeholder={`Tìm trong ${shop}`}
            style={{ flex: 1, padding: "8px 10px", border: "1px solid #888c8c", borderRadius: "4px 0 0 4px", fontSize: 14 }}
          />
          <button type="submit" style={{ background: "#e9b04a", border: "1px solid #e9b04a", borderRadius: "0 4px 4px 0", padding: "0 16px", cursor: "pointer" }}>
            Tìm
          </button>
        </form>
        <a href="/" style={{ color: "#2d6a5b", fontSize: 14 }}>
          Về trang chủ {shop}
        </a>
      </main>
      <footer style={{ background: "#2c4d44", color: "#e8e2d6", padding: 16, fontSize: 12, textAlign: "center" }}>© {shop}</footer>
    </div>
  );
}
