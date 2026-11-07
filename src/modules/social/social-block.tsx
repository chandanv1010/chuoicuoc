import Link from "next/link";
import { Section } from "@/components/admin/page";
import { oldInput } from "@/lib/flash";
import { can, getAdmin } from "@/server/auth";
import { listAccounts, publicAccount } from "./accounts";
import { siteBaseUrl, siteUrl, tiktokAudited, whatsappNumber } from "./config";
import { canonicalUrl, SOCIAL_FIELD } from "./enqueue";
import { SocialHistoryTable } from "./history-table";
import { historyOf } from "./posts";
import { SocialPublishBlock } from "./social-block-client";
import type { SocialPublishInput, SourceType } from "./types";
import { startSocialWorker } from "./worker";

/**
 * Khoi "Dang len mang xa hoi" gan vao form san pham / bai viet (server).
 * Dat TRONG AdminForm (o an social_publish di cung form).
 */
export async function SocialPublishSection({
  sourceType,
  item,
}: {
  sourceType: SourceType;
  item: { id: bigint | number | string; name?: string | null; description?: string | null; video?: string | null } | null;
}) {
  const admin = await getAdmin();
  if (!admin || !can(admin, "social.post.create")) return null;
  startSocialWorker();
  const [accounts, old, link] = await Promise.all([listAccounts(), oldInput(), item ? canonicalUrl(sourceType, BigInt(item.id)) : Promise.resolve(null)]);
  let initial: SocialPublishInput | null = null;
  const raw = old<string | null>(SOCIAL_FIELD, null);
  if (raw) {
    try {
      initial = JSON.parse(raw) as SocialPublishInput;
    } catch {
      initial = null;
    }
  }
  return (
    <Section
      title="Đăng lên mạng xã hội"
      description={
        <>
          Chọn kênh, định dạng và nội dung; bài được đưa vào hàng đợi khi bấm Lưu.{" "}
          <Link href="/social/account/index" className="text-primary hover:underline">
            Quản lý tài khoản
          </Link>
        </>
      }
    >
      <SocialPublishBlock
        accounts={accounts.filter((a) => a.status !== "disabled").map(publicAccount)}
        defaults={{ title: item?.name ?? "", description: item?.description ?? "", link, video: item?.video ?? "", linkPattern: siteUrl("__slug__") ?? "", whatsapp: whatsappNumber(), site: siteBaseUrl() }}
        initial={initial}
        tiktokAudited={tiktokAudited()}
      />
    </Section>
  );
}

/** Lich su dang cua san pham / bai viet — dat NGOAI AdminForm (co form rieng cho nut Thu lai/Huy). */
export async function SocialHistorySection({ sourceType, sourceId }: { sourceType: SourceType; sourceId: bigint | number | string }) {
  const admin = await getAdmin();
  if (!admin || !can(admin, "social.post.index")) return null;
  const rows = await historyOf(sourceType, BigInt(sourceId));
  return (
    <div className="-mt-14 mb-20">
      <Section
        title="Lịch sử đăng mạng xã hội"
        actions={
          <Link href={`/social/post/index?source=${sourceType}&source_id=${sourceId}`} className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        }
      >
        <SocialHistoryTable rows={rows} showSource={false} canUpdate={can(admin, "social.post.update")} />
      </Section>
    </div>
  );
}
