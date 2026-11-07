import { flash } from "@/lib/flash";
import { back, str } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import type { FormContext, FormRoute } from "@/server/routes";
import { deleteAccount, getAccount, updateAccountFields } from "./accounts";
import { SocialError } from "./http";
import { syncInbox, updateInbox } from "./inbox";
import { connectTelegram, sendTelegram, sendWhatsApp } from "./notify";
import { replyToComment, saveDraft, setHidden } from "./actions";
import { draftReply } from "./drafts";
import { refreshStats } from "./stats";
import { switchMetaPage } from "./oauth";
import { cancelPost, getPost, retryPost, runNow } from "./posts";
import { startSocialWorker, tick } from "./worker";
import { siteName } from "@/lib/site";

/** Form POST cua module mang xa hoi (trang Tai khoan ket noi + Lich su dang + khoi lich su o trang sua). */

function guarded(permission: string, fn: (ctx: FormContext & { adminId: bigint }) => Promise<Response>) {
  return async (ctx: FormContext) => {
    const admin = await authorizeHandler(ctx.req, permission);
    if (admin instanceof Response) return admin;
    return fn({ ...ctx, adminId: admin.id });
  };
}

/** Chay mot luot worker ngay va doi ket qua (toi da vai giay) de trang hien trang thai moi. */
async function kick() {
  startSocialWorker();
  await Promise.race([tick(), new Promise((r) => setTimeout(r, 8_000))]);
}

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "social/account/{id:\\d+}/disconnect",
    handler: guarded("social.account.update", async ({ req, params }) => {
      const account = await getAccount(params.id);
      if (!account) {
        await flash({ error: "Tài khoản không tồn tại" });
        return back(req, "/social/account/index");
      }
      await deleteAccount(account.id);
      await flash({ success: `Đã ngắt kết nối ${account.name}. Bài đang chờ của tài khoản này đã được hủy.` });
      return back(req, "/social/account/index");
    }),
  },
  {
    method: "POST",
    path: "social/account/{id:\\d+}/update",
    handler: guarded("social.account.update", async ({ req, params, input, adminId }) => {
      const account = await getAccount(params.id);
      if (!account) {
        await flash({ error: "Tài khoản không tồn tại" });
        return back(req, "/social/account/index");
      }
      try {
        if (account.platform === "facebook" && str(input, "page_id")) {
          const pageId = str(input, "page_id");
          if (account.meta?.dry_run) {
            const page = account.meta.pages?.find((p) => p.id === pageId);
            if (!page) throw new SocialError("Page không hợp lệ");
            await updateAccountFields(account.id, { page_id: page.id, name: page.name });
          } else {
            await switchMetaPage(account, pageId, adminId);
          }
        } else if (account.platform === "pinterest" && str(input, "board_id")) {
          const board = account.meta?.boards?.find((b) => b.id === str(input, "board_id"));
          if (!board) throw new SocialError("Board không hợp lệ");
          await updateAccountFields(account.id, { board_id: board.id });
        }
        await flash({ success: "Đã lưu cấu hình tài khoản" });
      } catch (e) {
        await flash({ error: `Không lưu được: ${(e as Error).message}` });
      }
      return back(req, "/social/account/index");
    }),
  },
  {
    method: "POST",
    path: "social/post/{id:\\d+}/retry",
    handler: guarded("social.post.update", async ({ req, params }) => {
      const n = await retryPost(BigInt(params.id));
      if (!n) await flash({ error: "Chỉ thử lại được bài lỗi hoặc đã hủy" });
      else {
        await kick();
        const p = await getPost(BigInt(params.id));
        await flash(p?.status === "failed" ? { error: `Thử lại vẫn lỗi: ${p.error}` } : { success: "Đã đưa bài vào hàng đợi và chạy lại" });
      }
      return back(req, "/social/post/index");
    }),
  },
  {
    method: "POST",
    path: "social/post/{id:\\d+}/run",
    handler: guarded("social.post.update", async ({ req, params }) => {
      const n = await runNow(BigInt(params.id));
      if (!n) await flash({ error: "Bài không còn ở trạng thái chờ đăng" });
      else {
        await kick();
        await flash({ success: "Đã chạy ngay" });
      }
      return back(req, "/social/post/index");
    }),
  },
  {
    method: "POST",
    path: "social/post/{id:\\d+}/cancel",
    handler: guarded("social.post.update", async ({ req, params }) => {
      const n = await cancelPost(BigInt(params.id));
      await flash(n ? { success: "Đã hủy bài đăng" } : { error: "Chỉ hủy được bài đang chờ (chưa gửi lên nền tảng)" });
      return back(req, "/social/post/index");
    }),
  },
  {
    method: "POST",
    path: "social/post/run",
    handler: guarded("social.post.update", async ({ req }) => {
      await kick();
      await flash({ success: "Đã chạy hàng đợi" });
      return back(req, "/social/post/index");
    }),
  },
  {
    method: "POST",
    path: "social/inbox/sync",
    handler: guarded("social.inbox.index", async ({ req }) => {
      const r = await syncInbox();
      await flash(
        r.problems.length
          ? { error: `Đã đồng bộ (${r.added} mục mới) nhưng có nguồn lỗi: ${r.problems.map((p) => `${p.source}: ${p.error}`).join(" | ")}` }
          : { success: `Đã đồng bộ: ${r.added} mục mới` },
      );
      return back(req, "/social/inbox/index");
    }),
  },
  {
    method: "POST",
    path: "social/inbox/{id:\\d+}/update",
    handler: guarded("social.inbox.update", async ({ req, params, input }) => {
      const lead = str(input, "is_lead");
      await updateInbox(BigInt(params.id), {
        status: str(input, "status") || undefined,
        note: input.note === undefined ? undefined : str(input, "note").trim() || null,
        is_lead: lead === "" ? undefined : lead === "1",
      });
      await flash({ success: "Đã cập nhật" });
      return back(req, "/social/inbox/index");
    }),
  },
  {
    method: "POST",
    path: "social/inbox/telegram/connect",
    handler: guarded("social.inbox.update", async ({ req }) => {
      try {
        const name = await connectTelegram();
        await flash({ success: `Đã kết nối Telegram: ${name}. Bot vừa gửi tin xác nhận.` });
      } catch (e) {
        await flash({ error: (e as Error).message });
      }
      return back(req, "/social/inbox/index");
    }),
  },
  {
    method: "POST",
    path: "social/inbox/telegram/test",
    handler: guarded("social.inbox.update", async ({ req }) => {
      try {
        await sendTelegram(
          ["🔔 <b>Thử thông báo</b>", "👤 Jane Doe (thử)", "💬 How much for 12 of these?", "📞 <b>555-123-4567</b>", "🏷 có SĐT, hỏi giá"].join("\n"),
        );
        await flash({ success: "Đã gửi tin thử — kiểm tra Telegram." });
      } catch (e) {
        await flash({ error: (e as Error).message });
      }
      return back(req, "/social/inbox/index");
    }),
  },
  {
    method: "POST",
    path: "social/inbox/whatsapp/test",
    handler: guarded("social.inbox.update", async ({ req }) => {
      try {
        await sendWhatsApp([`🔔 *Thử thông báo* — ${await siteName()}`, "👤 Jane Doe (thử)", "💬 How much for 12 of these?", "📞 *555-123-4567*"].join("\n"));
        await flash({ success: "Đã gửi tin thử — kiểm tra WhatsApp (có thể chậm 1–2 phút)." });
      } catch (e) {
        await flash({ error: (e as Error).message });
      }
      return back(req, "/social/inbox/index");
    }),
  },
  {
    method: "POST",
    path: "social/inbox/{id:\\d+}/reply",
    handler: guarded("social.inbox.update", async ({ req, params, input }) => {
      try {
        await replyToComment(BigInt(params.id), str(input, "reply"));
        await flash({ success: "Đã trả lời bình luận." });
      } catch (e) {
        // giu lai noi dung dang go de sua tiep
        await saveDraft(BigInt(params.id), str(input, "reply") || null);
        await flash({ error: `Không gửi được: ${(e as Error).message}` });
      }
      return back(req, "/social/inbox/index");
    }),
  },
  {
    method: "POST",
    path: "social/inbox/{id:\\d+}/draft",
    handler: guarded("social.inbox.update", async ({ req, params }) => {
      try {
        await saveDraft(BigInt(params.id), await draftReply(BigInt(params.id)));
        await flash({ success: "Đã điền câu trả lời mẫu — sửa cho phù hợp trước khi gửi." });
      } catch (e) {
        await flash({ error: (e as Error).message });
      }
      return back(req, "/social/inbox/index");
    }),
  },
  {
    method: "POST",
    path: "social/inbox/{id:\\d+}/hide",
    handler: guarded("social.inbox.update", async ({ req, params, input }) => {
      const hide = str(input, "hidden", "1") === "1";
      try {
        await setHidden(BigInt(params.id), hide);
        await flash({ success: hide ? "Đã ẩn bình luận (chỉ người viết và bạn bè họ còn thấy)." : "Đã hiện lại bình luận." });
      } catch (e) {
        await flash({ error: (e as Error).message });
      }
      return back(req, "/social/inbox/index");
    }),
  },
  {
    method: "POST",
    path: "social/stats/refresh",
    handler: guarded("social.stats.index", async ({ req }) => {
      try {
        const n = await refreshStats(true);
        await flash({ success: `Đã cập nhật số liệu ${n} bài đăng.` });
      } catch (e) {
        await flash({ error: (e as Error).message });
      }
      return back(req, "/social/stats/index");
    }),
  },
];
