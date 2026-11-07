import { SendIcon } from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { can, getAdmin } from "@/server/auth";
import { listAccounts, publicAccount } from "./accounts";
import { isDryRun } from "./config";
import { ListingFields } from "./listing-fields";
import { listingsOfProduct } from "./listings";
import { ListingTable } from "./listing-table";
import { DEFAULT_SETTINGS, MARKETPLACE_INFO, type ListingSettings } from "./types";
import { startMarketplaceWorker } from "./worker";

/**
 * Khoi "San TMDT" o trang sua san pham — dat NGOAI AdminForm (moi shop mot form rieng).
 * Lua chon da luu cua san pham > mac dinh cua shop > mac dinh chung.
 */
export async function MarketplaceSection({ productId, productName }: { productId: bigint | number | string; productName: string }) {
  const admin = await getAdmin();
  if (!admin || !can(admin, "marketplace.listing.index")) return null;
  startMarketplaceWorker();
  const pid = BigInt(productId);
  const [accounts, listings] = await Promise.all([listAccounts(), listingsOfProduct(pid)]);
  const canUpdate = can(admin, "marketplace.listing.update");
  const names = new Map(accounts.map((a) => [a.id.toString(), a.name]));
  const active = accounts.filter((a) => a.status !== "disabled");

  return (
    <div className="-mt-14 mb-20 grid gap-4">
      <Section
        title="Sàn TMĐT"
        description={
          <>
            Đưa sản phẩm này lên sàn (Etsy…). Tên, mô tả, ảnh, giá, phiên bản lấy từ website; bên dưới là thông tin riêng của sàn.{" "}
            <Link href="/marketplace/account/index" className="text-primary hover:underline">
              Quản lý tài khoản sàn
            </Link>
          </>
        }
      >
        {active.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Chưa kết nối shop nào.{" "}
            <Link href="/marketplace/account/index" className="text-primary hover:underline">
              Kết nối shop
            </Link>
          </div>
        )}
        {canUpdate &&
          active.map((a) => {
            const pub = publicAccount(a);
            const saved = listings.find((l) => l.account_id === a.id);
            const d = (pub.defaults ?? {}) as Partial<ListingSettings>;
            const s: Partial<ListingSettings> = saved ? saved.settings : { ...DEFAULT_SETTINGS, ...d, personalization: { ...DEFAULT_SETTINGS.personalization, ...(d.personalization ?? {}) } };
            const dry = Boolean(a.meta?.dry_run) || isDryRun(a.platform);
            return (
              <details key={a.id.toString()} open={!saved?.remote_id} className="rounded-lg border p-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium">
                  {MARKETPLACE_INFO[a.platform]?.label} · {a.name}
                  {dry && <Badge variant="warning">Dry run</Badge>}
                  {saved?.remote_id && <Badge variant="success">Đã có trên sàn #{saved.remote_id}</Badge>}
                </summary>
                <form action="/marketplace/listing/save" method="post" className="mt-3 grid gap-4">
                  <input type="hidden" name="product_id" value={pid.toString()} />
                  <input type="hidden" name="account_id" value={a.id.toString()} />
                  <ListingFields account={pub} s={s} product={{ name: productName }} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="action" value="push">
                      <SendIcon /> {saved?.remote_id ? "Lưu & đồng bộ lên" : "Lưu & đẩy lên"} {MARKETPLACE_INFO[a.platform]?.label}
                    </Button>
                    <Button type="submit" name="action" value="save" variant="outline">
                      Chỉ lưu
                    </Button>
                    <Button asChild variant="ghost">
                      <a href={`/ajax/marketplace/preview?product_id=${pid}&account_id=${a.id}`} target="_blank" rel="noreferrer" title="Dữ liệu sẽ gửi lên sàn theo lựa chọn đã lưu (không gọi API)">
                        Xem dữ liệu gửi lên sàn
                      </a>
                    </Button>
                  </div>
                </form>
              </details>
            );
          })}
      </Section>
      {listings.length > 0 && (
        <Section title="Trạng thái trên sàn">
          <ListingTable rows={listings.map((l) => ({ ...l, account_name: names.get(l.account_id.toString()) ?? "(đã ngắt)" }))} showProduct={false} canUpdate={canUpdate} />
        </Section>
      )}
    </div>
  );
}
