import { PlayIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { ListCard, PageHeader } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { convertDateTime } from "@/lib/helpers";
import { authorize, can } from "@/server/auth";
import { missingKey, PROVIDER_LABEL, PROVIDER_MEDIA, type Provider } from "@/modules/curate/providers";
import { listSources } from "@/modules/curate/store";

export const metadata = { title: "Nguồn lấy nội dung" };

const MEDIA_LABEL = { image: "Ảnh", video: "Video", article: "Bài viết" } as const;

/** GET /curate/source/index — danh sach nguon + form them / sua (?edit=id). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await authorize("curate.item.index");
  const canUpdate = can(admin, "curate.source.update");
  const sp = await searchParams;
  const sources = await listSources();
  const editing = sources.find((s) => s.id.toString() === sp.edit) ?? null;

  return (
    <>
      <PageHeader
        title="Nguồn lấy nội dung"
        crumbs={[{ label: "Tìm nguồn nội dung" }, { label: "Nguồn lấy nội dung" }]}
        description="Mỗi nguồn là một từ khóa (ảnh/video) hoặc một URL RSS (bài viết). Hệ thống tự lấy theo chu kỳ; mục trùng không lấy lại."
        actions={
          <Button asChild variant="outline">
            <Link href="/curate/item/index">Kho nội dung</Link>
          </Button>
        }
      />
      <ListCard title={`${sources.length} nguồn`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Nguồn</TableHead>
              <TableHead>Từ khóa / feed</TableHead>
              <TableHead>Chu kỳ</TableHead>
              <TableHead>Lần chạy gần nhất</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => {
              const key = missingKey(s.provider);
              return (
                <TableRow key={s.id.toString()}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="mt-0.5 flex gap-1">
                      <Badge variant={s.active ? "success" : "secondary"}>{s.active ? "Đang bật" : "Tắt"}</Badge>
                      <Badge variant="secondary">{MEDIA_LABEL[s.media]}</Badge>
                      {key ? <Badge variant="warning">Thiếu {key}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{PROVIDER_LABEL[s.provider]?.split(" (")[0]}</TableCell>
                  <TableCell className="max-w-64 truncate text-sm" title={s.query ?? ""}>{s.query}</TableCell>
                  <TableCell className="text-sm">{s.interval_hours} giờ · {s.per_run} mục</TableCell>
                  <TableCell className="max-w-72 text-xs">
                    <div>{s.last_run_at ? convertDateTime(s.last_run_at) : "Chưa chạy"}</div>
                    <div className={s.last_result?.startsWith("Lỗi") ? "text-destructive" : "text-muted-foreground"}>{s.last_result}</div>
                  </TableCell>
                  <TableCell>
                    {canUpdate && (
                      <div className="flex justify-end gap-1">
                        <form action={`/curate/source/${s.id}/run`} method="post">
                          <Button type="submit" size="sm" variant="outline" disabled={!!key}>
                            <PlayIcon className="size-3.5" /> Lấy ngay
                          </Button>
                        </form>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`?edit=${s.id}`}>Sửa</Link>
                        </Button>
                        <form action={`/curate/source/${s.id}/delete`} method="post">
                          <Button type="submit" size="sm" variant="ghost" aria-label="Xóa">
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </form>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ListCard>

      {canUpdate && (
        <ListCard title={editing ? `Sửa nguồn: ${editing.name}` : "Thêm nguồn"}>
          <form action="/curate/source/save" method="post" className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {editing && <input type="hidden" name="id" value={editing.id.toString()} />}
            <label className="grid gap-1 text-sm">
              Tên
              <Input name="name" required defaultValue={editing?.name ?? ""} placeholder="VD: Pexels – video máy thêu" />
            </label>
            <label className="grid gap-1 text-sm">
              Nguồn + loại
              <NativeSelect name="provider_media" defaultValue={editing ? `${editing.provider}:${editing.media}` : "openverse:image"}>
                {(Object.keys(PROVIDER_MEDIA) as Provider[]).flatMap((p) =>
                  PROVIDER_MEDIA[p].map((m) => (
                    <option key={`${p}:${m}`} value={`${p}:${m}`}>
                      {PROVIDER_LABEL[p].split(" (")[0]} – {MEDIA_LABEL[m]}{missingKey(p) ? " (cần key)" : ""}
                    </option>
                  )),
                )}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              Từ khóa (tiếng Anh) hoặc URL RSS
              <Input name="query" required defaultValue={editing?.query ?? ""} placeholder="home decor / https://.../feed" />
            </label>
            <label className="grid gap-1 text-sm">
              Chu kỳ (giờ)
              <Input name="interval_hours" type="number" min={1} max={720} defaultValue={editing?.interval_hours ?? 24} />
            </label>
            <label className="grid gap-1 text-sm">
              Số mục mỗi lần (tối đa 50)
              <Input name="per_run" type="number" min={1} max={50} defaultValue={editing?.per_run ?? 20} />
            </label>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="active" value="1" defaultChecked={editing ? !!editing.active : true} /> Bật tự động lấy
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit">{editing ? "Lưu" : "Thêm nguồn"}</Button>
              {editing && (
                <Button asChild variant="ghost">
                  <Link href="?">Hủy</Link>
                </Button>
              )}
            </div>
          </form>
          <div className="space-y-1 border-t p-4 text-xs text-muted-foreground">
            <p>Openverse và Wikimedia Commons dùng không cần key. Pexels / Pixabay (video MP4 chất lượng cao, hợp đăng Reels/TikTok) cần key miễn phí: dán vào .env (PEXELS_API_KEY, PIXABAY_API_KEY) rồi khởi động lại site.</p>
            <p>RSS: dán link feed của blog / trang tin ngành may thêu (thường là …/feed hoặc …/rss). Bài báo có bản quyền nên chỉ lấy tiêu đề, tóm tắt ngắn và link.</p>
          </div>
        </ListCard>
      )}
    </>
  );
}
