import { AuthFrame } from "@/components/site/auth-frame";
import { Alert } from "@/components/site/site-frame";
import { errorBag, oldInput } from "@/lib/flash";
import { url } from "@/modules/frontend/helpers";
import { FieldError } from "@/modules/frontend/shop/views";
import { siteName } from "@/lib/site";

/**
 * GET /register.html — Frontend\AuthController@register. Form POST cung URL
 * (register trong src/modules/frontend/shop/routes.ts): name, email, phone, address,
 * password, re_password.
 */
export default async function CustomerRegisterPage() {
  const shop = await siteName();
  const [errors, old] = await Promise.all([errorBag(), oldInput()]);
  const seo = { meta_title: "Tạo tài khoản", meta_keyword: "", meta_description: "", meta_image: "", canonical: url("register.html") };
  const value = (k: string) => old<string>(k, "") ?? "";
  const input = (name: string, label: string, opts: { type?: string; auto?: string; placeholder?: string; hint?: string } = {}) => (
    <div className="mt-3 first:mt-0">
      <label htmlFor={`rg-${name}`} className="az-label">
        {label}
      </label>
      <input
        id={`rg-${name}`}
        name={name}
        type={opts.type ?? "text"}
        autoComplete={opts.auto}
        placeholder={opts.placeholder}
        defaultValue={opts.type === "password" ? undefined : value(name)}
        aria-invalid={errors.has(name) || undefined}
        aria-describedby={`rg-${name}-err`}
        className="az-input"
      />
      {opts.hint && !errors.has(name) ? <p className="mt-1 text-xs text-az-muted">{opts.hint}</p> : null}
      <FieldError id={`rg-${name}-err`} message={errors.first(name)} />
    </div>
  );
  return (
    <AuthFrame seo={seo}>
      {errors.has("register") ? (
        <div className="mb-3">
          <Alert tone="error">{errors.first("register")}</Alert>
        </div>
      ) : null}
      <div className="rounded-lg border border-az-border px-6 py-5">
        <h1 className="mb-3 text-[28px] leading-9">Tạo tài khoản</h1>
        <form action="/register.html" method="post" noValidate>
          {input("name", "Họ và tên", { auto: "name", placeholder: "Họ và tên của bạn" })}
          {input("email", "Email", { type: "email", auto: "email" })}
          {input("phone", "Số điện thoại", { type: "tel", auto: "tel" })}
          {input("address", "Địa chỉ", { auto: "street-address", placeholder: "Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP" })}
          {input("password", "Mật khẩu", { type: "password", auto: "new-password", placeholder: "Tối thiểu 6 ký tự", hint: "Mật khẩu tối thiểu 6 ký tự." })}
          {input("re_password", "Nhập lại mật khẩu", { type: "password", auto: "new-password" })}
          <button type="submit" className="az-btn az-btn-cart mt-4 w-full rounded-lg">
            Tiếp tục
          </button>
        </form>
        <p className="mt-4 text-xs">
          Khi tạo tài khoản, bạn đồng ý với {" "}
          <a href="/terms" className="az-link">
            Điều khoản sử dụng
          </a>{" "}
          và{" "}
          <a href="/privacy-policy" className="az-link">
            Chính sách bảo mật
          </a>{" "}
          của {shop}.
        </p>
        <hr className="my-4 border-az-border" />
        <p className="text-[13px]">
          Đã có tài khoản?{" "}
          <a href="/login.html" className="az-link">
            Đăng nhập ›
          </a>
        </p>
      </div>
    </AuthFrame>
  );
}
