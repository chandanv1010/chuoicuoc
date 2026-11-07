import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { intParam, listParams, param, where, type SearchParams } from "@/server/admin-list";
import { listAccounts, type AccountRow } from "./accounts";
import { META_GRAPH_VERSION } from "./config";
import { requestJson } from "./http";
import { validAccessToken } from "./oauth";
import { detectLead, detectSpam } from "./lead";
import { notifyNewLeads } from "./notify";
import { hideNewSpam } from "./actions";
import { refreshStats } from "./stats";

/**
 * Hop thu tong hop (bang social_messages): keo binh luan + tin nhan ve admin, danh dau khach can tu van.
 *  - Facebook Page: binh luan tren bai cua Page  GET /{page-id}/feed?fields=comments.filter(stream){...}
 *      (quyen pages_read_engagement + pages_read_user_content)
 *      https://developers.facebook.com/docs/graph-api/reference/page/feed/
 *      https://developers.facebook.com/docs/graph-api/reference/object/comments/
 *  - Messenger / Instagram Direct: GET /{page-id}/conversations?platform=messenger|instagram
 *      (quyen pages_messaging / instagram_manage_messages)
 *      https://developers.facebook.com/docs/messenger-platform/conversations/
 *  - Instagram: binh luan tren media  GET /{ig-user-id}/media?fields=comments{...,replies{...}}
 *      (quyen instagram_basic + instagram_manage_comments)
 *      https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/comments
 *  - Website: bang contacts (form lien he) va reviews (danh gia san pham).
 *  TikTok va Pinterest khong co API doc binh luan cho app thuong -> khong dong bo.
 * Upsert theo (platform, remote_id): dong bo lai khong ghi de trang thai / ghi chu admin da dat.
 * Loi quyen KHONG danh dau tai khoan "can ket noi lai" (de khong lam hong viec dang bai) — chi bao tren trang.
 */

export const INBOX_STATUS_LABEL: Record<string, string> = { new: "Mới", contacted: "Đã liên hệ", done: "Xong", spam: "Bỏ qua / spam" };
export const INBOX_KIND_LABEL: Record<string, string> = { comment: "Bình luận", message: "Tin nhắn", contact: "Form liên hệ", review: "Đánh giá" };
export const INBOX_PLATFORM_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", website: "Website" };

const SYNC_MS = 5 * 60_000;
const graph = (path: string) => `https://graph.facebook.com/${META_GRAPH_VERSION()}${path}`;
/** Gio nen tang (ISO, UTC) -> gio VN luu trong DATETIME (cung quy uoc voi now()). */
const localTime = (iso?: string | null) => (iso ? new Date(Date.parse(iso) + (now().getTime() - Date.now())) : null);

type SyncState = { timer?: NodeJS.Timeout; started: boolean; running: boolean; current?: Promise<unknown>; lastRun?: Date; problems: { source: string; error: string }[]; added: number };
const g = globalThis as unknown as { __socialInbox?: SyncState; __socialInboxRun?: () => Promise<unknown> };
const state: SyncState = (g.__socialInbox ??= { started: false, running: false, problems: [], added: 0 });

export function startInboxSync() {
  if (state.started) return;
  state.started = true;
  // goi qua g.__socialInboxRun de hen gio luon chay code moi nhat (dev hot reload giu nguyen timer cu)
  state.timer = setInterval(() => void g.__socialInboxRun?.(), SYNC_MS);
  state.timer.unref?.();
  setTimeout(() => void g.__socialInboxRun?.(), 10_000).unref?.();
}

export function inboxSyncStatus() {
  return { lastRun: state.lastRun ?? null, running: state.running, problems: state.problems, added: state.added };
}

/* ------------------------------------------------------------------ */
/* Ghi                                                                 */
/* ------------------------------------------------------------------ */

export type InboxItem = {
  platform: "facebook" | "instagram" | "website";
  kind: "comment" | "message" | "contact" | "review";
  account_id?: bigint | null;
  remote_id: string;
  thread_id?: string | null;
  parent_remote_id?: string | null;
  product_id?: bigint | null;
  author_id?: string | null;
  author_name?: string | null;
  message: string;
  permalink?: string | null;
  from_page?: boolean;
  created_time: Date | null;
  /** so dien thoai / email khach tu nhap o form (website) */
  phone?: string | null;
  email?: string | null;
};

