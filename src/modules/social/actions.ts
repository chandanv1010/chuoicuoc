import "server-only";
import { db } from "@/lib/db";
import { now } from "@/lib/helpers";
import { getAccount } from "./accounts";
import { env, META_GRAPH_VERSION } from "./config";
import { requestJson, SocialError } from "./http";
import { validAccessToken } from "./oauth";

/**
 * Thao tac tren binh luan tu trang admin (Page access token):
 *  - Tra loi binh luan Facebook: POST /{comment-id}/comments (message) — quyen pages_manage_engagement
 *      https://developers.facebook.com/docs/graph-api/reference/object/comments/#publish
 *  - An / hien binh luan Facebook: POST /{comment-id} (is_hidden) — pages_manage_engagement
 *      https://developers.facebook.com/docs/graph-api/reference/comment/#updating
 *  - Instagram: POST /{ig-comment-id}/replies, POST /{ig-comment-id} (hide) — instagram_manage_comments
 *      https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/replies
 * Tin nhan rieng va website khong tra loi tu day (Messenger can pages_messaging; website tra loi qua email / SĐT).
 */

const graph = (path: string) => `https://graph.facebook.com/${META_GRAPH_VERSION()}${path}`;

type Row = { id: bigint; platform: string; kind: string; account_id: bigint | null; remote_id: string; thread_id: string | null; status: string };

async function row(id: bigint) {
  const r = await db.$queryRaw<Row[]>`SELECT id, platform, kind, account_id, remote_id, thread_id, status FROM social_messages WHERE id = ${id} LIMIT 1`;
  if (!r[0]) throw new SocialError("Không tìm thấy bình luận");
  return r[0];
}

/** Loi thieu quyen -> huong dan ket noi lai (khong danh dau tai khoan can ket noi lai). */
function permissionHint(e: unknown, scope: string): never {
  const msg = (e as Error).message ?? String(e);
  if (/\(#(10|200|230|3)\)|permission/i.test(msg)) throw new SocialError(`Token chưa có quyền ${scope}. Vào Tài khoản kết nối → Kết nối Facebook lại và đồng ý quyền. (${msg.slice(0, 160)})`);
  throw e instanceof SocialError ? e : new SocialError(msg);
}

async function post<T>(path: string, token: string, fields: Record<string, string>) {
  return requestJson<T>(graph(path), { method: "POST", body: new URLSearchParams({ ...fields, access_token: token }) });
}

/** Cho biet binh luan nay co tra loi / an duoc tu admin khong (de an nut tren giao dien). */
export function canAct(r: { platform: string; kind: string }) {
  if (r.kind !== "comment") return false;
  // Instagram can quyen instagram_manage_comments (chi co khi app Meta bat use case Instagram, xem META_EXTRA_SCOPES)
  return r.platform === "facebook" || (r.platform === "instagram" && env("META_EXTRA_SCOPES").includes("instagram_manage_comments"));
}

export async function replyToComment(id: bigint, text: string) {
  const message = text.trim();
  if (!message) throw new SocialError("Chưa nhập nội dung trả lời");
  const r = await row(id);
  if (!canAct(r) || !r.account_id) throw new SocialError("Chỉ trả lời được bình luận Facebook / Instagram từ admin. Tin nhắn và form website hãy trả lời qua inbox / email / SĐT.");
  const account = await getAccount(r.account_id);
  if (!account) throw new SocialError("Tài khoản mạng xã hội đã bị ngắt kết nối");
  const token = await validAccessToken(account.id);
  let replyId: string;
  try {
    const res =
      r.platform === "facebook"
        ? await post<{ id: string }>(`/${r.remote_id}/comments`, token, { message })
        : await post<{ id: string }>(`/${r.remote_id}/replies`, token, { message });
    replyId = res.id;
  } catch (e) {
    permissionHint(e, r.platform === "facebook" ? "pages_manage_engagement" : "instagram_manage_comments");
  }
  const t = now();
  // luu cau tra loi cua shop vao hop thu (dong bo sau se khop theo remote_id, khong tao trung)
  await db.$executeRaw`
    INSERT IGNORE INTO social_messages (platform, kind, account_id, remote_id, thread_id, parent_remote_id, social_post_id, product_id,
      author_name, message, from_page, status, created_time, created_at, updated_at)
    SELECT platform, kind, account_id, ${replyId}, thread_id, remote_id, social_post_id, product_id, ${account.name}, ${message}, 1, 'done', ${t}, ${t}, ${t}
    FROM social_messages WHERE id = ${id}`;
  await db.$executeRaw`
    UPDATE social_messages SET replied_at = ${t}, reply_draft = NULL, status = IF(status = 'new', 'contacted', status), updated_at = ${t}
    WHERE id = ${id}`;
}

export async function setHidden(id: bigint, hidden: boolean) {
  const r = await row(id);
  if (!canAct(r) || !r.account_id) throw new SocialError("Chỉ ẩn được bình luận Facebook / Instagram");
  const token = await validAccessToken(r.account_id);
  try {
    if (r.platform === "facebook") await post(`/${r.remote_id}`, token, { is_hidden: String(hidden) });
    else await post(`/${r.remote_id}`, token, { hide: String(hidden) });
  } catch (e) {
    permissionHint(e, r.platform === "facebook" ? "pages_manage_engagement" : "instagram_manage_comments");
  }
  await db.$executeRaw`
    UPDATE social_messages SET hidden = ${hidden ? 1 : 0}, status = ${hidden ? "spam" : "new"}, is_lead = IF(${hidden}, 0, is_lead), updated_at = ${now()}
    WHERE id = ${id}`;
}

/** Tu an binh luan spam Facebook moi dong bo (chi khi token co pages_manage_engagement). Tra ve so binh luan da an. */
export async function hideNewSpam(accountId: bigint) {
  const rows = await db.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM social_messages
    WHERE account_id = ${accountId} AND platform = 'facebook' AND kind = 'comment' AND status = 'spam' AND hidden = 0 AND from_page = 0
      AND created_at >= ${new Date(now().getTime() - 3 * 86400_000)}
    LIMIT 20`;
  let n = 0;
  for (const r of rows) {
    await setHidden(r.id, true);
    n++;
  }
  return n;
}

export async function saveDraft(id: bigint, draft: string | null) {
  await db.$executeRaw`UPDATE social_messages SET reply_draft = ${draft}, updated_at = ${now()} WHERE id = ${id}`;
}
