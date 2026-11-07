# Sàn TMĐT — kết nối và đẩy sản phẩm

Module `src/modules/marketplace` đưa sản phẩm của website lên các sàn. Mỗi sàn là một adapter trong `platforms/`;
hiện có **Etsy, Shopee, Lazada, TikTok Shop (Việt Nam) và Amazon**. eBay vẫn "Sắp có".
Shopee / Lazada / TikTok / Amazon mới thử ở chế độ dry run (dựng dữ liệu đúng khuôn API), chưa chạy với key thật.

- Bảng: `marketplace_accounts` (shop đã kết nối, token mã hóa bằng `SOCIAL_TOKEN_KEY`), `marketplace_listings`
  (mỗi cặp sản phẩm × shop một dòng: lựa chọn riêng của sàn, id listing trên sàn, trạng thái). Migration:
  `prisma/sql/2026-10-26-marketplace.sql`.
- Trang: **Sàn TMĐT → Tài khoản sàn** (kết nối, mặc định), **Sản phẩm trên sàn** (trạng thái), khối **Sàn TMĐT**
  ở cuối trang sửa sản phẩm (chọn danh mục, tag, cá nhân hóa… rồi "Lưu & đẩy lên").
- Worker nền (`worker.ts`, bật trong `src/instrumentation.ts`) chạy hàng đợi, thử lại khi lỗi mạng, lưu tiến độ từng
  bước nên lỗi giữa chừng không tạo trùng listing hay ảnh.
- Chưa có mã app → **dry run**: kết nối tạo shop thử, đẩy sản phẩm chỉ kiểm tra dữ liệu.

## Etsy

1. Đăng nhập Etsy bằng tài khoản chủ shop → <https://www.etsy.com/developers/register> → **Create a new app**.
   - Tên app không được chứa chữ "Etsy".
   - Mục đích: quản lý listing cho shop của chính mình (personal access).
2. Khi Etsy duyệt, trang **Your apps** có **Keystring** và **Shared secret**. Điền vào `.env`:
   ```
   ETSY_API_KEY="keystring"
   ETSY_SHARED_SECRET="shared secret"
   ```
3. Trong app Etsy, thêm **Callback URL** đúng bằng: `PUBLIC_BASE_URL/marketplace/callback/etsy`
   (trang Tài khoản sàn hiện sẵn URL này). Phải là HTTPS công khai; dùng tên miền thật, không dùng tunnel tạm.
4. Khởi động lại server → **Sàn TMĐT → Tài khoản sàn → Kết nối Etsy** → đăng nhập Etsy, cho phép.
   App xin quyền: `listings_r listings_w shops_r email_r`.
5. Bấm **Tải lại dữ liệu shop** nếu vừa sửa shipping profile / chính sách trên Etsy.
6. Mở **Mặc định khi đẩy sản phẩm lên shop này**: chọn danh mục hay dùng, vận chuyển, thời gian làm hàng, đổi trả.
7. Ở trang sửa sản phẩm, khối **Sàn TMĐT**: kiểm tra danh mục, 13 tag, cá nhân hóa → **Lưu & đẩy lên Etsy**.
   Mặc định tạo **bản nháp**; vào Etsy kiểm tra rồi bấm Publish (hoặc chọn "Đăng bán ngay").

Ánh xạ dữ liệu:

| Website | Etsy |
|---|---|
| Tên / mô tả ngắn (bỏ HTML) | title (≤140 ký tự) / description — ghi đè được trong khối Sàn TMĐT |
| Ảnh đại diện + album | ảnh listing (tối đa 20, theo thứ tự) |
| Giá, tồn kho | price, quantity (0–999 mỗi lựa chọn) |
| Phiên bản (tối đa 2 nhóm thuộc tính, vd Color × Embroidery Style) | biến thể với thuộc tính tùy chỉnh 513/514; giá riêng từng phiên bản nếu khác nhau |
| — | taxonomy, tags, materials, who_made, when_made, shipping/processing/return profile, ô cá nhân hóa |

Lưu ý: mỗi listing đăng bán mất phí $0.20 (Etsy Plus có 15 lượt miễn phí/tháng); chỉ đưa ảnh và nội dung do chính
shop sở hữu.

## Chung cho Shopee, Lazada, TikTok Shop, Amazon

- Callback khai báo trong app của sàn: `PUBLIC_BASE_URL/marketplace/callback/<shopee|lazada|tiktok_shop|amazon>`
  (vd `https://customstitchhouse.com/marketplace/callback/shopee`).
- Giá: website tính USD. Shop VN tính VND → nhập **tỷ giá** (giá web × tỷ giá, làm tròn 1.000đ) hoặc **giá trên sàn**.
  Lưu tỷ giá vào "Mặc định" của tài khoản sàn để khỏi nhập lại.
