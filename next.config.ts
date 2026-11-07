import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() cho $this->authorize() that bai (403) o trang admin
    authInterrupts: true,
    serverActions: { bodySizeLimit: "50mb" },
    // src/app/global-not-found.tsx: 404 cho URL khong khop route nao (giong Laravel)
    globalNotFound: true,
  },
  // Dev qua duong ham cloudflared: Next 16 chan tai nguyen dev (/_next, HMR) tu ten mien la -> trang khong hydrate
  allowedDevOrigins: ["*.trycloudflare.com", "customstitchhouse.com", "www.customstitchhouse.com"],
  // URL giong Laravel: khong tu them/bo dau "/" cuoi
  skipTrailingSlashRedirect: true,
  // Storefront EMHAUS dung URL tieng Anh; URL tieng Viet cu (ban WACO) chuyen 301 sang URL moi, giu query string
  async redirects() {
    const moved: [string, string][] = [
      ["/san-pham.html", "/products.html"],
      ["/gio-hang.html", "/cart.html"],
      ["/thanh-toan.html", "/quick-checkout.html"],
      ["/dang-nhap.html", "/login.html"],
      ["/dang-ky.html", "/register.html"],
      ["/tai-khoan.html", "/account.html"],
      ["/tai-khoan/lich-su-don-hang.html", "/account/orders.html"],
      ["/tai-khoan/lich-su-giao-dich.html", "/account/rewards.html"],
      ["/tai-khoan/thay-doi-mat-khau.html", "/account/password.html"],
      ["/tai-khoan/don-hang/:code", "/account/orders/:code"],
      ["/lien-he.html", "/contact.html"],
      ["/gioi-thieu.html", "/about.html"],
      ["/tin-tuc.html", "/news.html"],
      ["/phan-phoi.html", "/"],
      ["/cong-nghe.html", "/"],
      ["/he-thong-dai-ly.html", "/"],
      ["/san-pham/trang-:n(\\d+).html", "/products/page-:n.html"],
      ["/:slug/trang-:n(\\d+).html", "/:slug/page-:n.html"],
    ];
    return moved.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

export default nextConfig;
