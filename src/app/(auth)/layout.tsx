import "../(panel)/admin.css";

/** Root layout rieng cho trang dang nhap admin. */
export const metadata = { title: "Đăng nhập quản trị" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`:root{--font-admin:"Be Vietnam Pro"}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
