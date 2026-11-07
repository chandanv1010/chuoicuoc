"use client";

import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { NativeSelect } from "@/components/ui/form-controls";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/**
 * O doi trang thai danh gia + link doi tuong (thay HT.approve trong library.js:
 * #status-review change -> POST ajax/review/changeStatus {id, status}; tra so dong da sua).
 */
export function ReviewStatus({ id, status, options, href }: { id: string; status: number; options: [string, string][]; href: string }) {
  const [value, setValue] = useState(String(status));
  const [pending, setPending] = useState(false);
  const approved = value !== "0";

  const change = async (next: string) => {
    const prev = value;
    setValue(next);
    setPending(true);
    try {
      const res = await fetch("/ajax/review/changeStatus", {
        method: "POST",
        body: new URLSearchParams({ id, status: next }),
        headers: { "x-requested-with": "XMLHttpRequest" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error("Không cập nhật được trạng thái");
      toast.success("Cập nhật trạng thái thành công!");
    } catch (e) {
      setValue(prev);
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <NativeSelect value={value} onChange={(e) => change(e.target.value)} disabled={pending} className={cn("h-8 w-40", approved ? "text-success" : "text-amber-700")}>
          {options.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </NativeSelect>
        {pending && <Loader2Icon className="absolute top-2 right-7 size-4 animate-spin text-muted-foreground" />}
      </div>
      {href !== "#" && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!approved}
          className={cn("inline-flex items-center gap-1 text-xs text-primary hover:underline", !approved && "pointer-events-none text-muted-foreground")}
        >
          <ExternalLinkIcon className="size-3" /> Xem đối tượng
        </a>
      )}
    </div>
  );
}
