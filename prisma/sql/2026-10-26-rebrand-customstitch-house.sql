-- Doi thuong hieu EMHAUS -> CustomStitch House trong noi dung website.
-- Giu nguyen: link shop Etsy "Emhausvn" (dia chi shop that) va duong dan anh /userfiles/image/emhaus/...
-- REGEXP_REPLACE(..., 'c') = phan biet hoa thuong, nen "/emhaus/" (chu thuong) va "Emhausvn" (khong co ranh gioi tu) khong bi doi.
-- Backup truoc: next-core-backups/next_core-before-rebrand-customstitch-20261026.sql
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE systems SET content = 'CustomStitch House' WHERE keyword = 'homepage_company';
UPDATE systems SET content = 'support@customstitchhouse.example' WHERE keyword = 'contact_email' AND content = 'support@emhaus.example';
UPDATE systems SET content = REGEXP_REPLACE(REGEXP_REPLACE(content, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'), '\\bEmhaus\\b', 'CustomStitch House', 1, 0, 'c')
  WHERE keyword IN ('contact_address', 'seo_meta_title', 'seo_meta_description', 'seo_meta_keyword');

UPDATE post_language SET
  name = REGEXP_REPLACE(name, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'),
  description = REGEXP_REPLACE(description, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'),
  content = REGEXP_REPLACE(content, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'),
  meta_title = REGEXP_REPLACE(meta_title, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'),
  meta_description = REGEXP_REPLACE(meta_description, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c');

UPDATE post_catalogue_language SET
  description = REGEXP_REPLACE(description, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'),
  content = REGEXP_REPLACE(content, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'),
  meta_title = REGEXP_REPLACE(meta_title, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'),
  meta_description = REGEXP_REPLACE(meta_description, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c');

UPDATE product_language SET
  name = REGEXP_REPLACE(REGEXP_REPLACE(name, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'), '\\bEmhaus\\b', 'CustomStitch House', 1, 0, 'c'),
  description = REGEXP_REPLACE(REGEXP_REPLACE(description, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'), '\\bEmhaus\\b', 'CustomStitch House', 1, 0, 'c'),
  content = REGEXP_REPLACE(REGEXP_REPLACE(content, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'), '\\bEmhaus\\b', 'CustomStitch House', 1, 0, 'c'),
  meta_title = REGEXP_REPLACE(REGEXP_REPLACE(meta_title, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'), '\\bEmhaus\\b', 'CustomStitch House', 1, 0, 'c'),
  meta_description = REGEXP_REPLACE(REGEXP_REPLACE(meta_description, '\\bEMHAUS\\b', 'CustomStitch House', 1, 0, 'c'), '\\bEmhaus\\b', 'CustomStitch House', 1, 0, 'c');

COMMIT;
