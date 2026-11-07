import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { flash } from "@/lib/flash";
import { image, thumb, writeUrl } from "@/lib/helpers";
import { parseForm, type Input } from "@/lib/http";
import { __ } from "@/lib/lang";
import { getCurrentLanguage } from "@/lib/language";
import { getAdmin } from "@/server/auth";
import { tableOf } from "@/server/models";
import { eloquentJson } from "./php";
import { absoluteUrl } from "@/lib/origin";

/**
 * Cac endpoint ajax ma man khuyen mai / voucher goi:
 *  - Ajax\DashboardController: findPromotionObject, getPromotionConditionValue, findProduct, findProductObject
 *  - Ajax\ProductController: loadProductPromotion, loadProductVoucher
 * Moi ham nhan Request, tra Response JSON cung dinh dang voi Laravel.
 */

/** $request->input() cua GET: query string kieu PHP (option[model]=...). */
export function queryInput(req: Request): Input {
  const form = new FormData();
  for (const [k, v] of new URL(req.url).searchParams) form.append(k, v);
  return parseForm(form);
}

/** Middleware 'admin' (AuthenticateMiddleware): chua dang nhap -> redirect auth.admin. */
export async function requireAdminAjax(req: Request): Promise<Response | null> {
  if (await getAdmin()) return null;
  await flash({ error: "Bạn phải đăng nhập để sử dụng chức năng này" });
  return Response.redirect(absoluteUrl(req, "/admin"), 302);
}

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const str = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "string" ? v : String(v));

/* --------------------------- Paginator JSON --------------------------- */

/** LengthAwarePaginator::toArray() cua Laravel 10 (nhan 'pagination.previous' do vn khong co file pagination). */
function paginatorJson<T>(data: T[], total: number, perPage: number, page: number, path: string, query: Record<string, string> = {}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const url = (p: number) => `${path}?${new URLSearchParams({ ...query, page: String(p) }).toString()}`;
  const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  // UrlWindow (onEachSide = 3)
  let windows: (number[] | "...")[];
  if (lastPage < 3 * 2 + 8) windows = [range(1, lastPage)];
  else if (page <= 6) windows = [range(1, 8), "...", range(lastPage - 1, lastPage)];
  else if (page > lastPage - 6) windows = [range(1, 2), "...", range(lastPage - 8, lastPage)];
  else windows = [range(1, 2), "...", range(page - 3, page + 3), "...", range(lastPage - 1, lastPage)];
  const links: { url: string | null; label: string; active: boolean }[] = [
    { url: page > 1 ? url(page - 1) : null, label: "pagination.previous", active: false },
  ];
  for (const w of windows) {
    if (w === "...") links.push({ url: null, label: "...", active: false });
    else for (const p of w) links.push({ url: url(p), label: String(p), active: p === page });
  }
  links.push({ url: page < lastPage ? url(page + 1) : null, label: "pagination.next", active: false });
  const from = data.length ? (page - 1) * perPage + 1 : null;
  return {
    current_page: page,
    data,
    first_page_url: url(1),
    from,
    last_page: lastPage,
    last_page_url: url(lastPage),
    links,
    next_page_url: page < lastPage ? url(page + 1) : null,
    path,
    per_page: perPage,
    prev_page_url: page > 1 ? url(page - 1) : null,
    to: from === null ? null : from + data.length - 1,
    total,
  };
}

const pageOf = (input: Input) => {
  const n = Number.parseInt(str(input.page), 10);
  return Number.isNaN(n) || n < 1 ? 1 : n;
};
const requestPath = (req: Request) => {
  const u = new URL(req.url);
  return `${u.origin}${u.pathname}`;
};

/* ------------------------- findWidgetItem ------------------------- */

/**
 * BaseRepository::findWidgetItem([['name','LIKE','%kw%']], $language, $alias):
 * ban ghi co ban dich (bat ky ngon ngu) khop ten, kem ban dich theo ngon ngu hien tai.
 */
