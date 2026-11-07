import { Fragment } from "react";
import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions, Thumb } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { AutoSubmitField, SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Alert, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { param, type SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { demTheoNhom, NHOM, paginateFeatures, tenNhom } from "@/modules/home-feature/home-feature";

export const metadata = { title: "Khối trang chủ" };

/** So muc thiet ke cho tung khoi ($soChuan trong index.blade.php) */
const SO_CHUAN: Record<string, number> = { hero_usp: 4, commit: 5, about_badge: 3, why_waco: 6, stat: 4 };

/** GET /home-feature/index — HomeFeatureController@index (view backend/home_feature/index.blade.php) */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("home.feature.index");
  const sp = await searchParams;
  const [{ rows, total, perPage, page }, dem] = await Promise.all([paginateFeatures(sp), demTheoNhom()]);
  const seo = __<{ index: { title: string; table: string } }>("messages.homeFeature");
  const model = "HomeFeature";
  const nhomDangLoc = param(sp, "group");

  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/home-feature/create" label="Thêm mục" />} />
      <Alert className="mb-5 flex gap-2">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Mỗi dòng là một ô nhỏ trên trang chủ. Cột <b>Khối hiển thị</b> cho biết nó nằm ở đâu. Số mục trong mỗi khối đã được thiết kế cố định — thêm hoặc bớt sẽ làm lệch bố
          cục.
        </span>
      </Alert>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(NHOM).map(([ma, ten]) => {
          const dang = dem[ma] ?? 0;
          const chuan = SO_CHUAN[ma];
          const lech = chuan !== undefined && dang !== chuan;
          return (
            <Link
              key={ma}
              href={`/home-feature/index?group=${ma}`}
              className={cn("rounded-lg border bg-card p-3 text-sm transition-colors hover:border-primary", nhomDangLoc === ma && "border-primary ring-2 ring-primary/20")}
            >
              <div className="line-clamp-2 min-h-10 text-muted-foreground">{ten}</div>
              <div className={cn("mt-1 text-lg font-semibold", lech ? "text-destructive" : "text-success")}>
                {dang}
                {chuan ? <span className="text-sm font-normal text-muted-foreground"> / {chuan} mục</span> : " mục"}
              </div>
            </Link>
          );
        })}
        <Link
          href="/home-feature/index"
          className={cn("flex items-center justify-center rounded-lg border bg-card p-3 text-sm font-medium transition-colors hover:border-primary", !nhomDangLoc && "border-primary ring-2 ring-primary/20")}
        >
          Tất cả các khối
        </Link>
      </div>
      <ListCard title={seo.index.table} description="Số mục đếm theo các mục đang hiển thị; số màu đỏ là lệch so với thiết kế.">
        <ListToolbar action="/home-feature/index" searchParams={sp}>
          <AutoSubmitField name="group" defaultValue={nhomDangLoc && nhomDangLoc in NHOM ? nhomDangLoc : ""} className="w-60">
            <option value="">Tất cả các khối</option>
            {Object.entries(NHOM).map(([ma, ten]) => (
              <option key={ma} value={ma}>
                {ten}
              </option>
            ))}
          </AutoSubmitField>
        </ListToolbar>
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead className="w-14">Icon</TableHead>
                <TableHead className="min-w-48">Tiêu đề</TableHead>
                <TableHead>Khối hiển thị</TableHead>
                <TableHead className="w-24 text-center">Con số</TableHead>
                <TableHead className="w-20 text-center">Thứ tự</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={8} />}
              {rows.map((f) => {
                const id = f.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell>{f.icon ? <Thumb src={f.icon} className="size-9 bg-transparent [&>img]:object-contain" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {/* nl2br(e($feature->title)): giu cho xuong dong */}
                      <div className="font-medium">{nl2br(f.title)}</div>
                      {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                      {f.post_id ? <Badge variant="outline" className="mt-1">Liên kết bài viết #{f.post_id.toString()}</Badge> : null}
                    </TableCell>
                    <TableCell className="text-sm">{tenNhom(f.group)}</TableCell>
                    <TableCell className="text-center">{f.value || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">{f.order}</TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={f.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/home-feature/${id}/edit`} deleteHref={`/home-feature/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/home-feature/index", sp)} />
      </ListCard>
    </>
  );
}

function nl2br(s: string) {
  const parts = s.split(/(\r\n|\n\r|\n|\r)/);
  return parts.map((p, i) => (i % 2 === 1 ? <br key={i} /> : <Fragment key={i}>{p}</Fragment>));
}
