# Hướng dẫn chuyển Laravel (waco) sang next-core

Mục tiêu: **hoạt động và hiển thị y hệt** bản Laravel ở `../waco` (đang chạy tại http://localhost:8008).
Bản Next.js chạy tại http://localhost:3010 (dev server đã bật sẵn, tự reload khi sửa file — KHÔNG tự bật/tắt server, KHÔNG chạy `npm run build`).
Thanh toán online (VNPay, MoMo, PayPal, Zalo) và vận chuyển (ViettelPost, GHN) **bỏ qua**, làm sau.

## Nguồn sự thật

- Code Laravel: `../waco/app`, `../waco/resources/views`, `../waco/routes/web/*.php`, `../waco/public/backend/library/*.js`.
- Danh sách route đầy đủ: `docs/laravel/routes.md` (xuất từ `php artisan route:list`). Mỗi route trong phạm vi của bạn phải có bản Next.js cùng URL, cùng method, cùng hành vi.
- File ngôn ngữ đã xuất JSON: `src/lang/vn/*.json` → dùng `__("messages.post.index.title")` từ `@/lib/lang`.
- DB dùng chung cấu trúc với Laravel. Prisma schema: `prisma/schema.prisma` (bảng không có khóa chính bị `@@ignore` → dùng `db.$queryRaw` / `$executeRaw`).

## Kiến trúc (đọc code mẫu trước khi làm)

Module mẫu đã hoàn chỉnh: **Danh mục bài viết + Bài viết**. Đọc kỹ:
- `src/app/(panel)/post/**` — trang GET (index, create, {id}/edit, {id}/delete)
- `src/modules/post/post-catalogue.ts`, `post.ts` — repository + service
- `src/modules/post/catalogue-store.tsx`, `post-store.tsx` — view form
- `src/modules/post/routes.ts`, `post-routes.ts` — handler form POST/DELETE

Quy tắc:
1. **Trang admin GET**: `src/app/(panel)/<đường-dẫn-laravel>/page.tsx` (server component, URL giống hệt Laravel: `/post/catalogue/index`, `/post/{id}/edit`...). Gọi `await authorize("<permission>")` y như `$this->authorize('modules', ...)` trong controller. Layout `(panel)` đã có sidebar/topbar/toast.
2. **Form POST/PUT/DELETE**: KHÔNG dùng Server Actions. Form HTML thường `method="post"` tới đúng URL Laravel; proxy chuyển vào `src/server/routes.ts`. Khai báo handler trong `src/modules/<module>/routes.ts` (file đã tạo sẵn, đã được import trong `src/modules/index.ts`). `@method('DELETE')` → `<input type="hidden" name="_method" value="DELETE">` (component `DeleteConfirm` đã có).
3. **AJAX** (admin React và JS frontend gọi `ajax/...`): route handler `src/app/ajax/<...>/route.ts`, cùng URL, cùng method, **cùng định dạng JSON trả về** như Laravel (JS website vẫn phụ thuộc vào đó).
4. **Giao diện admin**: React + shadcn/ui, xem [ADMIN-UI.md](ADMIN-UI.md). Giữ đúng tên trường form mà handler đọc.
5. **Website khách hàng**: chuyển Blade → JSX giữ nguyên class, id, data-*, cấu trúc (JS/CSS frontend cũ chạy lại trên markup đó). Thuộc tính `data-modelId` viết `data-modelid`. Asset dùng đường dẫn tuyệt đối.
6. **Thư viện**:
   - `@/lib/http`: `parseForm` (FormData kiểu PHP `a[]`, `a[1][]`), `str/int/arr`, `back`, `backWithErrors`, `redirectWith`, `redirectTo`.
   - `@/lib/validator`: `validate(input, rules, messages)` kiểu Laravel + `unique()`, `exists()`. Copy nguyên `messages()` của FormRequest. Không có messages thì dùng mặc định tiếng Anh của Laravel (đã có sẵn).
   - `@/lib/flash`: `flash({success|error})`, `getFlash`, `oldInput()`, `errorBag()` — thay session flash / `old()` / `$errors`.
   - `@/server/auth`: `authorize(perm)` (trang), `authorizeHandler(req, perm?)` (handler), `getAdmin()`.
   - `@/lib/language`: `getCurrentLanguage()`, `getLanguages()`, `getSystem()`.
   - `@/server/nested-set`: `nestedSet({table, foreignKey, languageId, isMenu}).rebuild(tx)` / `.dropdown()` — port nguyên Nestedsetbie.
   - `@/server/router`: `saveRouter(tx, {...})`, `isCanonicalTaken`. `@/lib/constants`: `CONTROLLERS`, `PUBLISH`, `URL_SUFFIX`.
   - `@/server/admin-list`: `listParams`, `param`, `intParam`, `translatedLanguageIds`, `where`.
   - `@/lib/helpers`: `image, thumb, writeUrl, convertDateTime, now, strLimit, stripTags`.
   - `@/lib/money`: tien USD co xu (cot DECIMAL(12,2)) — `CURRENCY`, `formatMoney` ("$1,234.50"), `parseMoney` (doc o nhap "1,234.50" / "$24.99" -> "1234.50"), `toCents`/`fromCents`, `addMoney`/`subMoney`/`mulMoney`/`percentOf`/`sumLines`, `moneyNumber` (Decimal -> number cho JSON). O nhap tien admin: `MoneyInput` (`src/components/admin/money-input.tsx`). Thay `convert_price()` VND cu.
   - `@/server/models`: map tên model Laravel → bảng (dùng cho ajax chung).
7. **Giờ**: Laravel ghi giờ địa phương (Asia/Ho_Chi_Minh) vào cột DATETIME/TIMESTAMP, Prisma coi là UTC. Ghi DB dùng `now()` từ `@/lib/helpers` (không dùng `new Date()`); hiển thị dùng `convertDateTime()` (đọc giờ UTC).
8. **Mật khẩu**: bcrypt `$2y$`. Dùng `hashPassword`/`checkPassword` trong `src/modules/auth/routes.ts`.
9. **Upload/ảnh**: CKFinder 2 đã được thay bằng `MediaPicker` (`src/components/admin/media-picker.tsx`) + API `/ckfinder/api`. File nằm ở `storage/userfiles`, phục vụ qua `/userfiles/...` và `/uploads/...`; ảnh thu nhỏ qua `/ckfinder/thumb`.
10. Hành vi lạ/bug của bản gốc: **giữ nguyên** (ví dụ redirect `?query=` sau khi update), trừ khi nó làm sập trang (Laravel `echo $e->getMessage(); die();` → ta trả flash error). Ghi chú bằng comment ngắn.
11. Viết comment tiếng Việt không dấu ngắn gọn như code hiện có; mỗi file/hàm ghi rõ nó thay cho controller/service/blade nào.

## Phạm vi file

- Chỉ tạo/sửa file thuộc module của bạn: `src/app/(panel)/<module>/**`, `src/app/ajax/<module>/**` (hoặc endpoint ajax được giao), `src/modules/<module>/**`.
- **Không sửa** file nền dùng chung (`src/lib/**`, `src/server/**`, `src/components/**`, `src/app/(panel)/layout.tsx`, `src/proxy.ts`, `src/modules/index.ts`, `prisma/schema.prisma`, `package.json`). Cần thay đổi ở đó → ghi vào báo cáo cuối (mục "Cần sửa nền"), tạm viết helper riêng trong `src/modules/<module>/`.
- Không commit git, không cài thêm package (proxy npm của công ty thiếu nhiều bản), không chạy `npm run build`.

## Kiểm tra (bắt buộc trước khi báo xong)

1. `npx tsc --noEmit` sạch lỗi trong file của bạn.
2. Đăng nhập bằng curl rồi so sánh từng trang với Laravel:
   ```bash
   EMAIL=$(grep DEV_ADMIN_EMAIL .env | cut -d'"' -f2); PASS=$(grep DEV_ADMIN_PASSWORD .env | cut -d'"' -f2)
   # Next.js
   curl -s -c /tmp/nc-<module>.txt -b /tmp/nc-<module>.txt -o /dev/null -X POST http://localhost:3010/login -d "email=$EMAIL&password=$PASS"
   curl -s -b /tmp/nc-<module>.txt http://localhost:3010/post/catalogue/index > /tmp/next.html
   # Laravel (cần _token: lấy từ trang /admin)
   T=$(curl -s -c /tmp/lv-<module>.txt -b /tmp/lv-<module>.txt http://localhost:8008/admin | grep -o 'name="_token" value="[^"]*"' | cut -d'"' -f4)
   curl -s -c /tmp/lv-<module>.txt -b /tmp/lv-<module>.txt -o /dev/null -X POST http://localhost:8008/login -d "_token=$T&email=$EMAIL&password=$PASS"
   curl -s -b /tmp/lv-<module>.txt http://localhost:8008/post/catalogue/index > /tmp/laravel.html
   ```
   So sánh phần nội dung chính (bỏ debugbar). Hai DB khác dữ liệu (next_core cổng 33081 là bản sao cũ; sql_waco cổng 33068 là của Laravel) nên chỉ so cấu trúc/markup/hành vi, không so số liệu.
3. Thử luồng ghi: thêm → sửa → xóa một bản ghi test trên Next.js (DB next_core), kiểm tra bảng liên quan bằng
   `docker exec next-core-db mysql -uroot -proot --default-character-set=utf8mb4 next_core -e "..."`. Xóa dữ liệu test sau khi xong.
   KHÔNG ghi vào DB của Laravel (sql_waco) — chỉ đọc/so sánh.
4. Báo cáo cuối: danh sách route đã làm (đối chiếu routes.md), route chưa làm + lý do, khác biệt còn lại so với Laravel, mục "Cần sửa nền".
