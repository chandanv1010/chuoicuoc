/** Mau hien thi cho o mau (swatch) theo ten mau trong bang attributes. */
export function swatchColor(name: string): string {
  const n = name.toLowerCase();
  const map: [RegExp, string][] = [
    [/dusty blue/, "#7f9cb8"],
    [/navy/, "#1f2a4a"],
    [/black/, "#111"],
    [/beige|khaki|cream|tan/, "#d8c7a6"],
    [/brown/, "#6b4a2f"],
    [/green|olive/, "#4f6b3a"],
    [/blue/, "#3b6db3"],
    [/white/, "#fff"],
    [/red|burgundy/, "#9e1b32"],
    [/pink/, "#f2b6c6"],
    [/gr[ae]y/, "#888"],
  ];
  return map.find(([re]) => re.test(n))?.[1] ?? "#ccc";
}
