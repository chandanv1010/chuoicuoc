import { format } from "date-fns";
import { PageHeader } from "@/components/admin/page";
import { Badge } from "@/components/ui/misc";
import { authorize } from "@/server/auth";
import { listPages } from "@/modules/builder/pages";
import { NewPageForm } from "./new-page-form";
import { OverridePicker } from "./override-picker";

export const metadata = { title: "Trình dựng giao diện" };

type Item = Awaited<ReturnType<typeof listPages>>["pages"][number];

function Card({ p, note }: { p: Item; note?: string }) {
  return (
    <a href={`/builder/${p.slug}/edit`} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold group-hover:text-primary">{p.title}</h2>
        {p.publishedAt ? <Badge>Đang xuất bản</Badge> : <Badge variant="secondary">{note === "custom" ? "Chưa xuất bản" : "Giao diện code"}</Badge>}
      </div>
      {p.landing && <p className="mt-1 truncate text-xs text-primary">/{p.landing}.html</p>}
      <p className="mt-2 text-sm text-muted-foreground">
        {p.updatedAt ? `Sửa lần cuối ${format(p.updatedAt, "dd/MM/yyyy HH:mm")}` : note && note !== "custom" ? note : "Chưa sửa — mở để bắt đầu từ giao diện hiện tại"}
        {p.hasDraftChanges && p.publishedAt ? " · có bản nháp chưa xuất bản" : ""}
      </p>
      <span className="mt-4 inline-flex text-sm font-medium text-primary">Mở trình dựng →</span>
    </a>
  );
}

/** GET /builder/index — trang dung bang trinh dung giao dien: trang chinh, template trang con, thiet ke rieng. */
export default async function Page() {
  await authorize("home.feature.index");
  const { pages, templates, overrides, landings, parts } = await listPages();
  return (
    <>
      <PageHeader title="Trình dựng giao diện" crumbs={[{ label: "Trình dựng giao diện" }]} />
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase">Trang & phần chung</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pages.map((p) => (
              <Card key={p.slug} p={p} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground uppercase">Landing page</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Trang tự do với đường dẫn riêng (vd. /khuyen-mai-tet.html): bắt đầu từ trang trắng, tự chọn có header / footer hay không trong “Cài đặt trang” (bấm vào vùng trống của canvas). Xuất bản xong mới truy cập được.
          </p>
          <NewPageForm kind="landing" />
          {landings.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {landings.map((p) => (
                <Card key={p.slug} p={p} note="custom" />
              ))}
            </div>
          )}
        </section>
        <section id="parts">
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground uppercase">Header / Footer riêng</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Bản header / footer khác phần chung (vd. header tối giản cho landing page). Bắt đầu từ bản đang dùng; trang nào muốn dùng thì chọn trong “Cài đặt trang”.
          </p>
          <NewPageForm kind="part" />
          {parts.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {parts.map((p) => (
                <Card key={p.slug} p={p} note="custom" />
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground uppercase">Template trang con</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Dựng một lần, mọi trang cùng loại tự theo (tên, giá, ảnh, nội dung lấy theo trang đang xem). Chưa xuất bản thì trang vẫn dùng giao diện code.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((p) => (
              <Card key={p.slug} p={p} note="Chưa sửa — bắt đầu từ bố cục hiện tại" />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground uppercase">Thiết kế riêng từng trang</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Một sản phẩm, danh mục hay bài viết cần giao diện khác template: chọn loại, tìm trang rồi bấm “Thiết kế riêng”. Bản thiết kế bắt đầu từ template hiện tại; xuất bản xong chỉ trang đó dùng, các trang khác vẫn theo template.
          </p>
          <OverridePicker existing={overrides.map((o) => o.slug)} />
          {overrides.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {overrides.map((p) => (
                <Card key={p.slug} p={p} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Chưa có trang nào thiết kế riêng.</p>
          )}
        </section>
      </div>
    </>
  );
}
