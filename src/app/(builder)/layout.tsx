import { Toaster } from "@/components/ui/sonner";
import { requireAdmin } from "@/server/auth";
import "../(panel)/admin.css";

/** Root layout toan man hinh cho trinh dung giao dien (khong co sidebar admin). */
export const metadata = { title: { default: "Trình dựng giao diện", template: "%s | Trình dựng giao diện" }, robots: { index: false } };

export default async function BuilderLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <html lang="vi">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`:root{--font-admin:"Be Vietnam Pro"}`}</style>
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
