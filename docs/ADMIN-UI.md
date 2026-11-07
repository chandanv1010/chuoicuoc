# Giao diện admin mới (shadcn/ui) — quy ước

Admin **không còn dùng INSPINIA / jQuery / CKEditor 4 / CKFinder popup**. Mọi màn hình admin viết bằng
React (server component + client component) với bộ UI kiểu shadcn/ui. **Chức năng, URL, dữ liệu, validate,
handler form POST, endpoint ajax giữ nguyên** như đã port (xem `docs/PORTING.md` cho phần server).

Module mẫu đã hoàn chỉnh, đọc trước khi làm:
- `src/app/(panel)/post/catalogue/index/page.tsx` — trang danh sách
- `src/modules/post/catalogue-store.tsx`, `src/modules/post/post-store.tsx` — form thêm/sửa
- `src/app/(panel)/post/**/delete/page.tsx` — trang xác nhận xóa

## Bộ khối dùng chung (không sửa; cần thêm thì viết trong module của bạn)

`src/components/ui/*` (shadcn): `Button`, `Input`, `Textarea`, `NativeSelect`, `Label` (`form-controls`), `Card*`,
`Badge`, `Alert`, `Table*`, `Separator`, `Skeleton` (`misc`), `Checkbox`, `Switch`, `Dialog*`, `Popover*`,
`DropdownMenu*`, `Tabs*`, `Tooltip` (`interactive`), `Combobox` (thay select2: một/nhiều giá trị, tự sinh
`<input type=hidden name=...>`), `toast` (`sonner`).

`src/components/admin/page.tsx` (server):
- `PageHeader` (tiêu đề + breadcrumb + nút), `CreateButton`
- `ListToolbar` (form GET: perpage, publish, keyword + `children` cho bộ lọc riêng), `ListCard`, `EmptyRow`,
  `RowActions` (sửa/xóa), `Thumb`, `TranslateBadges` + `hasOtherLanguages()` (cột bản dịch)
- `FormErrors`, `AdminForm` (form POST 2 cột + thanh lưu cố định: nút `send=send_and_stay` / `send_and_exit`,
  hoặc `saveMode="single"` → `send=send`), `Section` (card nhóm trường)
- `ContentSection` (Tiêu đề + Mô tả ngắn + Nội dung), `SeoSection`, `AlbumSection`, `PublishSection`
  (ảnh đại diện + publish/follow, nhận `children`), `DeleteConfirm` (form `_method=DELETE`)
- `fieldErrors()` → hàm lấy lỗi theo tên trường

`src/components/admin/pagination.tsx`: `makePaginator` + `AdminPagination` (logic Laravel, query string giữ nguyên).

`src/components/admin/fields.tsx` (client):
- `Field` (nhãn + lỗi + gợi ý), `TitleInput` + `SeoFields` (tiêu đề tự sinh đường dẫn khi thêm mới)
- `ImageField` (1 ảnh), `AlbumField` (nhiều ảnh, kéo thả sắp xếp, `album[]`), `FileUrlInput` (đường dẫn + chọn từ thư viện)
- Bảng: `SelectableTable` + `SelectAllCheckbox` / `SelectRowCheckbox` / `SelectableRow` (bật/tắt xuất bản hàng loạt qua
  `ajax/dashboard/changeStatusAll`), `StatusSwitch` (`ajax/dashboard/changeStatus`), `OrderInput` (`ajax/product/updateOrder`)
- `AutoSubmitField` (select tự gửi form lọc)

`src/components/admin/media-picker.tsx`: `MediaPicker` (thư viện file, một/nhiều, type Images/Files/Flash).
`src/components/admin/rich-text/editor.tsx`: `RichTextEditor` (TipTap, thay CKEditor; gửi qua `<textarea name hidden>`;
không sửa thì giữ nguyên HTML gốc).

## Quy tắc

1. Trang GET giữ nguyên đường dẫn và `authorize("<permission>")` như hiện tại. Đổi phần giao diện sang các khối trên.
2. Form vẫn là `<form method="post" action="<URL Laravel>">` (trong `AdminForm` / `DeleteConfirm`), giữ **đúng tên trường**
   mà handler trong `src/modules/<module>/routes.ts` đang đọc (kể cả mảng `a[]`, `a[1][]`, `variant[sku][]`...). Không đổi
   handler trừ khi phải bỏ phần chỉ phục vụ jQuery.
3. Mọi hành vi trước đây do jQuery (`public/vendor/backend/library/*.js` của Laravel, đã xóa khỏi repo này) làm, viết lại bằng React client component trong
   `src/modules/<module>/` (ví dụ: dựng biến thể sản phẩm, điều kiện khuyến mại, chọn sản phẩm qua ajax, cây menu kéo thả
   bằng `@dnd-kit/*`, chọn tỉnh/huyện/xã, cập nhật đơn hàng, tìm đối tượng cho widget, slide...). Gọi đúng các endpoint
   ajax đã có (cùng JSON). Không nạp script jQuery nào.
4. Biểu đồ: `recharts`. Ngày giờ: `date-fns` nếu cần. Icon: `lucide-react` (bản 1.x, không có icon thương hiệu).
5. `DndContext` (dnd-kit) luôn truyền `id={useId()}` để không lệch `aria-describedby` khi hydrate.
6. Giao diện tiếng Việt, gọn, rõ; bảng có trạng thái rỗng; form có nhãn rõ; responsive (sidebar ẩn dưới 1024px).

## Kiểm tra trước khi báo xong

- `npx tsc --noEmit` sạch trong file của bạn.
- Mở từng trang trên dev server (http://localhost:3010, đăng nhập xem `docs/PORTING.md`) — không lỗi console, không lỗi hydrate.
- Chạy thật luồng thêm → sửa → xóa (và các thao tác đặc thù: biến thể, điều kiện, kéo thả...) trên DB `next_core`,
  kiểm tra dữ liệu ghi vào DB giống trước khi đổi giao diện; xóa dữ liệu test.
- Ghi file bằng Write/Edit, không dùng heredoc trong Bash (Bash ở máy này làm mất dấu `\`).
