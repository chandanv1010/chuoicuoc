# Chổi Cước Việt Nam (choicuoc)

Website giới thiệu & bán chổi cước công nghiệp, dựng bằng **Next.js 16 + Prisma + MySQL**
(nền tảng storefront kiểu Amazon, bản tiếng Việt). Dự án được tách ra từ nền `next-core`,
Việt hoá toàn bộ phần cửa hàng và **tắt chức năng giỏ hàng** (chỉ còn nút *Liên hệ đặt hàng*).

## Tính năng

- Cây danh mục: **Sản phẩm** → 4 nhóm con
  - Thanh chổi cước chặn cửa
  - Con lăn cước
  - Chổi cước đánh rỉ
  - Các loại chổi cước khác
- 27 sản phẩm demo (ảnh lấy từ tài liệu *các loại chổi cước.docx*).
- Giá hiển thị bằng **VND**; sản phẩm giá 0 hiển thị **"Liên hệ"**.
- Đã tắt: icon giỏ hàng, nút *Thêm vào giỏ*, trang giỏ/thanh toán không còn liên kết.

## Chạy local

```bash
npm install
```

```bash
npm run dev -- -p 3026
```

Mở http://localhost:3026

### Cấu hình (.env)

`.env` **không** được commit (chứa khoá bí mật). Các biến chính:

- `DATABASE_URL` — MySQL, mặc định `mysql://root:root@127.0.0.1:33081/choicuoc`
- `APP_URL` — `http://localhost:3026/`
- `APP_LOCALE` — `vn`

### Cơ sở dữ liệu

DB `choicuoc` (MySQL, container `next-core-db` cổng 33081). Dữ liệu danh mục + sản phẩm
được nạp bằng `_seed-choicuoc.mjs` (sinh `_seed-choicuoc.sql`, nạp với
`--default-character-set=utf8mb4` để tránh lỗi font tiếng Việt).

## Ghi chú

- Tài khoản admin dev: xem `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` trong `.env`.
- Thông tin liên hệ (hotline, email) trong bảng `systems` đang là giá trị mẫu, cần cập nhật.
