import "server-only";
import { db } from "@/lib/db";
import { STORE } from "@/modules/frontend/store";
import { publicBaseUrl } from "./config";
import { detectLead } from "./lead";

/**
 * Goi y cau tra loi mau cho binh luan / tin nhan cua khach (tieng Anh, khach My) theo y dinh: hoi gia / muon dat / hoi giao hang / khen.
 * Chu shop luon doc va sua truoc khi bam Gui — khong tu dong gui.
 */

type Ctx = { message: string; author: string | null; kind: string; productName: string | null; price: string | null; productUrl: string | null };

async function context(id: bigint): Promise<Ctx> {
  const r = await db.$queryRaw<{ message: string | null; author_name: string | null; kind: string; product_name: string | null; price: unknown; canonical: string | null }[]>`
    SELECT m.message, m.author_name, m.kind, pl.name AS product_name, p.price, pl.canonical
    FROM social_messages m
    LEFT JOIN products p ON p.id = m.product_id
    LEFT JOIN product_language pl ON pl.product_id = m.product_id AND pl.language_id = (SELECT MIN(language_id) FROM product_language WHERE product_id = m.product_id)
    WHERE m.id = ${id} LIMIT 1`;
  const x = r[0];
  if (!x) throw new Error("Không tìm thấy bình luận");
  const price = x.price !== null && x.price !== undefined && Number(x.price) > 0 ? `$${Number(x.price).toFixed(2)}` : null;
  return {
    message: x.message ?? "",
    author: x.author_name,
    kind: x.kind,
    productName: x.product_name,
    price,
    productUrl: x.canonical ? `${publicBaseUrl()}/${x.canonical}.html` : null,
  };
}

const firstName = (name: string | null) => (name ?? "").replace(/^@/, "").split(/\s+/)[0] || "there";

/** Cau tra loi mau theo y dinh cua khach. */
function template(c: Ctx): string {
  const hi = `Hi ${firstName(c.author)}!`;
  const reasons = detectLead(c.message).reasons;
  const link = c.productUrl ? ` You can order here: ${c.productUrl}` : ` Shop all products: ${publicBaseUrl()}`;
  const eta = `Orders usually arrive in ${STORE.deliveryDays[0]}–${STORE.deliveryDays[1]} days with tracked delivery.`;
  if (reasons.includes("hỏi giá")) {
    return `${hi} Thanks for asking 😊 ${c.productName ? `The ${c.productName} is ${c.price ?? "listed on our website"}.` : "Prices are listed on our website."} ${eta}${link}`;
  }
  if (reasons.includes("muốn đặt") || reasons.includes("nhắn tin")) {
    return `${hi} We'd love to help! Could you send us the item, option and quantity you'd like? We'll confirm the details with you. ${eta}${link}`;
  }
  if (reasons.includes("hỏi thông tin")) {
    return `${hi} Great question! ${eta} Let us know if you'd like a different color or size and we'll check for you.${link}`;
  }
  return `${hi} Thank you so much for the kind words! 💛${link}`;
}

/** Tra ve cau tra loi mau de chu shop sua roi gui. */
export async function draftReply(id: bigint): Promise<string> {
  return template(await context(id));
}
