import { Badge } from "@/components/ui/misc";
import { mauTrangThai, tenTrangThai } from "./dealer";

/** <span class="label label-{mau}"> cua dealer_registration -> Badge */
const VARIANT = { danger: "destructive", warning: "warning", primary: "default", success: "success", default: "secondary" } as const;

export function StatusBadge({ status }: { status: string }) {
  const mau = mauTrangThai(status) as keyof typeof VARIANT;
  return <Badge variant={VARIANT[mau] ?? "secondary"}>{tenTrangThai(status)}</Badge>;
}
