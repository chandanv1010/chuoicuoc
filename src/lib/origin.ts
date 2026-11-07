/**
 * Goc (scheme://host) ma trinh duyet thuc su dang dung.
 * Next dung ten may chu cua chinh no cho req.url (http://localhost:3010), nen sau proxy/tunnel
 * (cloudflared) phai lay tu x-forwarded-host / x-forwarded-proto, neu khong moi redirect ve localhost.
 */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** new URL(path, req.url) nhung theo goc that cua trinh duyet. */
export function absoluteUrl(req: Request, path: string): URL {
  return new URL(path, requestOrigin(req));
}
