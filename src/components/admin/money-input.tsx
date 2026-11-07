"use client";

import { useState } from "react";
import { Input } from "@/components/ui/form-controls";
import { CURRENCY, formatMoneyInput, parseMoney, sanitizeMoneyTyping } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * O nhap tien USD dung chung cho admin (thay o .int "1.234.567đ" cua ban VND).
 * - Hien tien to "$", cho go so thap phan (24.99), dau phay hang nghin (1,234.50).
 * - Blur: dinh dang lai "1,234.50".
 * - Gui len: <input type=hidden name=...> gia tri tron "1234.50" (rong -> "").
 * Dung khong kiem soat (defaultValue) hoac kiem soat (value + onValueChange, gia tri hien thi).
 */
type Props = Omit<React.ComponentProps<typeof Input>, "defaultValue" | "value" | "onChange" | "name" | "type"> & {
  name?: string;
  defaultValue?: unknown;
  /** gia tri hien thi (che do kiem soat) */
  value?: string;
  onValueChange?: (display: string) => void;
  /** chu nho ben phai o nhap */
  suffix?: React.ReactNode;
  /** an tien to $ (o gia tri co the la % — da co select $ / % ben canh) */
  hidePrefix?: boolean;
  /** class cho khung bao ngoai (vd "min-w-0 flex-1" khi dat canh select $ / %) */
  wrapperClassName?: string;
};

export function MoneyInput({ name, defaultValue, value, onValueChange, className, suffix, hidePrefix, wrapperClassName, onBlur, ...props }: Props) {
  const [inner, setInner] = useState(() => formatMoneyInput(defaultValue));
  const display = value ?? inner;
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };
  return (
    <div className={cn("relative", wrapperClassName)}>
      {!hidePrefix && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{CURRENCY.symbol}</span>
      )}
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={display}
        onChange={(e) => set(sanitizeMoneyTyping(e.target.value))}
        onBlur={(e) => {
          set(formatMoneyInput(display));
          onBlur?.(e);
        }}
        className={cn("text-right tabular-nums", !hidePrefix && "pl-7", suffix ? "pr-8" : undefined, className)}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      {name && <input type="hidden" name={name} value={parseMoney(display) ?? ""} />}
    </div>
  );
}
