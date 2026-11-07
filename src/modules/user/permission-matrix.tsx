"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/form-controls";
import { Checkbox } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/**
 * Ma tran phan quyen (user/catalogue/permission.blade.php): hang = quyen (nhom theo module
 * = tien to canonical), cot = nhom thanh vien. Gui permission[<nhomId>][] = <quyenId>
 * toi POST user/catalogue/updatePermission (UserCatalogueService::setPermission).
 * Moi nhom gui them 1 o rong permission[<nhomId>][] de bo tick het van xoa duoc quyen
 * (ban goc khong gui gi -> nhom giu nguyen quyen cu); service bo qua gia tri rong.
 */
type Perm = { id: string; name: string; canonical: string };
type Group = { module: string; items: Perm[] };

const key = (c: string, p: string) => `${c}-${p}`;

function triState(on: number, total: number): boolean | "indeterminate" {
  return on === 0 ? false : on === total ? true : "indeterminate";
}

export function PermissionMatrix({ catalogues, groups, granted }: { catalogues: { id: string; name: string }[]; groups: Group[]; granted: string[] }) {
  const [checked, setChecked] = useState(() => new Set(granted));
  const [keyword, setKeyword] = useState("");

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((p) => p.name.toLowerCase().includes(k) || p.canonical.toLowerCase().includes(k)) }))
      .filter((g) => g.items.length);
  }, [groups, keyword]);

  const setMany = (pairs: [string, string][], on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      for (const [c, p] of pairs) {
        if (on) next.add(key(c, p));
        else next.delete(key(c, p));
      }
      return next;
    });

  const visiblePerms = visible.flatMap((g) => g.items);
  const count = (c: string, perms: Perm[]) => perms.reduce((n, p) => n + (checked.has(key(c, p.id)) ? 1 : 0), 0);

  return (
    <div className="grid gap-4">
      {/* Gia tri gui di: luon gom moi quyen da tick (ke ca dang bi an do loc). */}
      {catalogues.map((c) => (
        <div key={c.id} hidden>
          <input type="hidden" name={`permission[${c.id}][]`} value="" />
          {[...checked]
            .filter((k) => k.startsWith(`${c.id}-`))
            .map((k) => (
              <input key={k} type="hidden" name={`permission[${c.id}][]`} value={k.slice(c.id.length + 1)} />
            ))}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm quyền theo tên hoặc canonical..." className="w-72 pl-8" />
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {catalogues.map((c) => (
            <span key={c.id} className="rounded-md border px-2 py-1">
              {c.name}: <b className="text-foreground">{[...checked].filter((k) => k.startsWith(`${c.id}-`)).length}</b> quyền
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Quyền</th>
              {catalogues.map((c) => (
                <th key={c.id} className="w-36 px-3 py-2.5 text-center font-medium">
                  <label className="flex flex-col items-center gap-1.5">
                    <span>{c.name}</span>
                    <Checkbox
                      checked={triState(count(c.id, visiblePerms), visiblePerms.length)}
                      onCheckedChange={(v) => setMany(visiblePerms.map((p) => [c.id, p.id]), v === true)}
                      aria-label={`Chọn tất cả quyền cho ${c.name}`}
                    />
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={catalogues.length + 1} className="py-12 text-center text-muted-foreground">
                  Không có quyền nào phù hợp.
                </td>
              </tr>
            )}
            {visible.map((g) => (
              <ModuleRows key={g.module} group={g} catalogues={catalogues} checked={checked} setMany={setMany} count={count} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModuleRows({
  group,
  catalogues,
  checked,
  setMany,
  count,
}: {
  group: Group;
  catalogues: { id: string; name: string }[];
  checked: Set<string>;
  setMany: (pairs: [string, string][], on: boolean) => void;
  count: (c: string, perms: Perm[]) => number;
}) {
  return (
    <>
      <tr className="border-t bg-muted/50">
        <td className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {group.module} <span className="font-normal normal-case">({group.items.length})</span>
        </td>
        {catalogues.map((c) => (
          <td key={c.id} className="px-3 py-2 text-center">
            <Checkbox
              checked={triState(count(c.id, group.items), group.items.length)}
              onCheckedChange={(v) => setMany(group.items.map((p) => [c.id, p.id]), v === true)}
              aria-label={`Chọn cả nhóm ${group.module} cho ${c.name}`}
            />
          </td>
        ))}
      </tr>
      {group.items.map((p) => {
        const rowOn = catalogues.filter((c) => checked.has(key(c.id, p.id))).length;
        return (
          <tr key={p.id} className="border-t transition-colors hover:bg-muted/30">
            <td className="px-3 py-2">
              <button
                type="button"
                className="text-left"
                title="Bấm để chọn / bỏ chọn quyền này cho mọi nhóm"
                onClick={() => setMany(catalogues.map((c) => [c.id, p.id]), rowOn < catalogues.length)}
              >
                <div className="font-medium">{p.name}</div>
                <code className="text-xs text-muted-foreground">{p.canonical}</code>
              </button>
            </td>
            {catalogues.map((c) => {
              const on = checked.has(key(c.id, p.id));
              return (
                <td key={c.id} className={cn("px-3 py-2 text-center", on && "bg-primary/5")}>
                  <Checkbox checked={on} onCheckedChange={(v) => setMany([[c.id, p.id]], v === true)} aria-label={`${p.name} — ${c.name}`} />
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
