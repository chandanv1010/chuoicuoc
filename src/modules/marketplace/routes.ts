import { flash } from "@/lib/flash";
import { back, str, type Input } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import type { FormContext, FormRoute } from "@/server/routes";
import { SocialError } from "@/modules/social/http";
import { accessToken, deleteAccount, getAccount, updateMeta } from "./accounts";
import { isDryRun } from "./config";
import { cancelQueued, getListing, queueListing, requeue, saveSettings, unlink } from "./listings";
import { validAccessToken } from "./oauth";
import { adapterOf } from "./platforms";
import { loadProduct } from "./product-source";
import { DEFAULT_SETTINGS, type ListingSettings } from "./types";
import { startMarketplaceWorker, tick } from "./worker";

/** Form POST cua module san TMDT (trang Tai khoan san, Danh sach san pham tren san, khoi o trang sua san pham). */

function guarded(permission: string, fn: (ctx: FormContext & { adminId: bigint }) => Promise<Response>) {
  return async (ctx: FormContext) => {
    const admin = await authorizeHandler(ctx.req, permission);
    if (admin instanceof Response) return admin;
    return fn({ ...ctx, adminId: admin.id });
  };
}

/** Chay mot luot worker ngay va doi toi da vai giay de trang hien trang thai moi. */
async function kick() {
  startMarketplaceWorker();
  await Promise.race([tick(), new Promise((r) => setTimeout(r, 12_000))]);
}

const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const checked = (input: Input, key: string) => ["1", "on", "true"].includes(str(input, key));

/** Doc lua chon tu form (ten truong chung cho moi san). */
export function settingsFromInput(input: Input): ListingSettings {
  const price = Number(str(input, "price_override").replace(",", "."));
  return {
    publish: str(input, "publish") === "active" ? "active" : "draft",
    title: str(input, "title").trim() || undefined,
    description: str(input, "description").trim() || undefined,
    category_id: str(input, "category_id").trim() || undefined,
    category_label: str(input, "category_label").trim() || undefined,
    tags: list(str(input, "tags")),
    materials: list(str(input, "materials")),
    personalization: {
      enabled: checked(input, "pers_enabled"),
      required: checked(input, "pers_required"),
      question: str(input, "pers_question").trim() || DEFAULT_SETTINGS.personalization.question,
      instructions: str(input, "pers_instructions").trim(),
      max_chars: Math.max(1, Math.min(1024, Number(str(input, "pers_max")) || DEFAULT_SETTINGS.personalization.max_chars)),
    },
    who_made: (["i_did", "someone_else", "collective"].includes(str(input, "who_made")) ? str(input, "who_made") : "i_did") as ListingSettings["who_made"],
    when_made: str(input, "when_made") || "made_to_order",
    shipping_profile_id: str(input, "shipping_profile_id") || undefined,
    return_policy_id: str(input, "return_policy_id") || undefined,
    processing_profile_id: str(input, "processing_profile_id") || undefined,
    price_override: price > 0 ? price : null,
    replace_images: checked(input, "replace_images"),
    brand: str(input, "brand").trim() || undefined,
    attributes: str(input, "attributes").trim() || undefined,
    weight_kg: positive(input, "weight_kg"),
    length_cm: positive(input, "length_cm"),
    width_cm: positive(input, "width_cm"),
    height_cm: positive(input, "height_cm"),
    fx_rate: positive(input, "fx_rate"),
    gtin: str(input, "gtin").replace(/\D/g, "") || undefined,
    variation_theme: str(input, "variation_theme").trim().toUpperCase() || undefined,
  };
}

const positive = (input: Input, key: string) => {
  const n = Number(str(input, key).replace(",", "."));
  return n > 0 ? n : null;
};

