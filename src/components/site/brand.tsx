/**
 * Thuong hieu theo ten shop (systems.homepage_company). Logo chu: bieu tuong vuong bo goc
 * co chu viet tat + ten shop. Dung chung cho header, trang dang nhap, favicon va public/logo.
 */

/** Chu viet tat tu ten shop: lay chu cai dau cua toi da 2 tu co nghia (vd "Chổi Cước Việt Nam" -> "CC"). */
export function brandInitials(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "SP";
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || words[0].slice(0, 2).toUpperCase();
}

/** SVG bieu tuong (vuong): nen + chu viet tat cua ten shop. */
export function brandMarkSvg({
  bg,
  fg = "#fbf7f0",
  stitch = "#e9b04a",
  rounded = true,
  name = "",
}: { bg?: string; fg?: string; stitch?: string; rounded?: boolean; name?: string } = {}) {
  const ini = brandInitials(name);
  const size = ini.length >= 2 ? 15 : 20;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    (bg ? `<rect width="48" height="48" rx="${rounded ? 11 : 0}" fill="${bg}"/>` : "") +
    `<rect x="4" y="4" width="40" height="40" rx="${rounded ? 9 : 0}" fill="none" stroke="${stitch}" stroke-width="2.4" stroke-dasharray="4.2 2.6" stroke-linecap="round"/>` +
    `<text x="24" y="31" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="${size}" text-anchor="middle" fill="${fg}">${ini}</text>` +
    `</svg>`
  );
}

/** Favicon: bieu tuong tren nen xanh reu. */
export const BRAND_FAVICON = "data:image/svg+xml," + encodeURIComponent(brandMarkSvg({ bg: "#1f3a33", name: "Chổi Cước" }));

/** API cua core: favicon theo ten shop. */
export function brandFavicon(name: string): string {
  return "data:image/svg+xml," + encodeURIComponent(brandMarkSvg({ bg: "#1f3a33", name }));
}

/** Logo ngang: bieu tuong + ten shop. */
export function BrandLogo({ name = "", tone = "light", tagline = false }: { name?: string; tone?: "light" | "dark"; tagline?: boolean }) {
  const fg = tone === "light" ? "#fbf7f0" : "#1f3a33";
  return (
    <span className="flex items-center gap-2">
      <span className="block size-9 shrink-0 md:size-10" aria-hidden="true" dangerouslySetInnerHTML={{ __html: brandMarkSvg({ fg, name }) }} />
      <span className="block leading-none">
        <span className="block font-display text-[17px] font-bold tracking-tight md:text-[19px]" style={{ color: fg }}>
          {name || "Cửa hàng"}
        </span>
        {tagline && (
          <span className="mt-1 flex items-center gap-1.5">
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase opacity-80" style={{ color: tone === "light" ? "#e9b04a" : "#b04530" }}>
              Chổi cước công nghiệp
            </span>
          </span>
        )}
      </span>
    </span>
  );
}
