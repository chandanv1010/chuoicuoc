import { AuthFrame } from "@/components/site/auth-frame";
import { Alert } from "@/components/site/site-frame";
import { errorBag, oldInput } from "@/lib/flash";
import { url } from "@/modules/frontend/helpers";
import { FieldError } from "@/modules/frontend/shop/views";
import { siteName } from "@/lib/site";

/**
 * GET /login.html — Frontend\AuthController@index. Form POST cung URL
 * (login trong src/modules/frontend/shop/routes.ts), truong email + password.
 */
export default async function CustomerLoginPage() {
  const shop = await siteName();
  const [errors, old] = await Promise.all([errorBag(), oldInput()]);
  const seo = { meta_title: "Đăng nhập", meta_keyword: "", meta_description: "", meta_image: "", canonical: url("login.html") };
  return (
    <AuthFrame seo={seo}>
      {errors.has("login") ? (
        <div className="mb-3">
          <Alert tone="error" title="Có lỗi xảy ra">
            {errors.first("login")}
          </Alert>
        </div>
      ) : null}
      <div className="rounded-lg border border-az-border px-6 py-5">
        <h1 className="mb-3 text-[28px] leading-9">Đăng nhập</h1>
        <form action="/login.html" method="post" noValidate>
          <label htmlFor="email" className="az-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={old<string>("email", "") ?? ""}
            aria-invalid={errors.has("email") || undefined}
            aria-describedby="email-err"
            className="az-input"
          />
          <FieldError id="email-err" message={errors.first("email")} />
          <label htmlFor="password" className="az-label mt-3">
            Mật khẩu
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" aria-describedby="password-err" className="az-input" />
          <FieldError id="password-err" message={errors.first("password")} />
          <button type="submit" className="az-btn az-btn-cart mt-4 w-full rounded-lg">
            Đăng nhập
          </button>
          <label className="mt-3 flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="rememberMe" /> Duy trì đăng nhập
          </label>
        </form>
        <p className="mt-4 text-xs">
          Khi tiếp tục, bạn đồng ý với {" "}
          <a href="/terms" className="az-link">
            Điều khoản sử dụng
          </a>{" "}
          và{" "}
          <a href="/privacy-policy" className="az-link">
            Chính sách bảo mật
          </a>{" "}
          của {shop}.
        </p>
        <p className="mt-3 text-[13px]">
          <a href="/contact.html" className="az-link">
            Quên mật khẩu? Liên hệ với chúng tôi
          </a>
        </p>
      </div>
      <div className="relative my-5 text-center text-xs text-az-muted">
        <span className="absolute inset-x-0 top-1/2 border-t border-[#e7e7e7]" aria-hidden="true" />
        <span className="relative bg-white px-2">Bạn mới biết đến {shop}?</span>
      </div>
      <a href="/register.html" className="az-btn az-btn-secondary w-full rounded-lg">
        Tạo tài khoản {shop}
      </a>
    </AuthFrame>
  );
}
