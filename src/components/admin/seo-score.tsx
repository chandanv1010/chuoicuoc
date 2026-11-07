"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Cham diem SEO truc tiep tren form them / sua (bai viet, danh muc): doc gia tri form moi ~0,8s (o noi dung TipTap
 * ghi vao textarea an nen khong co su kien input), cham theo checklist va hien diem 0-100 kieu PageSpeed: vong diem
 * (xanh >= 90, cam 50-89, do < 50), muc chua dat / can cai thien truoc, muc da dat gom lai ben duoi.
 * Tu khoa chinh = tu khoa dau tien trong o "Từ khóa SEO" (meta_keyword).
 */

type Status = "pass" | "warn" | "fail";
type Check = { id: string; group: string; title: string; detail: string; status: Status; weight: number };

type Fields = {
  name: string;
  description: string;
  content: string;
  metaTitle: string;
  metaKeyword: string;
  metaDescription: string;
  canonical: string;
  image: string;
  album: number;
  follow: string;
};

function read(form: HTMLFormElement): Fields {
  const fd = new FormData(form);
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    name: s("name"),
    description: s("description"),
    content: s("content"),
    metaTitle: s("meta_title"),
    metaKeyword: s("meta_keyword"),
    metaDescription: s("meta_description"),
    canonical: s("canonical"),
    image: s("image"),
    album: fd.getAll("album[]").filter(Boolean).length,
    follow: s("follow"),
  };
}

/** Bo dau tieng Viet + chu thuong (so khop tu khoa, kiem tra URL). */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
const slug = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

function htmlText(html: string) {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent ?? "";
}

const words = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

