import "server-only";
import type { AccountMeta, AccountRow } from "../accounts";
import type { ListingProgress, ListingRow } from "../listings";
import type { ListingSettings, Marketplace, ProductSnapshot } from "../types";

/**
 * Adapter cho tung san. Them san moi = viet mot file trong platforms/ + khai bao trong platforms/index.ts
 * + bat `ready` trong MARKETPLACE_INFO (types.ts).
 */

export type OAuthTokens = {
  access_token: string;
  refresh_token: string | null;
  expires_at: Date | null;
  refresh_expires_at: Date | null;
  scopes: string | null;
  /** du lieu kem theo tu buoc doi code (Shopee shop_id, Amazon selling_partner_id, Lazada seller...) cho fetchShop */
  hint?: Record<string, string>;
};

/** Tham so san gui ve trang callback (code, shop_id, selling_partner_id...). */
export type CallbackParams = { code: string; verifier: string; redirectUri: string; query: URLSearchParams };

/** Danh muc tren san cho o tim danh muc. */
export type CategoryItem = { id: string; path: string };

/** Thuoc tinh cua danh muc (de nhac nguoi dung dien o "Thuoc tinh sàn"). */
export type CategoryAttribute = { id: string; name: string; required: boolean; values?: string[] };

export type ConnectedShop = {
  name: string;
  shop_id: string;
  external_id: string | null;
  shop_url: string | null;
  currency: string | null;
};

export type SyncJob = {
  listing: ListingRow;
  product: ProductSnapshot;
  settings: ListingSettings;
  account: AccountRow;
  /** access token con han (tu lam moi) */
  token: () => Promise<string>;
  /** luu tien do giua chung de lan thu sau chay tiep (khong tao trung listing / anh) */
  save: (f: { remote_id?: string | null; remote_url?: string | null; remote_state?: string | null; stage?: string | null; progress: ListingProgress }) => Promise<void>;
};

export type SyncResult = { remote_id: string; remote_url: string | null; remote_state: string | null; progress: ListingProgress };

export interface MarketplaceAdapter {
  platform: Marketplace;
  scopes: string[];
  /** san khong tra lai `state` tren URL callback (Lazada): chi dua vao cookie phien ket noi (10 phut) */
  stateOptional?: boolean;
  /** URL trang dong y cua san */
  authorizeUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string;
  exchangeCode(p: CallbackParams): Promise<OAuthTokens>;
  /** account: tai khoan dang lam moi (Shopee can shop_id) */
  refreshTokens(refreshToken: string, account?: AccountRow): Promise<OAuthTokens>;
  /** shop cua nguoi vua dong y (hint: tu exchangeCode) */
  fetchShop(token: string, hint?: Record<string, string>): Promise<ConnectedShop>;
  /** tim danh muc (cache); account de goi API can token shop */
  categories?(account: AccountRow, token: string | null, q?: string): Promise<CategoryItem[]>;
  /** thuoc tinh cua mot danh muc */
  categoryAttributes?(account: AccountRow, token: string | null, categoryId: string): Promise<CategoryAttribute[]>;
  /** lay du lieu shop dung trong form (shipping profile, chinh sach doi tra, thoi gian lam hang...) */
  fetchShopData(shopId: string, token: string): Promise<Partial<AccountMeta>>;
  /** shop thu cho dry run */
  demoShop(): { shop: ConnectedShop; meta: Partial<AccountMeta> };
  /** kiem tra du lieu truoc khi day; tra ve danh sach loi (rong = hop le) */
  validate(product: ProductSnapshot, settings: ListingSettings, account: AccountRow): string[];
  /** tao moi hoac cap nhat listing tren san */
  sync(job: SyncJob): Promise<SyncResult>;
  /** link gia cho dry run */
  fakeUrl(id: string): string;
  /** du lieu se gui len san (xem truoc / kiem tra, khong goi API) */
  preview?(product: ProductSnapshot, settings: ListingSettings): unknown;
}