async function findWidgetItem(model: string, keyword: string, languageId: bigint) {
  const table = tableOf(model);
  const s = snake(model);
  if (!table || !/^[a-z_]+$/.test(s)) return null;
  const pivot = `${s}_language`;
  const fk = `${s}_id`;
  const hasDeleted = await db.$queryRawUnsafe<{ c: bigint }[]>(
    "SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'deleted_at'",
    table,
  );
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT t.* FROM \`${table}\` t WHERE EXISTS (SELECT 1 FROM \`${pivot}\` p WHERE p.\`${fk}\` = t.id AND p.name LIKE ?)` +
      (Number(hasDeleted[0].c) ? " AND t.deleted_at IS NULL" : ""),
    `%${keyword}%`,
  );
  return { rows, table, pivot, fk, languageId };
}

/** with(['languages' => where language_id]) — tra ve mang language + pivot nhu Eloquent. */
async function languagesOf(pivot: string, fk: string, ids: bigint[], languageId: bigint, pivotColumns: string[]) {
  const map = new Map<string, Record<string, unknown>[]>();
  if (!ids.length) return map;
  const cols = pivotColumns.map((c) => `p.\`${c}\` AS \`pivot_${c}\``).join(", ");
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT l.*, p.\`${fk}\` AS pivot_${fk}, p.language_id AS pivot_language_id${cols ? `, ${cols}` : ""}
     FROM languages l JOIN \`${pivot}\` p ON p.language_id = l.id
     WHERE p.\`${fk}\` IN (${ids.map(() => "?").join(",")}) AND p.language_id = ? AND l.deleted_at IS NULL`,
    ...ids.map(String),
    languageId,
  );
  for (const r of rows) {
    const lang: Record<string, unknown> = {};
    const pv: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k.startsWith("pivot_")) pv[k.slice(6)] = v;
      else lang[k] = v;
    }
    lang.pivot = pv;
    const key = String(pv[fk]);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(lang);
  }
  return map;
}

/** GET ajax/dashboard/findPromotionObject — {items: [{id, text}]} */
export async function findPromotionObject(req: Request) {
  const denied = await requireAdminAjax(req);
  if (denied) return denied;
  const input = queryInput(req);
  const model = str((input.option as Input | undefined)?.model);
  const language = await getCurrentLanguage();
  const found = await findWidgetItem(model, str(input.search), language.id);
  if (!found) return Response.json({ message: "Server Error" }, { status: 500 }); // loadClass() tra null
  const langs = await languagesOf(found.pivot, found.fk, found.rows.map((r) => r.id as bigint), language.id, ["name"]);
  const items = found.rows.map((r) => ({
    id: Number(r.id),
    // $val->languages->first()->pivot->name (ban goc loi 500 neu chua dich) -> null
    text: (langs.get(String(r.id))?.[0]?.pivot as Record<string, unknown> | undefined)?.name ?? null,
  }));
  return Response.json({ items });
}

/** GET ajax/dashboard/getPromotionConditionValue — {data: [{id, text}], error} */
export async function getPromotionConditionValue(req: Request) {
  const denied = await requireAdminAjax(req);
  if (denied) return denied;
  const input = queryInput(req);
  let object: { id: unknown; name: unknown }[] | undefined;
  try {
    switch (str(input.value)) {
      case "staff_take_care_customer":
        object = eloquentJson(await db.$queryRaw<Record<string, unknown>[]>`SELECT id, name FROM users WHERE deleted_at IS NULL`) as typeof object;
        break;
      case "customer_group":
        object = eloquentJson(
          await db.$queryRaw<Record<string, unknown>[]>`SELECT id, name FROM customer_catalogues WHERE deleted_at IS NULL`,
        ) as typeof object;
        break;
      case "customer_gender":
        object = __("module.gender");
        break;
      case "customer_birthday":
        object = __("module.day");
        break;
    }
    if (object === undefined) throw new Error("Undefined variable $object");
    return Response.json({ data: object.map((v) => ({ id: v.id, text: v.name })), error: false });
  } catch (e) {
    console.error(e);
    return Response.json({ error: true, messages: e instanceof Error ? e.message : String(e) });
  }
}

const PRODUCT_PIVOT = ["name", "canonical", "meta_title", "meta_keyword", "meta_description", "description", "content", "url", "created_at", "updated_at"];

