"use client";

import { Check, Loader2, Newspaper, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { saveSiteTypeAction } from "./actions";

const TYPES = [
  {
    key: "shop" as const,
    icon: ShoppingBag,
    title: "Website bán hàng",
    text: "Đầy đủ sản phẩm, đơn hàng, khách hàng, marketing, mạng xã hội, sàn TMĐT. Dashboard theo đơn hàng và doanh thu.",
  },
  {
    key: "news" as const,
    icon: Newspaper,
    title: "Website tin tức",
    text: "Ẩn mọi mục bán hàng khỏi menu (sản phẩm, đơn hàng, khách hàng, marketing, mạng xã hội, sàn TMĐT). Dashboard theo bài viết, lượt xem và liên hệ.",
  },
];

export function SiteTypeForm({ initial }: { initial: "shop" | "news" }) {
  const [type, setType] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const save = async () => {
    setBusy(true);
    try {
      await saveSiteTypeAction(type);
      setSaved(type);
      toast.success("Đã đổi loại website.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={cn("relative rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/60", type === t.key && "border-primary ring-2 ring-primary/20")}
          >
            {type === t.key && (
              <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3.5" />
              </span>
            )}
            <t.icon className="size-7 text-primary" />
            <p className="mt-3 font-semibold">{t.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.text}</p>
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={busy || type === saved}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {type === saved ? "Đang dùng" : "Lưu lại"}
        </Button>
        <p className="text-xs text-muted-foreground">Chỉ đổi menu và dashboard trong trang quản trị; dữ liệu không bị xóa.</p>
      </div>
    </div>
  );
}
