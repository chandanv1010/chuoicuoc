import { ShieldXIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** 403 khi $this->authorize('modules', ...) that bai. */
export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldXIcon className="size-7" />
      </span>
      <div>
        <h1 className="text-xl font-semibold">403 — Không có quyền truy cập</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tài khoản của bạn chưa được cấp quyền cho chức năng này (This action is unauthorized).</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard/index">Về Dashboard</Link>
      </Button>
    </div>
  );
}
