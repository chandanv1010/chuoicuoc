# Site mới từ web-core và nâng cấp từ core

`web-core` là mã nguồn chung. Mỗi website khách (vd. `next-core` = customstitchhouse.com, `apaniche`) là một repo riêng có remote `core` trỏ về đây. Tính năng làm ở core rồi các site kéo về.

## Cái gì nằm ở đâu

| Ở core (web-core) | Ở từng site |
|---|---|
| Toàn bộ code: admin, builder, shop, bài viết, marketplace, social, curate, thiết kế thêu… | `.env` (DB, khóa API, cổng) |
| `database/core.sql`: cấu trúc + dữ liệu nền (quyền, ngôn ngữ, tỉnh/huyện/xã) | Database của site (sản phẩm, bài viết, trang builder, cấu hình) |
| `prisma/sql/*.sql`: thay đổi cấu trúc DB | `storage/`: ảnh và file tải lên |
| Giao diện mặc định | Những file site sửa riêng (logo, màu, trang đặc thù), `scripts/<site>/`, landing |

Tên cửa hàng, liên hệ, SEO không viết trong code: lấy từ **Cấu hình chung** (`/system/index`, bảng `systems`, khóa `homepage_company`, `contact_*`, `seo_*`).

## Tạo site mới

```bash
git clone ../web-core ../ten-site
cd ../ten-site
git remote rename origin core
npm ci
```

1. Tạo DB (MySQL 8, utf8mb4) rồi nạp `database/core.sql`.
2. Chép `.env.example` thành `.env`, sửa `DATABASE_URL`, `DEV_ADMIN_EMAIL=admin@example.com`, `DEV_ADMIN_PASSWORD`.
3. `node --env-file=.env scripts/create-admin.mjs` để đặt mật khẩu admin.
4. `npx prisma generate`, chạy thử `npm run dev -- -p <cổng>`.
5. Vào `/system/index` sửa tên cửa hàng, liên hệ, SEO; vào `/builder/index` dựng header / footer / trang chủ.
6. Commit phần riêng của site trên nhánh `main` của repo site.

## Nâng cấp một site khi core có bản mới

Làm trong worktree riêng, **không build trong thư mục đang chạy production** (build lỗi sẽ xóa `.next` và làm sập site).

```bash
git fetch core
git worktree add -b core-update ../<site>-update main
cd ../<site>-update
git merge core/main
```

- Xung đột: ưu tiên giữ phần riêng của site, đưa thêm phần mới của core vào.
- Có file mới trong `prisma/sql/` thì chạy nó trên DB của site (backup trước).
- Kiểm tra: `npx tsc --noEmit -p .` và `npx next build --webpack` (node_modules là junction tới site, Turbopack không chấp nhận).
- Ổn thì gộp `core-update` vào `main` của site, build lại và khởi động lại production của site đó.

## Quy tắc khi sửa code

- Sửa cho mọi site → làm ở web-core, commit, rồi các site kéo về.
- Sửa chỉ cho một site → commit ở repo site đó. Hạn chế sửa sâu vào file core để lần kéo sau ít xung đột.
- Không đưa ảnh, dump DB, tên thương hiệu, khóa API của site nào vào core.

## Lịch sử tách

Commit `core: remove EMHAUS / CustomStitch House site content` xóa dữ liệu riêng của shop thêu khỏi core. Các site đã gộp nó bằng `git merge -s ours` (ghi nhận mà không xóa file của site), nên các lần `git merge core/main` sau chỉ mang code mới về.
