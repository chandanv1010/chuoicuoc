import { STORE } from "@/modules/frontend/store";
import { BackToTop } from "./back-to-top";

/** Footer kieu Amazon: "Back to top", 4 cot lien ket, dai duoi cung (thay footer.blade.php). */
export function Footer({ shopName, categories }: { system: Record<string, string>; shopName: string; categories: { id: number; name: string; href: string; children?: { id: number; name: string; href: string }[] }[] }) {
  const columns: { title: string; links: [string, string][] }[] = [
    {
      title: "Về chúng tôi",
      links: [
        [`Giới thiệu ${shopName}`, "/about.html"],
        ...(STORE.etsyUrl ? ([["Cửa hàng Etsy", STORE.etsyUrl]] as [string, string][]) : []),
        ["Liên hệ", "/contact.html"],
      ],
    },
    {
      title: "Mua sắm",
      links: [["Tất cả sản phẩm", "/products.html"], ...categories.flatMap((c) => [c, ...(c.children ?? [])]).map((c) => [c.name, c.href] as [string, string]), ["Chổi cước theo yêu cầu", "/products.html"]],
    },
    {
      title: "Hỗ trợ",
      links: [
        ["Tài khoản", "/account.html"],
        ["Chăm sóc khách hàng", "/contact.html"],
        ["Giao hàng", "/contact.html"],
        ["Tư vấn & báo giá", "/contact.html"],
      ],
    },
    {
      title: "Chính sách",
      links: [
        ["Chính sách bảo mật", "/privacy-policy"],
        ["Điều khoản sử dụng", "/terms"],
        ["Xóa dữ liệu", "/data-deletion"],
      ],
    },
  ];
  return (
    <footer className="mt-auto text-white">
      <BackToTop />
      <div className="bg-az-footer">
        <div className="mx-auto grid max-w-[1000px] grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-2 text-base font-bold">{col.title}</h2>
              <ul className="space-y-2 text-sm text-[#ddd]">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="hover:underline" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[#3a4553] px-4 py-6 text-sm">
          <span className="text-xl font-bold tracking-tight">{shopName}</span>
          <span className="rounded-sm border border-[#848688] px-3 py-1.5 text-xs">Tiếng Việt</span>
          <span className="rounded-sm border border-[#848688] px-3 py-1.5 text-xs">₫ VND</span>
          <span className="rounded-sm border border-[#848688] px-3 py-1.5 text-xs">Việt Nam</span>
        </div>
      </div>
      <div className="bg-az-footer-bottom px-4 py-6 text-center text-xs text-[#ddd]">
        <ul className="mb-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
          <li>
            <a href="/terms" className="hover:underline">
              Điều khoản sử dụng
            </a>
          </li>
          <li>
            <a href="/privacy-policy" className="hover:underline">
              Chính sách bảo mật
            </a>
          </li>
          <li>
            <a href="/data-deletion" className="hover:underline">
              Dữ liệu của bạn
            </a>
          </li>
        </ul>
        <p>
          © {new Date().getFullYear()} {shopName}. {STORE.tagline}.
        </p>
      </div>
    </footer>
  );
}
