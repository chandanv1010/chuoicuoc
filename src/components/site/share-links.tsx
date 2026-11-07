"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

/**
 * Nut chia se bai viet: sao chep link + Facebook / Pinterest / X bang link thuong
 * (khong nap SDK cua mang xa hoi).
 */
export function ShareLinks({ url, title, image }: { url: string; title: string; image?: string | null }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "Facebook", short: "f", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    {
      label: "Pinterest",
      short: "P",
      href: `https://www.pinterest.com/pin/create/button/?url=${u}&description=${t}${image ? `&media=${encodeURIComponent(image)}` : ""}`,
    },
    { label: "X", short: "𝕏", href: `https://x.com/intent/post?url=${u}&text=${t}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Trinh duyet chan clipboard: chon chu trong o tam roi copy kieu cu
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pill =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-az-border bg-white px-3.5 text-[13px] font-medium text-az-text transition-colors hover:border-az-link hover:text-az-link";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold tracking-[0.14em] text-az-muted uppercase">Share</span>
      <button type="button" onClick={copy} className={pill}>
        {copied ? <Check className="size-4 text-az-success" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
        <span>{copied ? "Link copied" : "Copy link"}</span>
      </button>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={pill}>
          <span aria-hidden="true" className="font-bold">
            {l.short}
          </span>
          {l.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
