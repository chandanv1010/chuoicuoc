import "server-only";
import { NextResponse } from "next/server";
import { flash } from "@/lib/flash";
import { now } from "@/lib/helpers";
import { db } from "@/lib/db";
import { validate } from "@/lib/validator";
import type { FormContext, FormRoute } from "@/server/routes";
import { FORM_TS_FIELD, HONEYPOT_FIELD, checkFormToken, clientIp, contentSpamReason, takeRateLimit } from "./antispam";
import { backWithBag, backWithFragment, fit, laravelInput, substrBytes, val } from "./input";
import { sendTelegram, sendWhatsApp, telegramStatus, whatsappStatus } from "@/modules/social/notify";
import { siteName } from "@/lib/site";

/**
 * Form POST cua cac trang tinh WACO (spread vao src/modules/frontend/routes.ts).
 * Khong gui mail: cac controller nay khong goi Mail (ContactService cung da
 * comment dong \Mail::to()).
 */

/** Frontend\DealerRegistrationController@store — POST /dang-ky-dai-ly (tui loi 'dealer'). */
async function dealerStore({ req, input: raw }: FormContext): Promise<Response> {
  const input = laravelInput(raw);
  const errors = await validate(
    input,
    {
      name: "required|string|max:255",
      phone: "required|string|max:50",
      company: "nullable|string|max:255",
      business_area: "nullable|string|max:255",
    },
    {
      "name.required": "Please enter your name.",
      "phone.required": "Please enter your phone number.",
      "phone.max": "The phone number is too long.",
    },
  );
  if (errors) return backWithBag(req, "dealer", errors, input, "dang-ky-dai-ly");

  try {
    // $request->input('source', 'homepage'): mac dinh chi khi KHONG gui truong nay
    const source = "source" in input ? (val(input, "source") ?? "") : "homepage";
    const t = now();
    await db.dealer_registrations.create({
      data: {
        // cot varchar(191)/varchar(50): Laravel (strict=false) de MySQL tu cat
        name: fit(val(input, "name"), 191) ?? "",
        phone: fit(val(input, "phone"), 50) ?? "",
        company: fit(val(input, "company"), 191),
        business_area: fit(val(input, "business_area"), 191),
        status: "new",
        // Ghi lai trang gui don de biet nut keu goi o dau dang hieu qua.
        source: fit(substrBytes(source, 190), 50),
        created_at: t,
        updated_at: t,
      },
    });
  } catch (e) {
    console.error(e); // report($e)
    return backWithBag(
      req,
      "dealer",
      { name: ["Something went wrong while sending your request. Please try again or email us."] },
      input,
      "dang-ky-dai-ly",
    );
  }

  await flash({
    dealer_success: "Thanks! Your request was sent. We will get back to you soon.",
  });
  return backWithFragment(req, "dang-ky-dai-ly");
}

/** Frontend\ContactController@store — POST /contact.html (tui loi 'contact'). */
async function contactStore({ req, input: raw }: FormContext): Promise<Response> {
  const input = laravelInput(raw);
  const errors = await validate(
    input,
    {
      name: "required|string|max:190",
      phone: "required|string|max:50",
      email: "nullable|email|max:190",
      address: "nullable|string|max:190",
      message: "nullable|string|max:5000",
    },
    {
      "name.required": "Enter your name.",
      "phone.required": "Enter your phone number.",
      "email.email": "Enter a valid email address.",
    },
  );
  if (errors) return backWithBag(req, "contact", errors, input, "contact");

  // Chong spam: bot bi chan thi gia vo thanh cong (khong lo cho bot biet), khach that co the
  // bi chan nham (dien qua nhanh / token het han / gui qua nhieu) thi bao loi va giu noi dung.
  const contactThanks = async () => {
    await flash({
      contact_success: `Thanks! Your message has been sent. ${await siteName()} will get back to you within 1–2 business days.`,
    });
    return backWithFragment(req, "contact");
  };
  const ip = clientIp(req);
  const blocked = (reason: string) => {
    console.warn(`[contact] blocked spam (${reason}) ip=${ip} email=${val(input, "email") ?? ""}`);
    return contactThanks();
  };
  if (val(input, HONEYPOT_FIELD)) return blocked("honeypot");
  const tok = checkFormToken(val(input, FORM_TS_FIELD), "contact");
  if (tok === "missing" || tok === "invalid") return blocked(`token ${tok}`);
  if (tok === "fast" || tok === "expired") {
    console.warn(`[contact] retry asked (token ${tok}) ip=${ip}`);
    const msg = tok === "fast" ? "That was quick! Please check your details and press Send again." : "This page was open for a long time. Please press Send again.";
    return backWithBag(req, "contact", { message: [msg] }, input, "contact");
  }
  const spam = contentSpamReason({
    name: val(input, "name"),
    phone: val(input, "phone"),
    email: val(input, "email"),
    address: val(input, "address"),
    message: val(input, "message"),
  });
  if (spam) return blocked(spam);
  const email = val(input, "email")?.toLowerCase();
  if (!takeRateLimit([`contact-ip:${ip}`, ...(email ? [`contact-email:${email}`] : [])])) {
    console.warn(`[contact] rate limited ip=${ip} email=${email ?? ""}`);
    return backWithBag(
      req,
      "contact",
      { message: ["You've sent several messages already. Please wait a few minutes, or email us directly."] },
      input,
      "contact",
    );
  }

  try {
    const t = now();
    await db.contacts.create({
      data: {
        name: val(input, "name"),
        phone: val(input, "phone"),
        // Cot email khong cho NULL nen luu chuoi rong khi khach bo trong.
        email: val(input, "email") ?? "",
        address: val(input, "address"),
        message: val(input, "message"),
        publish: 1,
        type: 1,
        created_at: t,
        updated_at: t,
      },
    });
  } catch (e) {
    console.error(e); // report($e)
    return backWithBag(
      req,
      "contact",
      { name: ["Something went wrong sending your message. Please try again or email us."] },
      input,
      "contact",
    );
  }

  return contactThanks();
}

