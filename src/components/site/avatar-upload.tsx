"use client";

/* eslint-disable @next/next/no-img-element -- anh dai dien upload */
import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Doi anh dai dien (thay #btnChangeAvatar + jQuery): POST multipart /ajax/customer/uploadAvatar
 * {avatar}; thanh cong tra {status: "success", url}, loi validate tra 422 {message}.
 */
export function AvatarUpload({ src, name }: { src: string | null; name: string }) {
  const [url, setUrl] = useState(src);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await fetch("/ajax/customer/uploadAvatar", { method: "POST", body: fd, headers: { "x-requested-with": "XMLHttpRequest", accept: "application/json" } });
      const json = (await res.json().catch(() => null)) as { status?: string; url?: string; message?: string } | null;
      if (!res.ok || json?.status !== "success" || !json.url) throw new Error(json?.message || "Upload failed.");
      setUrl(`${json.url}?v=${Date.now()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 overflow-hidden rounded-full border border-az-border bg-[#f3f3f3]">
        {url ? (
          <img src={url.startsWith("http") || url.startsWith("/") ? url : `/${url}`} alt={`${name}'s profile photo`} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-az-muted" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="size-6 animate-spin" aria-label="Uploading" />
          </span>
        )}
      </div>
      <div>
        <button type="button" onClick={() => input.current?.click()} className="az-btn az-btn-secondary text-xs" disabled={busy}>
          <Camera className="size-4" aria-hidden="true" /> Change photo
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Choose a profile photo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <p className="mt-1 text-xs text-az-muted">JPG, PNG or WebP, up to 2 MB.</p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-az-deal">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
