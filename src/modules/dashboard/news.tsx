import { EyeIcon, FileTextIcon, FolderTreeIcon, MailIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { EmptyRow, ListCard } from "@/components/admin/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { FRONTEND_LANGUAGE } from "@/modules/frontend/core";

/**
 * Dashboard cho website tin tuc (Loai website = tin tuc): so bai, luot xem, danh muc, lien he; bieu do bai dang theo
 * thang trong nam; bai xem nhieu; bai moi; lien he moi.
 */

type PostItem = { id: bigint; name: string | null; viewed: number; publish: number; created_at: Date | null; cat: string | null };

async function newsStats() {
  const now = new Date(Date.now() + 7 * 3600_000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1) - 7 * 3600_000);
  const prevStart = new Date(Date.UTC(y, m - 1, 1) - 7 * 3600_000);
  const yearStart = new Date(Date.UTC(y, 0, 1) - 7 * 3600_000);
  const lang = FRONTEND_LANGUAGE;
  const [[totals], [month], [cats], [contacts], perMonth, top, latest, recentContacts] = await Promise.all([
    db.$queryRaw<{ total: bigint; published: bigint; views: bigint | null }[]>`
      SELECT COUNT(*) total, SUM(publish = 2) published, SUM(viewed) views FROM posts WHERE deleted_at IS NULL`,
    db.$queryRaw<{ cur: bigint; prev: bigint }[]>`
      SELECT SUM(created_at >= ${monthStart}) cur, SUM(created_at >= ${prevStart} AND created_at < ${monthStart}) prev
      FROM posts WHERE deleted_at IS NULL`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) c FROM post_catalogues WHERE deleted_at IS NULL`,
    db.$queryRaw<{ total: bigint; cur: bigint }[]>`
      SELECT COUNT(*) total, SUM(created_at >= ${monthStart}) cur FROM contacts WHERE deleted_at IS NULL`,
    db.$queryRaw<{ m: number; c: bigint }[]>`
      SELECT MONTH(DATE_ADD(created_at, INTERVAL 7 HOUR)) m, COUNT(*) c FROM posts
      WHERE deleted_at IS NULL AND created_at >= ${yearStart} GROUP BY m`,
    db.$queryRaw<PostItem[]>`
      SELECT p.id, pl.name, p.viewed, p.publish, p.created_at, pcl.name cat FROM posts p
      LEFT JOIN post_language pl ON pl.post_id = p.id AND pl.language_id = ${lang}
      LEFT JOIN post_catalogue_language pcl ON pcl.post_catalogue_id = p.post_catalogue_id AND pcl.language_id = ${lang}
      WHERE p.deleted_at IS NULL ORDER BY p.viewed DESC, p.id DESC LIMIT 6`,
    db.$queryRaw<PostItem[]>`
      SELECT p.id, pl.name, p.viewed, p.publish, p.created_at, pcl.name cat FROM posts p
      LEFT JOIN post_language pl ON pl.post_id = p.id AND pl.language_id = ${lang}
      LEFT JOIN post_catalogue_language pcl ON pcl.post_catalogue_id = p.post_catalogue_id AND pcl.language_id = ${lang}
      WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC LIMIT 8`,
    db.$queryRaw<{ id: bigint; name: string | null; message: string | null; created_at: Date | null }[]>`
      SELECT id, name, message, created_at FROM contacts WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 5`,
  ]);
  const months = Array.from({ length: 12 }, (_, i) => Number(perMonth.find((r) => Number(r.m) === i + 1)?.c ?? 0));
  const cur = Number(month.cur ?? 0);
  const prev = Number(month.prev ?? 0);
  return {
    year: y,
    month: m,
    total: Number(totals.total),
    published: Number(totals.published ?? 0),
    views: Number(totals.views ?? 0),
    cur,
    grow: prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0,
    cats: Number(cats.c),
    contacts: Number(contacts.total),
    contactsMonth: Number(contacts.cur ?? 0),
    months,
    top,
    latest,
    recentContacts,
  };
}

const fmt = (n: number) => n.toLocaleString("vi-VN");
const day = (d: Date | null) => (d ? new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10).split("-").reverse().join("/") : "");

function Stat({ title, value, icon: Icon, tone, children }: { title: string; value: string; icon: React.ElementType; tone: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{title}</div>
          <div className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</div>
          {children && <div className="mt-1 text-xs text-muted-foreground">{children}</div>}
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export async function NewsDashboard() {
  const s = await newsStats();
  const max = Math.max(1, ...s.months);
  const up = s.grow >= 0;
  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Bài viết" value={fmt(s.total)} icon={FileTextIcon} tone="bg-primary/10 text-primary">
          {fmt(s.published)} đang hiển thị · {fmt(s.cur)} bài tháng này{" "}
          <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success" : "text-destructive")}>
            {up ? <TrendingUpIcon className="size-3.5" /> : <TrendingDownIcon className="size-3.5" />}
            {s.grow}%
          </span>
        </Stat>
        <Stat title="Tổng lượt xem" value={fmt(s.views)} icon={EyeIcon} tone="bg-success/10 text-success">
          Trung bình {fmt(s.total ? Math.round(s.views / s.total) : 0)} lượt / bài
        </Stat>
        <Stat title="Danh mục bài viết" value={fmt(s.cats)} icon={FolderTreeIcon} tone="bg-amber-500/10 text-amber-600">
          <Link href="/post/catalogue/index" className="hover:underline">
            Quản lý danh mục →
          </Link>
        </Stat>
        <Stat title="Liên hệ" value={fmt(s.contacts)} icon={MailIcon} tone="bg-destructive/10 text-destructive">
          {fmt(s.contactsMonth)} liên hệ mới tháng này
        </Stat>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Bài đăng theo tháng năm {s.year}</CardTitle>
              <CardDescription>Số bài viết tạo mới mỗi tháng</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-2">
              {s.months.map((c, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] tabular-nums text-muted-foreground">{c || ""}</span>
                  <div className={cn("w-full rounded-t-md", i === s.month ? "bg-primary" : "bg-primary/35")} style={{ height: `${(c / max) * 100}%`, minHeight: c ? 4 : 0 }} title={`Tháng ${i + 1}: ${c} bài`} />
                  <span className="text-[11px] text-muted-foreground">T{i + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Xem nhiều nhất</CardTitle>
              <CardDescription>Theo tổng lượt xem</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3">
              {s.top.map((p, i) => (
                <li key={String(p.id)} className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/post/${p.id}/edit`} className="line-clamp-2 text-sm font-medium hover:text-primary">
                      {p.name ?? `Bài #${p.id}`}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {fmt(p.viewed)} lượt xem{p.cat ? ` · ${p.cat}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {s.top.length === 0 && <li className="text-sm text-muted-foreground">Chưa có bài viết.</li>}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ListCard title="Bài viết mới" description="8 bài tạo gần nhất">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Lượt xem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.latest.length === 0 && <EmptyRow colSpan={4} text="Chưa có bài viết." />}
              {s.latest.map((p) => (
                <TableRow key={String(p.id)}>
                  <TableCell className="max-w-80">
                    <Link href={`/post/${p.id}/edit`} className="line-clamp-1 font-medium text-primary hover:underline">
                      {p.name ?? `Bài #${p.id}`}
                    </Link>
                    {p.publish !== 2 && (
                      <Badge variant="secondary" className="mt-1">
                        Đang ẩn
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{p.cat}</TableCell>
                  <TableCell>{day(p.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(p.viewed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Liên hệ mới</CardTitle>
              <CardDescription>
                <Link href="/contact/index" className="hover:underline">
                  Xem tất cả →
                </Link>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {s.recentContacts.map((c) => (
                <li key={String(c.id)} className="text-sm">
                  <p className="font-medium">
                    {c.name} <span className="text-xs font-normal text-muted-foreground">· {day(c.created_at)}</span>
                  </p>
                  {c.message && <p className="line-clamp-2 text-xs text-muted-foreground">{c.message}</p>}
                </li>
              ))}
              {s.recentContacts.length === 0 && <li className="text-sm text-muted-foreground">Chưa có liên hệ.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
