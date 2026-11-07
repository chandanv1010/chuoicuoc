import { SiteFrame } from "@/components/site/site-frame";
import { errorBag } from "@/lib/flash";
import { url } from "@/modules/frontend/helpers";
import { requireCustomerPage } from "@/modules/frontend/shop/customer";
import { AccountShell, FieldError } from "@/modules/frontend/shop/views";
import { siteName } from "@/lib/site";

/**
 * GET /account/password.html — CustomerController@changePassword.
 * POST cung URL: current_password, password, password_confirmation.
 */
export default async function CustomerPasswordPage() {
  const shop = await siteName();
  const customer = await requireCustomerPage();
  const errors = await errorBag();
  const seo = { meta_title: "Login & security", meta_keyword: "", meta_description: "", meta_image: "", canonical: url("account/password.html") };
  const field = (name: string, label: string, auto: string) => (
    <div>
      <label htmlFor={`pw-${name}`} className="az-label">
        {label}
      </label>
      <input id={`pw-${name}`} name={name} type="password" autoComplete={auto} className="az-input" aria-describedby={`pw-${name}-err`} />
      <FieldError id={`pw-${name}-err`} message={errors.first(name)} />
    </div>
  );
  return (
    <SiteFrame seo={seo}>
      <AccountShell title="Change password" crumb="Login & security">
        <div className="rounded-lg border border-az-border p-5">
          <p className="mb-4 text-sm">
            Use the form below to change the password for your {shop} account <strong>{customer.email}</strong>.
          </p>
          <form action="/account/password.html" method="post" className="max-w-[360px] space-y-3" noValidate>
            {field("current_password", "Current password", "current-password")}
            {field("password", "New password", "new-password")}
            {field("password_confirmation", "Re-enter new password", "new-password")}
            <button type="submit" className="az-btn az-btn-cart rounded-lg">
              Save changes
            </button>
          </form>
        </div>
      </AccountShell>
    </SiteFrame>
  );
}