/** GET ajax/dashboard/findProduct — mang Product (toArray) kem languages (pivot). */
export async function findProduct(req: Request) {
  const input = queryInput(req);
  const language = await getCurrentLanguage();
  const found = await findWidgetItem(__("module.product_model"), str(input.keyword), language.id);
  if (!found) return Response.json([]);
  const langs = await languagesOf(found.pivot, found.fk, found.rows.map((r) => r.id as bigint), language.id, PRODUCT_PIVOT);
  const out = found.rows.map((r) => {
    const row: Record<string, unknown> = { ...r };
    // $casts: attribute, chapter => json
    for (const k of ["attribute", "chapter"]) {
      if (typeof row[k] === "string") {
        try {
          row[k] = JSON.parse(row[k] as string);
        } catch {
          row[k] = null;
        }
      }
    }
    row.languages = langs.get(String(r.id)) ?? [];
    return eloquentJson(row);
  });
  return Response.json(out);
}

function esc(s: unknown) {
  return str(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
const REVIEWABLE = ["App", "Models", "Product"].join(String.fromCharCode(92)); // morphMany reviewable_type

/** echo float cua PHP (precision 14). */
const phpFloat = (n: number) => String(Number(n.toPrecision(14)));

/**
 * GET ajax/dashboard/findProductObject — {html} render
 * frontend/component/product-item-switch.blade.php cho cac san pham thuoc
 * TAT CA danh muc product_catalogue_id[] (ProductRepository::getProductByProductCatalogue).
 */
export async function findProductObject(req: Request) {
  const input = queryInput(req);
  const raw = input.product_catalogue_id;
  if (!raw || (Array.isArray(raw) && !raw.length)) return Response.json({ html: "" });
  const ids = (Array.isArray(raw) ? raw : typeof raw === "object" ? Object.values(raw) : [raw]).map((v) => Number.parseInt(str(v), 10)).filter((n) => !Number.isNaN(n));
  const language = await getCurrentLanguage();
  const products = ids.length
    ? await db.$queryRaw<
        {
          id: bigint;
          price: number;
          image: string | null;
          total_lesson: number | null;
          duration: string | null;
          name: string;
          canonical: string;
          lecturer_name: string | null;
          lecturer_avatar: string | null;
          review_count: bigint;
          review_average: unknown;
        }[]
      >`
      SELECT products.id, products.price, products.image, products.total_lesson, products.duration,
        tb2.name, tb2.canonical, tb3.name AS lecturer_name, tb3.image AS lecturer_avatar,
        (SELECT COUNT(*) FROM reviews r WHERE r.reviewable_id = products.id AND r.reviewable_type = ${REVIEWABLE}) AS review_count,
        (SELECT AVG(r.score) FROM reviews r WHERE r.reviewable_id = products.id AND r.reviewable_type = ${REVIEWABLE}) AS review_average
      FROM products
      JOIN product_language AS tb2 ON tb2.product_id = products.id
      LEFT JOIN lecturers AS tb3 ON tb3.id = products.lecturer_id
      WHERE products.id IN (
        SELECT product_id FROM product_catalogue_product
        WHERE product_catalogue_id IN (${Prisma.join(ids)})
        GROUP BY product_id HAVING COUNT(DISTINCT product_catalogue_id) = ${ids.length}
      ) AND tb2.language_id = ${language.id} AND products.deleted_at IS NULL`
    : [];
  const items = products
    .map((p) => {
      const canonical = writeUrl(p.canonical);
      const img = thumb(image(p.image), 600, 400);
      const star = Number(p.review_count) === 0 ? "0" : phpFloat((Number(p.review_average) / 5) * 100);
      return `
            <div class="uk-width-1-2 uk-width-small-1-2 uk-width-medium-1-3 uk-width-large-1-4 mb20">
                <div class="product-item">
                    <a href="${esc(canonical)}" title="${esc(p.name)}" class="image img-scaledown img-zoomin">
                        <div class="skeleton-loading"></div>
                        <img class="lazy-image" data-src="${esc(img)}" src="${esc(img)}" alt="${esc(p.name)}">
                    </a>
                    <div class="info">
                        <div class="course">
                            <div class="uk-flex uk-flex-middle">
                                <div class="total-lesson uk-flex">
                                    <img src="/backend/img/lesson.svg" alt="">
                                    <span>${esc(p.total_lesson)} Bài học</span>
                                </div>
                                <div class="duration uk-flex">
                                    <img src="/backend/img/time.svg" alt="">
                                    <span>${esc(p.duration)}</span>
                                </div>
                            </div>
                        </div>
                        <h3 class="title">
                            <a href="${esc(canonical)}" title="${esc(p.name)}">${esc(p.name)}</a>
                        </h3>
                        <div class="product-price">
                            <div class="uk-flex uk-flex-middle uk-flex-space-between">
                                <div class="price mt10"><div class="price-sale">Liên Hệ</div></div>
                            </div>
                        </div>
                        <div class="info-lecturer">
                            <div class="uk-flex uk-flex-middle uk-flex-space-between">
                                <div class="if">
                                    <a href="" class="image img-cover">
                                        <img src="${esc(p.lecturer_avatar)}" alt="">
                                    </a>
                                    <div class="text">
                                        <h4 class="heading-3"><span>${esc(p.lecturer_name)}</span></h4>
                                        <div class="rating">
                                            <div class="uk-flex uk-flex-middle uk-flex-space-between">
                                                <div>
                                                    <div class="star-rating">
                                                        <div class="stars" style="--star-width: ${star}%"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <a href="${esc(canonical)}" class="btn-detail">
                                    <span>Xem chi tiết</span>
                                    <svg width="4" height="6" viewBox="0 0 4 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3.49014 2.59539L1.44887 0.169256C1.40412 0.115625 1.35087 0.073056 1.2922 0.0440061C1.23354 0.0149562 1.17061 0 1.10706 0C1.0435 0 0.980576 0.0149562 0.921909 0.0440061C0.863242 0.073056 0.809996 0.115625 0.765241 0.169256C0.675574 0.276465 0.625244 0.421491 0.625244 0.572658C0.625244 0.723826 0.675574 0.868851 0.765241 0.97606L2.4695 3.00165L0.765241 5.02725C0.675574 5.13446 0.625244 5.27948 0.625244 5.43065C0.625244 5.58182 0.675574 5.72684 0.765241 5.83405C0.810225 5.88708 0.863576 5.92904 0.922232 5.95752C0.980888 5.98599 1.0437 6.00043 1.10706 5.99999C1.17042 6.00043 1.23322 5.98599 1.29188 5.95752C1.35054 5.92904 1.40389 5.88708 1.44887 5.83405L3.49014 3.40792C3.53526 3.35472 3.57108 3.29144 3.59552 3.22171C3.61996 3.15198 3.63254 3.07719 3.63254 3.00165C3.63254 2.92612 3.61996 2.85133 3.59552 2.7816C3.57108 2.71187 3.53526 2.64858 3.49014 2.59539Z" fill="#F2277E"/>
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    })
    .join("");
  const html = `<div class="panel-body render">
    <div class="uk-grid uk-grid-medium">${items}
    </div>
</div>`;
  return Response.json({ html });
}

/* ---------------- Ajax\ProductController (route ajax/product/*) ---------------- */

/**
 * GET ajax/product/loadProductPromotion — ProductController@loadProductPromotion.
 * model=Product: ProductRepository::findProductForPromotion (20/trang, group theo san pham).
 * model=ProductCatalogue: pagination danh muc (path 'product.catalogue.index' nhu ban goc).
 */
export async function loadProductPromotion(req: Request) {
  const denied = await requireAdminAjax(req);
  if (denied) return denied;
  const input = queryInput(req);
  const model = str(input.model);
  const keyword = str(input.keyword);
  const language = await getCurrentLanguage();
  const page = pageOf(input);
  const perPage = 20;
  if (model === "Product") {
    const cond = Prisma.sql`tb2.language_id = ${language.id} ${keyword !== "" ? Prisma.sql`AND tb2.name LIKE ${`%${keyword}%`}` : Prisma.empty} AND products.deleted_at IS NULL`;
    const from = Prisma.sql`FROM products
      JOIN product_language AS tb2 ON products.id = tb2.product_id
      LEFT JOIN product_variants AS tb3 ON products.id = tb3.product_id
      LEFT JOIN product_variant_language AS tb4 ON tb3.id = tb4.product_variant_id`;
    const [rows, count] = await Promise.all([
      db.$queryRaw<Record<string, unknown>[]>`
        SELECT products.id, products.image, products.warranty, ANY_VALUE(tb2.name) AS name,
          ANY_VALUE(tb3.uuid) AS uuid, CAST(ANY_VALUE(tb3.id) AS UNSIGNED) AS product_variant_id,
          ANY_VALUE(CONCAT(tb2.name, ' - ', COALESCE(tb4.name, ' Default'))) AS variant_name,
          ANY_VALUE(COALESCE(tb3.sku, products.code)) AS sku, CAST(ANY_VALUE(COALESCE(tb3.price, products.price)) AS DECIMAL(12,2)) AS price
        ${from} WHERE ${cond} GROUP BY products.id ORDER BY products.id DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
      db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT products.id) AS c ${from} WHERE ${cond}`,
    ]);
    const data = eloquentJson(rows) as unknown[];
    return Response.json({ model, objects: paginatorJson(data, Number(count[0].c), perPage, page, requestPath(req)) });
  }
  if (model === "ProductCatalogue") {
    const cond = Prisma.sql`tb2.language_id = ${language.id} ${keyword !== "" ? Prisma.sql`AND name LIKE ${`%${keyword}%`}` : Prisma.empty} AND product_catalogues.deleted_at IS NULL`;
    const from = Prisma.sql`FROM product_catalogues JOIN product_catalogue_language AS tb2 ON tb2.product_catalogue_id = product_catalogues.id`;
    const [rows, count] = await Promise.all([
      db.$queryRaw<Record<string, unknown>[]>`
        SELECT product_catalogues.id, tb2.name ${from} WHERE ${cond}
        ORDER BY product_catalogues.id DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
      db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c ${from} WHERE ${cond}`,
    ]);
    // ->withQueryString()->withPath(env('APP_URL').'product.catalogue.index')
    const query: Record<string, string> = {};
    // ConvertEmptyStringsToNull: tham so rong bi bo khoi query string
    for (const [k, v] of new URL(req.url).searchParams) if (k !== "page" && v.trim() !== "") query[k] = v.trim();
    const base = `${(process.env.APP_URL ?? new URL(req.url).origin).replace(/\/?$/, "/")}product.catalogue.index`;
    return Response.json({ model, objects: paginatorJson(eloquentJson(rows) as unknown[], Number(count[0].c), perPage, page, base, query) });
  }
  // Ban goc: $objects chua dinh nghia -> loi 500
  return Response.json({ message: "Undefined variable $objects" }, { status: 500 });
}

/** GET ajax/product/loadProductVoucher — ProductRepository::findProductForVoucher. */
export async function loadProductVoucher(req: Request) {
  const denied = await requireAdminAjax(req);
  if (denied) return denied;
  const input = queryInput(req);
  const model = str(input.model) || "Product";
  if (model !== "Product") return Response.json({ message: "Server Error" }, { status: 500 });
  const keyword = str(input.keyword);
  const language = await getCurrentLanguage();
  const page = pageOf(input);
  const perPage = 20;
  const cond = Prisma.sql`tb2.language_id = ${language.id} ${keyword !== "" ? Prisma.sql`AND tb2.name LIKE ${`%${keyword}%`}` : Prisma.empty} AND products.deleted_at IS NULL`;
  const from = Prisma.sql`FROM products JOIN product_language AS tb2 ON products.id = tb2.product_id`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<Record<string, unknown>[]>`
      SELECT products.id, products.code, products.price, products.image, ANY_VALUE(tb2.name) AS name
      ${from} WHERE ${cond} GROUP BY products.id ORDER BY products.id DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
    db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT products.id) AS c ${from} WHERE ${cond}`,
  ]);
  return Response.json({ model, objects: paginatorJson(eloquentJson(rows) as unknown[], Number(count[0].c), perPage, page, requestPath(req)) });
}
