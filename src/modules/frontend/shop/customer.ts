import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { flash } from "@/lib/flash";
import { redirectWith } from "@/lib/http";
import { currentId } from "@/lib/session";

/**
 * Auth::guard('customer')->user() va middleware App\Http\Middleware\CustomerAuth.
 * Model Customer dung SoftDeletes nen khach hang da xoa mem coi nhu chua dang nhap.
 */
export type Customer = {
  id: bigint;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  image: string | null;
  point: number;
  password: string;
  province_id: string | null;
  district_id: string | null;
  ward_id: string | null;
};

export async function currentCustomer(): Promise<Customer | null> {
  const id = await currentId("customer");
  if (!id) return null;
  return db.customers.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      image: true,
      point: true,
      password: true,
      province_id: true,
      district_id: true,
      ward_id: true,
    },
  });
}

const LOGIN_REQUIRED = "Please sign in to continue.";

/** CustomerAuth cho trang GET: chua dang nhap -> /login.html kem flash error. */
export async function requireCustomerPage(): Promise<Customer> {
  const customer = await currentCustomer();
  if (!customer) {
    await flash({ error: LOGIN_REQUIRED });
    redirect("/login.html");
  }
  return customer;
}

/** CustomerAuth cho handler POST/ajax: tra Response redirect khi chua dang nhap. */
export async function customerOrRedirect(req: Request): Promise<Customer | Response> {
  const customer = await currentCustomer();
  if (customer) return customer;
  // Laravel redirect 302; dung 303 cua redirectWith de form POST chuyen thanh GET
  return redirectWith(req, "/login.html", { error: LOGIN_REQUIRED });
}
