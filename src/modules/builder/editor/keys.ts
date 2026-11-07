"use client";

import type { EditorStore } from "./store";

/**
 * Phim tat kieu Figma — gan ca o cua so editor lan document cua iframe. Chu cai doc theo e.code (KeyC...) vi
 * bo go tieng Viet (Unikey / Telex) va layout khac co the doi e.key.
 */
export function handleKey(store: EditorStore, e: KeyboardEvent, onSave: () => void) {
  const t = e.target as HTMLElement | null;
  const mod = e.ctrlKey || e.metaKey;
  // e.code (KeyC) dung ca khi bo go doi e.key; thieu code (su kien gia lap...) thi dung e.key
  const code = /^Key[A-Z]$/.test(e.code) ? e.code : e.key.length === 1 ? `Key${e.key.toUpperCase()}` : e.code;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
    if (mod && code === "KeyS") {
      e.preventDefault();
      onSave();
    }
    return;
  }
  const { selected, doc, editingText, drag, cropping } = store.state;
  if (editingText || drag) return;
  const sel = selected ? doc.nodes[selected] : null;
  const run = (fn: () => void) => {
    e.preventDefault();
    fn();
  };

  if (cropping && (e.key === "Escape" || e.key === "Enter")) {
    e.preventDefault();
    store.iframe?.contentDocument?.querySelectorAll(".bb-cropping").forEach((el) => el.classList.remove("bb-cropping"));
    store.set({ cropping: null });
    return;
  }
  if (mod && code === "KeyZ") return run(() => (e.shiftKey ? store.redo() : store.undo()));
  if (mod && code === "KeyY") return run(() => store.redo());
  if (mod && code === "KeyS") return run(onSave);
  if (mod && code === "KeyV") return run(() => store.paste());
  if (!sel) return;
  if (e.key === "Escape") return run(() => store.select(sel.parent));
  if (e.key === "Enter" && sel.children?.length) return run(() => store.select(sel.children![0]));
  if (!sel.parent) return;
  if (e.key === "Delete" || e.key === "Backspace") return run(() => store.remove(sel.id));
  if (mod && code === "KeyD") return run(() => store.duplicate(sel.id));
  if (mod && code === "KeyC") return run(() => store.copy(sel.id));
  if (mod && code === "KeyX")
    return run(() => {
      store.copy(sel.id);
      store.remove(sel.id);
    });
  if (mod && code === "KeyG") return run(() => (e.shiftKey ? store.unwrap(sel.id) : store.wrap(sel.id)));
  if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowLeft")) return run(() => store.nudge(sel.id, -1));
  if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowRight")) return run(() => store.nudge(sel.id, 1));
}
