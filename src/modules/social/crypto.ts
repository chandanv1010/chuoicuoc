import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./config";

/**
 * Ma hoa token AES-256-GCM. Khoa lay tu SOCIAL_TOKEN_KEY:
 *  - 64 ky tu hex hoac base64 32 byte -> dung truc tiep;
 *  - chuoi khac -> SHA-256 cua chuoi (de dev de dat).
 * Dinh dang luu: v1:<iv b64>:<tag b64>:<ciphertext b64>
 */
function key(): Buffer {
  const raw = env("SOCIAL_TOKEN_KEY");
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new Error("Thiếu SOCIAL_TOKEN_KEY trong .env");
    // Dev: dung AUTH_SECRET de van chay duoc dry run
    return createHash("sha256").update(`social:${env("AUTH_SECRET") || "dev"}`).digest();
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32 && /^[A-Za-z0-9+/=_-]+$/.test(raw)) return b64;
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decrypt(enc: string | null | undefined): string | null {
  if (!enc) return null;
  const [v, iv, tag, data] = enc.split(":");
  if (v !== "v1" || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // doi khoa -> khong giai ma duoc -> coi nhu mat token (can ket noi lai)
    return null;
  }
}

/** Chuoi ngau nhien an toan cho state / PKCE verifier. */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
