"use client";

import { ArrowUp, Link2, Loader2, Mail, MessageCircle, MessageSquareText, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonHref, KIND_INFO, type FloatingButton, type FloatingConfig, type FloatingKind } from "@/modules/floating/config";

/**
 * Nut lien he noi hai ben hong trang (cau hinh o Quan ly Page -> Nut lien he noi). Nut "form" mo hop thoai gui
 * POST /yeu-cau-tu-van (luu vao QL Lien he), co honeypot + token thoi gian nhu form lien he. `preview`: ve trong
 * khung xem truoc cua trang admin (dinh vi theo khung, khong gui form that).
 */
export function FloatingButtons({ config, token, preview = false }: { config: FloatingConfig; token?: string; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (preview) return;
    const on = () => setScrolled(window.scrollY > 300);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [preview]);

  const visible = config.buttons.filter((b) => b.enabled && (b.kind === "form" || b.kind === "top" || buttonHref(b)));
  const sides = (["left", "right"] as const).map((side) => ({ side, list: visible.filter((b) => b.side === side) })).filter((s) => s.list.length);
  if (!sides.length) return null;

  const radius = config.shape === "circle" ? "9999px" : config.shape === "rounded" ? `${Math.round(config.size * 0.28)}px` : "6px";
  const pos = preview ? "absolute" : "fixed";

  return (
    <>
      {sides.map(({ side, list }) => (
        <div
          key={side}
          className={`${pos} z-[60] flex flex-col ${side === "left" ? "items-start" : "items-end"} ${config.hideOnMobile && !preview ? "max-sm:hidden" : ""}`}
          style={{ bottom: config.bottom, [side]: config.offset, gap: config.gap }}
        >
          {list.map((b, i) => {
            const hidden = b.kind === "top" && config.topAfterScroll && !scrolled && !preview;
            return (
              <Btn
                key={b.id}
                b={b}
                config={config}
                side={side}
                radius={radius}
                hidden={hidden}
                attention={i === 0 && b.kind !== "top" ? config.attention : "none"}
                onAction={() => (b.kind === "form" ? setOpen(true) : window.scrollTo({ top: 0, behavior: "smooth" }))}
                preview={preview}
              />
            );
          })}
        </div>
      ))}
      {open && <FormDialog config={config} token={token} preview={preview} onClose={() => setOpen(false)} />}
      <style>{`
        @keyframes fb-pulse { 0% { box-shadow: 0 0 0 0 var(--fb-c); } 70% { box-shadow: 0 0 0 14px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
        @keyframes fb-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .fb-btn:hover .fb-tip, .fb-btn:focus-visible .fb-tip { opacity: 1; transform: translateX(0); }
        @media (prefers-reduced-motion: reduce) { .fb-anim { animation: none !important; } }
      `}</style>
    </>
  );
}

