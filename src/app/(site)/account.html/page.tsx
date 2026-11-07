import { History, Lock, LogOut, MapPin, Package, Headset } from "lucide-react";
import { AvatarUpload } from "@/components/site/avatar-upload";
import { SiteFrame } from "@/components/site/site-frame";
import { errorBag, oldInput } from "@/lib/flash";
import { url } from "@/modules/frontend/helpers";
import { requireCustomerPage } from "@/modules/frontend/shop/customer";
import { numberFormat } from "@/modules/frontend/shop/php";
import { AccountShell, FieldError } from "@/modules/frontend/shop/views";
import { siteName } from "@/lib/site";

/**
 * GET /account.html — CustomerController@profile (CustomerAuth). Trang "Your Account"
 * kieu Amazon: cac the lien ket + form ho so (POST /account/update.html: name,
 * phone, address; email lay tu tai khoan) + anh dai dien (ajax/customer/uploadAvatar).
 */
export default async function CustomerProfilePage() {
  const shop = await siteName();
  const customer = await requireCustomerPage();
  const [errors, old] = await Promise.all([errorBag(), oldInput()]);
  const seo = { meta_title: "Tài khoản", meta_keyword: "", meta_description: "", meta_image: "", canonical: url("account.html") };
  const value = (k: "name" | "phone" | "address") => old<string | null>(k, customer[k]) ?? "";

  const cards = [
    { icon: Package, title: "Đơn hàng", text: "Theo dõi và mua lại", href: "/account/orders.html" },
    { icon: Lock, title: "Đăng nhập & bảo mật", text: "Đổi mật khẩu", href: "/account/password.html" },
    { icon: MapPin, title: "Hồ sơ", text: "Sửa tên, số điện thoại và địa chỉ", href: "#profile" },
    { icon: History, title: "Điểm thưởng", text: `${numberFormat(customer.point ?? 0)} điểm · xem lịch sử`, href: "/account/rewards.html" },
    { icon: Headset, title: "Chăm sóc khách hàng", text: `Liên hệ ${shop} để được hỗ trợ`, href: "/contact.html" },
  ];

  return (
    <SiteFrame seo={seo}>
      <AccountShell title="Tài khoản" wide>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <li key={c.title}>
              <a href={c.href} className="flex h-full gap-4 rounded-lg border border-az-border p-4 hover:bg-[#f7fafa]">
                <c.icon className="size-10 shrink-0 text-az-link" strokeWidth={1.4} aria-hidden="true" />
                <span>
                  <span className="block text-[17px]">{c.title}</span>
                  <span className="block text-sm text-az-muted">{c.text}</span>
                </span>
              </a>
            </li>
          ))}
          <li>
            <form action="/logout.html" method="post" className="h-full">
              <button type="submit" className="flex h-full w-full gap-4 rounded-lg border border-az-border p-4 text-left hover:bg-[#f7fafa]">
                <LogOut className="size-10 shrink-0 text-az-link" strokeWidth={1.4} aria-hidden="true" />
                <span>
                  <span className="block text-[17px]">Đăng xuất</span>
                  <span className="block text-sm text-az-muted">Đang đăng nhập: {customer.email}</span>
                </span>
              </button>
            </form>
          </li>
        </ul>

        <section id="profile" className="mt-8 max-w-[600px] scroll-mt-4 rounded-lg border border-az-border p-5" aria-labelledby="profile-h">
          <h2 id="profile-h" className="mb-4 text-xl font-bold">
            Hồ sơ của bạn
          </h2>
          <AvatarUpload src={customer.image} name={customer.name} />
          <form method="post" action="/account/update.html" className="mt-5 space-y-3" noValidate>
            <div>
              <span className="az-label">Email (đăng nhập)</span>
              <p className="text-sm">{customer.email}</p>
            </div>
            <div>
              <label htmlFor="pf-name" className="az-label">
                Họ và tên
              </label>
              <input id="pf-name" name="name" autoComplete="name" defaultValue={value("name")} className="az-input" aria-describedby="pf-name-err" />
              <FieldError id="pf-name-err" message={errors.first("name")} />
            </div>
            <div>
              <label htmlFor="pf-phone" className="az-label">
                Số điện thoại
              </label>
              <input id="pf-phone" name="phone" type="tel" autoComplete="tel" defaultValue={value("phone")} className="az-input" aria-describedby="pf-phone-err" />
              <FieldError id="pf-phone-err" message={errors.first("phone")} />
            </div>
            <div>
              <label htmlFor="pf-address" className="az-label">
                Địa chỉ
              </label>
              <input id="pf-address" name="address" autoComplete="street-address" defaultValue={value("address")} className="az-input" aria-describedby="pf-address-err" />
              <FieldError id="pf-address-err" message={errors.first("address")} />
            </div>
            <FieldError message={errors.first("email")} />
            <button type="submit" className="az-btn az-btn-cart rounded-lg">
              Lưu thay đổi
            </button>
          </form>
        </section>
      </AccountShell>
    </SiteFrame>
  );
}
