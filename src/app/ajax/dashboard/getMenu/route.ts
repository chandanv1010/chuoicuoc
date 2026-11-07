import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentLanguage } from "@/lib/language";
import { getAdmin } from "@/server/auth";
import { addslashes } from "@/modules/menu/menu";

/**
 * GET ajax/dashboard/getMenu — Ajax\DashboardController@getMenu (+ paginationAgrument).
 * Tra ve JSON cua LengthAwarePaginator (menu.js doc data[] va links[]).
 * Chi cac model co '\App\Repositories\<Nhom>\<Model>Repository' va bang *_language ben Laravel;
 * model khac -> class_exists false -> response()->json(null) = {}.
 */
const MODELS: Record<string, { snake: string; pivot: boolean }> = {
  PostCatalogue: { snake: "post_catalogue", pivot: false },
  Post: { snake: "post", pivot: true },
  ProductCatalogue: { snake: "product_catalogue", pivot: false },
  Product: { snake: "product", pivot: true },
  AttributeCatalogue: { snake: "attribute_catalogue", pivot: false },
  Attribute: { snake: "attribute", pivot: true },
};

const PER_PAGE = 20;
const ON_EACH_SIDE = 3;

export async function GET(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const url = new URL(req.url);
  const model = url.searchParams.get("model") ?? "";
  const cfg = MODELS[model];
  if (!cfg) return Response.json({});
  const language = await getCurrentLanguage();
  // $request->string('keyword') qua TrimStrings
  const keyword = (url.searchParams.get("keyword") ?? "").trim();
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "", 10);
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  const table = `${cfg.snake}s`;
  const lang = `${cfg.snake}_language`;
  const joins = [Prisma.raw(`JOIN \`${lang}\` AS tb2 ON tb2.\`${cfg.snake}_id\` = \`${table}\`.id`)];
  if (cfg.pivot) joins.push(Prisma.raw(`JOIN \`${cfg.snake}_catalogue_${cfg.snake}\` AS tb3 ON \`${table}\`.id = tb3.\`${cfg.snake}_id\``));
  const conds = [
    keyword ? Prisma.sql`name LIKE ${`%${addslashes(keyword)}%`}` : null,
    Prisma.sql`tb2.language_id = ${language.id}`,
    Prisma.raw(`\`${table}\`.deleted_at IS NULL`),
  ].filter(Boolean) as Prisma.Sql[];
  const base = Prisma.sql`FROM ${Prisma.raw(`\`${table}\``)} ${Prisma.join(joins, " ")} WHERE ${Prisma.join(conds, " AND ")} GROUP BY ${Prisma.raw(`\`${table}\`.id`)}, name`;

  const [countRows, rows] = await Promise.all([
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM (SELECT ${Prisma.raw(`\`${table}\`.id`)} ${base}) AS aggregate_table`,
    db.$queryRaw<{ id: bigint; name: string; canonical: string | null }[]>`
      SELECT ${Prisma.raw(`\`${table}\`.id`)} AS id, name, ANY_VALUE(canonical) AS canonical ${base}
      ORDER BY ${Prisma.raw(`\`${table}\`.id`)} DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
  ]);
  const total = Number(countRows[0]?.c ?? 0);
  const data = rows.map((r) => ({ id: Number(r.id), name: r.name, canonical: r.canonical }));

  // withQueryString(): giu query hien tai (tru page), withPath(APP_URL . 'post_catalogue.index')
  const path = `${(process.env.APP_URL ?? "/").replace(/\/?$/, "/")}${cfg.snake}.index`;
  const query: [string, string][] = [...url.searchParams.entries()].filter(([k]) => k !== "page");
  const pageUrl = (p: number) => `${path}?${[...query, ["page", String(p)]].map(([k, v]) => `${rawurlencode(k)}=${rawurlencode(v)}`).join("&")}`;
  const lastPage = Math.max(Math.ceil(total / PER_PAGE), 1);
  const from = data.length ? (page - 1) * PER_PAGE + 1 : null;

  const links: { url: string | null; label: string; active: boolean }[] = [];
  links.push({ url: page > 1 ? pageUrl(page - 1) : null, label: "pagination.previous", active: false });
  for (const el of urlWindow(page, lastPage)) {
    if (el === "...") links.push({ url: null, label: "...", active: false });
    else for (const p of el) links.push({ url: pageUrl(p), label: String(p), active: p === page });
  }
  links.push({ url: lastPage > page ? pageUrl(page + 1) : null, label: "pagination.next", active: false });

  return Response.json({
    current_page: page,
    data,
    first_page_url: pageUrl(1),
    from,
    last_page: lastPage,
    last_page_url: pageUrl(lastPage),
    links,
    next_page_url: lastPage > page ? pageUrl(page + 1) : null,
    path,
    per_page: PER_PAGE,
    prev_page_url: page > 1 ? pageUrl(page - 1) : null,
    to: from === null ? null : from + data.length - 1,
    total,
  });
}

/** Illuminate\Pagination\UrlWindow (onEachSide = 3) */
function urlWindow(current: number, last: number): (number[] | "...")[] {
  const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  if (last < ON_EACH_SIDE * 2 + 8) return [range(1, last)];
  const window = ON_EACH_SIDE + 4;
  if (current <= window) return [range(1, window + ON_EACH_SIDE), "...", range(last - 1, last)];
  if (current > last - window) return [range(1, 2), "...", range(last - (window + (ON_EACH_SIDE - 1)), last)];
  return [range(1, 2), "...", range(current - ON_EACH_SIDE, current + ON_EACH_SIDE), "...", range(last - 1, last)];
}

/** rawurlencode() (http_build_query PHP_QUERY_RFC3986) */
function rawurlencode(s: string) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
