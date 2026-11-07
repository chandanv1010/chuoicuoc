import "server-only";
import type { HeroCard } from "@/components/site/category-hero";
import { getStoreCatalogues, type StoreCatalogue } from "./storefront";

/**
 * Cac the danh muc lon dau trang chu — dung chung cho trang chu code cung
 * va khoi "The danh muc" cua trinh dung giao dien. Lay 3 danh muc chinh cua
 * choi cuoc (con lan / thanh chan cua / danh ri) theo canonical.
 */
const HERO = [
  {
    canonical: "con-lan-cuoc",
    title: "Con lăn cước",
    subtitle: "Con lăn cước sợi nylon, PP, inox — cho máy rửa, băng tải và đánh bóng.",
    bg: "linear-gradient(160deg,#dbe6ea 0%,#ebf0ef 100%)",
  },
  {
    canonical: "thanh-choi-cuoc-chan-cua",
    title: "Thanh chổi cước chặn cửa",
    subtitle: "Thanh chổi cước khung nhôm, chặn bụi, chặn khe cửa và máy móc.",
    bg: "linear-gradient(160deg,#f6dccf 0%,#f3e6dc 100%)",
  },
  {
    canonical: "choi-cuoc-danh-ri",
    title: "Chổi cước đánh rỉ",
    subtitle: "Chổi cước đĩa, bánh xe — đánh rỉ sét, ba via và đánh bóng kim loại.",
    bg: "linear-gradient(160deg,#e3e8d6 0%,#eef0e4 100%)",
  },
];

export async function getHomeHeroCards(): Promise<HeroCard[]> {
  const catalogues = await getStoreCatalogues();
  const byCanonical = (slug: string): StoreCatalogue | undefined => catalogues.find((c) => c.canonical === slug);
  return HERO.map((h) => {
    const c = byCanonical(h.canonical);
    return {
      title: h.title,
      subtitle: h.subtitle,
      href: c?.canonical ? `/${c.canonical}.html` : "/products.html",
      image: c?.images[0] ?? null,
      bg: h.bg,
      cta: "Xem sản phẩm",
      count: c?.count ?? 0,
    };
  });
}
