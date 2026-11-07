import { BookOpenIcon, LinkIcon, PlugIcon, UnplugIcon } from "lucide-react";
import Link from "next/link";
import { ListCard, PageHeader } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-controls";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { convertDateTime, now } from "@/lib/helpers";
import { authorize, can } from "@/server/auth";
import { listAccounts, type AccountRow } from "@/modules/social/accounts";
import { hasCredentials, isDryRun, publicBaseUrl, publicUrlProblem, redirectUri } from "@/modules/social/config";
import { SCOPES } from "@/modules/social/oauth";
import { ACCOUNT_STATUS_LABEL, OAUTH_KEYS, PLATFORM_LABEL, type OAuthKey } from "@/modules/social/types";
import { startSocialWorker, workerStatus } from "@/modules/social/worker";

export const metadata = { title: "Tài khoản mạng xã hội" };

const KEY_LABEL: Record<OAuthKey, string> = { facebook: "Facebook + Instagram", tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest", x: "X (Twitter)" };
const ENV_HINT: Record<OAuthKey, string> = {
  facebook: "META_APP_ID, META_APP_SECRET",
  tiktok: "TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET",
  youtube: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
  pinterest: "PINTEREST_APP_ID, PINTEREST_APP_SECRET",
  x: "X_CLIENT_ID, X_CLIENT_SECRET",
};

function Expiry({ a }: { a: AccountRow }) {
  if (a.meta?.dry_run) return <span className="text-muted-foreground">—</span>;
  if (!a.token_expires_at) return <span className="text-muted-foreground">Không hết hạn</span>;
  const soon = a.token_expires_at.getTime() < now().getTime();
  const auto = a.platform !== "facebook" && a.platform !== "instagram";
  return (
    <span className={soon && !auto ? "text-destructive" : ""}>
      {convertDateTime(a.token_expires_at)}
      {auto && <span className="block text-[11px] text-muted-foreground">tự làm mới</span>}
    </span>
  );
}

/** GET /social/account/index — Tai khoan ket noi (Facebook Page, Instagram, TikTok, YouTube, Pinterest, X). */
export default async function Page() {
  const admin = await authorize("social.account.index");
  startSocialWorker();
  const accounts = await listAccounts();
  const canUpdate = can(admin, "social.account.update");
  const problem = publicUrlProblem();
  const worker = workerStatus();

  return (
    <>
      <PageHeader
        title="Tài khoản kết nối"
        crumbs={[{ label: "Mạng xã hội" }, { label: "Tài khoản kết nối" }]}
        description="Kết nối kênh để đăng sản phẩm và bài viết lên mạng xã hội."
        actions={
          <Button asChild variant="outline">
            <Link href="/social/post/index">Lịch sử đăng</Link>
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 rounded-lg border bg-card p-4 text-sm">
        <div className="flex items-start gap-2">
          <BookOpenIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            Hướng dẫn tạo app và xin quyền từng nền tảng: <code className="rounded bg-muted px-1">docs/SOCIAL-API-SETUP.md</code> (trong mã nguồn). Điền mã vào <code className="rounded bg-muted px-1">.env</code> rồi khởi động lại server.
          </div>
        </div>
        <div className="text-muted-foreground">
          PUBLIC_BASE_URL: <code className="rounded bg-muted px-1">{publicBaseUrl()}</code>
          {problem && <div className="mt-1 text-amber-700">{problem} Instagram và ảnh TikTok sẽ báo lỗi; Facebook, YouTube, Pinterest, video TikTok vẫn gửi file trực tiếp.</div>}
        </div>
        <div className="text-xs text-muted-foreground">Worker hàng đợi: {worker.started ? "đang chạy" : "chưa chạy"}</div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {OAUTH_KEYS.map((key) => {
          const creds = hasCredentials(key);
          const dry = isDryRun(key === "facebook" ? "facebook" : key);
          return (
            <div key={key} className="grid content-between gap-3 rounded-lg border bg-card p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{KEY_LABEL[key]}</div>
                  {dry ? <Badge variant="warning">Dry run</Badge> : <Badge variant="success">Thật</Badge>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {creds ? "Đã có mã app." : `Chưa có mã app (${ENV_HINT[key]}) — kết nối sẽ tạo tài khoản thử.`}
                </div>
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Redirect URI &amp; quyền</summary>
                  <div className="mt-1 break-all">
                    <LinkIcon className="mr-1 inline size-3" />
                    {redirectUri(key)}
                  </div>
                  <div className="mt-1 break-all">{SCOPES[key].join(", ")}</div>
                </details>
              </div>
              {canUpdate && (
                <Button asChild size="sm">
                  {/* Route handler (OAuth) — dung <a> de khong prefetch */}
                  <a href={`/social/connect/${key}`}>
                    <PlugIcon /> Kết nối {KEY_LABEL[key]}
                  </a>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <ListCard title="Tài khoản đã kết nối">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kênh</TableHead>
              <TableHead>Tài khoản</TableHead>
              <TableHead className="w-36 text-center">Trạng thái</TableHead>
              <TableHead className="w-40">Token hết hạn</TableHead>
              <TableHead>Page / Board</TableHead>
              <TableHead className="w-40 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Chưa kết nối tài khoản nào. Bấm “Kết nối” ở trên.
                </td>
              </tr>
            )}
            {accounts.map((a) => {
              const id = a.id.toString();
              const key: OAuthKey = a.platform === "instagram" ? "facebook" : a.platform;
              return (
                <TableRow key={id}>
                  <TableCell className="font-medium">{PLATFORM_LABEL[a.platform]}</TableCell>
                  <TableCell>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.username && a.username !== a.name ? `${a.username} · ` : ""}
                      {a.page_id ?? a.channel_id ?? a.ig_user_id ?? a.external_id}
                    </div>
                    {a.meta?.dry_run && (
                      <Badge variant="warning" className="mt-1">
                        Tài khoản thử
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={a.status === "active" ? "success" : "destructive"}>{ACCOUNT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                    {a.last_error && a.status !== "active" && <div className="mt-1 max-w-48 text-left text-[11px] text-destructive">{a.last_error}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Expiry a={a} />
                  </TableCell>
                  <TableCell>
                    {a.platform === "facebook" && (a.meta?.pages?.length ?? 0) > 0 && canUpdate ? (
                      <form action={`/social/account/${id}/update`} method="post" className="flex gap-2">
                        <NativeSelect name="page_id" defaultValue={a.page_id ?? ""} className="h-8 w-48 text-xs">
                          {a.meta!.pages!.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.ig_username ? ` (IG @${p.ig_username})` : ""}
                            </option>
                          ))}
                        </NativeSelect>
                        <Button type="submit" size="sm" variant="outline">
                          Chọn Page
                        </Button>
                      </form>
                    ) : a.platform === "pinterest" && (a.meta?.boards?.length ?? 0) > 0 && canUpdate ? (
                      <form action={`/social/account/${id}/update`} method="post" className="flex gap-2">
                        <NativeSelect name="board_id" defaultValue={a.board_id ?? ""} className="h-8 w-48 text-xs">
                          {a.meta!.boards!.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </NativeSelect>
                        <Button type="submit" size="sm" variant="outline">
                          Board mặc định
                        </Button>
                      </form>
                    ) : a.platform === "instagram" ? (
                      <span className="text-xs text-muted-foreground">Liên kết với Page {a.meta?.pages?.find((p) => p.id === a.page_id)?.name ?? a.page_id}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canUpdate && (
                      <div className="flex flex-wrap justify-end gap-1">
                        {a.status !== "active" && (
                          <Button asChild size="sm" variant="outline">
                            <a href={`/social/connect/${key}`}>
                              <PlugIcon /> Kết nối lại
                            </a>
                          </Button>
                        )}
                        <form action={`/social/account/${id}/disconnect`} method="post">
                          <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                            <UnplugIcon /> Ngắt
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
    </>
  );
}
