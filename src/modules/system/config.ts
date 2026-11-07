/**
 * Port nguyen van app/Classes/System.php -> config().
 * Moi khoi: label, description, value { key: { type, label, title?, link?, option? } };
 * ten o nhap = config[<khoi>_<key>].
 */
export type ConfigItem = {
  type: "text" | "images" | "textarea" | "select" | "editor";
  label: string;
  title?: string;
  link?: { text: string; href: string; target: string };
  option?: Record<string, string>;
};
export type ConfigBlock = { label: string; description: string; value: Record<string, ConfigItem> };
export type ConfigSchema = Record<string, ConfigBlock>;

/**
 * Chi giu cac truong storefront thuc su doc (footer, trang Contact, checkout, SEO trang chu).
 * Cac truong WACO cu (Viettel Post, hotline mien, video, tai lieu, ban do dai ly, Zalo/Lazada/Shopee,
 * script, text_1..12...) da bo cung du lieu trong bang systems (prisma/sql/2026-10-25-english-only-cleanup.sql).
 */
export const SYSTEM_CONFIG: ConfigSchema = {
  homepage: {
    label: "Thông tin chung",
    description: "Tên cửa hàng hiện ở logo, tiêu đề trang, chân trang và email gửi khách.",
    value: {
      company: { type: "text", label: "Tên cửa hàng", title: "Ví dụ: Acme Store" },
    },
  },
  contact: {
    label: "Thông tin liên hệ",
    description: "Hiện ở trang Contact Us, chân trang và email gửi khách. Nhập bằng tiếng Anh.",
    value: {
      address: { type: "text", label: "Địa chỉ xưởng" },
      email: { type: "text", label: "Email hỗ trợ khách" },
      phone: { type: "text", label: "Số điện thoại" },
      hotline: { type: "text", label: "Hotline / WhatsApp" },
      working_hours: { type: "text", label: "Giờ làm việc", title: "Ví dụ: Mon–Sat, 8:00–17:00 (GMT+7)" },
    },
  },
  seo: {
    label: "SEO trang chủ",
    description: "Tiêu đề, từ khóa, mô tả và ảnh chia sẻ của trang chủ (tiếng Anh).",
    value: {
      meta_title: { type: "text", label: "Tiêu đề SEO" },
      meta_keyword: { type: "text", label: "Từ khóa SEO" },
      meta_description: { type: "textarea", label: "Mô tả SEO" },
      meta_images: { type: "images", label: "Ảnh SEO" },
    },
  },
};
