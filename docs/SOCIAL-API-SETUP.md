# Xin quyền API mạng xã hội cho EMHAUS

Hướng dẫn tạo app nhà phát triển và lấy quyền đăng bài cho từng kênh: Facebook Page, Instagram, TikTok, YouTube, Pinterest.
Sau khi có các mã, điền vào `.env` (xem `.env.example`) rồi vào **Admin → Mạng xã hội → Tài khoản kết nối** để đăng nhập từng kênh.

> Quy trình của các nền tảng thay đổi thường xuyên. Nội dung dưới đây đối chiếu với tài liệu chính thức ngày 25/10/2026; nếu màn hình khác đi, làm theo link tài liệu ở từng mục.

## 0. Chuẩn bị chung (làm trước)

1. **Tên miền HTTPS công khai.** Mọi nền tảng cần URL chuyển hướng sau đăng nhập (OAuth redirect URI), trang Chính sách bảo mật, Điều khoản và (Meta) URL xóa dữ liệu. Instagram còn tự tải ảnh/video từ URL công khai của bạn.
   - Khi đã deploy: dùng tên miền thật, ví dụ `https://emhaus.com`.
   - Khi còn chạy trên máy: mở đường hầm Cloudflare để có HTTPS tạm thời trỏ vào `localhost:3010`:
     ```bash
     cloudflared tunnel --url http://localhost:3010
     ```
     Lấy địa chỉ `https://xxxx.trycloudflare.com` nó in ra, đặt vào `PUBLIC_BASE_URL` trong `.env`. Địa chỉ đổi mỗi lần chạy, nên khi đổi phải cập nhật lại redirect URI ở từng app; muốn cố định thì tạo tunnel có tên trong tài khoản Cloudflare.
2. **Ba trang công khai** trên website (tiếng Anh): `/privacy-policy`, `/terms`, `/data-deletion` (hướng dẫn cách xin xóa dữ liệu). Nội dung đơn giản là đủ, nhưng phải mở được không cần đăng nhập.
3. **Biểu tượng app** PNG vuông 1024×1024 (logo EMHAUS) và một email liên hệ theo tên miền nếu có.
4. **Tài khoản trên các kênh**, đều đứng tên doanh nghiệp/thương hiệu EMHAUS:
   - Facebook Page (không phải trang cá nhân).
   - Instagram chuyển sang **Business** hoặc **Creator**, liên kết với Facebook Page ở trên.
   - TikTok (nên chuyển sang Business account).
   - Kênh YouTube.
   - Pinterest **Business** account, tạo sẵn vài board (Embroidered Hats, Cocktail Napkins, Christmas Napkins).

**Redirect URI** cần khai báo ở từng app (thay `PUBLIC_BASE_URL` bằng địa chỉ thật):

| Kênh | Redirect URI |
|---|---|
| Facebook + Instagram | `PUBLIC_BASE_URL/social/callback/facebook` |
| TikTok | `PUBLIC_BASE_URL/social/callback/tiktok` |
| YouTube | `PUBLIC_BASE_URL/social/callback/youtube` |
| Pinterest | `PUBLIC_BASE_URL/social/callback/pinterest` |
| X (Twitter) | `PUBLIC_BASE_URL/social/callback/x` |

## 1. Facebook Page + Instagram (một app Meta dùng chung)

**Điểm quan trọng:** bạn chỉ đăng lên Page và Instagram **của chính mình**, nên **không cần App Review** để dùng: ở chế độ quyền "Standard Access", người có vai trò trong app (Admin/Developer/Tester) vẫn cấp được mọi quyền cho app. App Review chỉ cần khi cho người ngoài dùng app.

