import { flash } from "@/lib/flash";
import { arr, back, int, redirectTo, redirectWith, str } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import type { FormContext, FormRoute } from "@/server/routes";
import { PROVIDER_MEDIA, type CurateKind, type Provider } from "./providers";
import { createDraftFromItem } from "./publish";
import { deleteSource, getItem, getSource, listSources, runSource, saveSource, setStatus, type CurateStatus } from "./store";

/** Form POST cua module tim nguon noi dung (trang Kho noi dung + Nguon lay noi dung). */

function guarded(permission: string, fn: (ctx: FormContext & { adminId: bigint }) => Promise<Response>) {
  return async (ctx: FormContext) => {
    const admin = await authorizeHandler(ctx.req, permission);
    if (admin instanceof Response) return admin;
    return fn({ ...ctx, adminId: admin.id });
  };
}

const ITEMS = "/curate/item/index";
const SOURCES = "/curate/source/index";
const PROVIDERS = Object.keys(PROVIDER_MEDIA) as Provider[];

const statusRoute = (action: string, status: CurateStatus, ok: string): FormRoute => ({
  method: "POST",
  path: `curate/item/{id:\\d+}/${action}`,
  handler: guarded("curate.item.update", async ({ req, params, adminId }) => {
    const n = await setStatus([BigInt(params.id)], status, adminId);
    await flash(n ? { success: ok } : { error: "Mục đã dùng để tạo bài, không đổi được" });
    return back(req, ITEMS);
  }),
});

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "curate/item/{id:\\d+}/draft",
    handler: guarded("curate.item.update", async ({ req, params, adminId }) => {
      const item = await getItem(BigInt(params.id));
      if (!item) return redirectWith(req, ITEMS, { error: "Không tìm thấy mục" });
      if (item.status === "used" && item.post_id) return redirectWith(req, `/post/${item.post_id}/edit`, { success: "Mục này đã có bài viết" });
      try {
        const { postId, warnings } = await createDraftFromItem(item, adminId);
        await flash({
          success: `Đã tạo bài nháp (chưa hiển thị trên web) kèm dẫn nguồn. Sửa nội dung, bật "Đăng lên mạng xã hội" + đặt lịch bên dưới, rồi chuyển Hoạt động khi muốn đăng web.`,
          ...(warnings.length ? { error: warnings.join(" ") } : {}),
        });
        return redirectTo(req, `/post/${postId}/edit`);
      } catch (e) {
        await flash({ error: `Không tạo được bài: ${e instanceof Error ? e.message : String(e)}` });
        return back(req, ITEMS);
      }
    }),
  },
  statusRoute("approve", "approved", "Đã đưa vào danh sách chọn"),
  statusRoute("reject", "rejected", "Đã loại"),
  statusRoute("restore", "new", "Đã đưa về chờ duyệt"),
  {
    method: "POST",
    path: "curate/item/bulk",
    handler: guarded("curate.item.update", async ({ req, input, adminId }) => {
      const ids = arr(input, "ids").filter((x) => /^\d+$/.test(x)).map(BigInt);
      const action = str(input, "bulk");
      const status = ({ approve: "approved", reject: "rejected", restore: "new" } as const)[action as "approve"];
      if (!ids.length || !status) return redirectWith(req, ITEMS, { error: "Chọn mục và thao tác" });
      const n = await setStatus(ids, status, adminId);
      await flash({ success: `Đã cập nhật ${n} mục` });
      return back(req, ITEMS);
    }),
  },
  {
    method: "POST",
    path: "curate/source/save",
    handler: guarded("curate.source.update", async ({ req, input }) => {
      const [provider, media] = str(input, "provider_media").split(":") as [Provider, CurateKind];
      const name = str(input, "name").trim();
      const query = str(input, "query").trim();
      if (!PROVIDERS.includes(provider) || !PROVIDER_MEDIA[provider].includes(media)) return redirectWith(req, SOURCES, { error: "Nguồn không hỗ trợ loại nội dung này" });
      if (!name || !query) return redirectWith(req, SOURCES, { error: provider === "rss" ? "Nhập tên và URL feed" : "Nhập tên và từ khóa" });
      const id = str(input, "id");
      await saveSource(/^\d+$/.test(id) ? BigInt(id) : null, {
        provider, media, name: name.slice(0, 190), query: query.slice(0, 500),
        interval_hours: Math.min(720, Math.max(1, int(input, "interval_hours", 24))),
        per_run: Math.min(50, Math.max(1, int(input, "per_run", 20))),
        active: ["1", "on"].includes(str(input, "active")),
      });
      return redirectWith(req, SOURCES, { success: "Đã lưu nguồn" });
    }),
  },
  {
    method: "POST",
    path: "curate/source/{id:\\d+}/run",
    handler: guarded("curate.source.update", async ({ req, params }) => {
      const s = await getSource(BigInt(params.id));
      if (!s) return redirectWith(req, SOURCES, { error: "Không tìm thấy nguồn" });
      const r = await runSource(s);
      await flash(r.ok ? { success: `${s.name}: ${r.message}` } : { error: `${s.name}: ${r.message}` });
      return back(req, SOURCES);
    }),
  },
  {
    method: "POST",
    path: "curate/source/run-all",
    handler: guarded("curate.source.update", async ({ req }) => {
      const res = [];
      for (const s of (await listSources()).filter((x) => x.active)) res.push(`${s.name}: ${(await runSource(s)).message}`);
      await flash({ success: res.length ? res.join(" · ") : "Không có nguồn nào đang bật" });
      return back(req, ITEMS);
    }),
  },
  {
    method: "POST",
    path: "curate/source/{id:\\d+}/delete",
    handler: guarded("curate.source.update", async ({ req, params }) => {
      await deleteSource(BigInt(params.id));
      return redirectWith(req, SOURCES, { success: "Đã xóa nguồn (các mục đã lấy về vẫn giữ)" });
    }),
  },
];
