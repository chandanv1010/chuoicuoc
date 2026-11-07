import { SimplePage } from "@/components/site/simple-page";
import { url } from "@/modules/frontend/helpers";
import { supportEmail } from "@/modules/frontend/legal";
import { siteName } from "@/lib/site";
import { STORE } from "@/modules/frontend/store";

/** GET /data-deletion — huong dan yeu cau xoa du lieu (Data Deletion Instructions URL cho Meta/TikTok/Google/Pinterest). */
export default async function DataDeletionPage() {
  const shop = await siteName();
  const email = await supportEmail();
  const seo = {
    meta_title: "Data Deletion Instructions",
    meta_keyword: "",
    meta_description: `How to request deletion of your personal data held by ${shop}.`,
    meta_image: "",
    canonical: url("data-deletion"),
  };
  const subject = encodeURIComponent("Data deletion request");
  return (
    <SimplePage seo={seo} title="Data Deletion Instructions" updated={STORE.legalUpdated}>
      <p>You can ask {shop} to delete the personal data we hold about you at any time. There is no charge.</p>

      <h2>How to request deletion</h2>
      <ol>
        <li>
          Send an email to <a href={`mailto:${email}?subject=${subject}`}>{email}</a> with the subject &quot;Data deletion request&quot;.
        </li>
        <li>
          Include the email address of your {shop} account (or the email/phone used on your orders). If your request concerns a social
          media account, include the platform (Facebook, Instagram, TikTok, Google/YouTube or Pinterest) and your username or profile link.
        </li>
        <li>We may reply to confirm the request comes from you before deleting anything.</li>
        <li>We complete deletion within 30 days and email you a confirmation.</li>
      </ol>

      <h2>What we delete</h2>
      <ul>
        <li>Your customer account: name, email, phone, address, password hash and profile photo.</li>
        <li>Messages you sent through our contact form and reviews you posted (including photos).</li>
        <li>Your shopping cart and session data.</li>
        <li>
          <strong>Data from connected social accounts:</strong> any profile information, account IDs and access tokens we received from Meta
          (Facebook/Instagram), TikTok, Google/YouTube or Pinterest when you connected or interacted with our app. Access tokens are revoked
          and removed, and we stop accessing that account.
        </li>
      </ul>

      <h2>What we may keep</h2>
      <p>
        Records of completed orders (items, amounts, dates and shipping details) may be kept for up to 5 years where required for accounting,
        tax or fraud prevention. These records are not used for marketing and are deleted when no longer required.
      </p>

      <h2>Removing app access yourself</h2>
      <p>
        You can also disconnect {shop} from your social accounts in each platform&apos;s settings (for example Facebook: Settings &amp;
        privacy → Settings → Apps and websites; TikTok, Google and Pinterest have similar &quot;connected apps&quot; pages). Disconnecting stops
        new data from being shared; email us to delete data we already received.
      </p>

      <p>
        See our <a href="/privacy-policy">Privacy Policy</a> for more details.
      </p>
    </SimplePage>
  );
}
