import { can, getAdmin } from "@/server/auth";
import { getAccount } from "@/modules/social/accounts";
import { isDryRun, tiktokAudited } from "@/modules/social/config";
import { SocialError } from "@/modules/social/http";
import { validAccessToken } from "@/modules/social/oauth";
import { fakeCreatorInfo, queryCreatorInfo, SELF_ONLY_NOTICE } from "@/modules/social/platforms/tiktok";

/**
 * GET /ajax/social/tiktok/creator-info?account_id= — creator_info cho khoi dang TikTok
 * (bat buoc hien ten tai khoan, quyen rieng tu, comment/duet/stitch theo content-sharing-guidelines).
 */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || !can(admin, "social.post.create")) return Response.json({ error: "Không có quyền" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("account_id") ?? "";
  if (!/^\d+$/.test(id)) return Response.json({ error: "Thiếu tài khoản" }, { status: 400 });
  const account = await getAccount(id);
  if (!account || account.platform !== "tiktok") return Response.json({ error: "Không tìm thấy tài khoản TikTok" }, { status: 404 });
  const audited = tiktokAudited();
  if (account.meta?.dry_run || isDryRun("tiktok")) {
    return Response.json({ ...fakeCreatorInfo(account.name), can_post: true, audited, notice: audited ? null : SELF_ONLY_NOTICE, dry_run: true });
  }
  try {
    const info = await queryCreatorInfo(await validAccessToken(account.id));
    const options = info.privacy_level_options ?? [];
    return Response.json({
      ...info,
      // App chua audit: chi duoc SELF_ONLY
      privacy_level_options: audited ? options : options.filter((o) => o === "SELF_ONLY"),
      can_post: options.length > 0,
      audited,
      notice: audited ? null : SELF_ONLY_NOTICE,
    });
  } catch (e) {
    const msg = e instanceof SocialError ? e.message : (e as Error).message;
    // vd spam_risk_too_many_posts / reached_active_user_cap: tai khoan khong dang duoc luc nay
    return Response.json({ can_post: false, error: `Tài khoản TikTok hiện không đăng được: ${msg}` });
  }
}
