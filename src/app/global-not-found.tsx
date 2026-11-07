import type { Metadata, Viewport } from "next";
import NotFound from "./(site)/not-found";
import { siteName } from "@/lib/site";

/**
 * 404 cho URL khong khop route nao (vd /a/b/c) — app khong co root layout chung
 * (moi nhom (site)/(panel)/(auth) co layout rieng) nen Next can trang nay
 * (experimental.globalNotFound trong next.config.ts). Giong trang loi 404 cua
 * Laravel: dung lai noi dung src/app/(site)/not-found.tsx (errors/minimal.blade.php).
 */
// Tieu de 404 o <head> (the <title> trong NotFound async chi nam trong luong RSC, khong vao HTML ban dau)
export async function generateMetadata(): Promise<Metadata> {
  return { title: `Không tìm thấy trang | ${await siteName()}` };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function GlobalNotFound() {
  return (
    <html lang="vi">
      <body className="antialiased">
        <NotFound />
      </body>
    </html>
  );
}
