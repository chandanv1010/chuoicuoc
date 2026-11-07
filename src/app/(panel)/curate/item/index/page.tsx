import { CheckIcon, ExternalLinkIcon, FilePlusIcon, PlayIcon, RefreshCwIcon, Undo2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { ListCard, PageHeader } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/misc";
import { authorize, can } from "@/server/auth";
import { licenseName, PROVIDER_LABEL, type Provider } from "@/modules/curate/providers";
import { countByStatus, paginateItems, PER_PAGE, type CurateItem } from "@/modules/curate/store";
import { startCurateWorker } from "@/modules/curate/worker";

export const metadata = { title: "Kho nội dung" };

const TABS = [
  { key: "new", label: "Chờ duyệt" },
  { key: "approved", label: "Đã chọn" },
  { key: "used", label: "Đã tạo bài" },
  { key: "rejected", label: "Đã loại" },
  { key: "all", label: "Tất cả" },
] as const;
const KIND_LABEL = { image: "Ảnh", video: "Video", article: "Bài viết" } as const;

/** Nhan quyen su dung de admin biet duoc lam gi voi muc nay. */
function Rights({ i }: { i: CurateItem }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary" title={i.license_url ?? undefined}>{licenseName(i.license)}</Badge>
      {!i.can_republish ? (
        <Badge variant="destructive" title="Bài có bản quyền: chỉ trích ngắn + link về bài gốc, không chép nội dung/ảnh">Chỉ trích dẫn + link</Badge>
      ) : i.attribution_required ? (
        <Badge variant="warning" title="Bắt buộc ghi tác giả + nguồn + giấy phép (bài nháp tự chèn sẵn)">Bắt buộc dẫn nguồn</Badge>
      ) : (
        <Badge variant="success" title="Không bắt buộc ghi nguồn; bài nháp vẫn ghi để minh bạch">Dùng tự do</Badge>
      )}
      {!i.can_modify && i.can_republish ? <Badge variant="destructive" title="CC BY-ND: không cắt ghép, chèn chữ/logo">Không chỉnh sửa</Badge> : null}
    </div>
  );
}

