/**
 * Module san TMDT: dong bo san pham cua website len cac san (Etsy truoc; Shopee, Lazada, TikTok Shop,
 * Amazon, eBay them sau bang adapter rieng trong platforms/).
 */

export const MARKETPLACES = ["etsy", "shopee", "lazada", "tiktok_shop", "amazon", "ebay"] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

export type MarketplaceInfo = {
  label: string;
  region: "intl" | "vn" | "both";
  /** da co adapter chua (chua -> hien "Sap co" tren trang tai khoan) */
  ready: boolean;
  env: string;
};

export const MARKETPLACE_INFO: Record<Marketplace, MarketplaceInfo> = {
  etsy: { label: "Etsy", region: "intl", ready: true, env: "ETSY_API_KEY, ETSY_SHARED_SECRET" },
  shopee: { label: "Shopee", region: "vn", ready: true, env: "SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY" },
  lazada: { label: "Lazada", region: "vn", ready: true, env: "LAZADA_APP_KEY, LAZADA_APP_SECRET" },
  tiktok_shop: { label: "TikTok Shop", region: "vn", ready: true, env: "TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_APP_SECRET, TIKTOK_SHOP_SERVICE_ID" },
  amazon: { label: "Amazon", region: "intl", ready: true, env: "AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET, AMAZON_SP_APP_ID" },
  ebay: { label: "eBay", region: "intl", ready: false, env: "EBAY_CLIENT_ID, EBAY_CLIENT_SECRET" },
};

export const READY_MARKETPLACES = MARKETPLACES.filter((m) => MARKETPLACE_INFO[m].ready);

export const ACCOUNT_STATUS_LABEL: Record<string, string> = { active: "Đang kết nối", needs_reconnect: "Cần kết nối lại", disabled: "Tạm tắt" };

export const LISTING_STATUS_LABEL: Record<string, string> = {
  idle: "Chưa đẩy",
  queued: "Đang chờ",
  processing: "Đang xử lý",
  synced: "Đã đồng bộ",
  failed: "Lỗi",
};

/** Lua chon chung khi dua san pham len san (luu o marketplace_listings.settings). Moi san doc phan minh can. */
export type ListingSettings = {
  /** draft = tao ban nhap tren san de tu kiem tra roi dang; active = dang ban ngay */
  publish: "draft" | "active";
  title?: string;
  /** de trong -> lay mo ta san pham (bo HTML) */
  description?: string;
  /** danh muc tren san (Etsy: taxonomy_id) */
  category_id?: string;
  /** ten danh muc de hien thi (vd "Accessories > Hats & Caps") */
  category_label?: string;
  tags: string[];
  materials: string[];
  /** ca nhan hoa: khach nhap noi dung (vd ten can theu) */
  personalization: { enabled: boolean; required: boolean; question: string; instructions: string; max_chars: number };
  /** Etsy */
  who_made?: "i_did" | "someone_else" | "collective";
  when_made?: string;
  shipping_profile_id?: string;
  return_policy_id?: string;
  processing_profile_id?: string;
  /** ghi de gia ban tren san (de trong -> gia website) */
  price_override?: number | null;
  /** cap nhat lai anh khi dong bo lai (mac dinh chi tai anh lan dau) */
  replace_images?: boolean;
  /** Shopee / Lazada / TikTok / Amazon: thuong hieu (trong = "No brand" / ten shop) */
  brand?: string;
  /** thuoc tinh rieng cua danh muc tren san, moi dong "ten hoac id = gia tri" */
  attributes?: string;
  /** goi hang (Shopee / Lazada / TikTok bat buoc) */
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  /** gia website (USD) x ty gia -> gia tren san tinh bang tien cua shop (VND). Trong = gia website giu nguyen */
  fx_rate?: number | null;
  /** Amazon: ma vach UPC/EAN (trong = xin mien GTIN) va variation theme khi co bien the (vd COLOR, SIZE, COLOR_SIZE) */
  gtin?: string;
  variation_theme?: string;
};

export const DEFAULT_SETTINGS: ListingSettings = {
  publish: "draft",
  tags: [],
  materials: [],
  personalization: { enabled: false, required: true, question: "Personalization", instructions: "", max_chars: 100 },
  who_made: "i_did",
  when_made: "made_to_order",
};

/** Du lieu san pham website da chuan hoa, adapter dung de dua len san. */
export type ProductSnapshot = {
  id: bigint;
  name: string;
  /** mo ta dang van ban thuan */
  description: string;
  price: number;
  stock: number;
  code: string;
  /** anh theo thu tu (anh dai dien truoc), duong dan /userfiles/... */
  images: string[];
  /** ten nhom thuoc tinh dung cho bien the, theo thu tu (vd ["Color", "Embroidery Style"]) */
  options: string[];
  variants: { sku: string | null; price: number; quantity: number; values: string[]; enabled: boolean }[];
  canonical: string | null;
};
