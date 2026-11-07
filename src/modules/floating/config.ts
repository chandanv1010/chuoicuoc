/**
 * Nut lien he noi hai ben hong trang (Messenger, Zalo, goi dien, WhatsApp, email, form lien he, len dau trang...).
 * Cau hinh luu JSON trong bang systems (keyword FLOATING_KEY), sua o Quan ly Page -> Nut lien he noi.
 */

export const FLOATING_KEY = "floating_buttons";

export type FloatingKind = "messenger" | "zalo" | "phone" | "whatsapp" | "email" | "form" | "top" | "link";

export type FloatingButton = {
  id: string;
  kind: FloatingKind;
  enabled: boolean;
  side: "left" | "right";
  /** messenger: ten trang / username (m.me/<value>); zalo / phone / whatsapp: so dien thoai; email: dia chi; link: URL */
  value: string;
  label: string;
  /** mau nen; rong = mau mac dinh cua loai nut */
  color: string;
};

export type FloatingConfig = {
  enabled: boolean;
  buttons: FloatingButton[];
  /** khoang cach toi mep duoi / mep ben (px) */
  bottom: number;
  offset: number;
  size: number;
  gap: number;
  shape: "circle" | "rounded" | "square";
  /** hien nhan chu canh nut: luon / khi re chuot / khong */
  labels: "always" | "hover" | "never";
  /** hieu ung goi chu y cho nut dau tien moi ben */
  attention: "none" | "pulse" | "bounce";
  shadow: boolean;
  /** an tren dien thoai */
  hideOnMobile: boolean;
  /** nut "len dau trang" chi hien khi da cuon xuong */
  topAfterScroll: boolean;
  form: { title: string; subtitle: string; submit: string; askEmail: boolean; askMessage: boolean; success: string };
};

export const KIND_INFO: Record<FloatingKind, { label: string; color: string; valueLabel?: string; placeholder?: string; defaultLabel: string }> = {
  messenger: { label: "Messenger", color: "#0866ff", valueLabel: "Trang / username", placeholder: "yourpage", defaultLabel: "Chat Messenger" },
  zalo: { label: "Zalo", color: "#0068ff", valueLabel: "Số điện thoại Zalo", placeholder: "0912345678", defaultLabel: "Chat Zalo" },
  phone: { label: "Gọi điện", color: "#16a34a", valueLabel: "Số điện thoại", placeholder: "+84 912 345 678", defaultLabel: "Gọi cho chúng tôi" },
  whatsapp: { label: "WhatsApp", color: "#25d366", valueLabel: "Số WhatsApp (mã quốc gia)", placeholder: "84912345678", defaultLabel: "WhatsApp" },
  email: { label: "Email", color: "#c8553d", valueLabel: "Địa chỉ email", placeholder: "hello@example.com", defaultLabel: "Gửi email" },
  form: { label: "Form liên hệ", color: "#22201c", defaultLabel: "Gửi tin nhắn" },
  top: { label: "Lên đầu trang", color: "#4b5563", defaultLabel: "Lên đầu trang" },
  link: { label: "Liên kết khác", color: "#7c3aed", valueLabel: "Đường dẫn", placeholder: "https://…", defaultLabel: "Mở" },
};

export const DEFAULT_FLOATING: FloatingConfig = {
  enabled: false,
  buttons: [
    { id: "b1", kind: "messenger", enabled: true, side: "right", value: "", label: "", color: "" },
    { id: "b2", kind: "form", enabled: true, side: "right", value: "", label: "", color: "" },
    { id: "b3", kind: "top", enabled: true, side: "right", value: "", label: "", color: "" },
  ],
  bottom: 24,
  offset: 20,
  size: 52,
  gap: 12,
  shape: "circle",
  labels: "hover",
  attention: "pulse",
  shadow: true,
  hideOnMobile: false,
  topAfterScroll: true,
  form: {
    title: "Gửi tin nhắn cho chúng tôi",
    subtitle: "Chúng tôi thường phản hồi trong 1–2 ngày làm việc.",
    submit: "Gửi",
    askEmail: true,
    askMessage: true,
    success: "Cảm ơn bạn! Tin nhắn đã được gửi. Chúng tôi sẽ liên hệ lại sớm.",
  },
};

const KINDS = Object.keys(KIND_INFO) as FloatingKind[];
const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.slice(0, max) : d);
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

/** Doc / lam sach cau hinh tu JSON (DB hoac form admin). */
export function normalizeFloating(raw: unknown): FloatingConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_FLOATING;
  const f = (r.form && typeof r.form === "object" ? r.form : {}) as Record<string, unknown>;
  const buttons = Array.isArray(r.buttons)
    ? r.buttons.slice(0, 12).flatMap((b, i): FloatingButton[] => {
        if (!b || typeof b !== "object") return [];
        const x = b as Record<string, unknown>;
        const kind = pick(x.kind, KINDS, "link");
        return [
          {
            id: str(x.id, 20) || `b${i + 1}`,
            kind,
            enabled: x.enabled !== false,
            side: pick(x.side, ["left", "right"] as const, "right"),
            value: str(x.value, 300).trim(),
            label: str(x.label, 60),
            color: /^#[0-9a-f]{3,8}$/i.test(str(x.color, 9)) ? str(x.color, 9) : "",
          },
        ];
      })
    : d.buttons;
  return {
    enabled: r.enabled === true,
    buttons,
    bottom: clamp(r.bottom, 0, 300, d.bottom),
    offset: clamp(r.offset, 0, 200, d.offset),
    size: clamp(r.size, 36, 80, d.size),
    gap: clamp(r.gap, 0, 40, d.gap),
    shape: pick(r.shape, ["circle", "rounded", "square"] as const, d.shape),
    labels: pick(r.labels, ["always", "hover", "never"] as const, d.labels),
    attention: pick(r.attention, ["none", "pulse", "bounce"] as const, d.attention),
    shadow: r.shadow !== false,
    hideOnMobile: r.hideOnMobile === true,
    topAfterScroll: r.topAfterScroll !== false,
    form: {
      title: str(f.title, 100) || d.form.title,
      subtitle: str(f.subtitle, 200),
      submit: str(f.submit, 40) || d.form.submit,
      askEmail: f.askEmail !== false,
      askMessage: f.askMessage !== false,
      success: str(f.success, 300) || d.form.success,
    },
  };
}

/** Link cua nut; null = nut hanh dong (form, len dau trang) hoac chua nhap gia tri. */
export function buttonHref(b: FloatingButton): string | null {
  const v = b.value.trim();
  const digits = v.replace(/[^\d+]/g, "");
  switch (b.kind) {
    case "messenger":
      return v ? (/^https?:\/\//.test(v) ? v : `https://m.me/${encodeURIComponent(v.replace(/^@/, ""))}`) : null;
    case "zalo":
      return digits ? `https://zalo.me/${digits.replace(/^\+84/, "0")}` : null;
    case "phone":
      return digits ? `tel:${digits}` : null;
    case "whatsapp":
      return digits ? `https://wa.me/${digits.replace(/^\+/, "")}` : null;
    case "email":
      return v.includes("@") ? `mailto:${v}` : null;
    case "link":
      return /^(https?:\/\/|\/)/.test(v) ? v : null;
    default:
      return null;
  }
}
