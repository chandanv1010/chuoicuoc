import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Phien dang nhap (thay session cua Laravel).
 *  - nc_admin:    user dang nhap admin (guard 'web')
 *  - nc_customer: khach hang dang nhap website (guard 'customer')
 *  - nc_sid:      id phien an danh, dung cho flash message va gio hang (proxy.ts tu cap)
 */
export const ADMIN_COOKIE = "nc_admin";
export const CUSTOMER_COOKIE = "nc_customer";
export const SID_COOKIE = "nc_sid";
const MAX_AGE = 60 * 60 * 24 * 7;

type Guard = "admin" | "customer";
const COOKIE: Record<Guard, string> = { admin: ADMIN_COOKIE, customer: CUSTOMER_COOKIE };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET phai dai it nhat 32 ky tu");
  return new TextEncoder().encode(secret);
}

export async function signId(id: bigint | number | string, guard: Guard) {
  return new SignJWT({ sub: String(id), guard })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function verifyId(token: string | undefined, guard: Guard): Promise<bigint | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.guard !== guard || !payload.sub) return null;
    return BigInt(payload.sub);
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

export async function loginAs(guard: Guard, id: bigint | number) {
  (await cookies()).set(COOKIE[guard], await signId(id, guard), cookieOptions);
}

export async function logoutGuard(guard: Guard) {
  (await cookies()).delete(COOKIE[guard]);
}

export async function currentId(guard: Guard) {
  return verifyId((await cookies()).get(COOKIE[guard])?.value, guard);
}

/** Id phien an danh; proxy.ts luon dam bao cookie nay ton tai. */
export async function sessionId(): Promise<string> {
  return (await cookies()).get(SID_COOKIE)?.value ?? "anonymous";
}
