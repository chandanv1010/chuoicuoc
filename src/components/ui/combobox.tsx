"use client";

import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./interactive";

/**
 * Thay select2: o chon co tim kiem, mot hoac nhieu gia tri. Gia tri duoc gui
 * bang <input type="hidden" name=...> nen form POST thuong van nhan nhu cu
 * (vd name="catalogue[]" voi multiple).
 */
export type ComboOption = { value: string; label: string; disabled?: boolean };

type Props = {
  name?: string;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
} & (
  | { multiple?: false; defaultValue?: string; value?: string; onChange?: (value: string) => void }
  | { multiple: true; defaultValue?: string[]; value?: string[]; onChange?: (value: string[]) => void }
);

/** Bo tien to "|-----" cua Nestedsetbie::Dropdown khi tim kiem. */
const plain = (label: string) => label.replace(/^(\|-+)+/, "").trim();

export function Combobox(props: Props) {
  const { name, options, placeholder = "Chọn...", searchPlaceholder = "Tìm kiếm...", emptyText = "Không có kết quả", className, disabled, id } = props;
  const [open, setOpen] = React.useState(false);
  const controlled = props.value !== undefined;
  const [inner, setInner] = React.useState<string[]>(() => {
    const d = props.defaultValue;
    return d === undefined ? [] : Array.isArray(d) ? d.map(String) : [String(d)];
  });
  const selected: string[] = controlled ? (Array.isArray(props.value) ? props.value.map(String) : [String(props.value)]) : inner;

  const commit = (next: string[]) => {
    if (!controlled) setInner(next);
    if (props.multiple) props.onChange?.(next);
    else props.onChange?.(next[0] ?? "");
  };

  const toggle = (v: string) => {
    if (props.multiple) commit(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    else {
      commit([v]);
      setOpen(false);
    }
  };

  const byValue = new Map(options.map((o) => [o.value, o]));
  const single = !props.multiple ? byValue.get(selected[0] ?? "") : undefined;

  return (
    <>
      {name &&
        (props.multiple
          ? selected.map((v) => <input key={v} type="hidden" name={name} value={v} />)
          : <input type="hidden" name={name} value={selected[0] ?? ""} />)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
              className,
            )}
          >
            <span className="flex min-w-0 flex-1 flex-wrap gap-1">
              {props.multiple ? (
                selected.length ? (
                  selected.map((v) => (
                    <span key={v} className="inline-flex max-w-full items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs">
                      <span className="truncate">{plain(byValue.get(v)?.label ?? v)}</span>
                      <span
                        role="button"
                        tabIndex={-1}
                        className="text-muted-foreground hover:text-foreground"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggle(v);
                        }}
                      >
                        <XIcon className="size-3" />
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">{placeholder}</span>
                )
              ) : single ? (
                <span className="truncate">{plain(single.label)}</span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0">
          <CommandPrimitive className="flex flex-col" filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
            <CommandPrimitive.Input placeholder={searchPlaceholder} className="h-9 border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground" />
            <CommandPrimitive.List className="max-h-72 overflow-y-auto p-1">
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">{emptyText}</CommandPrimitive.Empty>
              {options.map((o) => (
                <CommandPrimitive.Item
                  key={o.value}
                  value={`${plain(o.label)} ${o.value}`}
                  disabled={o.disabled}
                  onSelect={() => toggle(o.value)}
                  className="relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent"
                >
                  <CheckIcon className={cn("size-4", selected.includes(o.value) ? "opacity-100" : "opacity-0")} />
                  <span className="whitespace-pre">{o.label.replace(/\|-----/g, "    ")}</span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverContent>
      </Popover>
    </>
  );
}
