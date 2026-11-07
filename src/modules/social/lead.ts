/**
 * Nhan dien "khach can tu van" trong binh luan / tin nhan (dung ca server lan client, khong import server).
 * Lead khi: co so dien thoai, co email, hoac co tu khoa hoi gia / dat hang / nhan tin (Anh + Viet).
 * Tin nhan rieng (inbox) cua khach luon tinh la lead vi khach da chu dong lien he.
 */
import { ownLinkPattern } from "@/lib/constants";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Chuoi so co the co +, khoang trang, (), -, . — loc lai theo so chu so (9–15). */
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,18}\d)/g;

const INTENT: [string, RegExp][] = [
  ["nhắn tin", /\b(inbox|ib|dm|pm|message me|msg me|text me|call me|contact me|reach me|check (your|ur) dm|sent (you )?a (dm|message))\b|nhắn tin|inbox|ib mình|ib em|ib shop|liên hệ|gọi (cho|lại)|zalo|whats ?app|telegram/i],
  ["hỏi giá", /\b(price|pricing|how much|cost|quote|\$\$)\b|giá|bao nhiêu|nhiêu tiền|bn tiền/i],
  ["muốn đặt", /\b(order|buy|purchase|want (one|this|it|to order)|i'?ll take|need (one|this|\d+)|bulk|wholesale|custom(i[sz]e)?|personali[sz]e|make (one|me)|can you (make|do|embroider|stitch)|do you (ship|make|do|have))\b|đặt (hàng|may|thêu)?|mua|order|thêu (cho|tên|logo)|làm (cho|giúp)|tư vấn|ship/i],
  ["hỏi thông tin", /\b(available|in stock|size|sizes|color|colors|colour|shipping|deliver|how long|when (can|will)|is (this|it) (still )?available)\b|còn hàng|size|màu|giao hàng|bao lâu/i],
];

export type LeadInfo = { isLead: boolean; reasons: string[]; phones: string[]; emails: string[] };

export function findPhones(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(PHONE_RE) ?? []) {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) continue;
    // bo nam / ngay thang kieu 2026-10-27, gia tien kieu 1.250.000
    if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(m.trim())) continue;
    if (/^\d{1,3}([.,]\d{3}){2,}$/.test(m.trim())) continue;
    out.add(m.trim());
  }
  return [...out];
}

export function findEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
}

export function detectLead(text: string, opts: { phone?: string | null; email?: string | null; kind?: string; fromPage?: boolean } = {}): LeadInfo {
  const phones = findPhones(text);
  const emails = findEmails(text);
  if (opts.phone?.trim() && !phones.includes(opts.phone.trim())) phones.unshift(opts.phone.trim());
  if (opts.email?.trim() && !emails.includes(opts.email.trim().toLowerCase())) emails.unshift(opts.email.trim().toLowerCase());
  if (opts.fromPage) return { isLead: false, reasons: [], phones, emails };
  const reasons: string[] = [];
  if (phones.length) reasons.push("có SĐT");
  if (emails.length) reasons.push("có email");
  for (const [label, re] of INTENT) if (re.test(text)) reasons.push(label);
  if (opts.kind === "message") reasons.unshift("inbox");
  if (opts.kind === "contact") reasons.unshift("form liên hệ");
  return { isLead: reasons.length > 0, reasons, phones, emails };
}

/**
 * Spam thuong gap duoi bai cua shop nho: link la, ru dau tu / tien ao, ban follow, "check my profile".
 * Tra ve ly do (de hien tren admin) hoac null. Chu y khong bat nham khach that: link toi ten mien cua site / etsy duoc bo qua.
 */
const SPAM: [string, RegExp][] = [
  ["link lạ", /(https?:\/\/|www\.|\b(bit\.ly|tinyurl|t\.me|wa\.me|linktr\.ee|cutt\.ly|shorturl)\b)/i],
  ["đầu tư / tiền ảo", /\b(crypto|bitcoin|btc|forex|invest(ment|ing)?|trading|binary option|profit daily|passive income|earn \$?\d+)\b/i],
  ["bán follow / quảng cáo", /\b(followers?|promote (your|ur)|promotion|shoutout|collab(oration)? (dm|inbox)|ambassador|brand rep|send (a )?pic)\b/i],
  ["lừa đảo", /\b(sugar (daddy|mommy)|check my (profile|bio)|claim (your )?(prize|gift)|you('| ha)ve won|giveaway winner|verify your (page|account)|page (will be|is) (disabled|suspended)|copyright violation)\b/i],
];
const SAFE_LINK = ownLinkPattern(String.raw`etsy\.com/(shop|listing)`);

export function detectSpam(text: string): string | null {
  for (const [label, re] of SPAM) {
    if (label === "link lạ" && SAFE_LINK.test(text) && !/(bit\.ly|t\.me|wa\.me)/i.test(text)) continue;
    if (re.test(text)) return label;
  }
  return null;
}

/** Chia doan van ban thanh cac phan thuong / SĐT / email de to sang tren trang admin. */
export function splitContacts(text: string): { t: string; type?: "phone" | "email" }[] {
  const marks: { start: number; end: number; type: "phone" | "email" }[] = [];
  for (const m of text.matchAll(EMAIL_RE)) marks.push({ start: m.index!, end: m.index! + m[0].length, type: "email" });
  const phones = new Set(findPhones(text));
  for (const m of text.matchAll(PHONE_RE)) {
    if (!phones.has(m[0].trim())) continue;
    const start = m.index!;
    if (marks.some((x) => start < x.end && start + m[0].length > x.start)) continue;
    marks.push({ start, end: start + m[0].length, type: "phone" });
  }
  marks.sort((a, b) => a.start - b.start);
  const out: { t: string; type?: "phone" | "email" }[] = [];
  let i = 0;
  for (const m of marks) {
    if (m.start > i) out.push({ t: text.slice(i, m.start) });
    out.push({ t: text.slice(m.start, m.end), type: m.type });
    i = m.end;
  }
  if (i < text.length) out.push({ t: text.slice(i) });
  return out;
}
