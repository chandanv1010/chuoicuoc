/**
 * Anh san pham thu nho cho storefront: dung route cong khai GET /thumb?src=&w=
 * (src/app/(site)/thumb/route.ts — ImageResizerController, co cache dia).
 * Anh goc san pham (vd anh Etsy) rong ~1588px nen luon xin ban thu nho dung kich thuoc hien thi.
 */
export function thumbUrl(src: string | null | undefined, width: number): string {
  if (!src) return PLACEHOLDER;
  if (!/^\/?(userfiles|uploads)\//.test(src)) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  return `/thumb?src=${encodeURIComponent(path)}&w=${width}`;
}

export const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f3f3"/><path d="M30 65l12-15 9 11 7-8 12 12z" fill="#ccc"/><circle cx="62" cy="38" r="6" fill="#ccc"/></svg>',
  );
