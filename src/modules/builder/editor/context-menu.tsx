"use client";

import { ArrowDown, ArrowUp, ClipboardPaste, Copy, CopyPlus, Group, Scissors, Trash2, Ungroup } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "./store";

export type MenuState = { x: number; y: number };

/** Menu chuot phai tren canvas: copy / dan / nhan ban / boc frame / doi thu tu / xoa. */
export function ContextMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const store = useStore();
  const { selected, doc } = store.state;
  const n = selected ? doc.nodes[selected] : null;
  const child = !!n?.parent;

  useEffect(() => {
    const close = () => onClose();
    const idoc = store.iframe?.contentDocument;
    window.addEventListener("pointerdown", close);
    idoc?.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      idoc?.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [onClose, store]);

  const items: { label: string; keys?: string; icon: React.ComponentType<{ className?: string }>; run: () => void; show: boolean; danger?: boolean }[] = [
    { label: "Copy", keys: "Ctrl+C", icon: Copy, run: () => store.copy(n!.id), show: child },
    { label: "Cắt", keys: "Ctrl+X", icon: Scissors, run: () => (store.copy(n!.id), store.remove(n!.id)), show: child },
    { label: "Dán", keys: "Ctrl+V", icon: ClipboardPaste, run: () => store.paste(), show: store.canPaste() },
    { label: "Nhân bản", keys: "Ctrl+D", icon: CopyPlus, run: () => store.duplicate(n!.id), show: child },
    { label: "Bọc vào Frame", keys: "Ctrl+G", icon: Group, run: () => store.wrap(n!.id), show: child },
    { label: "Bỏ Frame", keys: "Ctrl+Shift+G", icon: Ungroup, run: () => store.unwrap(n!.id), show: n?.type === "frame" && child },
    { label: "Lên trước", keys: "Alt+↑", icon: ArrowUp, run: () => store.nudge(n!.id, -1), show: child },
    { label: "Xuống sau", keys: "Alt+↓", icon: ArrowDown, run: () => store.nudge(n!.id, 1), show: child },
    { label: "Xóa", keys: "Delete", icon: Trash2, run: () => store.remove(n!.id), show: child, danger: true },
  ];

  return (
    <div
      className="fixed z-[120] min-w-52 rounded-lg border bg-popover p-1 text-xs shadow-xl"
      style={{ left: Math.min(state.x, window.innerWidth - 220), top: Math.min(state.y, window.innerHeight - 320) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items
        .filter((i) => i.show)
        .map((i) => (
          <button
            key={i.label}
            type="button"
            onClick={() => {
              i.run();
              onClose();
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted ${i.danger ? "text-destructive" : ""}`}
          >
            <i.icon className="size-3.5" />
            <span className="flex-1">{i.label}</span>
            {i.keys && <span className="text-[10px] text-muted-foreground">{i.keys}</span>}
          </button>
        ))}
    </div>
  );
}
