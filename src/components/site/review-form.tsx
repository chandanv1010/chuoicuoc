"use client";

import { Loader2, Star } from "lucide-react";
import { useState } from "react";

/**
 * Form viet danh gia (thay review.js + jQuery): POST multipart /ajax/review/create voi
 * cac truong cua ReviewService::create (reviewable_type, reviewable_id, fullname, email,
 * phone, gender, description, score, image). Danh gia moi o trang thai cho duyet (status 0).
 */
export function ReviewForm({ productId, reviewableType, defaultName = "", defaultEmail = "" }: { productId: number; reviewableType: string; defaultName?: string; defaultEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!score) {
      setState("error");
      setError("Please choose a star rating.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("score", String(score));
    fd.set("reviewable_type", reviewableType);
    fd.set("reviewable_id", String(productId));
    const file = fd.get("image");
    if (file instanceof File && file.size === 0) fd.delete("image");
    setState("busy");
    try {
      const res = await fetch("/ajax/review/create", { method: "POST", body: fd, headers: { "x-requested-with": "XMLHttpRequest" } });
      const json = (await res.json().catch(() => null)) as { code?: number } | null;
      if (!res.ok || !json || json.code !== 10) throw new Error();
      setState("done");
    } catch {
      setState("error");
      setError("We couldn't submit your review. Images must be PNG, JPEG or WebP under 5MB.");
    }
  };

  if (state === "done")
    return (
      <p role="status" className="rounded-lg border border-az-success bg-[#f1faf7] p-3 text-sm">
        Thank you! Your review was submitted and will appear after it is approved.
      </p>
    );

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="az-btn az-btn-secondary w-full py-1.5">
        Write a customer review
      </button>
    );

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-az-border p-4" noValidate>
      <fieldset>
        <legend className="az-label">Overall rating</legend>
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={score === n}
              className="p-0.5"
            >
              <Star className={`size-7 ${(hover || score) >= n ? "fill-az-star text-[#de7921]" : "text-[#999]"}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="rv-desc" className="az-label">
          Your review
        </label>
        <textarea id="rv-desc" name="description" required maxLength={191} rows={3} className="az-input" placeholder="What did you like or dislike?" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rv-name" className="az-label">
            Your name
          </label>
          <input id="rv-name" name="fullname" required defaultValue={defaultName} className="az-input" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="rv-email" className="az-label">
            Email <span className="font-normal text-az-muted">(not shown)</span>
          </label>
          <input id="rv-email" name="email" type="email" required defaultValue={defaultEmail} className="az-input" autoComplete="email" />
        </div>
      </div>
      <div>
        <label htmlFor="rv-image" className="az-label">
          Add a photo <span className="font-normal text-az-muted">(optional)</span>
        </label>
        <input id="rv-image" name="image" type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
      </div>
      {state === "error" && (
        <p role="alert" className="text-sm text-az-deal">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={state === "busy"} className="az-btn az-btn-cart">
          {state === "busy" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Submit
        </button>
        <button type="button" onClick={() => setOpen(false)} className="az-btn az-btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
