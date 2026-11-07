import { DesktopSidebar, FlashToast, Topbar } from "@/components/admin/shell";
import { TooltipProvider } from "@/components/ui/interactive";
import { Toaster } from "@/components/ui/sonner";
import { getFlash } from "@/lib/flash";
import { image } from "@/lib/helpers";
import { getLanguages } from "@/lib/language";
import { requireAdmin } from "@/server/auth";
import { sidebarFor } from "@/config/sidebar";
import { getSiteType, isRootEmail } from "@/modules/system/site-type";
import "./admin.css";

/**
 * Khung admin (thay resources/views/backend/dashboard/layout.blade.php + INSPINIA):
 * React + shadcn/ui, khong con jQuery.
 */
export const metadata = { title: { default: "Quản trị", template: "%s | Quản trị" } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [languages, { success, error }, siteType] = await Promise.all([getLanguages(), getFlash(), getSiteType()]);
  const nav = sidebarFor({ siteType, root: isRootEmail(admin.email) });

  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`:root{--font-admin:"Be Vietnam Pro"}`}</style>
      </head>
      <body>
        <TooltipProvider>
          <DesktopSidebar nav={nav} />
          <div className="flex min-h-screen flex-col lg:pl-64">
            <Topbar
              nav={nav}
              userName={admin.name}
              email={admin.email}
              languages={languages.map((l) => ({
                id: l.id.toString(),
                name: l.name,
                canonical: l.canonical,
                image: image(l.image),
                current: l.current === 1,
              }))}
            />
            <main className="flex-1 p-4 lg:p-6">{children}</main>
          </div>
          <Toaster />
          <FlashToast success={success} error={error} />
        </TooltipProvider>
      </body>
    </html>
  );
}