/** Upsert; tra ve true neu la dong moi. */
async function upsert(it: InboxItem): Promise<boolean> {
  // spam (link la, tien ao, ban follow...) -> trang thai "Bo qua / spam", khong tinh la khach, khong bao Telegram
  const spam = it.from_page || it.platform === "website" ? null : detectSpam(it.message);
  const lead = detectLead(it.message, { phone: it.phone, email: it.email, kind: it.kind, fromPage: Boolean(it.from_page) });
  if (spam) Object.assign(lead, { isLead: false, reasons: [`spam: ${spam}`] });
  const status = it.from_page ? "done" : spam ? "spam" : "new";
  const t = now();
  const n = await db.$executeRaw`
    INSERT INTO social_messages (platform, kind, account_id, remote_id, thread_id, parent_remote_id, social_post_id, product_id,
      author_id, author_name, message, permalink, phones, emails, is_lead, lead_reasons, from_page, status, created_time, created_at, updated_at)
    VALUES (${it.platform}, ${it.kind}, ${it.account_id ?? null}, ${it.remote_id}, ${it.thread_id ?? null}, ${it.parent_remote_id ?? null},
      (SELECT sp.id FROM social_posts sp WHERE sp.platform = ${it.platform} AND sp.remote_id = ${it.thread_id ?? ""} LIMIT 1),
      COALESCE(${it.product_id ?? null}, (SELECT sp.source_id FROM social_posts sp WHERE sp.platform = ${it.platform} AND sp.remote_id = ${it.thread_id ?? ""} AND sp.source_type = 'Product' LIMIT 1)),
      ${it.author_id ?? null}, ${it.author_name?.slice(0, 191) ?? null}, ${it.message}, ${it.permalink?.slice(0, 1000) ?? null},
      ${lead.phones.join(", ") || null}, ${lead.emails.join(", ") || null}, ${lead.isLead ? 1 : 0}, ${lead.reasons.join(", ") || null},
      ${it.from_page ? 1 : 0}, ${status}, ${it.created_time}, ${t}, ${t})
    ON DUPLICATE KEY UPDATE message = VALUES(message), author_name = COALESCE(VALUES(author_name), author_name),
      permalink = COALESCE(VALUES(permalink), permalink), phones = VALUES(phones), emails = VALUES(emails),
      -- admin da xu ly (doi trang thai / danh dau tay) thi giu nguyen danh gia lead
      is_lead = IF(status = 'new', VALUES(is_lead), is_lead), lead_reasons = IF(status = 'new', VALUES(lead_reasons), lead_reasons)`;
  return n === 1; // MySQL: 1 = chen moi, 2 = cap nhat, 0 = khong doi
}

/* ------------------------------------------------------------------ */
/* Dong bo                                                             */
/* ------------------------------------------------------------------ */

type GraphList<T> = { data?: T[]; paging?: { next?: string } };
type FbFrom = { id?: string; name?: string };
type FbComment = { id: string; message?: string; from?: FbFrom; created_time?: string; permalink_url?: string; parent?: { id: string } };
type FbPost = { id: string; permalink_url?: string; comments?: GraphList<FbComment> };
type FbPhoto = { id: string; link?: string; page_story_id?: string; comments?: GraphList<FbComment> };
type Conv = { id: string; link?: string; messages?: GraphList<{ id: string; message?: string; from?: FbFrom & { username?: string }; created_time?: string }> };
type IgComment = { id: string; text?: string; username?: string; from?: { id?: string; username?: string }; timestamp?: string; replies?: GraphList<IgComment> };
type IgMedia = { id: string; permalink?: string; comments?: GraphList<IgComment> };

const get = <T>(path: string, token: string) => requestJson<T>(graph(`${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`), { timeoutMs: 60_000 });

/** Bat loi tung nguon de nguon nay hong khong chan nguon khac. `perm`: quyen Meta nguon nay can (de bao dung ten). */
async function source(name: string, problems: SyncState["problems"], fn: () => Promise<number>, perm?: string) {
  try {
    return await fn();
  } catch (e) {
    problems.push({ source: name, error: humanError((e as Error).message, perm) });
    return 0;
  }
}

