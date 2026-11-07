import { SimplePage } from "@/components/site/simple-page";
import { url } from "@/modules/frontend/helpers";
import { supportEmail } from "@/modules/frontend/legal";
import { siteName } from "@/lib/site";
import { STORE } from "@/modules/frontend/store";

/** GET /privacy-policy — chính sách bảo mật. */
export default async function PrivacyPolicyPage() {
  const [email, shop] = await Promise.all([supportEmail(), siteName()]);
  const seo = {
    meta_title: "Chính sách bảo mật",
    meta_keyword: "",
    meta_description: `${shop} thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn như thế nào.`,
    meta_image: "",
    canonical: url("privacy-policy"),
  };
  return (
    <SimplePage seo={seo} title="Chính sách bảo mật" updated={STORE.legalUpdated}>
      <p>
        Chính sách này giải thích cách {shop} thu thập, sử dụng và bảo vệ thông tin cá nhân khi bạn truy cập website, tạo tài khoản,
        gửi yêu cầu tư vấn hoặc đặt hàng.
      </p>

      <h2>1. Thông tin chúng tôi thu thập</h2>
      <ul>
        <li>
          <strong>Thông tin liên hệ và đơn hàng:</strong> họ tên, email, số điện thoại, địa chỉ, nội dung yêu cầu và thông tin đơn hàng.
        </li>
        <li>
          <strong>Nội dung bạn gửi:</strong> tin nhắn qua biểu mẫu liên hệ, đánh giá sản phẩm và hình ảnh kèm theo (nếu có).
        </li>
        <li>
          <strong>Thông tin kỹ thuật:</strong> cookie phiên để giữ đăng nhập, và nhật ký máy chủ cơ bản (địa chỉ IP, loại trình duyệt)
          phục vụ bảo mật và xử lý sự cố.
        </li>
      </ul>

      <h2>2. Mục đích sử dụng</h2>
      <ul>
        <li>Tư vấn, báo giá, xử lý và giao đơn hàng của bạn.</li>
        <li>Liên hệ với bạn về đơn hàng hoặc câu hỏi của bạn.</li>
        <li>Bảo đảm an toàn cho website và tuân thủ quy định pháp luật.</li>
      </ul>
      <p>Chúng tôi không bán thông tin cá nhân của bạn và không dùng cho quảng cáo của bên thứ ba.</p>

      <h2>3. Chia sẻ thông tin</h2>
      <p>
        Chúng tôi chỉ chia sẻ thông tin với các đơn vị cần thiết để vận hành cửa hàng — ví dụ đơn vị vận chuyển (để giao hàng),
        nhà cung cấp hạ tầng, đối tác thanh toán — và chỉ ở mức cần thiết. Chúng tôi có thể cung cấp thông tin khi pháp luật yêu cầu.
      </p>

      <h2>4. Lưu trữ</h2>
      <p>
        Chúng tôi lưu hồ sơ đơn hàng trong thời gian cần thiết cho mục đích kế toán, thuế và bảo hành (thường tới 5 năm). Thông tin
        tài khoản được giữ cho đến khi bạn xóa tài khoản hoặc yêu cầu xóa.
      </p>

      <h2>5. Quyền của bạn</h2>
      <p>
        Bạn có thể xem và cập nhật hồ sơ trong <a href="/account.html">Tài khoản</a>. Bạn có thể yêu cầu truy cập, chỉnh sửa hoặc xóa thông tin
        cá nhân bất cứ lúc nào — xem trang <a href="/data-deletion">Xóa dữ liệu</a>.
      </p>

      <h2>6. Bảo mật</h2>
      <p>Mật khẩu được lưu dưới dạng băm một chiều, và chỉ những người cần thiết để xử lý đơn hàng mới được truy cập dữ liệu khách hàng.</p>

      <h2>7. Thay đổi</h2>
      <p>Chúng tôi có thể cập nhật chính sách này. Ngày &quot;Cập nhật lần cuối&quot; ở trên cho biết lần thay đổi gần nhất.</p>

      <h2>8. Liên hệ</h2>
      <p>
        Thắc mắc về quyền riêng tư? Gửi email cho chúng tôi tại <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </SimplePage>
  );
}