function Card({ i, canUpdate }: { i: CurateItem; canUpdate: boolean }) {
  const id = i.id.toString();
  const act = (path: string, label: string, Icon: typeof CheckIcon, variant: "default" | "outline" | "ghost" = "outline") => (
    <form action={`/curate/item/${id}/${path}`} method="post">
      <Button type="submit" size="sm" variant={variant} className="h-7 px-2 text-xs">
        <Icon className="size-3.5" /> {label}
      </Button>
    </form>
  );
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <div className="relative aspect-[4/3] bg-muted">
        {i.thumb_url ? (
          // anh xem truoc lay tu nguon (chi trong admin); khi duyet moi tai ve may chu
          // eslint-disable-next-line @next/next/no-img-element
          <img src={i.thumb_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center p-4 text-center text-sm text-muted-foreground">{i.kind === "article" ? "Bài viết" : "Không có ảnh"}</div>
        )}
        <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
          {i.kind === "video" ? <PlayIcon className="mr-0.5 inline size-3" /> : null}
          {KIND_LABEL[i.kind]}
          {i.duration ? ` · ${Math.floor(i.duration / 60)}:${String(i.duration % 60).padStart(2, "0")}` : ""}
          {i.width && i.height ? ` · ${i.width}×${i.height}` : ""}
        </span>
        {canUpdate && i.status !== "used" ? (
          <input type="checkbox" name="ids" value={id} form="bulk" className="absolute top-2 right-2 size-4" aria-label="Chọn" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 text-xs">
        <div className="line-clamp-2 text-sm font-medium" title={i.title ?? ""}>{i.title || "(không tiêu đề)"}</div>
        {i.excerpt ? <p className="line-clamp-3 text-muted-foreground">{i.excerpt}</p> : null}
        <div className="text-muted-foreground">
          {i.author ? <>Tác giả: {i.author} · </> : null}
          {PROVIDER_LABEL[i.provider as Provider]?.split(" (")[0] ?? i.provider}
        </div>
        <Rights i={i} />
        <p className="rounded bg-muted px-1.5 py-1 text-[11px] break-words text-muted-foreground" title="Dòng dẫn nguồn sẽ chèn vào bài">{i.attribution}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          {i.page_url ? (
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
              <a href={i.page_url} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="size-3.5" /> Gốc
              </a>
            </Button>
          ) : null}
          {i.status === "used" && i.post_id ? (
            <Button asChild size="sm" className="h-7 px-2 text-xs">
              <Link href={`/post/${i.post_id}/edit`}>Mở bài viết</Link>
            </Button>
          ) : canUpdate ? (
            <>
              {act("draft", "Tạo bài nháp", FilePlusIcon, "default")}
              {i.status === "new" ? act("approve", "Chọn", CheckIcon) : null}
              {i.status === "rejected" || i.status === "approved" ? act("restore", "Bỏ chọn", Undo2Icon, "ghost") : null}
              {i.status !== "rejected" ? act("reject", "Loại", XIcon, "ghost") : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** GET /curate/item/index — kho noi dung lay tu nguon mien phi, cho admin duyet. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await authorize("curate.item.index");
  startCurateWorker();
  const sp = await searchParams;
  const status = sp.status || "new";
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, total }, counts] = await Promise.all([
    paginateItems({ status, kind: sp.kind || undefined, provider: sp.provider || undefined, q: sp.q?.trim() || undefined, page }),
    countByStatus(),
  ]);
  const canUpdate = can(admin, "curate.item.update");
  const canSource = can(admin, "curate.source.update");
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (patch: Record<string, string>) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `?${u}`;
  };
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Kho nội dung"
        crumbs={[{ label: "Tìm nguồn nội dung" }, { label: "Kho nội dung" }]}
        description="Ảnh, video, bài viết lấy tự động từ nguồn miễn phí. Chọn mục muốn dùng → “Tạo bài nháp” (tự tải về + chèn dẫn nguồn) → ở trang sửa bài chọn đăng web / mạng xã hội và đặt lịch."
        actions={
          <div className="flex gap-2">
            {canSource && (
              <form action="/curate/source/run-all" method="post">
                <Button type="submit" variant="outline">
                  <RefreshCwIcon /> Lấy ngay
                </Button>
              </form>
            )}
            <Button asChild variant="outline">
              <Link href="/curate/source/index">Nguồn lấy nội dung</Link>
            </Button>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Button key={t.key} asChild size="sm" variant={status === t.key ? "default" : "outline"}>
            <Link href={qs({ status: t.key, page: "" })}>
              {t.label} ({t.key === "all" ? allCount : counts[t.key] ?? 0})
            </Link>
          </Button>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input type="hidden" name="status" value={status} />
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Tiêu đề, tác giả" className="w-56" />
        <NativeSelect name="kind" defaultValue={sp.kind ?? ""} className="w-36">
          <option value="">Mọi loại</option>
          {Object.entries(KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="provider" defaultValue={sp.provider ?? ""} className="w-48">
          <option value="">Mọi nguồn</option>
          {Object.entries(PROVIDER_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.split(" (")[0]}</option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">Lọc</Button>
      </form>
      <ListCard
        title={`${total} mục`}
        description={
          canUpdate && status !== "used" ? (
            <form id="bulk" action="/curate/item/bulk" method="post" className="flex items-center gap-2">
              <span>Mục đã tick:</span>
              <NativeSelect name="bulk" defaultValue="" className="h-8 w-40">
                <option value="">Chọn thao tác</option>
                <option value="approve">Đưa vào “Đã chọn”</option>
                <option value="reject">Loại</option>
                <option value="restore">Về “Chờ duyệt”</option>
              </NativeSelect>
              <Button type="submit" size="sm" variant="outline">Áp dụng</Button>
            </form>
          ) : undefined
        }
      >
        {rows.length ? (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((i) => (
              <Card key={i.id.toString()} i={i} canUpdate={canUpdate} />
            ))}
          </div>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Chưa có mục nào ở đây. {canSource ? "Bấm “Lấy ngay” hoặc thêm nguồn." : ""}
          </p>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 p-3 text-sm">
            {page > 1 && <Link href={qs({ page: String(page - 1) })} className="text-primary hover:underline">← Trước</Link>}
            <span className="text-muted-foreground">Trang {page}/{pages}</span>
            {page < pages && <Link href={qs({ page: String(page + 1) })} className="text-primary hover:underline">Sau →</Link>}
          </div>
        )}
      </ListCard>
      <p className="mt-3 text-xs text-muted-foreground">
        Quy tắc pháp lý áp dụng tự động: chỉ lấy giấy phép cho phép dùng thương mại (CC0, public domain, CC BY, CC BY-SA, CC BY-ND, Pexels, Pixabay), bỏ CC “NC”.
        Bài báo từ RSS có bản quyền: chỉ lưu tiêu đề + tóm tắt ≤ 280 ký tự + link, không tải ảnh của bài; bài nháp yêu cầu bạn tự viết nội dung.
      </p>
    </>
  );
}