/** Loi thieu quyen cua Meta (#10, #200, #230...) -> loi nhac bang tieng Viet voi dung ten quyen can cap. */
function humanError(msg: string, perm?: string) {
  if (perm && /\(#(10|200|230|190)\)|permission/i.test(msg)) {
    return `Token chưa được cấp quyền ${perm}. Kiểm tra quyền này đã "Sẵn sàng thử nghiệm" trong app Meta, rồi bấm "Kết nối Facebook" lại và đồng ý hết. (${msg.slice(0, 160)})`;
  }
  return msg.slice(0, 400);
}

/** Tin nhan chi dong bo khi token da xin quyen (META_EXTRA_SCOPES) — tranh bao loi thieu quyen mai. */
const hasScope = (acc: AccountRow, scope: string) => (acc.scopes ?? "").split(/[,\s]+/).includes(scope);

async function syncFacebook(acc: AccountRow, problems: SyncState["problems"]) {
  if (!acc.page_id) return 0;
  const token = await validAccessToken(acc.id);
  const pageId = acc.page_id;
  let added = 0;
  const comments = "comments.filter(stream).order(reverse_chronological).limit(100){id,message,from,created_time,permalink_url,parent{id}}";
  const save = async (c: FbComment, threadId: string, link: string | null | undefined) =>
    c.message &&
    (await upsert({
      platform: "facebook",
      kind: "comment",
      account_id: acc.id,
      remote_id: c.id,
      thread_id: threadId,
      parent_remote_id: c.parent?.id ?? null,
      author_id: c.from?.id ?? null,
      author_name: c.from?.name ?? null,
      message: c.message,
      permalink: c.permalink_url ?? link ?? null,
      from_page: c.from?.id === pageId,
      created_time: localTime(c.created_time),
    }));
  added += await source(`${acc.name} — bình luận Facebook`, problems, async () => {
    let n = 0;
    const r = await get<GraphList<FbPost>>(`/${pageId}/feed?fields=${encodeURIComponent(`id,permalink_url,${comments}`)}&limit=50`, token);
    for (const post of r.data ?? []) for (const c of post.comments?.data ?? []) if (await save(c, post.id, post.permalink_url)) n++;
    // bai nhieu anh: khach bam vao tung anh roi binh luan -> binh luan nam o anh, khong o bai. page_story_id = id bai chua anh (de ghep san pham)
    const photos = await get<GraphList<FbPhoto>>(`/${pageId}/photos?type=uploaded&fields=${encodeURIComponent(`id,link,page_story_id,${comments}`)}&limit=100`, token);
    for (const ph of photos.data ?? []) for (const c of ph.comments?.data ?? []) if (await save(c, ph.page_story_id ?? ph.id, ph.link)) n++;
    return n;
  }, "pages_read_user_content");
  // tu an spam vua dong bo (can quyen an binh luan)
  if (hasScope(acc, "pages_manage_engagement")) await source(`${acc.name} — ẩn bình luận spam`, problems, () => hideNewSpam(acc.id));
  if (hasScope(acc, "pages_messaging")) added += await source(`${acc.name} — tin nhắn Messenger`, problems, () => syncConversations(acc, token, "messenger", pageId), "pages_messaging");
  return added;
}

async function syncInstagram(acc: AccountRow, problems: SyncState["problems"]) {
  if (!acc.ig_user_id) return 0;
  const token = await validAccessToken(acc.id);
  const igId = acc.ig_user_id;
  let added = 0;
  added += await source(`${acc.name} — bình luận Instagram`, problems, async () => {
    let n = 0;
    const c = "id,text,username,from,timestamp";
    const fields = `id,permalink,comments.limit(50){${c},replies.limit(50){${c}}}`;
    const r = await get<GraphList<IgMedia>>(`/${igId}/media?fields=${encodeURIComponent(fields)}&limit=50`, token);
    for (const media of r.data ?? []) {
      const all = (media.comments?.data ?? []).flatMap((x) => [{ c: x, parent: null as string | null }, ...(x.replies?.data ?? []).map((y) => ({ c: y, parent: x.id }))]);
      for (const { c: cm, parent } of all) {
        if (!cm.text) continue;
        const username = cm.username ?? cm.from?.username ?? null;
        const ok = await upsert({
          platform: "instagram",
          kind: "comment",
          account_id: acc.id,
          remote_id: cm.id,
          thread_id: media.id,
          parent_remote_id: parent,
          author_id: cm.from?.id ?? null,
          author_name: username ? `@${username}` : null,
          message: cm.text,
          permalink: media.permalink ?? null,
          from_page: Boolean(username && acc.username && username.toLowerCase() === acc.username.replace(/^@/, "").toLowerCase()),
          created_time: localTime(cm.timestamp),
        });
        if (ok) n++;
      }
    }
    return n;
  }, "instagram_manage_comments");
  if (acc.page_id && hasScope(acc, "instagram_manage_messages")) added += await source(`${acc.name} — tin nhắn Instagram`, problems, () => syncConversations(acc, token, "instagram", acc.ig_user_id!), "instagram_manage_messages");
  return added;
}

/** Hop thu Messenger / Instagram Direct cua Page (20 hoi thoai moi nhat, 20 tin moi nhat moi hoi thoai). */
async function syncConversations(acc: AccountRow, token: string, platform: "messenger" | "instagram", ownId: string) {
  let n = 0;
  const fields = "id,link,updated_time,messages.limit(20){id,message,from,created_time}";
  const r = await get<GraphList<Conv>>(`/${acc.page_id}/conversations?platform=${platform}&fields=${encodeURIComponent(fields)}&limit=20`, token);
  for (const conv of r.data ?? []) {
    for (const m of conv.messages?.data ?? []) {
      if (!m.message) continue;
      const name = m.from?.name ?? (m.from?.username ? `@${m.from.username}` : null);
      const ok = await upsert({
        platform: platform === "messenger" ? "facebook" : "instagram",
        kind: "message",
        account_id: acc.id,
        remote_id: m.id,
        thread_id: conv.id,
        author_id: m.from?.id ?? null,
        author_name: name,
        message: m.message,
        permalink: conv.link ? `https://www.facebook.com${conv.link}` : platform === "messenger" ? "https://business.facebook.com/latest/inbox/messenger" : "https://www.instagram.com/direct/inbox/",
        from_page: m.from?.id === ownId || m.from?.id === acc.page_id,
        created_time: localTime(m.created_time),
      });
      if (ok) n++;
    }
  }
  return n;
}

/** Form lien he + danh gia tren website (da nam san trong DB). */
async function syncWebsite() {
  let n = 0;
  const contacts = await db.$queryRaw<{ id: bigint; name: string | null; phone: string | null; email: string | null; address: string | null; message: string | null; product_id: bigint | null; created_at: Date | null }[]>`
    SELECT id, name, phone, email, address, message, product_id, created_at FROM contacts WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 500`;
  for (const c of contacts) {
    const text = [c.message?.replace(/<[^>]+>/g, " ").trim(), c.address ? `Địa chỉ: ${c.address}` : null].filter(Boolean).join("\n") || "(không có lời nhắn)";
    if (await upsert({ platform: "website", kind: "contact", remote_id: `contact:${c.id}`, product_id: c.product_id, author_name: c.name, message: text, phone: c.phone, email: c.email, permalink: "/contact/index", created_time: c.created_at })) n++;
  }
  const reviews = await db.$queryRaw<{ id: bigint; fullname: string; phone: string; email: string; description: string; score: number; reviewable_type: string; reviewable_id: number; created_at: Date | null }[]>`
    SELECT id, fullname, phone, email, description, score, reviewable_type, reviewable_id, created_at FROM reviews ORDER BY id DESC LIMIT 500`;
  for (const r of reviews) {
    const productId = /Product$/.test(r.reviewable_type) ? BigInt(r.reviewable_id) : null;
    if (await upsert({ platform: "website", kind: "review", remote_id: `review:${r.id}`, product_id: productId, author_name: r.fullname, message: `${"★".repeat(Math.max(0, Math.min(5, r.score)))} ${r.description}`, phone: r.phone, email: r.email, permalink: "/review/index", created_time: r.created_at })) n++;
  }
  return n;
}

/** Mot luot dong bo tat ca nguon. Dang chay thi doi luot do xong (khong chay chong). */
export async function syncInbox() {
  if (state.running) {
    await state.current;
    return inboxSyncStatus();
  }
  const run = runSync();
  state.current = run;
  await run;
  return inboxSyncStatus();
}

async function runSync() {
  state.running = true;
  const problems: SyncState["problems"] = [];
  let added = 0;
  try {
    for (const acc of await listAccounts()) {
      if (acc.status !== "active" || acc.meta?.dry_run) continue;
      if (acc.platform === "facebook") added += await source(acc.name, problems, () => syncFacebook(acc, problems));
      if (acc.platform === "instagram") added += await source(acc.name, problems, () => syncInstagram(acc, problems));
    }
    added += await source("Website", problems, syncWebsite);
    // thong ke tuong tac bai dang (30 phut / lan)
    await source("Thống kê tương tác", problems, () => refreshStats());
    // bao lead moi qua Telegram (chua cau hinh thi bo qua)
    await source("Thông báo Telegram", problems, notifyNewLeads);
  } finally {
    state.problems = problems;
    state.added = added;
    state.lastRun = new Date();
    state.running = false;
  }
}

/* ------------------------------------------------------------------ */
/* Doc / cap nhat cho trang admin                                      */
/* ------------------------------------------------------------------ */

export type InboxRow = {
  id: bigint;
  platform: string;
  kind: string;
  author_name: string | null;
  message: string | null;
  permalink: string | null;
  phones: string | null;
  emails: string | null;
  is_lead: number;
  lead_reasons: string | null;
  from_page: number;
  hidden: number;
  status: string;
  note: string | null;
  reply_draft: string | null;
  replied_at: Date | null;
  parent_remote_id: string | null;
  created_time: Date | null;
  product_id: bigint | null;
  product_name: string | null;
  thread_count: bigint;
};

/** Loc: view=lead (mac dinh: khach can tu van chua xu ly) | all; platform; kind; status; keyword; mine=1 (hien ca tin cua shop). */
export async function paginateInbox(sp: SearchParams) {
  const { perPage, page, offset, keyword } = listParams(sp);
  const view = param(sp, "view") ?? "lead";
  const status = param(sp, "status") ?? "";
  const cond = where([
    view === "lead" ? Prisma.sql`m.is_lead = 1` : null,
    view === "lead" && !status ? Prisma.sql`m.status IN ('new','contacted')` : null,
    intParam(sp, "mine") ? null : Prisma.sql`m.from_page = 0`,
    param(sp, "platform") ? Prisma.sql`m.platform = ${param(sp, "platform")}` : null,
    param(sp, "kind") ? Prisma.sql`m.kind = ${param(sp, "kind")}` : null,
    status ? Prisma.sql`m.status = ${status}` : null,
    keyword ? Prisma.sql`(m.message LIKE ${`%${keyword}%`} OR m.author_name LIKE ${`%${keyword}%`} OR m.phones LIKE ${`%${keyword}%`} OR m.note LIKE ${`%${keyword}%`})` : null,
  ]);
  const [rows, count] = await Promise.all([
    db.$queryRaw<InboxRow[]>`
      SELECT m.id, m.platform, m.kind, m.author_name, m.message, m.permalink, m.phones, m.emails, m.is_lead, m.lead_reasons, m.from_page, m.hidden,
        m.status, m.note, m.reply_draft, m.replied_at, m.parent_remote_id, m.created_time, m.product_id, pl.name AS product_name,
        (SELECT COUNT(*) FROM social_messages t WHERE t.kind = 'message' AND t.thread_id = m.thread_id AND t.platform = m.platform) AS thread_count
      FROM social_messages m
      LEFT JOIN product_language pl ON pl.product_id = m.product_id AND pl.language_id = (SELECT MIN(language_id) FROM product_language WHERE product_id = m.product_id)
      ${cond}
      ORDER BY m.created_time DESC, m.id DESC LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM social_messages m ${cond}`,
  ]);
  return { rows, total: Number(count[0].c), perPage, page };
}

/** So dem cho the tren dau trang. */
export async function inboxCounts() {
  const r = await db.$queryRaw<{ leads: bigint | null; fresh: bigint | null; total: bigint | null; comments: bigint | null; messages: bigint | null; website: bigint | null }[]>`
    SELECT SUM(is_lead = 1 AND status IN ('new','contacted')) AS leads, SUM(status = 'new') AS fresh, COUNT(*) AS total,
      SUM(kind = 'comment') AS comments, SUM(kind = 'message') AS messages, SUM(platform = 'website') AS website
    FROM social_messages WHERE from_page = 0`;
  const x = r[0];
  return { leads: Number(x?.leads ?? 0), fresh: Number(x?.fresh ?? 0), total: Number(x?.total ?? 0), comments: Number(x?.comments ?? 0), messages: Number(x?.messages ?? 0), website: Number(x?.website ?? 0) };
}

/** Tin trong cung hoi thoai (hien khi mo rong mot tin nhan). */
export async function threadOf(id: bigint) {
  return db.$queryRaw<{ id: bigint; author_name: string | null; message: string | null; from_page: number; created_time: Date | null }[]>`
    SELECT t.id, t.author_name, t.message, t.from_page, t.created_time FROM social_messages m
    JOIN social_messages t ON t.platform = m.platform AND t.thread_id = m.thread_id AND t.kind = m.kind
    WHERE m.id = ${id} AND m.kind = 'message' ORDER BY t.created_time, t.id`;
}

export async function updateInbox(id: bigint, f: { status?: string; note?: string | null; is_lead?: boolean }) {
  const sets: Prisma.Sql[] = [Prisma.sql`updated_at = ${now()}`];
  if (f.status && f.status in INBOX_STATUS_LABEL) sets.push(Prisma.sql`status = ${f.status}`);
  if (f.note !== undefined) sets.push(Prisma.sql`note = ${f.note}`);
  if (f.is_lead !== undefined) sets.push(Prisma.sql`is_lead = ${f.is_lead ? 1 : 0}`);
  return db.$executeRaw`UPDATE social_messages SET ${Prisma.join(sets, ", ")} WHERE id = ${id}`;
}

g.__socialInboxRun = syncInbox;
