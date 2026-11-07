/**
 * Menu trai cua admin — giu dung cac nhom cua resources/lang/vn/sidebar.php,
 * icon doi sang ten icon lucide-react (xem ICONS trong components/admin/sidebar.tsx).
 */
export type SidebarIcon =
  | "dashboard"
  | "product"
  | "order"
  | "customer"
  | "marketing"
  | "share"
  | "curate"
  | "store"
  | "post"
  | "comment"
  | "contact"
  | "user"
  | "slide"
  | "menu"
  | "distribution"
  | "home"
  | "dealer"
  | "info"
  | "settings";

export type SidebarItem = {
  title: string;
  icon: SidebarIcon;
  /** segment dau cua URL de danh dau dang mo (request()->segment(1)) */
  name: string[];
  route?: string;
  subModule?: { title: string; route: string; root?: boolean }[];
  /** chi hien voi website ban hang (an khi loai website = tin tuc) */
  shop?: boolean;
};

export const sidebar: SidebarItem[] = [
  { title: "Dashboard", icon: "dashboard", name: ["dashboard"], route: "/dashboard/index" },
  {
    title: "QL Sản Phẩm",
    icon: "product",
    shop: true,
    name: ["product", "attribute", "review"],
    subModule: [
      { title: "QL Nhóm Sản Phẩm", route: "/product/catalogue/index" },
      { title: "QL Sản phẩm", route: "/product/index" },
      { title: "QL Loại thuộc tính", route: "/attribute/catalogue/index" },
      { title: "QL thuộc tính", route: "/attribute/index" },
      { title: "Đánh giá sản phẩm", route: "/review/index" },
    ],
  },
  {
    title: "QL đơn hàng",
    icon: "order",
    shop: true,
    name: ["order", "design-request"],
    subModule: [
      { title: "QL Đơn Hàng", route: "/order/index" },
      { title: "Thiết kế khách gửi", route: "/design-request/index" },
    ],
  },
  {
    title: "QL Khách hàng",
    icon: "customer",
    shop: true,
    name: ["customer"],
    subModule: [
      { title: "QL Nhóm Khách hàng", route: "/customer/catalogue/index" },
      { title: "QL Khách hàng", route: "/customer/index" },
    ],
  },
  {
    title: "QL Marketing",
    icon: "marketing",
    shop: true,
    name: ["promotion", "voucher", "source"],
    subModule: [
      { title: "QL Khuyến mại", route: "/promotion/index" },
      { title: "QL Voucher", route: "/voucher/index" },
      { title: "QL nguồn khách", route: "/source/index" },
    ],
  },
  {
    title: "QL Bài viết",
    icon: "post",
    name: ["post"],
    subModule: [
      { title: "QL Nhóm Bài Viết", route: "/post/catalogue/index" },
      { title: "QL Bài Viết", route: "/post/index" },
    ],
  },
  {
    // Module mang xa hoi (src/modules/social)
    title: "Mạng xã hội",
    icon: "share",
    shop: true,
    name: ["social"],
    subModule: [
      { title: "Tài khoản kết nối", route: "/social/account/index" },
      { title: "Lịch sử đăng", route: "/social/post/index" },
      { title: "Bình luận & tin nhắn", route: "/social/inbox/index" },
      { title: "Thống kê tương tác", route: "/social/stats/index" },
    ],
  },
  {
    // Module tim nguon noi dung (src/modules/curate): anh/video/bai viet mien phi -> duyet -> bai nhap + lich dang MXH
    title: "Tìm nguồn nội dung",
    icon: "curate",
    name: ["curate"],
    subModule: [
      { title: "Kho nội dung", route: "/curate/item/index" },
      { title: "Nguồn lấy nội dung", route: "/curate/source/index" },
    ],
  },
  {
    // Module san TMDT (src/modules/marketplace)
    title: "Sàn TMĐT",
    icon: "store",
    shop: true,
    name: ["marketplace"],
    subModule: [
      { title: "Tài khoản sàn", route: "/marketplace/account/index" },
      { title: "Sản phẩm trên sàn", route: "/marketplace/listing/index" },
    ],
  },
  { title: "QL Liên Hệ", icon: "contact", name: ["contact"], subModule: [{ title: "QL Liên Hệ", route: "/contact/index" }] },
  {
    title: "QL Thành viên",
    icon: "user",
    name: ["user", "permission"],
    subModule: [
      { title: "QL Nhóm Thành Viên", route: "/user/catalogue/index" },
      { title: "QL Thành Viên", route: "/user/index" },
      { title: "QL Quyền", route: "/permission/index" },
    ],
  },
  { title: "QL Banner & Slide", icon: "slide", name: ["slide"], subModule: [{ title: "Cài đặt Slide", route: "/slide/index" }] },
  { title: "QL Menu", icon: "menu", name: ["menu"], subModule: [{ title: "Cài đặt Menu", route: "/menu/index" }] },
  {
    title: "QL Phân phối",
    icon: "distribution",
    name: ["distribution"],
    subModule: [
      { title: "QL Nhà phân phối", route: "/distribution/index" },
      { title: "Khu vực phân phối", route: "/distribution/area/index" },
    ],
  },
  {
    // Bo "QL Đại lý", "Quản lý Giới thiệu", "Quản lý Widget", "Nội dung các khối" (30/10): du lieu WACO cu,
    // website dung trinh dung giao dien; trang va du lieu van giu
    title: "Quản lý Page",
    icon: "home",
    name: ["builder", "floating"],
    subModule: [
      { title: "Trình dựng giao diện", route: "/builder/index" },
      { title: "Nút liên hệ nổi", route: "/floating/index" },
    ],
  },
  {
    title: "Cấu hình chung",
    icon: "settings",
    name: ["language", "system", "site-type"],
    subModule: [
      { title: "Loại website", route: "/site-type/index", root: true },
      { title: "QL Ngôn ngữ", route: "/language/index" },
      { title: "Cấu hình hệ thống", route: "/system/index" },
    ],
  },
];

/** Menu theo loai website (tin tuc: an nhom ban hang) va quyen tai khoan goc (muc root). */
export function sidebarFor({ siteType, root }: { siteType: "shop" | "news"; root: boolean }): SidebarItem[] {
  return sidebar
    .filter((s) => !(s.shop && siteType === "news"))
    .map((s) => (s.subModule ? { ...s, subModule: s.subModule.filter((m) => !m.root || root) } : s));
}