/**
 * Frontend\ConsultController@store — POST /yeu-cau-tu-van, goi bang fetch tu
 * form cua nut lien he noi (components/site/floating-buttons.tsx). Tra JSON
 * {ok, message} hoac {ok:false, errors:[...]} (422/500).
 */
async function consultStore({ req, input: raw }: FormContext): Promise<Response> {
  const input = laravelInput(raw);
  const errors = await validate(
    input,
    {
      name: "required|string|max:190",
      phone: "required|string|max:50",
      email: "nullable|email|max:190",
      message: "nullable|string|max:2000",
      product: "nullable|string|max:190",
      type: "nullable|string|max:30",
      page: "nullable|string|max:190",
    },
    {
      "name.required": "Please enter your name.",
      "phone.required": "Please enter your phone number.",
      "phone.max": "The phone number is too long.",
    },
  );
  if (errors) {
    return NextResponse.json({ ok: false, errors: Object.values(errors).flat() }, { status: 422 });
  }

  // Chong spam nhu form lien he: honeypot + token thoi gian (SiteFrame ky "consult") + loc noi dung + gioi han
  // tan suat. Bot bi chan thi gia vo thanh cong; khach that dien qua nhanh / mo trang qua lau thi bao gui lai.
  const product = val(input, "product");
  const message = val(input, "message");
  const ip = clientIp(req);
  const tok = checkFormToken(val(input, FORM_TS_FIELD), "consult");
  if (tok === "fast" || tok === "expired") {
    const msg = tok === "fast" ? "That was quick! Please check your details and press Send again." : "This page was open for a long time. Please press Send again.";
    return NextResponse.json({ ok: false, errors: [msg] }, { status: 422 });
  }
  const spam =
    (val(input, HONEYPOT_FIELD) ? "honeypot" : null) ??
    (tok === "ok" ? null : `token ${tok}`) ??
    contentSpamReason({ name: val(input, "name"), phone: val(input, "phone"), message: [product, message].filter(Boolean).join("\n") }) ??
    (takeRateLimit([`consult-ip:${ip}`]) ? null : "rate limit");
  if (spam) {
    console.warn(`[consult] blocked spam (${spam}) ip=${ip}`);
    return NextResponse.json({ ok: true, message: "Thanks! Your request was sent. We will get back to you soon." });
  }

  // Ghi ro san pham va loai yeu cau vao loi nhan de nguoi truc don biet.
  const kind = val(input, "type");
  let loiNhan = kind === "quote" ? "Quote request" : kind === "form" ? "Floating contact form" : kind === "custom" ? "Custom design request" : "Question";
  if (product && product !== "0") loiNhan += ` - product: ${product}`;
  const page = val(input, "page");
  if (page) loiNhan += ` - page: ${page}`;
  if (message && message !== "0") loiNhan += `\n${message}`;

  try {
    const t = now();
    await db.contacts.create({
      data: {
        name: val(input, "name"),
        phone: val(input, "phone"),
        // Cot email khong cho NULL: khach bo trong thi luu chuoi rong.
        email: val(input, "email") ?? "",
        message: loiNhan,
        publish: 1,
        type: 2,
        created_at: t,
        updated_at: t,
      },
    });
  } catch (e) {
    console.error(e); // report($e)
    return NextResponse.json(
      { ok: false, errors: ["Something went wrong while sending your request. Please try again or email us."] },
      { status: 500 },
    );
  }

  // Yeu cau thiet ke rieng (form tren landing): bao ngay cho shop qua Telegram / WhatsApp neu da cau hinh, khong chan khach
  if (kind === "custom") void notifyCustomRequest(val(input, "name") ?? "", val(input, "phone") ?? "", val(input, "email") ?? "", loiNhan);

  return NextResponse.json({
    ok: true,
    message: "Thanks! Your request was sent. We will get back to you soon.",
  });
}

async function notifyCustomRequest(name: string, phone: string, email: string, body: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = [`🧵 Yêu cầu thiết kế riêng từ ${name}`, `📞 ${phone}${email ? ` · ✉️ ${email}` : ""}`, body.slice(0, 900)];
  try {
    const tg = await telegramStatus();
    if (tg.hasToken && tg.chat) await sendTelegram(lines.map(esc).join("\n"));
  } catch (e) {
    console.warn("[consult] telegram:", (e as Error).message);
  }
  try {
    if (whatsappStatus().ready) await sendWhatsApp(lines.join("\n"));
  } catch (e) {
    console.warn("[consult] whatsapp:", (e as Error).message);
  }
}

export const infoRoutes: FormRoute[] = [
  { method: "POST", path: "dang-ky-dai-ly", handler: dealerStore },
  { method: "POST", path: "contact.html", handler: contactStore },
  { method: "POST", path: "yeu-cau-tu-van", handler: consultStore },
];