- **Gói hàng** (cân nặng, D×R×C) bắt buộc với sàn VN.
- **Danh mục + thuộc tính**: chọn danh mục lá; ô "Thuộc tính trên sàn" mỗi dòng `tên hoặc mã = giá trị`. Sau khi chọn
  danh mục, danh sách thuộc tính của danh mục hiện bên dưới (in đậm = bắt buộc). Lazada dùng *mã* thuộc tính (vd `material`).
- Thương hiệu trống = No brand / Generic. Thương hiệu riêng phải được sàn duyệt trước.
- Cá nhân hóa (khách nhập tên) chỉ có trên Etsy; sàn khác ghi hướng dẫn trong mô tả.

## Shopee (Open Platform v2)

1. Đăng ký tại https://open.shopee.com → tạo App (loại *ERP System* / *Seller In House System*) → lấy **Partner ID**,
   **Partner Key**. App mới chạy ở môi trường Test: đặt `SHOPEE_SANDBOX=1` và dùng shop test Shopee cấp; khi App
   chuyển *Live* thì `SHOPEE_SANDBOX=0`.
2. Khai báo Redirect URL domain: `customstitchhouse.com`.
3. `.env`: `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY` → khởi động lại → Tài khoản sàn → Kết nối Shopee (đăng nhập bằng
   **tài khoản shop**). Token 4 giờ, tự làm mới (refresh 30 ngày; quá 30 ngày không đồng bộ phải kết nối lại).
4. Đẩy: tải ảnh (tối đa 9) → `add_item` → `init_tier_variation` (tối đa 2 nhóm phân loại, 50 phân loại).
   Cập nhật giá/tồn kho theo phân loại có sẵn; thêm phân loại mới phải làm trên Seller Centre.

## Lazada (Open Platform)

1. https://open.lazada.com → App Console → tạo App (*ERP*) → **App Key**, **App Secret**, Callback URL như trên.
2. `.env`: `LAZADA_APP_KEY`, `LAZADA_APP_SECRET` → Kết nối Lazada (đăng nhập tài khoản seller VN).
3. Đẩy: `/image/upload` (tối đa 8 ảnh) → `/product/create` (biến thể tối đa 3 nhóm). Sản phẩm mới qua **kiểm duyệt (QC)**;
   chọn "Tạo rồi tắt bán" để tạo xong tự chuyển Inactive.

## TikTok Shop (Partner API 202309)

1. https://partner.tiktokshop.com → đăng ký Partner (Developer, thị trường Vietnam) → tạo App → **App key**, **App secret**;
   ở trang App lấy **Service ID** (dùng cho link ủy quyền) và khai báo Redirect URL.
2. Xin scope sản phẩm (Product), kho (Logistics), shop (Authorization).
3. `.env`: `TIKTOK_SHOP_APP_KEY`, `TIKTOK_SHOP_APP_SECRET`, `TIKTOK_SHOP_SERVICE_ID` → Kết nối TikTok Shop.
   Sau khi kết nối, hệ thống lưu `shop_cipher` và danh sách **kho hàng** (bắt buộc khai tồn kho theo kho).
4. Đẩy: tải ảnh → `POST /product/202309/products` (Draft hoặc gửi duyệt). Tên nên 25–255 ký tự.

## Amazon (Selling Partner API)

1. Seller Central (tài khoản Professional) → *Apps and Services → Develop Apps* → đăng ký Developer Profile (private
   developer, role *Product Listing*) → tạo App → **LWA client id / client secret**, **App ID** (`amzn1.sp.solution…`),
   OAuth Login URI + Redirect URI như trên.
2. `.env`: `AMAZON_SP_CLIENT_ID`, `AMAZON_SP_CLIENT_SECRET`, `AMAZON_SP_APP_ID`, `AMAZON_SP_DRAFT_APP=1` (app chưa publish).
3. Ảnh: Amazon tự tải từ URL → `PUBLIC_BASE_URL` phải là https thật (customstitchhouse.com, máy này đang chạy).
4. Chọn **product type** (HAT, TABLE_LINEN…), danh sách thuộc tính bắt buộc của product type hiện bên dưới — điền vào ô
   thuộc tính (giá trị JSON nguyên bản Amazon cũng được). Không có UPC/EAN → xin miễn GTIN trên Seller Central trước.
5. "Chỉ kiểm tra" = gửi `mode=VALIDATION_PREVIEW`: Amazon báo lỗi thiếu trường mà chưa tạo listing — nên chạy trước.

## Thêm sàn mới

1. Viết `platforms/<san>.ts` theo interface `MarketplaceAdapter` (`platforms/base.ts`): OAuth, lấy shop, dữ liệu shop,
   validate, sync.
2. Khai báo trong `platforms/index.ts`, đặt `ready: true` và tên biến môi trường trong `MARKETPLACE_INFO` (`types.ts`),
   thêm mã app vào `credentials()` (`config.ts`).
3. Trường riêng của sàn: thêm vào `ListingSettings` và `listing-fields.tsx`.
