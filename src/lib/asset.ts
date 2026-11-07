/** Anh trong DB la duong dan tuong doi (/uploads/...) cua site Laravel. */
export function asset(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${process.env.NEXT_PUBLIC_ASSET_URL ?? ""}${path}`;
}