function count(hay: string, needle: string) {
  if (!needle) return 0;
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    n++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

export function analyzeSeo(f: Fields): Check[] {
  const kw = norm(f.metaKeyword.split(",")[0] ?? "");
  const title = f.metaTitle.trim() || f.name.trim();
  const desc = f.metaDescription.trim() || htmlText(f.description).trim();
  const doc = typeof window === "undefined" ? null : new DOMParser().parseFromString(f.content || "", "text/html");
  const text = doc?.body.textContent ?? "";
  const ntext = norm(text);
  const wc = words(text).length;
  const kwWords = kw ? words(kw).length : 0;
  const hits = kw ? count(ntext, kw) : 0;
  const density = wc ? ((hits * Math.max(1, kwWords)) / wc) * 100 : 0;
  const headings = doc ? [...doc.querySelectorAll("h2, h3, h4")].map((h) => norm(h.textContent ?? "")) : [];
  const imgs = doc ? [...doc.querySelectorAll("img")] : [];
  const links = doc ? [...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? "") : [];
  const host = typeof window === "undefined" ? "" : window.location.host;
  const internal = links.filter((h) => h.startsWith("/") || h.startsWith("#") || (host && h.includes(host)) || !/^[a-z]+:/i.test(h));
  const external = links.filter((h) => /^https?:\/\//i.test(h) && !(host && h.includes(host)));
  const paras = doc ? [...doc.querySelectorAll("p")].map((p) => words(p.textContent ?? "").length) : [];
  const longPara = paras.filter((n) => n > 150).length;
  const first10 = norm(words(text).slice(0, Math.max(30, Math.ceil(wc * 0.1))).join(" "));
  const url = f.canonical.trim();
  const noKw = "Nhập “Từ khóa SEO” (từ khóa đầu tiên là từ khóa chính) để chấm mục này.";
  const C: Check[] = [];
  const add = (group: string, id: string, title: string, status: Status, detail: string, weight = 1) => C.push({ id, group, title, detail, status, weight });

  // ---- Tu khoa chinh
  add("Từ khóa chính", "kw", "Có từ khóa chính", kw ? "pass" : "fail", kw ? `Từ khóa chính: “${kw}”.` : "Chưa có. Nhập ở ô “Từ khóa SEO”.", 2);
  add("Từ khóa chính", "kw-title", "Từ khóa nằm trong tiêu đề SEO", !kw ? "fail" : norm(title).includes(kw) ? "pass" : "fail", kw ? (norm(title).includes(kw) ? "Tiêu đề có chứa từ khóa." : "Thêm từ khóa vào tiêu đề SEO.") : noKw, 2);
  add(
    "Từ khóa chính",
    "kw-title-start",
    "Từ khóa đứng gần đầu tiêu đề",
    !kw ? "fail" : norm(title).indexOf(kw) === 0 ? "pass" : norm(title).indexOf(kw) > 0 && norm(title).indexOf(kw) < norm(title).length / 2 ? "warn" : "fail",
    kw ? "Từ khóa ở nửa đầu tiêu đề được Google coi trọng hơn." : noKw,
  );
  add("Từ khóa chính", "kw-desc", "Từ khóa nằm trong mô tả SEO", !kw ? "fail" : norm(desc).includes(kw) ? "pass" : "fail", kw ? (norm(desc).includes(kw) ? "Mô tả có chứa từ khóa." : "Thêm từ khóa vào mô tả SEO.") : noKw, 2);
  add("Từ khóa chính", "kw-url", "Từ khóa nằm trong đường dẫn (URL)", !kw ? "fail" : slug(url).includes(slug(kw)) ? "pass" : "fail", kw ? `URL nên chứa “${slug(kw)}”.` : noKw, 2);
  add("Từ khóa chính", "kw-intro", "Từ khóa xuất hiện ở 10% đầu nội dung", !kw ? "fail" : first10.includes(kw) ? "pass" : "fail", kw ? "Nhắc tới từ khóa ngay đoạn mở bài." : noKw);
  add(
    "Từ khóa chính",
    "kw-density",
    "Mật độ từ khóa 0,5% – 2,5%",
    !kw || !wc ? "fail" : density >= 0.5 && density <= 2.5 ? "pass" : density > 0 ? "warn" : "fail",
    kw ? `Xuất hiện ${hits} lần, mật độ ${density.toFixed(2)}%.${density > 2.5 ? " Quá dày, dễ bị coi là nhồi từ khóa." : ""}` : noKw,
  );
  add(
    "Từ khóa chính",
    "kw-heading",
    "Từ khóa nằm trong tiêu đề phụ (H2, H3)",
    !kw ? "fail" : headings.some((h) => h.includes(kw)) ? "pass" : headings.length ? "warn" : "fail",
    kw ? (headings.length ? "Đưa từ khóa vào ít nhất một tiêu đề phụ." : "Nội dung chưa có tiêu đề phụ.") : noKw,
  );
  add("Từ khóa chính", "kw-alt", "Từ khóa nằm trong alt của ảnh", !kw ? "fail" : imgs.some((i) => norm(i.getAttribute("alt") ?? "").includes(kw)) ? "pass" : imgs.length ? "warn" : "fail", kw ? "Đặt alt chứa từ khóa cho ít nhất một ảnh trong nội dung." : noKw);

  // ---- Tieu de & mo ta
  const tl = title.length;
  add("Tiêu đề & mô tả", "title-len", "Tiêu đề SEO dài 30 – 60 ký tự", tl >= 30 && tl <= 60 ? "pass" : tl > 0 && tl <= 70 ? "warn" : "fail", `Hiện ${tl} ký tự.${tl > 60 ? " Google sẽ cắt bớt." : tl < 30 ? " Quá ngắn." : ""}`, 2);
  const dl = desc.length;
  add("Tiêu đề & mô tả", "desc-len", "Mô tả SEO dài 120 – 160 ký tự", dl >= 120 && dl <= 160 ? "pass" : dl >= 70 && dl <= 180 ? "warn" : "fail", `Hiện ${dl} ký tự.`, 2);
  add("Tiêu đề & mô tả", "meta-title", "Đã nhập tiêu đề SEO riêng", f.metaTitle.trim() ? "pass" : "warn", f.metaTitle.trim() ? "Có tiêu đề SEO." : "Đang dùng tiêu đề bài; nên viết tiêu đề SEO riêng.");
  add("Tiêu đề & mô tả", "meta-desc", "Đã nhập mô tả SEO riêng", f.metaDescription.trim() ? "pass" : "warn", f.metaDescription.trim() ? "Có mô tả SEO." : "Google sẽ tự lấy một đoạn trong trang.");

  // ---- Duong dan
  add("Đường dẫn", "url", "Có đường dẫn (URL)", url ? "pass" : "fail", url ? `/${url}` : "Chưa có đường dẫn.", 2);
  add("Đường dẫn", "url-clean", "URL không dấu, chỉ chữ thường, số và gạch nối", !url ? "fail" : /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(url) ? "pass" : "warn", "Ví dụ: cach-cham-soc-mu-theu.");
  add("Đường dẫn", "url-len", "URL ngắn gọn (≤ 75 ký tự)", !url ? "fail" : url.length <= 75 ? "pass" : "warn", `Hiện ${url.length} ký tự.`);

  // ---- Noi dung
  add("Nội dung", "length", "Nội dung đủ dài (≥ 600 từ)", wc >= 600 ? "pass" : wc >= 300 ? "warn" : "fail", `Hiện ${wc} từ.`, 2);
  add("Nội dung", "headings", "Có tiêu đề phụ H2 / H3", headings.length >= 2 ? "pass" : headings.length === 1 ? "warn" : "fail", `${headings.length} tiêu đề phụ.`);
  add("Nội dung", "paragraphs", "Đoạn văn ngắn, dễ đọc (≤ 150 từ mỗi đoạn)", !paras.length ? "fail" : longPara === 0 ? "pass" : "warn", longPara ? `${longPara} đoạn quá dài.` : "Các đoạn đều ngắn gọn.");
  add("Nội dung", "images", "Nội dung có ảnh", imgs.length ? "pass" : f.album ? "warn" : "fail", imgs.length ? `${imgs.length} ảnh trong nội dung.` : "Chèn ít nhất một ảnh vào nội dung.");
  const noAlt = imgs.filter((i) => !(i.getAttribute("alt") ?? "").trim()).length;
  add("Nội dung", "alt", "Mọi ảnh đều có alt", !imgs.length ? "warn" : noAlt === 0 ? "pass" : "fail", !imgs.length ? "Chưa có ảnh để kiểm tra." : noAlt ? `${noAlt} ảnh thiếu alt.` : "Đủ alt.");
  add("Nội dung", "internal", "Có liên kết nội bộ", internal.length ? "pass" : "fail", internal.length ? `${internal.length} liên kết nội bộ.` : "Dẫn tới bài viết / sản phẩm khác trên web.");
  add("Nội dung", "external", "Có liên kết ra nguồn ngoài", external.length ? "pass" : "warn", external.length ? `${external.length} liên kết ngoài.` : "Trích nguồn uy tín giúp tăng độ tin cậy.");

  // ---- Khac
  add("Khác", "image", "Có ảnh đại diện (ảnh chia sẻ mạng xã hội)", f.image.trim() ? "pass" : "fail", f.image.trim() ? "Có ảnh đại diện." : "Chọn ảnh đại diện ở cột phải.");
  add("Khác", "summary", "Có mô tả ngắn", htmlText(f.description).trim().length >= 50 ? "pass" : htmlText(f.description).trim() ? "warn" : "fail", "Mô tả ngắn hiện ở trang danh sách và khi chia sẻ.");
  add("Khác", "follow", "Cho phép Google đi theo liên kết (Follow)", f.follow === "2" ? "warn" : "pass", f.follow === "2" ? "Đang đặt Nofollow." : "Follow.");
  return C;
}

export function seoScore(checks: Check[]) {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
  return total ? Math.round((got / total) * 100) : 0;
}

const TONE = (score: number) => (score >= 90 ? { ring: "#0cce6b", text: "text-[#0a8f4a]", bg: "#e6f9ee" } : score >= 50 ? { ring: "#ffa400", text: "text-[#c33300]", bg: "#fff4e0" } : { ring: "#ff4e42", text: "text-[#c7221f]", bg: "#ffeceb" });

function Gauge({ score }: { score: number }) {
  const t = TONE(score);
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-28">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill={t.bg} stroke={t.bg} strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={t.ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .4s" }} />
      </svg>
      <span className={cn("absolute inset-0 grid place-items-center text-3xl font-semibold tabular-nums", t.text)}>{score}</span>
    </div>
  );
}

