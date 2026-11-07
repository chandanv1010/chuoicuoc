import { Pager } from "@/components/site/pager";
import { SiteFrame } from "@/components/site/site-frame";
import { url } from "@/modules/frontend/helpers";
import { resolvePage } from "@/modules/frontend/paginator";
import { requireCustomerPage } from "@/modules/frontend/shop/customer";
import { paginatePointHistory } from "@/modules/frontend/shop/orders";
import { numberFormat, padLeft, ucfirst } from "@/modules/frontend/shop/php";
import { usDate } from "@/modules/frontend/store";
import { AccountShell } from "@/modules/frontend/shop/views";

type SP = Promise<Record<string, string | string[] | undefined>>;

const TYPE_LABELS: Record<string, string> = {
  earn: "Cộng điểm",
  revertEarn: "Hoàn lại điểm đã cộng",
  use: "Dùng điểm",
  revertUsed: "Hoàn lại điểm đã dùng",
  revertUse: "Hoàn lại điểm đã dùng",
};

/** GET /account/rewards.html — CustomerController@pointHistory (bang customer_point_history). */
export default async function CustomerPointHistoryPage({ searchParams }: { searchParams: SP }) {
  const customer = await requireCustomerPage();
  const sp = await searchParams;
  const page = resolvePage(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const list = await paginatePointHistory(customer.id, page);
  const seo = { meta_title: "Điểm thưởng", meta_keyword: "", meta_description: "", meta_image: "", canonical: url("account/rewards.html") };
  const lastPage = Math.max(1, Math.ceil(list.total / list.perPage));

  return (
    <SiteFrame seo={seo}>
      <AccountShell title="Điểm thưởng" crumb="Lịch sử giao dịch" wide>
        <p className="mb-4 text-sm">
          Số dư hiện tại: <strong>{numberFormat(customer.point ?? 0)} điểm</strong>
        </p>
        {list.rows.length === 0 ? (
          <div className="rounded-lg border border-az-border p-6 text-sm">
            <p className="font-bold">Chưa có giao dịch nào</p>
            <p className="text-az-muted">Điểm thưởng sẽ hiển thị ở đây sau khi đơn hàng hoàn tất.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-az-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#f0f2f2] text-left text-xs text-az-muted uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Giao dịch
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Đơn hàng
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Loại
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Điểm
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Ngày
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Ghi chú
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((h) => (
                  <tr key={String(h.id)} className="border-t border-az-border">
                    <td className="px-3 py-2 font-bold">#{padLeft(h.id, 5)}</td>
                    <td className="px-3 py-2">
                      {h.order_code ? (
                        <a href={`/account/orders/${encodeURIComponent(h.order_code)}.html`} className="az-link">
                          #{h.order_code}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2">{TYPE_LABELS[h.type] ?? ucfirst(h.type)}</td>
                    <td className={`px-3 py-2 text-right font-bold ${h.points < 0 ? "text-az-deal" : "text-az-success"}`}>
                      {h.points > 0 ? "+" : h.points < 0 ? "-" : ""}
                      {numberFormat(Math.abs(h.points))}
                    </td>
                    <td className="px-3 py-2">{usDate(h.created_at, true)}</td>
                    <td className="px-3 py-2">{h.description ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} lastPage={lastPage} href={(p) => `/account/rewards.html${p > 1 ? `?page=${p}` : ""}`} />
      </AccountShell>
    </SiteFrame>
  );
}
