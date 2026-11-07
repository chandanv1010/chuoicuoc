import { SimplePage } from "@/components/site/simple-page";
import { url } from "@/modules/frontend/helpers";
import { supportEmail } from "@/modules/frontend/legal";
import { siteName } from "@/lib/site";
import { STORE } from "@/modules/frontend/store";

/** GET /data-deletion — hướng dẫn yêu cầu xóa dữ liệu. */
export default async function DataDeletionPage() {
  const shop = await siteName();
  const email = await supportEmail();
  const seo = {
    meta_title: "Hướng dẫn xóa dữ liệu",
    meta_keyword: "",
    meta_description: `Cách yêu cầu xóa dữ liệu cá nhân mà ${shop} đang lưu giữ.`,
    meta_image: "",
    canonical: url("data-deletion"),
  };
  const subject = encodeURIComponent("Yêu cầu xóa dữ liệu");
  return (
    <SimplePage seo={seo} title="Hướng dẫn xóa dữ liệu" updated={STORE.legalUpdated}>
      <p>Bạn có thể yêu cầu {shop} xóa dữ liệu cá nhân mà chúng tôi lưu giữ về bạn bất cứ lúc nào. Hoàn toàn miễn phí.</p>

      <h2>Cách yêu cầu xóa dữ liệu</h2>
      <ol>
        <li>
          Gửi email đến <a href={`mailto:${email}?subject=${subject}`}>{email}</a> với tiêu đề &quot;Yêu cầu xóa dữ liệu&quot;.
        </li>
        <li>Ghi rõ email của tài khoản {shop} (hoặc email/số điện thoại bạn đã dùng khi đặt hàng).</li>
        <li>Chúng tôi có thể trả lời để xác minh yêu cầu đến từ chính bạn trước khi xóa.</li>
        <li>Chúng tôi hoàn tất việc xóa trong vòng 30 ngày và gửi email xác nhận.</li>
      </ol>

      <h2>Chúng tôi xóa những gì</h2>
      <ul>
        <li>Tài khoản khách hàng: họ tên, email, số điện thoại, địa chỉ, mật khẩu (dạng băm) và ảnh đại diện.</li>
        <li>Tin nhắn bạn gửi qua biểu mẫu liên hệ và đánh giá bạn đã đăng (kèm hình ảnh).</li>
        <li>Dữ liệu phiên của bạn trên website.</li>
      </ul>

      <h2>Chúng tôi có thể giữ lại</h2>
      <p>
        Hồ sơ đơn hàng đã hoàn tất (sản phẩm, số tiền, ngày và thông tin giao hàng) có thể được lưu tới 5 năm khi cần cho mục đích kế toán,
        thuế hoặc chống gian lận. Các hồ sơ này không dùng cho tiếp thị và sẽ được xóa khi không còn cần thiết.
      </p>

      <p>
        Xem thêm <a href="/privacy-policy">Chính sách bảo mật</a> để biết chi tiết.
      </p>
    </SimplePage>
  );
}