1. Vào https://developers.facebook.com → **My Apps → Create App**.
   - Use case: chọn **"Manage everything on your Page"** và thêm **"Manage messaging & content on Instagram"** (tên có thể khác chút; mục đích là có Pages API + Instagram API).
   - Gắn app vào **Business Portfolio** của bạn (tạo ở https://business.facebook.com nếu chưa có).
2. **App settings → Basic:** điền Privacy Policy URL, Terms URL, User data deletion URL, App icon, Category. Copy **App ID** và **App Secret** vào `.env` (`META_APP_ID`, `META_APP_SECRET`).
3. **Facebook Login for Business → Settings:** thêm Valid OAuth Redirect URI `PUBLIC_BASE_URL/social/callback/facebook`.
4. **Quyền cần có** (app sẽ tự xin khi bạn bấm Kết nối):
   - Page: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` (đủ cho cả đăng video; Meta đã bỏ quyền `publish_video`, xin nó sẽ báo "Invalid Scopes").
   - Instagram (qua Facebook Login): `instagram_basic`, `instagram_content_publish`.
   - Hộp thư bình luận & tin nhắn (trang **Mạng xã hội → Bình luận & tin nhắn**): `pages_read_user_content` (đọc bình luận trên bài của Page), `pages_messaging` (Messenger), `instagram_manage_comments`, `instagram_manage_messages` (Instagram Direct — cần bật thêm trong app Instagram: Cài đặt → Tin nhắn → Công cụ kết nối → **Cho phép truy cập tin nhắn**). Ở chế độ phát triển các quyền này dùng được ngay cho Admin của app; nếu nút Kết nối báo "Invalid Scopes" thì vào app → Use cases → Customize → thêm quyền tương ứng.
   - `business_management`: bắt buộc khi Page nằm trong một Business Portfolio (Facebook sẽ hỏi chọn doanh nghiệp sở hữu Page); thiếu nó `/me/accounts` trả rỗng và báo "Requires business_management permission".
5. **Business Verification** (Business settings → Security Center): nộp giấy phép kinh doanh/ giấy tờ doanh nghiệp. Không bắt buộc để tự đăng lên Page của mình ở chế độ phát triển, nhưng cần khi chuyển app sang Live hoặc xin Advanced Access sau này. Nên làm sớm vì mất vài ngày.
6. Vai trò: tài khoản Facebook bạn dùng để kết nối phải là **Admin của app** và có quyền **tạo nội dung (CREATE_CONTENT)** trên Page.
7. Bấm **Kết nối Facebook** trong admin EMHAUS → đăng nhập → chọn Page và tài khoản Instagram → xong.

Giới hạn cần biết:
- Facebook Reels qua API: video 3–90 giây, khuyến nghị 9:16 (1080×1920), tối đa 30 reel/24 giờ mỗi Page.
- Instagram: ảnh **chỉ JPEG**; carousel tối đa 20 ảnh/video; giới hạn số bài/24 giờ (app kiểm tra qua API trước khi đăng); ảnh/video phải ở **URL công khai** lúc đăng.

Tài liệu: [Pages API – Posts](https://developers.facebook.com/docs/pages-api/posts), [Reels Publishing](https://developers.facebook.com/docs/video-api/guides/reels-publishing), [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing).

## 2. TikTok

1. Vào https://developers.tiktok.com → đăng nhập → **Manage apps → Connect an app**. Chọn loại tổ chức (Organization) EMHAUS.
2. Điền thông tin app: icon, mô tả, Terms URL, Privacy Policy URL, **Platform: Web** với Website URL là tên miền của bạn.
3. **Add products:** thêm **Login Kit** và **Content Posting API**. Trong Content Posting API bật **Direct Post**.
4. **Scopes:** `user.info.basic`, `video.publish` (và `video.upload` nếu muốn gửi bản nháp vào hộp thư TikTok thay vì đăng thẳng).
5. **Redirect URI** (Login Kit): `PUBLIC_BASE_URL/social/callback/tiktok`. TikTok yêu cầu HTTPS.
6. **Xác minh tên miền / URL prefix** (mục URL properties) nếu dùng đăng ảnh hoặc video kéo từ URL (`PULL_FROM_URL`). Đăng ảnh (photo mode) luôn cần URL đã xác minh.
7. Lưu **Client key** và **Client secret** vào `.env` (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`), rồi **Submit for review** để app được duyệt sử dụng.
8. **Audit Direct Post** (bắt buộc để đăng công khai):
   - Trước audit: **mọi bài đăng qua API đều ở chế độ riêng tư (chỉ mình tôi)** và tối đa 5 người dùng/24 giờ. Vẫn dùng được để thử.
   - Nộp audit trong trang Content Posting API, kèm video quay màn hình luồng đăng bài trong admin EMHAUS. Màn hình đăng TikTok trong admin đã làm theo hướng dẫn của TikTok: hiện tên tài khoản, chọn quyền riêng tư không đặt sẵn, Comment/Duet/Stitch mặc định tắt, nút khai báo nội dung quảng cáo, câu đồng ý Music Usage Confirmation, xem trước video.
   - Lưu ý chính sách: **không chèn logo, watermark, chữ quảng cáo hay link vào video/ảnh đăng TikTok**. Video sản phẩm tạo bằng AI cho TikTok phải là bản không có logo/giá/nút mua.

