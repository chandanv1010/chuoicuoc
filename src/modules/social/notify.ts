import "server-only";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { siteName } from "@/lib/site";
import { env, publicBaseUrl } from "./config";
import { INBOX_KIND_LABEL, INBOX_PLATFORM_LABEL } from "./inbox";

/**
 * Bao khach can tu van qua Telegram Bot API (https://core.telegram.org/bots/api).
 *  - TELEGRAM_BOT_TOKEN trong .env (tao bot bang @BotFather).
 *  - Chat nhan tin: TELEGRAM_CHAT_ID trong .env, hoac bam "Ket noi Telegram" o trang Binh luan & tin nhan
 *    sau khi da nhan /start cho bot -> lay chat tu getUpdates, luu vao social_settings.
 *  - Chi bao lead moi tu luc ket noi (telegram_since), moi lead mot lan (social_messages.notified_at).
 * Bao them qua WhatsApp (tuy chon) bang CallMeBot (https://www.callmebot.com/blog/free-api-whatsapp-messages/):
 *  - mien phi, chi gui ve so cua chinh minh; CALLMEBOT_WHATSAPP_PHONE (+84...) + CALLMEBOT_WHATSAPP_APIKEY trong .env.
 *  - dich vu ben thu ba khong chinh thuc: loi WhatsApp khong chan Telegram va nguoc lai.
 */

const MAX_PER_RUN = 10;

export async function getSetting(k: string) {
  const r = await db.$queryRaw<{ v: string | null }[]>`SELECT v FROM social_settings WHERE k = ${k} LIMIT 1`;
  return r[0]?.v ?? null;
}

export async function setSetting(k: string, v: string | null) {
  await db.$executeRaw`INSERT INTO social_settings (k, v, updated_at) VALUES (${k}, ${v}, ${now()}) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = VALUES(updated_at)`;
}

const botToken = () => env("TELEGRAM_BOT_TOKEN");

async function chatId() {
  return env("TELEGRAM_CHAT_ID") || (await getSetting("telegram_chat_id"));
}

export async function telegramStatus() {
  const token = botToken();
  const chat = token ? await chatId() : null;
  return { hasToken: Boolean(token), chat, chatName: chat ? await getSetting("telegram_chat_name") : null, since: await getSetting("telegram_since") };
}

type TgResult<T> = { ok: boolean; result?: T; description?: string };

async function tg<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = botToken();
  if (!token) throw new Error("Chưa có TELEGRAM_BOT_TOKEN trong .env");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as TgResult<T>;
  // khong dua token vao thong bao loi
  if (!j.ok) throw new Error(`Telegram: ${j.description ?? res.status}`);
  return j.result as T;
}

type Update = { message?: { chat: { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string } } };

/** Lay chat moi nhat da nhan tin cho bot (nguoi dung bam /start truoc) va luu lai. */
export async function connectTelegram() {
  const updates = await tg<Update[]>("getUpdates", { limit: 100, allowed_updates: ["message"] });
  const chat = [...updates].reverse().find((u) => u.message)?.message?.chat;
  if (!chat) throw new Error("Bot chưa nhận được tin nào. Mở Telegram, tìm bot của bạn, bấm Start (hoặc gửi /start) rồi bấm lại nút này.");
  const name = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id);
  await setSetting("telegram_chat_id", String(chat.id));
  await setSetting("telegram_chat_name", name);
  // chi bao lead tu bay gio tro di (khong ban lai lead cu)
  await setSetting("telegram_since", now().toISOString().slice(0, 19).replace("T", " "));
  const shop = (await siteName()).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await sendTelegram(`✅ Đã kết nối thông báo khách cần tư vấn của <b>${shop}</b>.\nTừ giờ có khách để lại SĐT, hỏi giá hoặc muốn đặt hàng, bot sẽ báo ở đây.`);
  return name;
}

/* ---------------- WhatsApp (CallMeBot) ---------------- */

const waPhone = () => env("CALLMEBOT_WHATSAPP_PHONE").replace(/[^\d+]/g, "");
const waKey = () => env("CALLMEBOT_WHATSAPP_APIKEY");

export const whatsappStatus = () => ({ ready: Boolean(waPhone() && waKey()), phone: waPhone() ? `…${waPhone().slice(-4)}` : null });

