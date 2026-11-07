import "server-only";
import type { ReactNode } from "react";
import {
  CataloguePager,
  ClearFilters,
  FilterCategories,
  FilterColors,
  FilterPrice,
  FilterRating,
  ResultCount,
  SortBar,
} from "@/components/site/catalogue-parts";
import { PostBreadcrumb, PostCataloguePager, PostContent, PostShare, PostShopStory } from "@/components/site/post-parts";
import { PostCatalogueView } from "@/components/site/post-catalogue-view";
import type { GalleryOpts } from "@/components/site/product-gallery";
import { PostView } from "@/components/site/post-view";
import { ProductCatalogueView } from "@/components/site/product-catalogue-view";
import {
  ProductBreadcrumb,
  ProductBulletsWidget,
  ProductButtonWidget,
  ProductBuyBox,
  ProductDeliveryWidget,
  ProductOptionsWidget,
  ProductPriceWidget,
  ProductQtyWidget,
  ProductRatingWidget,
  ProductShipInfoWidget,
  ProductSkuWidget,
  ProductStockWidget,
  ProductDescription,
  ProductDetailsTable,
  ProductGallerySection,
  ProductRelated,
  ProductReviewsSection,
} from "@/components/site/product-parts";
import { CustomRequest } from "@/components/site/custom-request";
import type { PageCtx } from "./data";
import { SLOTS, type BuilderDoc, type NodeProps } from "./schema";

/** Trang con dang xem kem trang so / bo loc (danh muc, danh sach bai viet). */
export type SlotCtx = PageCtx & { page: number; query: [string, string][]; preview?: boolean };

/**
 * Ve cac "khoi trang" (SLOTS) cua mot template bang chinh giao dien code san co (server component). Ket qua la map
 * id node -> phan tu React; BuilderTree dat vao dung cho. Khoi khong hop loai trang (vd. hop mua hang trong template
 * danh muc) bo qua.
 */
export function renderSlots(doc: BuilderDoc, ctx: SlotCtx | null): Record<string, ReactNode> {
  const out: Record<string, ReactNode> = {};
  // Khoi dung chung (form yeu cau thiet ke rieng...): ve o moi trang, ke ca trang khong gan ban ghi
  for (const n of Object.values(doc.nodes)) {
    if (n.type !== "slot" || n.props.slot !== "customRequest") continue;
    out[n.id] = <CustomRequest label={n.props.label} phone={n.props.url} topic={n.props.heading} />;
  }
  if (!ctx) return out;
  const id = BigInt(ctx.id);
  const list = { catalogueId: id, page: ctx.page, query: ctx.query };
  const el = (slot: string, p: NodeProps): ReactNode => {
    const opts = { design: p.design, heading: p.heading, hideHeading: p.hideHeading, collapsible: p.collapsible };
    const w = { productId: id, design: p.design, label: p.label };
    switch (slot) {
      case "productRating":
        return <ProductRatingWidget {...w} />;
      case "productPrice":
        return <ProductPriceWidget {...w} />;
      case "productOptions":
        return <ProductOptionsWidget {...w} />;
      case "productStock":
        return <ProductStockWidget {...w} />;
      case "productQty":
        return <ProductQtyWidget {...w} />;
      case "productAddToCart":
        return <ProductButtonWidget {...w} />;
      case "productBuyNow":
        return <ProductButtonWidget {...w} buyNow />;
      case "productDelivery":
        return <ProductDeliveryWidget {...w} />;
      case "productShipInfo":
        return <ProductShipInfoWidget {...w} />;
      case "productSku":
        return <ProductSkuWidget {...w} />;
      case "productBullets":
        return <ProductBulletsWidget {...w} />;
      case "breadcrumb":
        return <ProductBreadcrumb productId={id} />;
      case "productGallery":
        return (
          <ProductGallerySection
            productId={id}
            opts={{ thumbs: p.design as GalleryOpts["thumbs"], visible: p.limit, size: p.thumbSize, zoom: !p.noZoom }}
          />
        );
      case "productBuy":
        return <ProductBuyBox productId={id} />;
      case "productDescription":
        return <ProductDescription productId={id} />;
      case "productDetails":
        return <ProductDetailsTable productId={id} />;
      case "productReviews":
        return <ProductReviewsSection productId={id} />;
      case "productRelated":
        return <ProductRelated productId={id} />;
      case "filterCategories":
        return <FilterCategories {...list} {...opts} />;
      case "filterPrice":
        return <FilterPrice {...list} {...opts} />;
      case "filterColors":
        return <FilterColors {...list} {...opts} />;
      case "filterRating":
        return <FilterRating {...list} {...opts} />;
      case "filterClear":
        // Editor: hien san de thay va sua kieu; trang that chi hien khi khach dang loc
        return <ClearFilters {...list} always={ctx.preview} design={p.design} label={p.label} />;
      case "resultCount":
        return <ResultCount {...list} />;
      case "sortBar":
        return <SortBar {...list} />;
      case "pagination":
        return ctx.kind === "postcat" ? <PostCataloguePager {...list} /> : <CataloguePager {...list} />;
      case "postBreadcrumb":
        return <PostBreadcrumb postId={id} />;
      case "postContent":
        return <PostContent postId={id} />;
      case "postShare":
        return <PostShare postId={id} />;
      case "postShopStory":
        return <PostShopStory postId={id} />;
      case "catalogueListing":
        return <ProductCatalogueView catalogueId={id} page={ctx.page} query={ctx.query} bare />;
      case "postBody":
        return <PostView postId={id} bare preview={ctx.preview} />;
      case "postListing":
        return <PostCatalogueView catalogueId={id} page={ctx.page} featuredFirst={ctx.page === 1} query={ctx.query} bare />;
      default:
        return null;
    }
  };
  for (const n of Object.values(doc.nodes)) {
    if (n.type !== "slot" || !n.props.slot) continue;
    const def = SLOTS[n.props.slot];
    if (!def || !def.kinds.includes(ctx.kind)) continue;
    out[n.id] = el(n.props.slot, n.props);
  }
  return out;
}
