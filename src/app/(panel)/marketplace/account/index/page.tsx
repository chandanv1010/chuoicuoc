import { BookOpenIcon, LinkIcon, PlugIcon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import Link from "next/link";
import { ListCard, PageHeader } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { convertDateTime } from "@/lib/helpers";
import { authorize, can } from "@/server/auth";
import { listAccounts, publicAccount } from "@/modules/marketplace/accounts";
import { hasCredentials, isDryRun, redirectUri } from "@/modules/marketplace/config";
import { ListingFields } from "@/modules/marketplace/listing-fields";
import { adapterOf } from "@/modules/marketplace/platforms";
import { ACCOUNT_STATUS_LABEL, MARKETPLACE_INFO, MARKETPLACES } from "@/modules/marketplace/types";
import { startMarketplaceWorker, workerStatus } from "@/modules/marketplace/worker";
import { publicBaseUrl } from "@/modules/social/config";

export const metadata = { title: "Tài khoản sàn TMĐT" };

const REGION = { intl: "Quốc tế", vn: "Việt Nam", both: "VN + quốc tế" } as const;

/** GET /marketplace/account/index — ket noi shop tren cac san TMDT + mac dinh dang san pham. */
export default async function Page() {
  const admin = await authorize("marketplace.account.index");
  startMarketplaceWorker();
  const accounts = await listAccounts();
  const canUpdate = can(admin, "marketplace.account.update");
  const worker = workerStatus();

  return (
    <>
      <PageHeader
        title="Tài khoản sàn TMĐT"
        crumbs={[{ label: "Sàn TMĐT" }, { label: "Tài khoản sàn" }]}
        description="Kết nối shop trên các sàn để đẩy sản phẩm từ website lên sàn."
        actions={
          <Button asChild variant="outline">
            <Link href="/marketplace/listing/index">Sản phẩm trên sàn</Link>
          </Button>
        }
      />

      <div className="mb-5 grid gap-2 rounded-lg border bg-card p-4 text-sm">
        <div className="flex items-start gap-2">
          <BookOpenIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            Hướng dẫn tạo app từng sàn: <code className="rounded bg-muted px-1">docs/MARKETPLACE-SETUP.md</code>. Điền mã vào <code className="rounded bg-muted px-1">.env</code> rồi khởi động lại server. Chưa có mã app thì kết nối sẽ tạo shop thử (dry run) để làm quen.
          </div>
        </div>
        <div className="text-muted-foreground">
          PUBLIC_BASE_URL: <code className="rounded bg-muted px-1">{publicBaseUrl()}</code> · Worker: {worker.started ? "đang chạy" : "chưa chạy"}
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MARKETPLACES.map((m) => {
          const info = MARKETPLACE_INFO[m];
          const ready = info.ready && Boolean(adapterOf(m));
          return (
            <div key={m} className="grid content-between gap-3 rounded-lg border bg-card p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{info.label}</div>
                  {!ready ? <Badge variant="secondary">Sắp có</Badge> : isDryRun(m) ? <Badge variant="warning">Dry run</Badge> : <Badge variant="success">Thật</Badge>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{REGION[info.region]}</div>
                {ready && (
                  <>
                    <div className="mt-1 text-xs text-muted-foreground">{hasCredentials(m) ? "Đã có mã app." : `Chưa có mã app (${info.env}) — kết nối sẽ tạo shop thử.`}</div>
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Callback URL &amp; quyền</summary>
                      <div className="mt-1 break-all">
                        <LinkIcon className="mr-1 inline size-3" />
                        {redirectUri(m)}
                      </div>
                      <div className="mt-1 break-all">{adapterOf(m)!.scopes.join(" ")}</div>
                    </details>
                  </>
                )}
              </div>
              {ready && canUpdate && (
                <Button asChild size="sm">
                  <a href={`/marketplace/connect/${m}`}>
                    <PlugIcon /> Kết nối {info.label}
                  </a>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <ListCard title="Shop đã kết nối">
        {accounts.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">Chưa kết nối shop nào. Bấm “Kết nối” ở trên.</div>}
        <div className="grid gap-4 p-1">
          {accounts.map((a) => {
            const pub = publicAccount(a);
            const id = a.id.toString();
            return (
              <div key={id} className="grid gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {MARKETPLACE_INFO[a.platform]?.label ?? a.platform} · {a.name}
                      </span>
                      <Badge variant={a.status === "active" ? "success" : "destructive"}>{ACCOUNT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                      {a.meta?.dry_run && <Badge variant="warning">Shop thử</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Shop ID {a.shop_id ?? "—"} · {a.currency ?? ""}
                      {a.shop_url && (
                        <>
                          {" · "}
                          <a href={a.shop_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            Xem shop
                          </a>
                        </>
                      )}
                      {a.meta?.refreshed_at && <> · dữ liệu shop cập nhật {convertDateTime(new Date(a.meta.refreshed_at))}</>}
                    </div>
                    {a.last_error && a.status !== "active" && <div className="mt-1 text-xs text-destructive">{a.last_error}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {pub.shipping_profiles.length} cài đặt vận chuyển · {pub.processing_profiles.length} thời gian làm hàng · {pub.return_policies.length} chính sách đổi trả
                    </div>
                  </div>
                  {canUpdate && (
                    <div className="flex flex-wrap gap-2">
                      <form action={`/marketplace/account/${id}/refresh`} method="post">
                        <Button type="submit" variant="outline" size="sm" title="Tải lại shipping profile, chính sách, thời gian làm hàng từ sàn">
                          <RefreshCwIcon /> Tải lại dữ liệu shop
                        </Button>
                      </form>
                      <form action={`/marketplace/account/${id}/disconnect`} method="post">
                        <Button type="submit" variant="ghost" size="sm">
                          <UnplugIcon /> Ngắt
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
                {canUpdate && (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-primary">Mặc định khi đẩy sản phẩm lên shop này</summary>
                    <form action={`/marketplace/account/${id}/defaults`} method="post" className="mt-3 grid gap-4">
                      <ListingFields account={pub} s={pub.defaults} />
                      <div>
                        <Button type="submit" size="sm">
                          Lưu mặc định
                        </Button>
                      </div>
                    </form>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </ListCard>
    </>
  );
}