function Mark({ s }: { s: Status }) {
  if (s === "fail") return <span className="mt-1 size-0 shrink-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[#ff4e42]" aria-label="Chưa đạt" />;
  if (s === "warn") return <span className="mt-1 size-2.5 shrink-0 bg-[#ffa400]" aria-label="Cần cải thiện" />;
  return <span className="mt-1 size-2.5 shrink-0 rounded-full bg-[#0cce6b]" aria-label="Đạt" />;
}

function Row({ c }: { c: Check }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b last:border-b-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-2.5 py-2 text-left text-[13px] hover:bg-muted/40">
        <Mark s={c.status} />
        <span className="min-w-0 flex-1">{c.title}</span>
        <ChevronDown className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <p className="pb-2 pl-5 text-xs text-muted-foreground">{c.detail}</p>}
    </li>
  );
}

/** Khoi "Điểm SEO" o cot phai form them / sua. */
export function SeoScorePanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [showPassed, setShowPassed] = useState(false);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let last = "";
    const run = () => {
      const f = read(form);
      const key = JSON.stringify(f);
      if (key === last) return;
      last = key;
      setChecks(analyzeSeo(f));
    };
    run();
    const t = setInterval(run, 800);
    return () => clearInterval(t);
  }, []);

  const score = checks ? seoScore(checks) : 0;
  const bad = (checks ?? []).filter((c) => c.status !== "pass").sort((a, b) => (a.status === b.status ? b.weight - a.weight : a.status === "fail" ? -1 : 1));
  const passed = (checks ?? []).filter((c) => c.status === "pass");
  const counts = { fail: bad.filter((c) => c.status === "fail").length, warn: bad.filter((c) => c.status === "warn").length };

  return (
    <div ref={ref} className="rounded-xl border bg-card">
      <div className="flex flex-col items-center gap-2 border-b px-4 pt-5 pb-4 text-center">
        <Gauge score={score} />
        <p className="text-sm font-semibold">Điểm SEO</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-[#ff4e42]" /> 0–49
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 bg-[#ffa400]" /> 50–89
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#0cce6b]" /> 90–100
          </span>
        </div>
      </div>
      <div className="px-4 py-3">
        {bad.length > 0 && (
          <>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Cần sửa · {counts.fail} chưa đạt, {counts.warn} cần cải thiện
            </p>
            <ul>
              {bad.map((c) => (
                <Row key={c.id} c={c} />
              ))}
            </ul>
          </>
        )}
        <button type="button" onClick={() => setShowPassed(!showPassed)} className="mt-2 flex w-full items-center justify-between rounded-md py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground">
          Đã đạt ({passed.length})
          <ChevronDown className={cn("size-3.5 transition-transform", showPassed && "rotate-180")} />
        </button>
        {showPassed && (
          <ul>
            {passed.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Chấm tự động khi bạn gõ. Từ khóa chính là từ đầu tiên trong ô “Từ khóa SEO”.</p>
      </div>
    </div>
  );
}
