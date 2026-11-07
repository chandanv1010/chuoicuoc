"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { createPageAction } from "@/modules/builder/actions";

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const field = "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary";

/**
 * Tao landing page (ten + duong dan /<duong-dan>.html, tu goi y theo ten) hoac header / footer rieng (ten),
 * xong mo thang trinh dung.
 */
export function NewPageForm({ kind }: { kind: "landing" | "part" }) {
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [touched, setTouched] = useState(false);
  const [part, setPart] = useState<"header" | "footer">("header");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shownPath = touched ? path : slugify(title);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { slug } = await createPageAction(kind === "landing" ? "landing" : part, title, kind === "landing" ? shownPath : undefined);
      location.href = `/builder/${slug}/edit`;
    } catch (err) {
      setError((err as Error).message || "Không tạo được trang");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-end gap-2">
        {kind === "part" && (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Loại
            <select value={part} onChange={(e) => setPart(e.target.value as "header" | "footer")} className={field}>
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </select>
          </label>
        )}
        <label className="grid min-w-56 flex-1 gap-1 text-xs text-muted-foreground">
          {kind === "landing" ? "Tên trang" : "Tên thiết kế"}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={150}
            placeholder={kind === "landing" ? "VD: Khuyến mãi Tết 2027" : "VD: Tối giản (chỉ logo + hotline)"}
            className={field}
          />
        </label>
        {kind === "landing" && (
          <label className="grid min-w-56 flex-1 gap-1 text-xs text-muted-foreground">
            Đường dẫn
            <span className="flex items-center rounded-lg border bg-background pl-3 text-sm focus-within:border-primary">
              <span className="text-muted-foreground">/</span>
              <input
                value={shownPath}
                onChange={(e) => {
                  setTouched(true);
                  setPath(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
                required
                maxLength={99}
                placeholder="khuyen-mai-tet"
                className="h-9 min-w-0 flex-1 bg-transparent outline-none"
              />
              <span className="pr-3 text-muted-foreground">.html</span>
            </span>
          </label>
        )}
        <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {kind === "landing" ? "Tạo landing page" : "Tạo thiết kế"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  );
}
