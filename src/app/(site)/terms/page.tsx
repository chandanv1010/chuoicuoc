import { SimplePage } from "@/components/site/simple-page";
import { url } from "@/modules/frontend/helpers";
import { supportEmail } from "@/modules/frontend/legal";
import { siteName } from "@/lib/site";
import { STORE } from "@/modules/frontend/store";

/** GET /terms — điều khoản sử dụng / mua bán. */
export default async function TermsPage() {
  const [email, shop] = await Promise.all([supportEmail(), siteName()]);
  const seo = {
    meta_title: "Điều khoản sử dụng",
    meta_keyword: "",
    meta_description: `Điều khoản và điều kiện khi mua hàng tại ${shop}.`,
    meta_image: "",
    canonical: url("terms"),
  };
  return (
    <SimplePage seo={seo} title="Điều khoản sử dụng" updated={STORE.legalUpdated}>
      <p>
        Điều khoản này điều chỉnh việc bạn sử dụng website {shop} và việc mua hàng từ chúng tôi. Khi sử dụng website hoặc đặt hàng,
        bạn đồng ý với các điều khoản này.
      </p>

      <h2>1. Về chúng tôi</h2>
      <p>{shop} sản xuất và cung cấp các loại chổi cước công nghiệp, nhận gia công theo yêu cầu và giao hàng trên toàn quốc.</p>

      <h2>2. Tài khoản</h2>
      <p>
        Bạn chịu trách nhiệm bảo mật mật khẩu và các hoạt động dưới tài khoản của mình. Vui lòng cung cấp thông tin liên hệ và giao hàng
        chính xác.
      </p>

      <h2>3. Đơn hàng và giá</h2>
      <ul>
        <li>Giá hiển thị bằng VND. Chúng tôi có thể điều chỉnh các lỗi giá rõ ràng trước khi xác nhận đơn.</li>
        <li>Đơn hàng được chấp nhận khi chúng tôi xác nhận qua điện thoại hoặc email. Chúng tôi có thể từ chối đơn, ví dụ khi hết hàng.</li>
        <li>Với hàng gia công theo yêu cầu, số lượng và thời gian sản xuất được thống nhất khi đặt hàng.</li>
      </ul>

      <h2>4. Hàng theo yêu cầu</h2>
      <p>
        Sản phẩm gia công được làm theo thông số bạn cung cấp (kích thước, loại sợi, kiểu trục). Vui lòng kiểm tra kỹ thông số trước khi
        xác nhận sản xuất.
      </p>

      <h2>5. Giao hàng</h2>
      <p>
        Thời gian giao hàng là ước tính và có thể bị ảnh hưởng bởi đơn vị vận chuyển. Rủi ro mất mát chuyển sang bạn khi hàng được giao
        đến địa chỉ bạn cung cấp.
      </p>

      <h2>6. Đổi trả và sự cố</h2>
      <p>
        Vì nhiều sản phẩm được làm theo yêu cầu, chúng tôi không nhận đổi trả vì lý do đổi ý với hàng gia công. Nếu sản phẩm bị lỗi,
        hư hỏng hoặc khác với đơn đặt, vui lòng liên hệ trong vòng 30 ngày để được đổi hoặc hoàn tiền.
      </p>

      <h2>7. Nội dung bạn gửi</h2>
      <p>
        Khi gửi đánh giá, hình ảnh hoặc tin nhắn, bạn cho phép chúng tôi hiển thị nội dung đó trên website. Không gửi nội dung vi phạm
        pháp luật, phản cảm hoặc gây hiểu lầm; chúng tôi có thể gỡ bỏ.
      </p>

      <h2>8. Sở hữu trí tuệ</h2>
      <p>Hình ảnh, nội dung trên website thuộc về {shop} trừ khi có ghi chú khác và không được sao chép khi chưa được phép.</p>

      <h2>9. Giới hạn trách nhiệm</h2>
      <p>
        Trong phạm vi pháp luật cho phép, tổng trách nhiệm của chúng tôi cho mỗi khiếu nại liên quan đến một sản phẩm được giới hạn ở số tiền
        bạn đã trả cho sản phẩm đó.
      </p>

      <h2>10. Thay đổi</h2>
      <p>Chúng tôi có thể cập nhật điều khoản này. Phiên bản có hiệu lực tại thời điểm bạn đặt hàng sẽ áp dụng cho đơn hàng đó.</p>

      <h2>11. Liên hệ</h2>
      <p>
        Thắc mắc về điều khoản: <a href={`mailto:${email}`}>{email}</a>. Xem thêm <a href="/privacy-policy">Chính sách bảo mật</a>.
      </p>
    </SimplePage>
  );
}
