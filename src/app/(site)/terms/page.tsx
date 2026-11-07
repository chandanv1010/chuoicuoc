import { SimplePage } from "@/components/site/simple-page";
import { url } from "@/modules/frontend/helpers";
import { supportEmail } from "@/modules/frontend/legal";
import { STORE } from "@/modules/frontend/store";

/** GET /terms — dieu khoan su dung / ban hang. */
export default async function TermsPage() {
  const email = await supportEmail();
  const seo = {
    meta_title: "Terms of Service",
    meta_keyword: "",
    meta_description: `Terms and conditions for shopping with CustomStitch House.`,
    meta_image: "",
    canonical: url("terms"),
  };
  return (
    <SimplePage seo={seo} title="Terms of Service" updated={STORE.legalUpdated}>
      <p>
        These Terms of Service govern your use of the CustomStitch House website and any purchase you make from us. By using the site or placing an
        order, you agree to these terms.
      </p>

      <h2>1. About us</h2>
      <p>
        CustomStitch House is a small business in Vietnam that makes machine-embroidered hats, napkins and related products and ships them
        internationally, mainly to the United States.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for keeping your password confidential and for activity under your account. Please give accurate contact and
        shipping information.
      </p>

      <h2>3. Orders and pricing</h2>
      <ul>
        <li>All prices are shown in US dollars (USD). We may correct obvious pricing errors before an order is confirmed.</li>
        <li>An order is accepted when we confirm it by email or phone. We may decline an order, for example if an item is unavailable.</li>
        <li>Import duties or taxes charged by your country, if any, are the buyer&apos;s responsibility unless stated otherwise.</li>
      </ul>

      <h2>4. Personalized items</h2>
      <p>
        Personalized items are made to your instructions. Please check spelling carefully — we embroider the text exactly as provided. You
        must have the right to use any names, logos or designs you ask us to embroider.
      </p>

      <h2>5. Shipping</h2>
      <p>
        Delivery estimates are not guaranteed and may be affected by customs or carrier delays. Risk of loss passes to you when the package
        is delivered to the address you provided.
      </p>

      <h2>6. Returns and problems</h2>
      <p>
        Because items are made to order, we do not accept returns for change of mind on personalized items. If your item arrives damaged,
        defective or different from what you ordered, contact us within 30 days of delivery and we will offer a replacement or refund.
      </p>

      <h2>7. Reviews and content you submit</h2>
      <p>
        By submitting a review, photo or message, you allow us to display it on our website and social media. Do not submit unlawful,
        offensive or misleading content; we may remove it.
      </p>

      <h2>8. Intellectual property</h2>
      <p>Designs, photos and text on this website belong to CustomStitch House unless otherwise noted and may not be copied without permission.</p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the extent permitted by law, our total liability for any claim relating to a product is limited to the amount you paid for that
        product.
      </p>

      <h2>10. Changes</h2>
      <p>We may update these terms. The version in effect when you place an order applies to that order.</p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${email}`}>{email}</a>. See also our <a href="/privacy-policy">Privacy Policy</a>.
      </p>
    </SimplePage>
  );
}
