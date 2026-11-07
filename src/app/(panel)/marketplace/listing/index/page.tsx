import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { ListCard, PageHeader } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { authorize, can } from "@/server/auth";
import { listAccounts } from "@/modules/marketplace/accounts";
import { listListings } from "@/modules/marketplace/listings";
import { ListingTable } from "@/modules/marketplace/listing-table";
import { LISTING_STATUS_LABEL, MARKETPLACE_INFO } from "@/modules/marketplace/types";
import { startMarketplaceWorker } from "@/modules/marketplace/worker";

export const metadata = { title: "Sản phẩm trên sàn TMĐT" };

const PER_PAGE = 30;

/** GET /marketplace/listing/index — trang thai dong bo san pham len cac san. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await authorize("marketplace.listing.index");
  startMarketplaceWorker();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const accountId = sp.account_id && /^\d+$/.test(sp.account_id) ? BigInt(sp.account_id) : null;
  const [{ rows, total }, accounts] = await Promise.all([listListings({ status: sp.status || undefined, accountId, q: sp.q?.trim() || undefined, page, perPage: PER_PAGE }), listAccounts()]);
  const canUpdate = can(admin, "marketplace.listing.update");
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Sản phẩm trên sàn"
        crumbs={[{ label: "Sàn TMĐT" }, { label: "Sản phẩm trên sàn" }]}
        description="Đưa sản phẩm lên sàn ở trang sửa sản phẩm (khối “Sàn TMĐT”). Trang này theo dõi trạng thái đồng bộ."
        actions={
          <div className="flex gap-2">
            {canUpdate && (
              <form action="/marketplace/listing/run" method="post">
                <Button type="submit" variant="outline">
                  <PlayIcon /> Chạy hàng đợi
                </Button>
              </form>
            )}
            <Button asChild variant="outline">
              <Link href="/marketplace/account/index">Tài khoản sàn</Link>
            </Button>
          </div>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Tên sản phẩm" className="w-56" />
        <NativeSelect name="account_id" defaultValue={sp.account_id ?? ""} className="w-56">
          <option value="">Tất cả shop</option>
          {accounts.map((a) => (
            <option key={a.id.toString()} value={a.id.toString()}>
              {MARKETPLACE_INFO[a.platform]?.label} · {a.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">Mọi trạng thái</option>
          {Object.entries(LISTING_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Lọc
        </Button>
      </form>
      <ListCard title={`${total} sản phẩm`}>
        <ListingTable rows={rows} showProduct canUpdate={canUpdate} />
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 p-3 text-sm">
            {page > 1 && <Link href={qs(page - 1)} className="text-primary hover:underline">← Trước</Link>}
            <span className="text-muted-foreground">
              Trang {page}/{pages}
            </span>
            {page < pages && <Link href={qs(page + 1)} className="text-primary hover:underline">Sau →</Link>}
          </div>
        )}
      </ListCard>
    </>
  );
}
