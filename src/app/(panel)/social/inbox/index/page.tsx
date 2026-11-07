import { BellIcon, MessageCircleIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, MailIcon, PhoneIcon, RefreshCwIcon, SendIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { AutoSubmitField } from "@/components/admin/fields";
import { ListCard, PageHeader } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";
import { Alert, Badge } from "@/components/ui/misc";
import { convertDateTime } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { param, type SearchParams } from "@/server/admin-list";
import { authorize, can } from "@/server/auth";
import { INBOX_KIND_LABEL, INBOX_PLATFORM_LABEL, INBOX_STATUS_LABEL, inboxCounts, inboxSyncStatus, paginateInbox, startInboxSync, type InboxRow } from "@/modules/social/inbox";
import { splitContacts } from "@/modules/social/lead";
import { telegramStatus, whatsappStatus } from "@/modules/social/notify";
import { canAct } from "@/modules/social/actions";

export const metadata = { title: "Bình luận & tin nhắn" };

/**
 * GET /social/inbox/index — hop thu tong hop binh luan + tin nhan (Facebook, Instagram, website).
 * Mac dinh mo tab "Can tu van": tin co SĐT / email / hoi gia / muon dat / inbox, chua xu ly xong.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await authorize("social.inbox.index");
  startInboxSync();
  const sp = await searchParams;
  const [{ rows, total, perPage, page }, counts, tg] = await Promise.all([paginateInbox(sp), inboxCounts(), telegramStatus()]);
  const sync = inboxSyncStatus();
  const canUpdate = can(admin, "social.inbox.update");
  const view = param(sp, "view") ?? "lead";
  const qs = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    const base = { view, platform: param(sp, "platform") ?? "", kind: param(sp, "kind") ?? "", status: param(sp, "status") ?? "", keyword: param(sp, "keyword") ?? "" };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v && !(k === "view" && v === "lead")) q.set(k, v);
    const s = q.toString();
    return `/social/inbox/index${s ? `?${s}` : ""}`;
  };
  const tiles: { label: string; n: number; href: string; active: boolean; hot?: boolean }[] = [
    { label: "Cần tư vấn", n: counts.leads, href: qs({ view: "lead", kind: "", platform: "", status: "", page: "" }), active: view === "lead" && !param(sp, "kind") && !param(sp, "platform"), hot: true },
    { label: "Chưa xem", n: counts.fresh, href: qs({ view: "all", status: "new", kind: "", platform: "", page: "" }), active: view === "all" && param(sp, "status") === "new" },
    { label: "Bình luận", n: counts.comments, href: qs({ view: "all", kind: "comment", status: "", platform: "", page: "" }), active: view === "all" && param(sp, "kind") === "comment" },
    { label: "Tin nhắn", n: counts.messages, href: qs({ view: "all", kind: "message", status: "", platform: "", page: "" }), active: view === "all" && param(sp, "kind") === "message" },
    { label: "Website", n: counts.website, href: qs({ view: "all", platform: "website", kind: "", status: "", page: "" }), active: view === "all" && param(sp, "platform") === "website" },
    { label: "Tất cả", n: counts.total, href: qs({ view: "all", kind: "", platform: "", status: "", page: "" }), active: view === "all" && !param(sp, "kind") && !param(sp, "platform") && !param(sp, "status") },
  ];

  return (
    <>
      <PageHeader
        title="Bình luận & tin nhắn"
        crumbs={[{ label: "Mạng xã hội" }, { label: "Bình luận & tin nhắn" }]}
        description={
          <>
            Gom bình luận, tin nhắn Facebook / Instagram và form liên hệ, đánh giá trên website. Tự đồng bộ 5 phút một lần
            {sync.lastRun ? `, lần cuối ${convertDateTime(new Date(sync.lastRun.getTime() + 7 * 3600_000), "H:i d/m")}` : ""}. TikTok và Pinterest không cho đọc bình luận qua API.
          </>
        }
        actions={
          <form action="/social/inbox/sync" method="post">
            <Button type="submit">
              <RefreshCwIcon /> Đồng bộ ngay
            </Button>
          </form>
        }
      />
      {sync.problems.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <p className="font-medium">Một số nguồn chưa đọc được:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {sync.problems.map((p) => (
              <li key={p.source}>
                <b>{p.source}</b>: {p.error}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            <Link href="/social/account/index" className="underline">
              Mở Tài khoản kết nối
            </Link>{" "}
            → bấm <b>Kết nối Facebook</b> lại và đồng ý tất cả quyền.
          </p>
        </Alert>
      )}
      <TelegramCard tg={tg} canUpdate={canUpdate} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={cn("rounded-lg border bg-card p-3 text-sm transition-colors hover:border-primary", t.active && "border-primary ring-2 ring-primary/20")}>
            <div className="text-muted-foreground">{t.label}</div>
            <div className={cn("mt-1 text-lg font-semibold", t.hot && t.n > 0 && "text-destructive")}>{t.n}</div>
          </Link>
        ))}
      </div>
      <ListCard title={view === "lead" ? "Khách cần tư vấn" : "Tất cả bình luận & tin nhắn"}>
        <form action="/social/inbox/index" className="flex flex-wrap items-center gap-2 pb-4">
          <input type="hidden" name="view" value={view} />
          <AutoSubmitField name="platform" defaultValue={param(sp, "platform") ?? ""} className="w-36">
            <option value="">Mọi kênh</option>
            {Object.entries(INBOX_PLATFORM_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </AutoSubmitField>
          <AutoSubmitField name="kind" defaultValue={param(sp, "kind") ?? ""} className="w-36">
            <option value="">Mọi loại</option>
            {Object.entries(INBOX_KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </AutoSubmitField>
          <AutoSubmitField name="status" defaultValue={param(sp, "status") ?? ""} className="w-40">
            <option value="">{view === "lead" ? "Chưa xong" : "Mọi trạng thái"}</option>
            {Object.entries(INBOX_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </AutoSubmitField>
          <Input name="keyword" defaultValue={param(sp, "keyword") ?? ""} placeholder="Tìm tên, nội dung, SĐT…" className="w-full sm:w-56" />
        </form>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {view === "lead" ? "Chưa có khách nào cần tư vấn." : "Chưa có bình luận / tin nhắn nào."}{" "}
            {counts.total === 0 && "Bấm “Đồng bộ ngay” để kéo về."}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <InboxItem key={r.id.toString()} r={r} canUpdate={canUpdate} />
            ))}
          </ul>
        )}
        <AdminPagination paginator={makePaginator(total, perPage, page, "/social/inbox/index", sp)} />
      </ListCard>
    </>
  );
}

function InboxItem({ r, canUpdate }: { r: InboxRow; canUpdate: boolean }) {
  const id = r.id.toString();
  const external = r.permalink?.startsWith("http");
  const threadCount = Number(r.thread_count);
  return (
    <li className={cn("grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_260px]", r.status === "new" && r.is_lead ? "bg-destructive/[0.03]" : "")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <Badge variant="outline">{INBOX_PLATFORM_LABEL[r.platform] ?? r.platform}</Badge>
          <Badge variant="secondary">{INBOX_KIND_LABEL[r.kind] ?? r.kind}</Badge>
          {r.parent_remote_id && <Badge variant="secondary">Trả lời</Badge>}
          {r.from_page ? <Badge variant="success">Shop</Badge> : null}
          <span className="font-medium">{r.author_name || "Ẩn danh"}</span>
          <span className="text-xs text-muted-foreground">{convertDateTime(r.created_time, "H:i d/m/Y")}</span>
        </div>
        <p className="mt-1.5 text-sm break-words whitespace-pre-line">
          {splitContacts(r.message ?? "").map((p, i) =>
            p.type === "phone" ? (
              <a key={i} href={`tel:${p.t.replace(/[^\d+]/g, "")}`} className="rounded bg-warning/25 px-1 font-semibold text-amber-800 hover:underline">
                {p.t}
              </a>
            ) : p.type === "email" ? (
              <a key={i} href={`mailto:${p.t}`} className="rounded bg-warning/25 px-1 font-semibold text-amber-800 hover:underline">
                {p.t}
              </a>
            ) : (
              <span key={i}>{p.t}</span>
            ),
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {r.is_lead ? (
            <span className="flex flex-wrap gap-1">
              {(r.lead_reasons ?? "").split(", ").filter(Boolean).map((x) => (
                <Badge key={x} variant="warning">
                  {x}
                </Badge>
              ))}
            </span>
          ) : null}
          {r.status === "spam" && r.lead_reasons?.startsWith("spam") && <Badge variant="destructive">{r.lead_reasons}</Badge>}
          {r.hidden ? <Badge variant="outline">Đã ẩn trên Facebook</Badge> : null}
          {r.replied_at && <Badge variant="success">Đã trả lời {convertDateTime(r.replied_at, "H:i d/m")}</Badge>}
          {r.phones && (
            <span className="flex items-center gap-1">
              <PhoneIcon className="size-3" /> {r.phones}
            </span>
          )}
          {r.emails && (
            <span className="flex items-center gap-1">
              <MailIcon className="size-3" /> {r.emails}
            </span>
          )}
          {r.product_id && (
            <Link href={`/product/${r.product_id}/edit`} className="hover:text-primary">
              Sản phẩm: {r.product_name ?? `#${r.product_id}`}
            </Link>
          )}
          {r.kind === "message" && threadCount > 1 && <span>{threadCount} tin trong hội thoại</span>}
          {r.permalink && (
            <a href={r.permalink} target={external ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              {external ? "Mở để trả lời" : "Xem trong admin"} <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
        {r.note && <p className="mt-2 rounded bg-muted px-2 py-1 text-xs">Ghi chú: {r.note}</p>}
        {canUpdate && !r.from_page && canAct(r) && <ReplyBox r={r} />}
      </div>
      {canUpdate ? (
        <form action={`/social/inbox/${id}/update`} method="post" className="flex flex-wrap items-start gap-2 md:flex-col md:items-stretch">
          <AutoSubmitField name="status" defaultValue={r.status} className="w-40 md:w-full">
            {Object.entries(INBOX_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </AutoSubmitField>
          <div className="flex min-w-0 flex-1 gap-2">
            <Input name="note" defaultValue={r.note ?? ""} placeholder="Ghi chú (đã gọi, báo giá…)" className="min-w-0 flex-1" />
            <Button type="submit" variant="outline" size="sm" className="h-9">
              Lưu
            </Button>
          </div>
          {!r.is_lead && !r.from_page && (
            <Button type="submit" name="is_lead" value="1" variant="ghost" size="sm" className="justify-start text-xs">
              Đánh dấu cần tư vấn
            </Button>
          )}
        </form>
      ) : (
        <div className="text-sm">
          <Badge variant="outline">{INBOX_STATUS_LABEL[r.status] ?? r.status}</Badge>
        </div>
      )}
    </li>
  );
}

/**
 * Tra loi binh luan ngay trong admin: o soan (dien san goi y neu da bam "Goi y tra loi"), nut Gui, an / hien.
 * Moi nut la mot form rieng (khong long form).
 */
function ReplyBox({ r }: { r: InboxRow }) {
  const id = r.id.toString();
  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-2">
      <form action={`/social/inbox/${id}/reply`} method="post" className="grid gap-2">
        <Textarea name="reply" defaultValue={r.reply_draft ?? ""} rows={r.reply_draft ? 3 : 2} placeholder={`Trả lời công khai trên ${INBOX_PLATFORM_LABEL[r.platform]}…`} className="min-h-0 text-sm" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm">
            <SendIcon /> Gửi trả lời
          </Button>
          <Button type="submit" size="sm" variant="outline" formAction={`/social/inbox/${id}/draft`}>
            <SparklesIcon /> Câu mẫu
          </Button>
          <Button type="submit" size="sm" variant="ghost" formAction={`/social/inbox/${id}/hide`} name="hidden" value={r.hidden ? "0" : "1"}>
            {r.hidden ? <EyeIcon /> : <EyeOffIcon />} {r.hidden ? "Hiện lại" : "Ẩn bình luận"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** The cau hinh bao khach can tu van qua Telegram. */
function TelegramCard({ tg, canUpdate }: { tg: Awaited<ReturnType<typeof telegramStatus>>; canUpdate: boolean }) {
  const wa = whatsappStatus();
  const ready = tg.hasToken && tg.chat;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
      <BellIcon className={cn("size-5 shrink-0", ready ? "text-success" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Báo khách cần tư vấn qua Telegram</div>
        <div className="text-xs text-muted-foreground">
          {!tg.hasToken ? (
            <>
              Chưa bật. Tạo bot bằng <b>@BotFather</b> trên Telegram, dán token vào <code>.env</code> dòng <code>TELEGRAM_BOT_TOKEN</code>, khởi động lại web.
            </>
          ) : !tg.chat ? (
            <>Đã có bot. Mở bot trên Telegram, bấm <b>Start</b>, rồi bấm “Kết nối Telegram”.</>
          ) : (
            <>
              Đang báo về <b>{tg.chatName ?? tg.chat}</b> — mỗi khách mới được báo một lần, kiểm tra 5 phút một lần.
            </>
          )}
        </div>
      </div>
      {canUpdate && tg.hasToken && (
        <div className="flex gap-2">
          <form action="/social/inbox/telegram/connect" method="post">
            <Button type="submit" size="sm" variant={tg.chat ? "outline" : "default"}>
              {tg.chat ? "Kết nối lại" : "Kết nối Telegram"}
            </Button>
          </form>
          {tg.chat && (
            <form action="/social/inbox/telegram/test" method="post">
              <Button type="submit" size="sm" variant="outline">
                Gửi thử
              </Button>
            </form>
          )}
        </div>
      )}
      <div className="flex w-full flex-wrap items-center gap-3 border-t pt-3">
        <MessageCircleIcon className={cn("size-5 shrink-0", wa.ready ? "text-success" : "text-muted-foreground")} />
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">WhatsApp (CallMeBot)</span> —{" "}
          {wa.ready ? (
            <>báo cùng lúc với Telegram về số {wa.phone}.</>
          ) : (
            <>
              chưa bật. Nhắn câu kích hoạt cho CallMeBot (xem callmebot.com) để lấy API key, rồi điền <code>CALLMEBOT_WHATSAPP_PHONE</code> và{" "}
              <code>CALLMEBOT_WHATSAPP_APIKEY</code> trong <code>.env</code>.
            </>
          )}
        </div>
        {canUpdate && wa.ready && (
          <form action="/social/inbox/whatsapp/test" method="post">
            <Button type="submit" size="sm" variant="outline">
              Gửi thử WhatsApp
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
