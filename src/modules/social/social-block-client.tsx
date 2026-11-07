"use client";

import { ArrowDownIcon, ArrowUpIcon, FilmIcon, InfoIcon, RefreshCwIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { Checkbox, Switch } from "@/components/ui/interactive";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import {
  captionLength,
  FORMAT_SPECS,
  formatsOf,
  PLATFORM_LABEL,
  TEXT_LIMITS,
  withHashtags,
  type Format,
  type Platform,
  type SocialPublishInput,
  type SocialTargetInput,
  type TikTokOptions,
} from "./types";

/**
 * Khoi "Dang len mang xa hoi" trong form san pham / bai viet.
 * Gui len bang 1 o an social_publish (JSON) -> enqueue.ts tao social_posts sau khi luu.
 * Anh lay truc tiep tu o "Anh dai dien" + "Album anh" cua form (doc DOM dinh ky).
 * Phan TikTok lam theo https://developers.tiktok.com/doc/content-sharing-guidelines
 */

export type BlockAccount = {
  id: string;
  platform: Platform;
  name: string;
  username: string | null;
  status: string;
  board_id: string | null;
  boards: { id: string; name: string }[];
  dry_run: boolean;
};

/**
 * whatsapp: so quoc te chi gom chu so (vd 84961164235), rong = khong them dong lien he.
 * site: goc website cong khai (vd https://example.com) cho chu ky Instagram.
 */
type Defaults = { title: string; description: string; link: string | null; video: string; linkPattern: string; whatsapp: string; site: string };

type SuggestInput = { title: string; description: string; link: string | null; whatsapp: string; site: string };

/** Chu ky mac dinh cuoi bai: link website + WhatsApp (Instagram: caption khong co link bam duoc -> ghi ten mien / so). */
function signature(platform: Platform, d: SuggestInput) {
  if (platform === "facebook") {
    return [d.link && `🛒 Shop now: ${d.link}`, d.whatsapp && `📲 WhatsApp: https://wa.me/${d.whatsapp}`].filter(Boolean).join("\n");
  }
  if (platform === "instagram") {
    const host = d.site.replace(/^https?:\/\//, "");
    return [host && !/localhost|127\.0\.0\.1/.test(host) && `🛒 Shop: ${host}`, d.whatsapp && `📲 WhatsApp: +${d.whatsapp}`].filter(Boolean).join("\n");
  }
  if (platform === "x") {
    // X: 280 ky tu -> chu ky gon; link tinh 23 ky tu
    return [d.link && `🛒 ${d.link}`, d.whatsapp && `📲 wa.me/${d.whatsapp}`].filter(Boolean).join("\n");
  }
  return "";
}

/** Cat theo cach dem cua nen tang (X: link 23, emoji 2). */
function cutFor(platform: Platform, s: string, n: number) {
  if (captionLength(platform, s) <= n) return s;
  let out = s;
  while (out && captionLength(platform, `${out}…`) > n) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

type TargetState = {
  checked: boolean;
  format: Format;
  title: string;
  caption: string;
  board_id: string;
  privacy: string;
  tags: string;
  tiktok: TikTokOptions;
};

type CreatorInfo = {
  creator_nickname?: string;
  creator_username?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
  can_post?: boolean;
  error?: string;
  notice?: string | null;
  dry_run?: boolean;
};

const PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Mọi người",
  MUTUAL_FOLLOW_FRIENDS: "Bạn bè (theo dõi lẫn nhau)",
  FOLLOWER_OF_CREATOR: "Người theo dõi",
  SELF_ONLY: "Chỉ mình tôi",
};

const EMPTY_TIKTOK: TikTokOptions = {
  privacy_level: "",
  // Comment/Duet/Stitch mac dinh tat theo huong dan TikTok
  disable_comment: true,
  disable_duet: true,
  disable_stitch: true,
  commercial: false,
  brand_organic: false,
  brand_content: false,
  consent: false,
};

/** Bo the HTML (mo ta tu trinh soan thao). */
function plain(html: string) {
  if (!html) return "";
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (div) {
    div.innerHTML = html.replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
    return (div.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
  }
  return html.replace(/<[^>]*>/g, "").trim();
}

function cut(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** Caption goi y theo nen tang tu tieu de + mo ta + link. (Diem noi caption AI: xem ai.ts) */
function suggest(platform: Platform, d: SuggestInput) {
  const desc = plain(d.description);
  const lim = TEXT_LIMITS[platform];
  switch (platform) {
    case "facebook":
    case "instagram": {
      // Cat phan mo ta, giu nguyen chu ky o cuoi
      const sign = signature(platform, d);
      const room = lim.caption - (sign ? sign.length + 2 : 0);
      return { title: d.title, caption: [cut([d.title, desc].filter(Boolean).join("\n\n"), room), sign].filter(Boolean).join("\n\n") };
    }
    case "tiktok":
      // TikTok: khong chen link
      return { title: cut(d.title, 90), caption: cut([d.title, desc].filter(Boolean).join("\n\n"), lim.caption) };
    case "youtube":
      return { title: cut(d.title, 100), caption: cut([desc, d.link].filter(Boolean).join("\n\n"), lim.caption) };
    case "pinterest":
      return { title: cut(d.title, 100), caption: cut(desc || d.title, lim.caption) };
    case "x": {
      // X: chi tieu de (mo ta dai khong vua 280 ky tu) + chu ky
      const sign = signature(platform, d);
      const room = lim.caption - (sign ? captionLength("x", sign) + 2 : 0);
      return { title: d.title, caption: [cutFor("x", d.title, room), sign].filter(Boolean).join("\n\n") };
    }
  }
}

/** Doc anh dai dien + album hien tai cua form. */
function readFormImages(form: HTMLFormElement | null): string[] {
  if (!form) return [];
  const out: string[] = [];
  const img = form.querySelector<HTMLInputElement>('input[name="image"]')?.value?.trim();
  if (img) out.push(img);
  form.querySelectorAll<HTMLInputElement>('input[name="album[]"]').forEach((i) => i.value.trim() && out.push(i.value.trim()));
  return [...new Set(out)];
}

const isVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u.trim());

export function SocialPublishBlock({
  accounts,
  defaults,
  initial,
  tiktokAudited,
}: {
  accounts: BlockAccount[];
  defaults: Defaults;
  initial: SocialPublishInput | null;
  tiktokAudited: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(Boolean(initial?.enabled));
  const [formImages, setFormImages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[] | null>(initial?.images ?? null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [video, setVideo] = useState(initial?.video ?? (isVideoUrl(defaults.video) ? defaults.video : ""));
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [picker, setPicker] = useState(false);
  const [hashtags, setHashtags] = useState(initial?.hashtags ?? "");
  const [ai, setAi] = useState(Boolean(initial?.ai_generated));
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">(initial?.schedule ? "later" : "now");
  const [schedule, setSchedule] = useState(initial?.schedule ?? "");
  const [submitError, setSubmitError] = useState<string[]>([]);
  const [creators, setCreators] = useState<Record<string, CreatorInfo | "loading">>({});

  const [targets, setTargets] = useState<Record<string, TargetState>>(() => {
    const init: Record<string, TargetState> = {};
    for (const a of accounts) {
      const prev = initial?.targets.find((t) => t.account_id === a.id);
      const s = suggest(a.platform, defaults);
      init[a.id] = {
        checked: Boolean(prev),
        format: prev?.format ?? formatsOf(a.platform)[0],
        title: prev?.title ?? s.title,
        caption: prev?.caption ?? s.caption,
        board_id: prev?.board_id ?? a.board_id ?? a.boards[0]?.id ?? "",
        privacy: prev?.privacy ?? "public",
        tags: prev?.tags ?? "",
        tiktok: { ...EMPTY_TIKTOK, ...(prev?.tiktok ?? {}), consent: false },
      };
    }
    return init;
  });

  // Anh tu form: doc lai moi 1.5s (anh dai dien / album co the doi bat cu luc nao)
  useEffect(() => {
    const form = rootRef.current?.closest("form") ?? null;
    const read = () => {
      const list = readFormImages(form);
      setFormImages((prev) => (prev.length === list.length && prev.every((x, i) => x === list[i]) ? prev : list));
    };
    read();
    const t = setInterval(read, 1500);
    return () => clearInterval(t);
  }, []);

  // Thu tu anh dang: giu thu tu nguoi dung da sap, them anh moi vao cuoi, bo anh da xoa khoi form
  const ordered = useMemo(() => {
    const base = selected ?? formImages;
    const kept = base.filter((u) => formImages.includes(u));
    const added = formImages.filter((u) => !kept.includes(u));
    return [...kept, ...added];
  }, [selected, formImages]);
  const images = ordered.filter((u) => !excluded.has(u));

  const move = (url: string, dir: -1 | 1) => {
    const list = [...ordered];
    const i = list.indexOf(url);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setSelected(list);
  };

  const update = (id: string, patch: Partial<TargetState>) => setTargets((t) => ({ ...t, [id]: { ...t[id], ...patch } }));
  const updateTikTok = (id: string, patch: Partial<TikTokOptions>) => setTargets((t) => ({ ...t, [id]: { ...t[id], tiktok: { ...t[id].tiktok, ...patch } } }));

  /** Ly do khong dung duoc mot dinh dang voi media hien tai. */
  const formatProblem = useCallback(
    (f: Format): string | null => {
      const spec = FORMAT_SPECS[f];
      if (spec.video && !video) return "chưa chọn video";
      if (spec.video && videoMeta) {
        if (f === "fb_reel" && (videoMeta.duration < 3 || videoMeta.duration > 90)) return "reel cần 3–90 giây";
        if (f === "yt_short" && videoMeta.duration > 180) return "Shorts tối đa 3 phút";
        if (f === "yt_short" && videoMeta.width > videoMeta.height) return "Shorts cần video dọc";
        if (f === "fb_reel" && videoMeta.width > videoMeta.height) return "reel cần video dọc 9:16";
      }
      if (spec.minImages && images.length < spec.minImages) return `cần ít nhất ${spec.minImages} ảnh`;
      return null;
    },
    [video, videoMeta, images.length],
  );

  const accountProblem = (a: BlockAccount): string | null => {
    if (a.status !== "active") return "Tài khoản cần kết nối lại";
    const ok = formatsOf(a.platform).some((f) => !formatProblem(f));
    if (!ok) return a.platform === "youtube" ? "Chưa có video (YouTube chỉ đăng video)" : "Nội dung chưa đủ ảnh/video cho nền tảng này";
    return null;
  };

  // Dinh dang dang chon khong con hop le -> tu chuyen sang dinh dang dau tien hop le
  useEffect(() => {
    setTargets((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const a of accounts) {
        const t = prev[a.id];
        if (!t || !formatProblem(t.format)) continue;
        const ok = formatsOf(a.platform).find((f) => !formatProblem(f));
        if (ok && ok !== t.format) {
          next[a.id] = { ...t, format: ok };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [accounts, formatProblem]);

  // TikTok: lay creator_info khi chon tai khoan
  useEffect(() => {
    for (const a of accounts) {
      if (a.platform !== "tiktok" || !targets[a.id]?.checked || creators[a.id]) continue;
      setCreators((c) => ({ ...c, [a.id]: "loading" }));
      fetch(`/ajax/social/tiktok/creator-info?account_id=${a.id}`)
        .then((r) => r.json())
        .then((info: CreatorInfo) => setCreators((c) => ({ ...c, [a.id]: info })))
        .catch(() => setCreators((c) => ({ ...c, [a.id]: { can_post: false, error: "Không lấy được thông tin tài khoản TikTok" } })));
    }
  }, [accounts, targets, creators]);

  const refill = () => {
    const form = rootRef.current?.closest("form");
    const title = form?.querySelector<HTMLInputElement>('input[name="name"]')?.value ?? defaults.title;
    const description = form?.querySelector<HTMLTextAreaElement>('textarea[name="description"]')?.value ?? defaults.description;
    // Link theo duong dan dang nhap trong form (trang them moi chua co link da luu)
    const canonical = form?.querySelector<HTMLInputElement>('input[name="canonical"]')?.value?.trim();
    const link = canonical ? defaults.linkPattern.replace("__slug__", canonical) : defaults.link;
    setTargets((prev) => {
      const next = { ...prev };
      for (const a of accounts) {
        const s = suggest(a.platform, { title, description, link, whatsapp: defaults.whatsapp, site: defaults.site });
        next[a.id] = { ...prev[a.id], title: s.title, caption: s.caption };
      }
      return next;
    });
  };

  /** Loi chan luu (kiem tra lai o server/worker). */
  const problems = useMemo(() => {
    if (!enabled) return [];
    const out: string[] = [];
    const chosen = accounts.filter((a) => targets[a.id]?.checked);
    if (!chosen.length) out.push("Chưa chọn tài khoản nào để đăng.");
    for (const a of chosen) {
      const t = targets[a.id];
      const label = `${PLATFORM_LABEL[a.platform]} (${a.name})`;
      const fp = formatProblem(t.format);
      if (fp) out.push(`${label}: ${fp}.`);
      const caption = withHashtags(t.caption, hashtags);
      const lim = TEXT_LIMITS[a.platform];
      const len = captionLength(a.platform, caption);
      if (len > lim.caption) out.push(`${label}: ${lim.captionLabel} dài ${len}/${lim.caption} ký tự.`);
      if (lim.title && needsTitle(a.platform, t.format) && t.title.length > lim.title) out.push(`${label}: tiêu đề dài ${t.title.length}/${lim.title} ký tự.`);
      if (a.platform === "youtube" && !t.title.trim()) out.push(`${label}: chưa nhập tiêu đề video.`);
      if (a.platform === "pinterest" && !t.board_id) out.push(`${label}: chưa chọn board.`);
      if (a.platform === "tiktok") {
        const info = creators[a.id];
        const o = t.tiktok;
        if (info && info !== "loading" && info.can_post === false) out.push(`${label}: ${info.error ?? "tài khoản hiện không đăng được"}.`);
        if (!o.privacy_level) out.push(`${label}: chưa chọn quyền riêng tư.`);
        if (o.commercial && !o.brand_organic && !o.brand_content) out.push(`${label}: bật nội dung thương mại thì phải chọn ít nhất một loại.`);
        if (o.brand_content && o.privacy_level === "SELF_ONLY") out.push(`${label}: nội dung có tài trợ không thể để "Chỉ mình tôi".`);
        if (!o.consent) out.push(`${label}: chưa xác nhận đồng ý gửi nội dung lên TikTok.`);
        if (/https?:\/\/|www\./i.test(t.caption)) out.push(`${label}: không chèn link vào nội dung TikTok.`);
        if (info && info !== "loading" && info.max_video_post_duration_sec && videoMeta && t.format === "tiktok_video" && videoMeta.duration > info.max_video_post_duration_sec) {
          out.push(`${label}: video dài ${Math.round(videoMeta.duration)} giây, tối đa ${info.max_video_post_duration_sec} giây.`);
        }
      }
    }
    if (scheduleMode === "later" && !schedule) out.push("Chưa chọn thời gian hẹn đăng.");
    return out;
  }, [enabled, accounts, targets, hashtags, formatProblem, creators, videoMeta, scheduleMode, schedule]);

  // Chan submit form khi khoi dang MXH con loi (khong anh huong khi tat khoi)
  const problemsRef = useRef(problems);
  problemsRef.current = problems;
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onSubmit = (e: SubmitEvent) => {
      if (problemsRef.current.length) {
        e.preventDefault();
        setSubmitError(problemsRef.current);
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);
  useEffect(() => {
    if (!problems.length) setSubmitError([]);
  }, [problems.length]);

  const payload: SocialPublishInput | null = enabled
    ? {
        enabled: true,
        images,
        video,
        hashtags,
        ai_generated: ai,
        schedule: scheduleMode === "later" ? schedule : "",
        targets: accounts
          .filter((a) => targets[a.id]?.checked)
          .map((a): SocialTargetInput => {
            const t = targets[a.id];
            return {
              account_id: a.id,
              format: t.format,
              title: needsTitle(a.platform, t.format) ? t.title : undefined,
              caption: t.caption,
              ...(a.platform === "pinterest" ? { board_id: t.board_id } : {}),
              ...(a.platform === "youtube" ? { privacy: t.privacy, tags: t.tags } : {}),
              ...(a.platform === "tiktok" ? { tiktok: t.tiktok } : {}),
            };
          }),
      }
    : null;

  if (!accounts.length) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Chưa kết nối tài khoản mạng xã hội nào.{" "}
        <a href="/social/account/index" className="font-medium text-primary hover:underline">
          Kết nối tài khoản
        </a>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="grid gap-4">
      <input type="hidden" name="social_publish" value={payload ? JSON.stringify(payload) : ""} />
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            setEnabled(v);
            // Lan dau bat ma chua co noi dung (trang them moi): dien tu tieu de/mo ta cua form
            if (v && accounts.every((a) => !targets[a.id]?.caption.trim())) refill();
          }}
        />
        Đăng lên mạng xã hội khi lưu
      </label>

      {enabled && (
        <>
          {submitError.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <TriangleAlertIcon className="size-4" /> Chưa lưu được — kiểm tra phần đăng mạng xã hội
              </div>
              <ul className="list-disc space-y-0.5 pl-6">
                {submitError.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ---- Media ---- */}
          <div className="grid gap-2">
            <div className="text-sm font-medium">Ảnh đăng (lấy từ Ảnh đại diện + Album, sắp xếp thứ tự)</div>
            {ordered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có ảnh. Thêm ảnh đại diện hoặc album ở trên.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ordered.map((url, i) => {
                  const off = excluded.has(url);
                  return (
                    <div key={url} className={cn("relative w-24 overflow-hidden rounded-md border bg-muted/30", off && "opacity-40")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="aspect-square w-full object-cover" />
                      <div className="flex items-center justify-between gap-1 border-t bg-card px-1 py-0.5">
                        <Checkbox
                          checked={!off}
                          aria-label="Dùng ảnh này"
                          onCheckedChange={(v) =>
                            setExcluded((s) => {
                              const n = new Set(s);
                              if (v) n.delete(url);
                              else n.add(url);
                              return n;
                            })
                          }
                        />
                        <span className="text-[11px] text-muted-foreground">{off ? "—" : images.indexOf(url) + 1}</span>
                        <span className="flex">
                          <button type="button" className="p-0.5 hover:text-primary disabled:opacity-30" disabled={i === 0} onClick={() => move(url, -1)} aria-label="Lên trước">
                            <ArrowUpIcon className="size-3.5 -rotate-90" />
                          </button>
                          <button type="button" className="p-0.5 hover:text-primary disabled:opacity-30" disabled={i === ordered.length - 1} onClick={() => move(url, 1)} aria-label="Ra sau">
                            <ArrowDownIcon className="size-3.5 -rotate-90" />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Video (mp4, tùy chọn)</div>
            <div className="flex gap-2">
              <Input value={video} onChange={(e) => (setVideo(e.target.value), setVideoMeta(null), setVideoError(false))} placeholder="/userfiles/file/video.mp4" autoComplete="off" />
              <Button type="button" variant="outline" onClick={() => setPicker(true)}>
                <FilmIcon /> Chọn
              </Button>
              {video && (
                <Button type="button" variant="ghost" size="icon" aria-label="Bỏ video" onClick={() => (setVideo(""), setVideoMeta(null))}>
                  <XIcon />
                </Button>
              )}
            </div>
            <MediaPicker open={picker} type="Files" onOpenChange={setPicker} onSelect={(urls) => (setVideo(urls[0] ?? ""), setVideoMeta(null), setVideoError(false))} />
            {video && (
              <div className="flex items-start gap-3">
                <video
                  key={video}
                  src={video}
                  controls
                  preload="metadata"
                  className="max-h-48 max-w-64 rounded-md border bg-black"
                  onLoadedMetadata={(e) => setVideoMeta({ duration: e.currentTarget.duration, width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight })}
                  onError={() => setVideoError(true)}
                />
                <div className="text-xs text-muted-foreground">
                  {videoMeta ? (
                    <>
                      {Math.round(videoMeta.duration)} giây · {videoMeta.width}×{videoMeta.height} · {videoMeta.height > videoMeta.width ? "dọc" : videoMeta.height === videoMeta.width ? "vuông" : "ngang"}
                    </>
                  ) : videoError ? (
                    <span className="text-destructive">Không đọc được video này.</span>
                  ) : (
                    "Đang đọc video..."
                  )}
                  {!isVideoUrl(video) && <div className="text-destructive">Nên dùng file .mp4</div>}
                </div>
              </div>
            )}
          </div>

          {/* ---- Tai khoan ---- */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Tài khoản đăng</div>
              <Button type="button" variant="ghost" size="sm" onClick={refill}>
                <RefreshCwIcon /> Điền lại nội dung từ tiêu đề/mô tả
              </Button>
            </div>
            {accounts.map((a) => {
              const t = targets[a.id];
              const problem = accountProblem(a);
              const lim = TEXT_LIMITS[a.platform];
              const fullCaption = withHashtags(t.caption, hashtags);
              return (
                <div key={a.id} className={cn("rounded-lg border", t.checked && !problem && "border-primary/50")}>
                  <label className={cn("flex items-center gap-3 px-3 py-2.5", problem ? "cursor-not-allowed" : "cursor-pointer")}>
                    <Checkbox checked={t.checked && !problem} disabled={Boolean(problem)} onCheckedChange={(v) => update(a.id, { checked: Boolean(v) })} />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{PLATFORM_LABEL[a.platform]}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{a.name}</span>
                      {a.dry_run && (
                        <Badge variant="warning" className="ml-2">
                          Thử (dry run)
                        </Badge>
                      )}
                    </span>
                    {problem && <span className="text-xs text-muted-foreground">{problem}</span>}
                  </label>

                  {t.checked && !problem && (
                    <div className="grid gap-3 border-t px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {formatsOf(a.platform).map((f) => {
                          const fp = formatProblem(f);
                          const spec = FORMAT_SPECS[f];
                          return (
                            <button
                              key={f}
                              type="button"
                              disabled={Boolean(fp)}
                              title={fp ?? spec.hint ?? ""}
                              onClick={() => update(a.id, { format: f })}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                t.format === f ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary",
                              )}
                            >
                              {spec.label}
                              {fp && <span className="ml-1">({fp})</span>}
                            </button>
                          );
                        })}
                      </div>
                      <FormatNote format={t.format} imageCount={images.length} />

                      {needsTitle(a.platform, t.format) && (
                        <div className="grid gap-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium">Tiêu đề</span>
                            <Counter n={t.title.length} max={lim.title ?? 100} />
                          </div>
                          <Input value={t.title} onChange={(e) => update(a.id, { title: e.target.value })} />
                        </div>
                      )}
                      <div className="grid gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{a.platform === "tiktok" && t.format === "tiktok_photo" ? "Mô tả" : lim.captionLabel}</span>
                          <Counter n={captionLength(a.platform, fullCaption)} max={a.platform === "tiktok" && t.format === "tiktok_photo" ? 4000 : lim.caption} />
                        </div>
                        <Textarea value={t.caption} rows={5} onChange={(e) => update(a.id, { caption: e.target.value })} />
                        {hashtags.trim() && <p className="text-[11px] text-muted-foreground">Hashtag chung sẽ được thêm vào cuối.</p>}
                      </div>

                      {a.platform === "pinterest" && (
                        <div className="grid gap-1">
                          <span className="text-xs font-medium">Board</span>
                          <NativeSelect value={t.board_id} onChange={(e) => update(a.id, { board_id: e.target.value })}>
                            <option value="">— Chọn board —</option>
                            {a.boards.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </NativeSelect>
                          {defaults.link && <p className="text-[11px] text-muted-foreground">Ghim sẽ trỏ về: {defaults.link}</p>}
                        </div>
                      )}

                      {a.platform === "youtube" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="grid gap-1">
                            <span className="text-xs font-medium">Chế độ hiển thị</span>
                            <NativeSelect value={t.privacy} onChange={(e) => update(a.id, { privacy: e.target.value })}>
                              <option value="public">Công khai</option>
                              <option value="unlisted">Không công khai (có link)</option>
                              <option value="private">Riêng tư</option>
                            </NativeSelect>
                          </div>
                          <div className="grid gap-1">
                            <span className="text-xs font-medium">Thẻ (tags, cách nhau dấu phẩy)</span>
                            <Input value={t.tags} onChange={(e) => update(a.id, { tags: e.target.value })} placeholder="thêu, mũ thêu, quà tặng" />
                          </div>
                        </div>
                      )}

                      {a.platform === "tiktok" && (
                        <TikTokPanel
                          info={creators[a.id]}
                          options={t.tiktok}
                          isPhoto={t.format === "tiktok_photo"}
                          audited={tiktokAudited}
                          images={images}
                          video={video}
                          onChange={(p) => updateTikTok(a.id, p)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ---- Chung ---- */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-sm font-medium">Hashtag</span>
              <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#yourbrand #handmade" />
            </div>
            <div className="grid gap-1">
              <span className="text-sm font-medium">Thời gian đăng</span>
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as "now" | "later")} className="w-32">
                  <option value="now">Đăng ngay</option>
                  <option value="later">Hẹn giờ</option>
                </NativeSelect>
                {scheduleMode === "later" && <Input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="w-auto" />}
              </div>
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Switch checked={ai} onCheckedChange={setAi} className="mt-0.5" />
            <span>
              <span className="font-medium">Nội dung có dùng AI</span>
              <span className="block text-xs text-muted-foreground">Gắn nhãn nội dung do AI tạo: TikTok (AIGC), YouTube (nội dung tổng hợp), Facebook Reel.</span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}

function needsTitle(platform: Platform, format: Format) {
  return platform === "youtube" || platform === "pinterest" || format === "tiktok_photo" || format === "fb_video";
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={cn("tabular-nums text-muted-foreground", n > max && "font-medium text-destructive")}>{`${n.toLocaleString("vi-VN")}/${max.toLocaleString("vi-VN")}`}</span>;
}

function FormatNote({ format, imageCount }: { format: Format; imageCount: number }) {
  const spec = FORMAT_SPECS[format];
  const notes: string[] = [];
  if (spec.hint) notes.push(spec.hint);
  if (spec.maxImages && imageCount > spec.maxImages) notes.push(`chỉ lấy ${spec.maxImages} ảnh đầu`);
  if (format === "ig_image" || format === "ig_carousel" || format === "tiktok_photo") notes.push("cần PUBLIC_BASE_URL công khai (HTTPS)");
  if (!notes.length) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <InfoIcon className="size-3.5" /> {notes.join(" · ")}
    </p>
  );
}

/** TikTok Direct Post theo content-sharing-guidelines. */
function TikTokPanel({
  info,
  options: o,
  isPhoto,
  audited,
  images,
  video,
  onChange,
}: {
  info: CreatorInfo | "loading" | undefined;
  options: TikTokOptions;
  isPhoto: boolean;
  audited: boolean;
  images: string[];
  video: string;
  onChange: (p: Partial<TikTokOptions>) => void;
}) {
  if (!info || info === "loading") return <p className="text-xs text-muted-foreground">Đang lấy thông tin tài khoản TikTok...</p>;
  if (info.can_post === false) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{info.error ?? "Tài khoản TikTok hiện không đăng được, hãy thử lại sau."}</div>
    );
  }
  const options = info.privacy_level_options ?? [];
  const toggle = (label: string, key: "disable_comment" | "disable_duet" | "disable_stitch", creatorDisabled?: boolean) => (
    <label className={cn("flex items-center gap-2 text-sm", creatorDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      {/* Mac dinh tat (disable_* = true) — nguoi dung tu bat; xam khi creator da tat */}
      <Switch checked={!creatorDisabled && !o[key]} disabled={creatorDisabled} onCheckedChange={(v) => onChange({ [key]: !v })} />
      {label}
      {creatorDisabled && <span className="text-xs text-muted-foreground">(tài khoản đã tắt)</span>}
    </label>
  );
  return (
    <div className="grid gap-3 rounded-md bg-muted/40 p-3">
      <div className="text-sm">
        Đăng với tài khoản: <b>{info.creator_nickname ?? info.creator_username}</b>
        {info.dry_run && <span className="ml-1 text-xs text-muted-foreground">(thử)</span>}
      </div>
      {!audited && <p className="text-xs text-amber-700">{info.notice}</p>}

      <div className="grid gap-1">
        <span className="text-xs font-medium">Ai có thể xem bài này (bắt buộc)</span>
        <NativeSelect value={o.privacy_level} onChange={(e) => onChange({ privacy_level: e.target.value })}>
          <option value="" disabled>
            — Chọn quyền riêng tư —
          </option>
          {options.map((p) => (
            <option key={p} value={p} disabled={p === "SELF_ONLY" && o.brand_content}>
              {PRIVACY_LABEL[p] ?? p}
              {p === "SELF_ONLY" && o.brand_content ? " (không dùng được với nội dung có tài trợ)" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <span className="text-xs font-medium">Cho phép người xem</span>
        {toggle("Bình luận", "disable_comment", info.comment_disabled)}
        {!isPhoto && toggle("Duet", "disable_duet", info.duet_disabled)}
        {!isPhoto && toggle("Stitch", "disable_stitch", info.stitch_disabled)}
      </div>

      <div className="grid gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Switch checked={o.commercial} onCheckedChange={(v) => onChange({ commercial: v, ...(v ? {} : { brand_organic: false, brand_content: false }) })} />
          Khai báo nội dung thương mại
        </label>
        {o.commercial && (
          <div className="grid gap-2 pl-11">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={o.brand_organic} onCheckedChange={(v) => onChange({ brand_organic: Boolean(v) })} />
              Thương hiệu của bạn (Your brand)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={o.brand_content}
                onCheckedChange={(v) => onChange({ brand_content: Boolean(v), ...(v && o.privacy_level === "SELF_ONLY" ? { privacy_level: "" } : {}) })}
              />
              Nội dung có tài trợ (Branded content)
            </label>
            {!o.brand_organic && !o.brand_content && <p className="text-xs text-destructive">Chọn ít nhất một loại.</p>}
            {(o.brand_organic || o.brand_content) && (
              <p className="text-xs text-muted-foreground">
                Bài sẽ được gắn nhãn <b>{o.brand_content ? "“Paid partnership”" : "“Promotional content”"}</b> trên TikTok.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <span className="text-xs font-medium">Xem trước nội dung gửi lên TikTok</span>
        {isPhoto ? (
          <div className="flex flex-wrap gap-1.5">
            {images.slice(0, 35).map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="" className="size-16 rounded border object-cover" />
            ))}
          </div>
        ) : video ? (
          <video src={video} controls preload="metadata" className="max-h-56 w-fit rounded border bg-black" />
        ) : null}
        <p className="text-xs text-muted-foreground">
          Không chèn logo, watermark, chữ quảng cáo hay link vào ảnh/video đăng TikTok. Sau khi đăng, TikTok có thể mất vài phút để xử lý; trạng thái sẽ cập nhật ở Lịch sử đăng.
        </p>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox checked={o.consent} onCheckedChange={(v) => onChange({ consent: Boolean(v) })} className="mt-0.5" />
          <span>Tôi đã xem trước và đồng ý gửi nội dung này lên TikTok (chưa gửi gì cho đến khi xác nhận và bấm Lưu).</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Khi đăng, bạn đồng ý với{" "}
          {o.brand_content && (
            <>
              <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Branded Content Policy
              </a>{" "}
              và{" "}
            </>
          )}
          <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Music Usage Confirmation
          </a>{" "}
          của TikTok.
        </p>
      </div>
    </div>
  );
}
