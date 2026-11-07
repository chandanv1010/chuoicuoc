/**
 * Ghi mot landing page dung san (scripts/landing/<ten>.ts: path, title, settings, spec) vao builder_pages (slug lp-<path>),
 * ca ban nhap lan ban xuat ban. Chay lai se GHI DE ban da sua trong trinh dung.
 *   node scripts/landing/seed-landing.mjs personalized-hat > out.sql   roi nap vao MySQL cua du an
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const name = process.argv[2];
if (!name) throw new Error("Thieu ten file landing (vd. personalized-hat)");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(root, "src") } });
const lp = await jiti.import(path.join(root, `scripts/landing/${name}.ts`));
const { buildDoc } = await jiti.import(path.join(root, "src/modules/builder/library.ts"));

const doc = { ...buildDoc(lp.spec()), settings: lp.settings };
const q = (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const json = q(JSON.stringify(doc));
// Landing page uu tien hon routers o /<path>.html: duong dan trung san pham / danh muc / bai viet se CHE trang do.
// Cau lenh SIGNAL lam hong ca file SQL neu trung, nen khong ghi gi.
process.stdout.write(
  `SET NAMES utf8mb4;\n` +
    `DROP PROCEDURE IF EXISTS lp_guard;\nDELIMITER //\nCREATE PROCEDURE lp_guard() BEGIN IF (SELECT COUNT(*) FROM routers WHERE canonical = ${q(lp.path)}) > 0 THEN ` +
    `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Duong dan landing trung voi san pham / danh muc / bai viet'; END IF; END//\nDELIMITER ;\nCALL lp_guard();\nDROP PROCEDURE lp_guard;\n` +
    `INSERT INTO builder_pages (slug, title, draft, published, published_at, created_at, updated_at) VALUES (${q(`lp-${lp.path}`)}, ${q(lp.title)}, ${json}, ${json}, NOW(), NOW(), NOW()) ` +
    `ON DUPLICATE KEY UPDATE title = VALUES(title), draft = VALUES(draft), published = VALUES(published), published_at = NOW(), updated_at = NOW();\n`,
);
// Header / footer rieng cua landing (export parts: [{ slug: "header-xxx", title, spec }])
for (const p of lp.parts ?? []) {
  if (!/^(header|footer)-[a-z0-9][a-z0-9-]*$/.test(p.slug)) throw new Error(`Slug header / footer sai: ${p.slug}`);
  const pj = q(JSON.stringify(buildDoc(p.spec())));
  process.stdout.write(
    `INSERT INTO builder_pages (slug, title, draft, published, published_at, created_at, updated_at) VALUES (${q(p.slug)}, ${q(p.title)}, ${pj}, ${pj}, NOW(), NOW(), NOW()) ` +
      `ON DUPLICATE KEY UPDATE title = VALUES(title), draft = VALUES(draft), published = VALUES(published), published_at = NOW(), updated_at = NOW();\n`,
  );
}
