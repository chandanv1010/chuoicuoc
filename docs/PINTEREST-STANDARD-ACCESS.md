# Xin Pinterest Standard access cho app 1630365

App "Custom Stitch House Publisher" đang ở Trial: ghim chỉ tạo được trên sandbox, chỉ chủ tài khoản thấy.
Standard access cho phép đăng ghim công khai lên tài khoản thật. Pinterest duyệt dựa trên mô tả app + video demo.

Nộp ở: developers.pinterest.com → My apps → **Upgrade** trên thẻ app → kiểm tra mô tả, privacy policy → tải video → Submit.
Kết quả báo qua email (không có thời hạn cố định).

## 1. Nội dung điền form (tiếng Anh, copy nguyên)

**App description / use case**

> Custom Stitch House Publisher is an internal publishing tool for our own small embroidery business, Custom Stitch House (https://customstitchhouse.com). We machine-embroider hats and linen cocktail napkins to order and sell them to customers in the United States.
>
> The tool runs inside the admin panel of our own website. The shop owner connects our single Pinterest business account through Pinterest OAuth (scopes: user_accounts:read, boards:read, boards:write, pins:read, pins:write). When a product is published on our website, the owner can choose to create a Pin from that product: the Pin uses our own product photo, the product title and description, and links back to the product page on customstitchhouse.com. Pins are only created on our own account and boards; we never post on behalf of other Pinterest users.
>
> Data handling: we store only the OAuth access/refresh tokens (encrypted with AES-256-GCM on our server), the account username and the list of our board names/IDs needed to choose where to Pin. We do not collect Pinterest passwords, other users' data, or analytics beyond our own Pins. The owner can disconnect the account at any time in the admin panel, which deletes the stored tokens.

**Privacy policy URL:** https://customstitchhouse.com/privacy-policy (mục 3 "Pinterest and other social media integrations")

**Website:** https://customstitchhouse.com — đã claim trên tài khoản Pinterest.

## 2. Kịch bản video (khoảng 2 phút)

Pinterest cần thấy đủ 4 việc: bắt đầu kết nối trong app → màn hình xin quyền của Pinterest → quay về redirect URI → gọi API thành công (tạo ghim).
Không cần dựng đẹp, không dùng slide. Quay bằng Chrome trên máy tính (cửa sổ rộng), **đã đăng nhập admin và Pinterest từ trước** (không quay cảnh gõ mật khẩu).

Chuẩn bị: mở sẵn tab https://customstitchhouse.com/social/account/index. Bật quay: **Win + Shift + R** (Snipping Tool) → kéo chọn vùng cửa sổ Chrome (tránh góc phải dưới có chữ "Activate Windows") → Start.

| # | Thao tác | Phụ đề tiếng Anh (mình chèn sau) |
|---|----------|-----------------------------------|
| 1 | Dừng 3 giây ở trang Tài khoản kết nối, cuộn tới thẻ Pinterest | Our website admin panel → Social accounts. We connect our own Pinterest business account. |
| 2 | Bấm **Kết nối Pinterest** | The owner clicks "Connect Pinterest" — this starts Pinterest OAuth. |
| 3 | Trang Pinterest "Cho phép ứng dụng": dừng 3 giây cho thấy danh sách quyền, rồi bấm **Cấp quyền truy cập** | Pinterest consent screen: the user reviews the requested scopes and grants access. |
| 4 | Quay về trang admin, cuộn xuống bảng "Tài khoản đã kết nối", dừng ở dòng Pinterest (customstitchstory + board) | Redirected back to https://customstitchhouse.com/social/callback/pinterest. Account and boards are loaded via the API. |
| 5 | Mở **Sản phẩm** → sửa một sản phẩm (vd. "Five Elements Embroidered Cap") | We open a product on our website to Pin it. |
| 6 | Cuộn tới khối **Đăng lên mạng xã hội**: chỉ tick **Pinterest**, chọn board, kiểu "Ghim ảnh", thời gian **Đăng ngay**; bỏ tick Facebook/Instagram/TikTok | Choose Pinterest, our board, and the product photo. Title, description and link come from the product. |
| 7 | Bấm **Lưu** | Saving creates the Pin through POST /v5/pins. |
| 8 | Mở **Mạng xã hội → Lịch sử đăng**, lọc Pinterest, đợi dòng mới chuyển "Đã đăng" (bấm F5 nếu cần) | The Pin was created successfully — status "Published" with the Pin URL. |
| 9 | Bấm link ghim → trang ghim trên Pinterest, dừng 3 giây, bấm vào ghim để thấy nó dẫn về trang sản phẩm | The Pin on Pinterest, linking back to the product page on our website. |
| 10 | Dừng quay | — |

Gửi file video (.mp4) cho Claude: chèn phụ đề tiếng Anh theo bảng trên, cắt khoảng chờ, xuất bản nộp Pinterest.

## 3. Sau khi được duyệt Standard

1. `.env`: `PINTEREST_SANDBOX="0"`, khởi động lại web.
2. Admin → Tài khoản kết nối → **Kết nối Pinterest** lại (token sandbox không dùng được trên API thật).
3. Chọn board thật (hoặc tạo board) cho tài khoản.
4. Đăng lại các ghim lên tài khoản thật (ghim sandbox không chuyển sang được).
