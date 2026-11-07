import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Port nguyen van app/Classes/Nestedsetbie.php.
 *
 *   const ns = nestedSet({ table: "post_catalogues", foreignKey: "post_catalogue_id", languageId });
 *   await ns.rebuild(tx);              // Get() + Set() + Recursive(0) + Action()
 *   const options = await ns.dropdown(); // Dropdown(): { "0": "[Root]", "12": "|-----Ten" }
 *
 * Luu y giong ban goc: chi cac ban ghi CO ban dich o languageId moi duoc tinh lai.
 */
type Params = {
  table: string; // vd post_catalogues
  foreignKey?: string; // vd post_catalogue_id
  languageId: bigint | number;
  isMenu?: boolean; // menus + menu_language
};

type Row = { id: bigint; name: string; parent_id: number | bigint; lft: number; rgt: number; level: number; order: number };

const SAFE = /^[a-z_]+$/;

function languageTable(p: Params) {
  // Get(): $catalogue = major_groups ? '_group' : (isMenu ? '' : '_catalogue')
  const isMajorGroups = p.table === "major_groups";
  const catalogue = isMajorGroups ? "_group" : p.isMenu ? "" : "_catalogue";
  const moduleExtract = p.table.split("_");
  const join = p.isMenu ? moduleExtract[0].slice(0, -1) : moduleExtract[0];
  return `${join}${catalogue}_language`;
}

async function get(client: PrismaClient | Prisma.TransactionClient, p: Params): Promise<Row[]> {
  const fk = p.foreignKey ?? "post_catalogue_id";
  const lt = languageTable(p);
  if (![p.table, fk, lt].every((s) => SAFE.test(s))) throw new Error("Ten bang khong hop le");
  return client.$queryRawUnsafe<Row[]>(
    `SELECT tb1.id, tb2.name, tb1.parent_id, tb1.lft, tb1.rgt, tb1.level, tb1.\`order\`
     FROM \`${p.table}\` AS tb1
     JOIN \`${lt}\` AS tb2 ON tb1.id = tb2.\`${fk}\`
     WHERE tb2.language_id = ? AND tb1.deleted_at IS NULL
     ORDER BY tb1.lft ASC`,
    p.languageId,
  );
}

export function nestedSet(p: Params) {
  return {
    async rebuild(client: PrismaClient | Prisma.TransactionClient = db) {
      const data = await get(client, p);
      // Set(): ma tran ke 2 chieu, Map giu dung thu tu khoa nhu mang PHP
      const arr = new Map<number, Map<number, 1>>();
      const put = (a: number, b: number) => {
        if (!arr.has(a)) arr.set(a, new Map());
        arr.get(a)!.set(b, 1);
      };
      for (const val of data) {
        put(Number(val.id), Number(val.parent_id));
        put(Number(val.parent_id), Number(val.id));
      }

      // Recursive()
      const lft = new Map<number, number>();
      const rgt = new Map<number, number>();
      const level = new Map<number, number>();
      const checked = new Set<string>();
      let count = 0;
      let countLevel = 0;
      const recursive = (start: number) => {
        lft.set(start, ++count);
        level.set(start, countLevel);
        for (const key of arr.keys()) {
          const adjacent = arr.get(start)?.has(key) || arr.get(key)?.has(start);
          if (adjacent && !checked.has(`${key}:${start}`) && !checked.has(`${start}:${key}`)) {
            countLevel++;
            checked.add(`${start}:${key}`);
            checked.add(`${key}:${start}`);
            recursive(key);
            countLevel--;
          }
        }
        rgt.set(start, ++count);
      };
      if (data.length) recursive(0);

      // Action(): upsert level/lft/rgt
      for (const [id, lv] of level) {
        if (id === 0) continue;
        await client.$executeRawUnsafe(
          `UPDATE \`${p.table}\` SET level = ?, lft = ?, rgt = ? WHERE id = ?`,
          lv,
          lft.get(id),
          rgt.get(id),
          id,
        );
      }
    },

    /** Dropdown($param): giu thu tu lft. Tra ve mang [value, label] de giu dung thu tu. */
    async dropdown(text?: string): Promise<[string, string][]> {
      const data = await get(db, p);
      const out: [string, string][] = [["0", text || "[Root]"]];
      for (const val of data) out.push([String(val.id), "|-----".repeat(val.level > 0 ? val.level - 1 : 0) + val.name]);
      return out;
    },
  };
}
