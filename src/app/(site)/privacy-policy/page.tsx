import { SimplePage } from "@/components/site/simple-page";
import { url } from "@/modules/frontend/helpers";
import { supportEmail } from "@/modules/frontend/legal";
import { STORE } from "@/modules/frontend/store";

/** GET /privacy-policy — chinh sach quyen rieng tu (yeu cau khi dang ky app Meta/TikTok/Google/Pinterest). */
export default async function PrivacyPolicyPage() {
  const email = await supportEmail();
  const seo = {
    meta_title: "Privacy Policy",
    meta_keyword: "",
    meta_description: `How CustomStitch House collects, uses and protects your personal information.`,
    meta_image: "",
    canonical: url("privacy-policy"),
  };
  return (
    <SimplePage seo={seo} title="Privacy Policy" updated={STORE.legalUpdated}>
      <p>
        This Privacy Policy explains how CustomStitch House (&quot;we&quot;, &quot;us&quot;), a small embroidery business based in Vietnam, collects, uses and
        protects personal information when you visit this website, create an account, place an order, or interact with us on social media.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account and order information:</strong> your name, email address, phone number, shipping address, order details, and any
          personalization text or notes you provide.
        </li>
        <li>
          <strong>Reviews and messages:</strong> content you submit in product reviews or through our contact form, including optional photos.
        </li>
        <li>
          <strong>Technical information:</strong> a session cookie that keeps your cart and sign-in working, and basic server logs (IP address,
          browser type, pages requested) used for security and troubleshooting.
        </li>
        <li>
          <strong>Social media data:</strong> if you interact with us through Facebook, Instagram, TikTok, Google/YouTube or Pinterest, or if an
          account is connected to our publishing tools, we may receive the information that platform shares with us (such as your public
          profile name, account ID, and permissions you grant). We only use it for the purpose you authorized.
        </li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To process, personalize, ship and support your orders.</li>
        <li>To communicate with you about your order or your questions.</li>
        <li>To publish and manage our own product posts on connected social media accounts.</li>
        <li>To keep the website secure and to comply with legal obligations.</li>
      </ul>
      <p>We do not sell your personal information, and we do not use it for third-party advertising.</p>

      <h2>3. Pinterest and other social media integrations</h2>
      <p>
        CustomStitch House uses an app connected to the Pinterest API (and similar official APIs from Meta, TikTok and Google/YouTube) only to publish
        and manage content on <strong>our own business accounts</strong>. The app is used by our team; it is not offered to the public and does
        not access other people&apos;s Pinterest accounts.
      </p>
      <ul>
        <li>
          <strong>What the app does:</strong> when we add or update a product in our store, it creates a Pin on one of our own boards with the
          product photo, title, description and a link back to the product page on this website.
        </li>
        <li>
          <strong>Permissions requested from Pinterest:</strong> <code>boards:read</code> (to choose which of our boards to post to),{" "}
          <code>pins:read</code> and <code>pins:write</code> (to create and check our own Pins), and <code>user_accounts:read</code> (to show
          which of our accounts is connected).
        </li>
        <li>
          <strong>What we store:</strong> the OAuth access and refresh tokens for our own account (encrypted with AES-256), the account name and
          ID, our board names and IDs, and the IDs and links of the Pins we create. We do not store data about other Pinterest users, their
          Pins, followers or messages.
        </li>
        <li>
          <strong>Sharing:</strong> Pinterest data is not sold, shared with third parties, or used for advertising or profiling.
        </li>
        <li>
          <strong>Revoking access and deletion:</strong> the connection can be removed at any time from our admin panel or from Pinterest
          (Settings → Security and logins → Apps). When it is removed we delete the stored tokens. To ask us to delete any data, email us or use
          our <a href="/data-deletion">Data Deletion</a> page.
        </li>
      </ul>

      <h2>4. Sharing</h2>
      <p>
        We share information only with service providers needed to run the shop — for example shipping carriers (to deliver your package),
        hosting providers, and payment or banking partners — and only as much as they need. We may also disclose information if required by
        law.
      </p>

      <h2>5. International transfers</h2>
      <p>
        CustomStitch House operates from Vietnam and ships to the United States. Your information may be stored and processed in Vietnam and in the
        countries where our service providers operate.
      </p>

      <h2>6. Retention</h2>
      <p>
        We keep order records for as long as needed for accounting, tax and warranty purposes (generally up to 5 years). Account information
        is kept until you delete your account or ask us to delete it. Tokens for connected social accounts are deleted when the connection is
        removed.
      </p>

      <h2>7. Your rights and choices</h2>
      <p>
        You can view and update your profile in <a href="/account.html">Your Account</a>. You may ask us to access, correct or delete your
        personal information at any time — see our <a href="/data-deletion">Data Deletion</a> page. California residents may request the
        categories of personal information we hold; we do not sell or share personal information for cross-context behavioral advertising.
      </p>

      <h2>8. Children</h2>
      <p>Our website is not directed to children under 13, and we do not knowingly collect their personal information.</p>

      <h2>9. Security</h2>
      <p>Passwords are stored as one-way hashes, and access to customer data is limited to the people who need it to fulfil orders.</p>

      <h2>10. Changes</h2>
      <p>We may update this policy from time to time. The &quot;Last updated&quot; date above shows when it last changed.</p>

      <h2>11. Contact</h2>
      <p>
        Questions about privacy? Email us at <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </SimplePage>
  );
}