export async function sendWhatsApp(text: string) {
  if (!waPhone() || !waKey()) throw new Error("Chưa có CALLMEBOT_WHATSAPP_PHONE / CALLMEBOT_WHATSAPP_APIKEY trong .env");
  const q = new URLSearchParams({ phone: waPhone(), text, apikey: waKey() });
  const res = await fetch(`https://api.callmebot.com/whatsapp.php?${q}`, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  const body = (await res.text().catch(() => "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // CallMeBot tra HTML; loi thuong la "APIKey is invalid" / "ERROR" — khong dua apikey vao thong bao
  if (!res.ok || /invalid|error|not allowed|blocked/i.test(body)) throw new Error(`WhatsApp (CallMeBot): ${body.slice(0, 160) || `HTTP ${res.status}`}`);
}

/** Moc bat dau bao: lan ket noi Telegram, hoac lan dau bat WhatsApp (khong ban lai khach cu). */
async function notifySince() {
  const since = await getSetting("telegram_since");
  if (since || !whatsappStatus().ready) return since;
  const t = now().toISOString().slice(0, 19).replace("T", " ");
  await setSetting("telegram_since", t);
  return t;
}

export async function sendTelegram(html: string) {
  const chat = await chatId();
  if (!chat) throw new Error("Chưa kết nối chat Telegram");
  await tg("sendMessage", { chat_id: chat, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type LeadRow = {
  id: bigint;
  platform: string;
  kind: string;
  author_name: string | null;
  message: string | null;
  phones: string | null;
  emails: string | null;
  lead_reasons: string | null;
  permalink: string | null;
  product_name: string | null;
};

function leadLinks(r: LeadRow) {
  const admin = `${publicBaseUrl()}/social/inbox/index`;
  const link = r.permalink?.startsWith("http") ? r.permalink : `${publicBaseUrl()}${r.permalink ?? "/social/inbox/index"}`;
  return { admin, link };
}

/** Ban WhatsApp: chu thuong, *dam*, link de tran. */
function leadText(r: LeadRow) {
  const { admin, link } = leadLinks(r);
  return [
    `🔔 *Khách cần tư vấn* — ${INBOX_PLATFORM_LABEL[r.platform] ?? r.platform} · ${INBOX_KIND_LABEL[r.kind] ?? r.kind}`,
    `👤 ${r.author_name || "Ẩn danh"}`,
    `💬 ${(r.message ?? "").slice(0, 600)}`,
    r.phones ? `📞 *${r.phones}*` : null,
    r.emails ? `✉️ ${r.emails}` : null,
    r.product_name ? `🛍 ${r.product_name}` : null,
    r.lead_reasons ? `🏷 ${r.lead_reasons}` : null,
    `🔗 ${link}`,
    `🗂 ${admin}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function leadMessage(r: LeadRow) {
  const { admin, link } = leadLinks(r);
  return [
    `🔔 <b>Khách cần tư vấn</b> — ${esc(INBOX_PLATFORM_LABEL[r.platform] ?? r.platform)} · ${esc(INBOX_KIND_LABEL[r.kind] ?? r.kind)}`,
    `👤 ${esc(r.author_name || "Ẩn danh")}`,
    `💬 ${esc((r.message ?? "").slice(0, 600))}`,
    r.phones ? `📞 <b>${esc(r.phones)}</b>` : null,
    r.emails ? `✉️ ${esc(r.emails)}` : null,
    r.product_name ? `🛍 ${esc(r.product_name)}` : null,
    r.lead_reasons ? `🏷 ${esc(r.lead_reasons)}` : null,
    `🔗 <a href="${esc(link)}">Mở để trả lời</a> · <a href="${esc(admin)}">Xem trong admin</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Gui lead moi chua bao (goi sau moi luot dong bo). Tra ve so lead da bao. Chua cau hinh -> bo qua im lang. */
export async function notifyNewLeads(): Promise<number> {
  const st = await telegramStatus();
  const tgOn = Boolean(st.hasToken && st.chat);
  const waOn = whatsappStatus().ready;
  const since = await notifySince();
  if ((!tgOn && !waOn) || !since) return 0;
  const rows = await db.$queryRaw<LeadRow[]>`
    SELECT m.id, m.platform, m.kind, m.author_name, m.message, m.phones, m.emails, m.lead_reasons, m.permalink, pl.name AS product_name
    FROM social_messages m
    LEFT JOIN product_language pl ON pl.product_id = m.product_id AND pl.language_id = (SELECT MIN(language_id) FROM product_language WHERE product_id = m.product_id)
    WHERE m.is_lead = 1 AND m.from_page = 0 AND m.status = 'new' AND m.notified_at IS NULL AND m.created_at >= ${since}
    ORDER BY m.created_time, m.id LIMIT ${MAX_PER_RUN + 1}`;
  let sent = 0;
  for (const r of rows.slice(0, MAX_PER_RUN)) {
    // tung kenh rieng: mot kenh loi van bao kenh kia; ca hai loi -> nem loi, de luot sau thu lai
    const errors: string[] = [];
    if (tgOn) await sendTelegram(leadMessage(r)).catch((e: Error) => errors.push(e.message));
    if (waOn) await sendWhatsApp(leadText(r)).catch((e: Error) => errors.push(e.message));
    if (errors.length === Number(tgOn) + Number(waOn)) throw new Error(errors.join(" | "));
    if (errors.length) console.warn("[social] notify:", errors.join(" | "));
    await db.$executeRaw`UPDATE social_messages SET notified_at = ${now()} WHERE id = ${r.id}`;
    sent++;
  }
  if (rows.length > MAX_PER_RUN) {
    if (tgOn) await sendTelegram(`…và còn khách khác. <a href="${esc(publicBaseUrl())}/social/inbox/index">Xem tất cả trong admin</a>`).catch(() => {});
    if (waOn) await sendWhatsApp(`…và còn khách khác: ${publicBaseUrl()}/social/inbox/index`).catch(() => {});
  }
  return sent;
}