export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "marketplace/account/{id:\\d+}/disconnect",
    handler: guarded("marketplace.account.update", async ({ req, params }) => {
      const a = await getAccount(params.id);
      if (a) await deleteAccount(a.id);
      await flash(a ? { success: `Đã ngắt kết nối ${a.name}. Sản phẩm đã đưa lên sàn vẫn giữ nguyên trên sàn.` } : { error: "Tài khoản không tồn tại" });
      return back(req, "/marketplace/account/index");
    }),
  },
  {
    method: "POST",
    path: "marketplace/account/{id:\\d+}/refresh",
    handler: guarded("marketplace.account.update", async ({ req, params }) => {
      const a = await getAccount(params.id);
      if (!a) {
        await flash({ error: "Tài khoản không tồn tại" });
        return back(req, "/marketplace/account/index");
      }
      try {
        if (a.meta?.dry_run || isDryRun(a.platform)) throw new SocialError("Tài khoản thử (dry run) không lấy được dữ liệu thật từ sàn.");
        const token = await validAccessToken(a.id);
        if (!accessToken(a)) throw new SocialError("Mất token, hãy kết nối lại.");
        const data = await adapterOf(a.platform)!.fetchShopData(a.shop_id ?? "", token);
        await updateMeta(a.id, { ...(a.meta ?? {}), ...data });
        await flash({ success: `Đã tải lại cài đặt vận chuyển, đổi trả, thời gian làm hàng của ${a.name}.` });
      } catch (e) {
        await flash({ error: `Không tải được dữ liệu shop: ${(e as Error).message}` });
      }
      return back(req, "/marketplace/account/index");
    }),
  },
  {
    method: "POST",
    path: "marketplace/account/{id:\\d+}/defaults",
    handler: guarded("marketplace.account.update", async ({ req, params, input }) => {
      const a = await getAccount(params.id);
      if (!a) {
        await flash({ error: "Tài khoản không tồn tại" });
        return back(req, "/marketplace/account/index");
      }
      const s = settingsFromInput(input);
      const defaults: Partial<ListingSettings> = {
        publish: s.publish,
        category_id: s.category_id,
        category_label: s.category_label,
        tags: s.tags,
        materials: s.materials,
        who_made: s.who_made,
        when_made: s.when_made,
        shipping_profile_id: s.shipping_profile_id,
        return_policy_id: s.return_policy_id,
        processing_profile_id: s.processing_profile_id,
        personalization: s.personalization,
        brand: s.brand,
        attributes: s.attributes,
        weight_kg: s.weight_kg,
        length_cm: s.length_cm,
        width_cm: s.width_cm,
        height_cm: s.height_cm,
        fx_rate: s.fx_rate,
        variation_theme: s.variation_theme,
      };
      await updateMeta(a.id, { ...(a.meta ?? {}), defaults });
      await flash({ success: `Đã lưu mặc định đăng sản phẩm cho ${a.name}.` });
      return back(req, "/marketplace/account/index");
    }),
  },
  {
    // Khoi "San TMDT" o trang sua san pham: luu lua chon (+ dua vao hang doi neu bam Day len san)
    method: "POST",
    path: "marketplace/listing/save",
    handler: guarded("marketplace.listing.update", async ({ req, input, adminId }) => {
      const productId = BigInt(str(input, "product_id") || "0");
      const a = await getAccount(str(input, "account_id") || "0");
      const fallback = `/product/${productId}/edit`;
      if (!a || !productId) {
        await flash({ error: "Thiếu sản phẩm hoặc tài khoản sàn" });
        return back(req, fallback);
      }
      const settings = settingsFromInput(input);
      if (str(input, "action") !== "push") {
        await saveSettings(productId, a.id, a.platform, settings, adminId);
        await flash({ success: `Đã lưu thông tin đăng ${a.name}.` });
        return back(req, fallback);
      }
      const product = await loadProduct(productId);
      const errs = product ? adapterOf(a.platform)!.validate(product, settings, a) : ["Sản phẩm không tồn tại."];
      if (errs.length) {
        await saveSettings(productId, a.id, a.platform, settings, adminId);
        await flash({ error: `Chưa đẩy được lên ${a.name}: ${errs.join(" ")}` });
        return back(req, fallback);
      }
      const dry = Boolean(a.meta?.dry_run) || isDryRun(a.platform);
      await queueListing(productId, a.id, a.platform, settings, adminId, dry);
      await kick();
      await flash({ success: dry ? `Dry run: đã kiểm tra dữ liệu cho ${a.name} (chưa gửi thật vì chưa có mã app).` : `Đã đưa vào hàng đợi đẩy lên ${a.name}. Trạng thái cập nhật trong bảng bên dưới.` });
      return back(req, fallback);
    }),
  },
  {
    method: "POST",
    path: "marketplace/listing/{id:\\d+}/retry",
    handler: guarded("marketplace.listing.update", async ({ req, params }) => {
      const n = await requeue(BigInt(params.id));
      if (!n) await flash({ error: "Chỉ chạy lại được mục đã đồng bộ, lỗi hoặc chưa đẩy" });
      else {
        await kick();
        const l = await getListing(BigInt(params.id));
        await flash(l?.status === "failed" ? { error: `Vẫn lỗi: ${l.error}` } : { success: "Đã đưa vào hàng đợi và chạy lại" });
      }
      return back(req, "/marketplace/listing/index");
    }),
  },
  {
    method: "POST",
    path: "marketplace/listing/{id:\\d+}/cancel",
    handler: guarded("marketplace.listing.update", async ({ req, params }) => {
      const n = await cancelQueued(BigInt(params.id));
      await flash(n ? { success: "Đã hủy việc đang chờ" } : { error: "Chỉ hủy được việc đang chờ" });
      return back(req, "/marketplace/listing/index");
    }),
  },
  {
    method: "POST",
    path: "marketplace/listing/{id:\\d+}/unlink",
    handler: guarded("marketplace.listing.update", async ({ req, params }) => {
      const n = await unlink(BigInt(params.id));
      await flash(n ? { success: "Đã bỏ liên kết. Sản phẩm trên sàn giữ nguyên; lần đẩy sau sẽ tạo listing mới." } : { error: "Không bỏ liên kết được (đang xử lý?)" });
      return back(req, "/marketplace/listing/index");
    }),
  },
  {
    method: "POST",
    path: "marketplace/listing/run",
    handler: guarded("marketplace.listing.update", async ({ req }) => {
      await kick();
      await flash({ success: "Đã chạy hàng đợi" });
      return back(req, "/marketplace/listing/index");
    }),
  },
];