function Btn({
  b,
  config,
  side,
  radius,
  hidden,
  attention,
  onAction,
  preview,
}: {
  b: FloatingButton;
  config: FloatingConfig;
  side: "left" | "right";
  radius: string;
  hidden: boolean;
  attention: FloatingConfig["attention"];
  onAction: () => void;
  preview: boolean;
}) {
  const info = KIND_INFO[b.kind];
  const color = b.color || info.color;
  const label = b.label || info.defaultLabel;
  const href = buttonHref(b);
  const s = config.size;
  const tip =
    config.labels === "never" ? null : (
      <span
        className={`fb-tip pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-white px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-[#22201c] shadow-md transition-all duration-150 ${
          side === "right" ? "right-full mr-2.5" : "left-full ml-2.5"
        } ${config.labels === "always" ? "opacity-100" : `opacity-0 ${side === "right" ? "translate-x-1" : "-translate-x-1"}`}`}
      >
        {label}
      </span>
    );
  const style: React.CSSProperties = {
    width: s,
    height: s,
    borderRadius: radius,
    background: color,
    ["--fb-c" as string]: `${color}88`,
    boxShadow: config.shadow ? "0 6px 18px rgba(0,0,0,.18)" : undefined,
    animation: attention === "pulse" ? "fb-pulse 2s infinite" : attention === "bounce" ? "fb-bounce 1.6s ease-in-out infinite" : undefined,
    opacity: hidden ? 0 : 1,
    pointerEvents: hidden ? "none" : undefined,
    transition: "opacity .2s, transform .15s",
  };
  const cls = "fb-btn fb-anim relative grid place-items-center text-white hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2";
  const icon = <KindIcon kind={b.kind} size={Math.round(s * 0.46)} />;
  if (href)
    return (
      <a
        href={preview ? undefined : href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        aria-label={label}
        className={cls}
        style={style}
      >
        {icon}
        {tip}
      </a>
    );
  return (
    <button type="button" aria-label={label} onClick={onAction} className={cls} style={style} tabIndex={hidden ? -1 : undefined}>
      {icon}
      {tip}
    </button>
  );
}

export function KindIcon({ kind, size = 24 }: { kind: FloatingKind; size?: number }) {
  switch (kind) {
    case "messenger":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.98-.87c.17-.08.36-.09.53-.04.91.25 1.88.38 2.9.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm6 7.46-2.94 4.66c-.47.73-1.47.92-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66c.47-.73 1.47-.92 2.17-.4l2.34 1.75c.21.16.51.16.72 0l3.16-2.4c.42-.32.97.18.69.63z" />
        </svg>
      );
    case "zalo":
      return (
        <span aria-hidden="true" style={{ fontSize: size * 0.5, fontWeight: 800, letterSpacing: -0.3 }}>
          Zalo
        </span>
      );
    case "phone":
      return <Phone size={size} aria-hidden="true" />;
    case "whatsapp":
      return <MessageCircle size={size} aria-hidden="true" />;
    case "email":
      return <Mail size={size} aria-hidden="true" />;
    case "form":
      return <MessageSquareText size={size} aria-hidden="true" />;
    case "top":
      return <ArrowUp size={size} aria-hidden="true" />;
    default:
      return <Link2 size={size} aria-hidden="true" />;
  }
}

function FormDialog({ config, token, preview, onClose }: { config: FloatingConfig; token?: string; preview: boolean; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const first = useRef<HTMLInputElement>(null);
  const f = config.form;

  useEffect(() => {
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (preview) return setState("done"), setMessage(f.success);
    setState("busy");
    setErrors([]);
    try {
      const res = await fetch("/yeu-cau-tu-van", { method: "POST", body: new FormData(e.currentTarget), headers: { accept: "application/json" } });
      const json = (await res.json()) as { ok: boolean; message?: string; errors?: string[] };
      if (json.ok) {
        setState("done");
        setMessage(f.success || json.message || "");
      } else {
        setState("idle");
        setErrors(json.errors ?? ["Something went wrong. Please try again."]);
      }
    } catch {
      setState("idle");
      setErrors(["Something went wrong. Please try again."]);
    }
  };

  const input = "w-full rounded-lg border border-[#d5d0c6] bg-white px-3 py-2 text-sm text-[#22201c] outline-none focus:border-[#22201c]";
  return (
    <div className={`${preview ? "absolute" : "fixed"} inset-0 z-[70] grid place-items-center bg-black/40 p-4`} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="fb-form-title" className="w-full max-w-sm rounded-2xl bg-white p-5 text-[#22201c] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="fb-form-title" className="text-lg font-bold">
              {f.title}
            </h2>
            {f.subtitle && <p className="mt-0.5 text-sm text-[#6b645a]">{f.subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {state === "done" ? (
          <p role="status" className="mt-4 rounded-lg bg-[#e7f6ee] p-3 text-sm text-[#166534]">
            {message}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-2.5">
            <input type="hidden" name="_fts" value={token ?? ""} />
            <input type="hidden" name="type" value="form" />
            <input type="hidden" name="page" value={typeof window === "undefined" ? "" : window.location.pathname} />
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <input name="contact_ref_code" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>
            <input ref={first} name="name" required placeholder="Your name" autoComplete="name" className={input} aria-label="Your name" />
            <input name="phone" required placeholder="Phone number" type="tel" autoComplete="tel" className={input} aria-label="Phone number" />
            {f.askEmail && <input name="email" type="email" placeholder="Email (optional)" autoComplete="email" className={input} aria-label="Email" />}
            {f.askMessage && <textarea name="message" rows={3} placeholder="How can we help?" className={input} aria-label="Message" />}
            {errors.length > 0 && (
              <ul role="alert" className="text-sm text-[#b91c1c]">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <button type="submit" disabled={state === "busy"} className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#22201c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {state === "busy" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {f.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
