/**
 * Khoi giao dien dung chung cua cac trang tai khoan khach (kieu Amazon "Your Account"),
 * thay frontend/auth/customer/components/{header,sidebar}.blade.php.
 */

/** Khung trang tai khoan: breadcrumb "Your Account › ..." + tieu de. */
export function AccountShell({ title, crumb, children, wide = false }: { title: string; crumb?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-5 ${wide ? "max-w-[1000px]" : "max-w-[700px]"}`}>
      {crumb !== undefined && (
        <nav aria-label="Breadcrumb" className="mb-2 text-sm">
          <a href="/account.html" className="az-link">
            Your Account
          </a>
          <span className="mx-1.5 text-az-muted" aria-hidden="true">
            ›
          </span>
          <span className="text-az-orange">{crumb}</span>
        </nav>
      )}
      <h1 className="az-h1 mb-4">{title}</h1>
      {children}
    </div>
  );
}

/** Thong bao loi duoi o nhap (thay <div class="field-error">). */
export function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <p id={id} className="mt-1 flex items-center gap-1 text-xs text-az-deal" role="alert">
      <span aria-hidden="true">!</span> {message}
    </p>
  ) : null;
}

/** Nhan trang thai cua don (order.confirm / payment / delivery). */
export const ORDER_CONFIRM: Record<string, string> = { pending: "Order received", confirm: "Confirmed", cancle: "Cancelled" };
export const ORDER_DELIVERY = (d: string) =>
  d === "pending" ? "Preparing for shipment" : d === "processing" ? "Shipped" : d === "success" ? "Delivered" : "-";
export const ORDER_PAYMENT = (p: string) => (p === "paid" ? "Paid" : "Unpaid");
export const PAYMENT_METHOD = (m: string) => (m === "cod" ? "Pay on delivery" : m === "bank" ? "Bank transfer" : m === "qr_bank" ? "QR bank transfer" : m || "-");
