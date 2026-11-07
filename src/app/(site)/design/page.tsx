import { Designer } from "@/components/site/design/designer";
import { notFound } from "next/navigation";
import { designFontsHref, SITE_DESIGN_ENABLED } from "@/modules/design/config";
import { SiteFrame } from "@/components/site/site-frame";
import { url } from "@/modules/frontend/helpers";
import { siteName } from "@/lib/site";

/**
 * GET /design — khach tu thiet ke khan cocktail (mu tam an): dat hinh/chu vao vi tri muon theu,
 * chinh kich thuoc theo mm, roi gui thiet ke ve xuong (xuong lam file may theu + gui proof).
 */
export default async function DesignPage() {
  const shop = await siteName();
  if (!SITE_DESIGN_ENABLED) notFound();
  const seo = {
    meta_title: `Design your embroidery – ${shop}`,
    meta_keyword: "",
    meta_description: "Place your artwork or name on a cotton canvas cocktail napkin or a T-shirt (front and back), choose the size and position, and send it to our embroidery workshop.",
    meta_image: "",
    canonical: url("design"),
  };

  return (
    <SiteFrame seo={seo} bg="gray">
      {/* font cho chu theu (TEXT_FONTS) */}
      <link rel="stylesheet" href={designFontsHref()} />
      <div className="mx-auto max-w-[1300px] space-y-4 px-3 py-4 sm:px-5">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-az-muted uppercase">Design studio</p>
            <h1 className="font-display text-2xl font-bold lg:text-3xl">Design your own embroidery</h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-az-text/75">
            Add your artwork or a name, place it where you want it, then send it to our workshop. We make the machine stitch file and email you a proof before
            stitching.
          </p>
        </header>
        <Designer />
      </div>
    </SiteFrame>
  );
}
