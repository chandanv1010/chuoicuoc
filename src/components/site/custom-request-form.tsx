"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";

/**
 * Form "yeu cau thiet ke rieng" (khoi customRequest cua trinh dung giao dien): POST /yeu-cau-tu-van (consultStore,
 * luu vao QL Lien he, type=custom). Ten truong an chong spam do server truyen vao.
 */
export function CustomRequestForm({
  token,
  tsField,
  honeypotField,
  label,
  topic,
}: {
  token: string;
  tsField: string;
  honeypotField: string;
  label?: string;
  /** chu de (ten landing / san pham) ghi kem vao loi nhan cho nguoi truc */
  topic?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("busy");
    setErrors([]);
    try {
      const res = await fetch("/yeu-cau-tu-van", { method: "POST", body: new FormData(e.currentTarget), headers: { accept: "application/json" } });
      const json = (await res.json()) as { ok: boolean; message?: string; errors?: string[] };
      if (json.ok) {
        setState("done");
        setMessage(json.message ?? "");
      } else {
        setState("idle");
        setErrors(json.errors ?? ["Something went wrong. Please try again."]);
      }
    } catch {
      setState("idle");
      setErrors(["Could not send. Please check your connection and try again."]);
    }
  };

  const field =
    "block w-full rounded-xl border border-[#e3d6c4] bg-white px-4 py-3 text-[15px] text-[#2b2420] outline-none placeholder:text-[#a2958a] focus:border-[#6f7f52] focus:ring-2 focus:ring-[#6f7f52]/20";

  if (state === "done")
    return (
      <div className="rounded-2xl border border-[#cfd8bf] bg-[#f3f6ec] p-6 text-[#2b2420]" role="status">
        <p className="text-lg font-bold">Thank you — we got your idea! 🎄</p>
        <p className="mt-1 text-[15px] text-[#5f5a52]">{message || "We will get back to you soon."} We usually reply within 1–2 business days.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate={false}>
      <input type="hidden" name={tsField} value={token} />
      <input type="hidden" name="type" value="custom" />
      <input type="hidden" name="product" value={topic ?? ""} />
      <input type="hidden" name="page" value={typeof window === "undefined" ? "" : window.location.pathname} />
      {/* honeypot: an khoi nguoi that va trinh doc man hinh */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="cr-ref">Leave this field empty</label>
        <input id="cr-ref" name={honeypotField} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <label className="grid gap-1.5 text-sm font-semibold text-[#2b2420]">
        Your name
        <input name="name" required maxLength={190} autoComplete="name" placeholder="Jane Smith" className={field} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-[#2b2420]">
        WhatsApp or phone
        <input name="phone" required maxLength={50} type="tel" autoComplete="tel" placeholder="+1 555 123 4567" className={field} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-[#2b2420] sm:col-span-2">
        <span>
          Email <span className="font-normal text-[#8a7d72]">(optional)</span>
        </span>
        <input name="email" type="email" maxLength={190} autoComplete="email" placeholder="you@example.com" className={field} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-[#2b2420] sm:col-span-2">
        Tell us your idea
        <textarea
          name="message"
          required
          maxLength={2000}
          rows={5}
          placeholder="Describe what you'd like — size, colors, quantity, any text or reference."
          className={`${field} resize-y`}
        />
      </label>
      {errors.length > 0 && (
        <ul className="rounded-xl border border-[#f0c2c2] bg-[#fdf2f2] px-4 py-3 text-sm text-[#a12525] sm:col-span-2" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={state === "busy"}
          className="inline-flex items-center gap-2 rounded-xl bg-[#b22234] px-6 py-3.5 text-[15px] font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {state === "busy" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {label || "Send my idea"}
        </button>
        <span className="text-[13px] text-[#8a7d72]">We&apos;ll reply with ideas and a quote — nothing is charged until you order.</span>
      </div>
    </form>
  );
}
