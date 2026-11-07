import type { ConfigSchema } from "@/modules/system/config";

/** Port nguyen van app/Classes/Introduce.php -> config() (trang Cong nghe). */
export const INTRODUCE_CONFIG: ConfigSchema = {
  block_1: {
    label: "Khối 1: Banner chính",
    description: "Cài đặt hình nền và nội dung hiển thị trên banner trang công nghệ",
    value: {
      banner_image: { type: "images", label: "Ảnh Banner nền" },
      banner_title: { type: "text", label: "Tiêu đề lớn trên banner" },
      banner_desc: { type: "textarea", label: "Mô tả chi tiết trên banner" },
    },
  },
  block_2: {
    label: "Khối 2: 4 Icon nổi bật",
    description: "Cấu hình thông tin cho 4 icon nổi xếp ngang",
    value: {
      icon_1: { type: "images", label: "Ảnh Icon 1" },
      title_1: { type: "text", label: "Tiêu đề đỏ / Nổi bật 1" },
      desc_1: { type: "text", label: "Mô tả 1" },
      icon_2: { type: "images", label: "Ảnh Icon 2" },
      title_2: { type: "text", label: "Tiêu đề đỏ / Nổi bật 2" },
      desc_2: { type: "text", label: "Mô tả 2" },
      icon_3: { type: "images", label: "Ảnh Icon 3" },
      title_3: { type: "text", label: "Tiêu đề đỏ / Nổi bật 3" },
      desc_3: { type: "text", label: "Mô tả 3" },
      icon_4: { type: "images", label: "Ảnh Icon 4" },
      title_4: { type: "text", label: "Tiêu đề đỏ / Nổi bật 4" },
      desc_4: { type: "text", label: "Mô tả 4" },
    },
  },
  block_3: {
    label: "Khối 3: Ưu điểm vượt trội (Accordion)",
    description: "Cấu hình ảnh bên trái và 3 mục thông tin rút gọn (Accordion) bên phải",
    value: {
      image: { type: "images", label: "Ảnh bên trái" },
      title: { type: "text", label: "Tiêu đề lớn bên phải (ví dụ: Ưu Điểm Vượt Trội)" },
      acc_title_1: { type: "text", label: "Tiêu đề mục 1" },
      acc_content_1: { type: "editor", label: "Nội dung mục 1" },
      acc_title_2: { type: "text", label: "Tiêu đề mục 2" },
      acc_content_2: { type: "editor", label: "Nội dung mục 2" },
      acc_title_3: { type: "text", label: "Tiêu đề mục 3" },
      acc_content_3: { type: "editor", label: "Nội dung mục 3" },
    },
  },
};
