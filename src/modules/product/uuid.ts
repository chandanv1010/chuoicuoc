import "server-only";
import { createHash } from "node:crypto";

/** Ramsey\Uuid\Uuid::NAMESPACE_DNS */
export const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/** Uuid::uuid5($namespace, $name)->toString() */
export function uuid5(namespace: string, name: string) {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  const b = hash.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