Tài liệu: [Content Posting API – Get started](https://developers.tiktok.com/doc/content-posting-api-get-started), [Content sharing guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines).

## 3. YouTube

1. Vào https://console.cloud.google.com → tạo **Project** "EMHAUS Social".
2. **APIs & Services → Library:** bật **YouTube Data API v3**.
3. **OAuth consent screen** (Google Auth Platform):
   - User type: **External**. App name EMHAUS, support email, logo, Privacy/Terms URL, Authorized domain là tên miền của bạn.
   - Scopes: `https://www.googleapis.com/auth/youtube.upload` và `https://www.googleapis.com/auth/youtube.readonly` (đọc tên kênh).
   - **Test users:** thêm email Google sở hữu kênh YouTube.
4. **Credentials → Create credentials → OAuth client ID → Web application:** Authorized redirect URI `PUBLIC_BASE_URL/social/callback/youtube`. Copy **Client ID / Client secret** vào `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
5. **Publishing status:** khi app để ở **Testing**, refresh token **hết hạn sau 7 ngày**, tức là cứ 7 ngày phải bấm kết nối lại. Bấm **Publish app** (chuyển sang In production) để token không hết hạn. Vì `youtube.upload` là scope nhạy cảm, Google sẽ hiện màn "app chưa xác minh" khi bạn đăng nhập; với dùng nội bộ (dưới 100 người) bạn có thể bấm *Advanced → Go to EMHAUS* để tiếp tục, hoặc nộp xác minh (cần video demo, chính sách bảo mật, xác minh tên miền trong Search Console).
6. Hạn mức: theo tài liệu hiện tại `videos.insert` có hạn mức riêng **100 lần tải lên/ngày**. Video từ project chưa xác minh **không còn bị khóa riêng tư**.
7. Khi đăng video có cảnh do AI tạo, admin tự bật `containsSyntheticMedia` (YouTube yêu cầu khai báo nội dung tổng hợp/chỉnh sửa trông như thật).

Tài liệu: [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert).

## 4. Pinterest

1. Đảm bảo tài khoản Pinterest là **Business**.
2. Vào https://developers.pinterest.com → **My apps → Connect app**, điền tên, mô tả, website, Privacy Policy, mục đích dùng (đăng ghim sản phẩm của chính shop lên board của mình).
3. Chờ duyệt **Trial access** (thường 1–2 ngày làm việc, có khi lâu hơn). Trial dùng để thử, kèm môi trường **sandbox** không ảnh hưởng tài khoản thật.
4. **Configure → Redirect URIs:** thêm `PUBLIC_BASE_URL/social/callback/pinterest` (phải khớp tuyệt đối). Copy **App ID / App secret key** vào `.env` (`PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`).
5. Scopes: `boards:read`, `pins:read`, `pins:write`, `user_accounts:read` (thêm `boards:write` nếu muốn tạo board từ admin).
6. Xin **Standard access** để đăng ghim thật: My apps → **Upgrade** → mô tả lại mục đích, chính sách bảo mật, **tải video demo** quay luồng kết nối và đăng ghim trong admin EMHAUS (làm được sau khi Trial và tính năng đã chạy trên sandbox).

Tài liệu: [Connect app](https://developers.pinterest.com/docs/getting-started/connect-app/), [Access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/).

## 4b. X (Twitter)

**Chi phí:** từ 06/02/2026 X API tính tiền theo lượt dùng (pay-per-use), không còn gói Free cho tài khoản mới. Phải nạp credit trong Developer Console. Theo các bảng giá công bố lại (đối chiếu docs.x.com trước khi nạp): mỗi post khoảng $0.015, **post có link khoảng $0.20**. Chữ ký mặc định có link website, nên mỗi post X tốn khoảng $0.20; xóa dòng link trong nội dung nếu muốn rẻ hơn. Hết credit thì X trả lỗi 402 và bài báo lỗi (không thử lại).

1. Vào https://console.x.com (hoặc developer.x.com) bằng tài khoản X của shop → tạo **Project + App**.
2. **User authentication settings → Set up:**
   - App permissions: **Read and write**.
   - Type of App: **Web App, Automated App or Bot** (confidential client).
   - Callback URI / Redirect URL: `PUBLIC_BASE_URL/social/callback/x` (X chấp nhận `http://localhost:3010/social/callback/x` khi chạy trên máy).
   - Website URL: tên miền của shop.
3. Copy **OAuth 2.0 Client ID** và **Client Secret** (không phải API Key/Secret của OAuth 1.0a) vào `.env`: `X_CLIENT_ID`, `X_CLIENT_SECRET`.
4. **Billing / Credits:** thêm thẻ và nạp credit (tài khoản mới thường được tặng credit khởi đầu).
5. Khởi động lại server → **Admin → Mạng xã hội → Kết nối X (Twitter)** → đăng nhập X → Authorize.

Scope: `tweet.read`, `tweet.write`, `users.read`, `media.write`, `offline.access` (access token 2 giờ, hệ thống tự làm mới bằng refresh token).
Giới hạn: 280 ký tự (link tính 23, emoji tính 2), tối đa 4 ảnh mỗi post; ảnh > 5 MB tự nén JPEG.

Tài liệu: [OAuth 2.0](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), [Create Post](https://docs.x.com/x-api/posts/create-post), [Media upload](https://docs.x.com/x-api/media/upload-media).

## 5. Thứ tự nên làm

| Bước | Việc | Thời gian chờ |
|---|---|---|
| 1 | Tên miền/tunnel HTTPS + 3 trang Privacy/Terms/Data deletion | — |
| 2 | Meta app (Facebook + Instagram) — dùng được ngay cho Page của bạn | không chờ |
| 3 | Google Cloud project (YouTube) | không chờ (Testing), Publish app khi ổn định |
| 4 | Pinterest app → chờ Trial → làm demo → xin Standard | vài ngày đến vài tuần |
| 5 | TikTok app → submit app → quay demo → audit Direct Post | 1–3 tuần; trước đó bài đăng ở chế độ riêng tư |
| song song | Meta Business Verification | vài ngày |

Khi đã điền `.env`, khởi động lại server (biến môi trường chỉ được đọc lúc khởi động). Chưa điền mã của kênh nào thì kênh đó chạy ở **chế độ thử (dry run)**: admin vẫn tạo lịch đăng và hiện kết quả giả để kiểm tra luồng, không gửi gì lên mạng xã hội.
