import "server-only";
import { siteName } from "@/lib/site";
import { upsertAccount } from "./accounts";
import type { OAuthKey } from "./types";

/**
 * Tai khoan thu (dry run) khi chua co ma app: de thu ca luong ket noi -> dang -> lich su
 * ma khong can dang nhap that. Moi bai cua tai khoan nay deu gia lap.
 */
export async function createDemoAccounts(key: OAuthKey, userId: bigint) {
  const common = { access_token: "dry-run", scopes: "dry-run", user_id: userId };
  // Ten / username gia lay theo ten shop cua site (systems.homepage_company)
  const shop = await siteName();
  const handle = shop.toLowerCase().replace(/[^a-z0-9]+/g, "") || "shop";
  switch (key) {
    case "facebook": {
      const pages = [
        { id: "demo_page_1", name: `${shop} (thử)`, ig_id: "demo_ig_1", ig_username: `${handle}.demo` },
        { id: "demo_page_2", name: `${shop} Outlet (thử)`, ig_id: null, ig_username: null },
      ];
      await upsertAccount({ ...common, platform: "facebook", name: pages[0].name, username: "Dry run", external_id: "demo_fb_user", page_id: pages[0].id, refresh_token: "dry-run", meta: { dry_run: true, pages } });
      await upsertAccount({ ...common, platform: "instagram", name: `@${handle}.demo`, username: `${handle}.demo`, external_id: "demo_fb_user", page_id: pages[0].id, ig_user_id: "demo_ig_1", meta: { dry_run: true, pages } });
      return [`${shop} (thử)`, `@${handle}.demo`];
    }
    case "tiktok":
      await upsertAccount({ ...common, platform: "tiktok", name: `${shop} TikTok (thử)`, external_id: "demo_tiktok", meta: { dry_run: true } });
      return [`${shop} TikTok (thử)`];
    case "youtube":
      await upsertAccount({ ...common, platform: "youtube", name: `${shop} Channel (thử)`, channel_id: "demo_channel", meta: { dry_run: true } });
      return [`${shop} Channel (thử)`];
    case "pinterest": {
      const boards = [
        { id: "demo_board_1", name: "Best Sellers" },
        { id: "demo_board_2", name: "New Arrivals" },
        { id: "demo_board_3", name: "Gift Ideas" },
      ];
      await upsertAccount({ ...common, platform: "pinterest", name: `${shop} Pinterest (thử)`, username: `${handle}_demo`, external_id: "demo_pinterest", board_id: boards[0].id, meta: { dry_run: true, boards } });
      return [`${shop} Pinterest (thử)`];
    }
    case "x":
      await upsertAccount({ ...common, platform: "x", name: `@${handle}_demo (thử)`, username: `${handle}_demo`, external_id: "demo_x", meta: { dry_run: true } });
      return [`@${handle}_demo (thử)`];
  }
}
