-- EMHAUS la web tieng Anh: bo noi dung WACO cu (may loc nuoc, tieng Viet) va dat ngon ngu mac dinh la English.
-- Ngon ngu id 1 duoc ghi cung o nhieu cho trong code (ban port tu Laravel) nen doi CHINH id 1 thanh English
-- thay vi chuyen du lieu sang id khac. Backup truoc: next-core-backups/next_core-before-english-cleanup-20261025.sql
SET NAMES utf8mb4;
START TRANSACTION;

-- 1. Bai viet WACO (nuoc loc, dich vu dai ly) + danh muc "Dich vu va ho tro", "Khuyen mai thang 11", "tat"
DELETE FROM routers WHERE controllers LIKE '%\\PostController' AND module_id BETWEEN 118 AND 131;
DELETE FROM routers WHERE controllers LIKE '%\\PostCatalogueController' AND module_id IN (25, 26, 27);
DELETE FROM post_catalogue_post WHERE post_id BETWEEN 118 AND 131 OR post_catalogue_id IN (25, 26, 27);
DELETE FROM post_language WHERE post_id BETWEEN 118 AND 131;
DELETE FROM contacts WHERE post_id BETWEEN 118 AND 131;
DELETE FROM posts WHERE id BETWEEN 118 AND 131;
DELETE FROM post_catalogue_language WHERE post_catalogue_id IN (25, 26, 27);
DELETE FROM post_catalogues WHERE id IN (25, 26, 27);
UPDATE post_catalogues SET lft = 2, rgt = 3 WHERE id = 24; -- News la nut duy nhat

-- 2. San pham + danh muc may loc nuoc (da an tu truoc, nay xoa han)
DELETE FROM routers WHERE controllers LIKE '%\\ProductController' AND module_id BETWEEN 140 AND 153;
DELETE FROM routers WHERE controllers LIKE '%\\ProductCatalogueController' AND module_id BETWEEN 99 AND 104;
DELETE FROM product_catalogue_product WHERE product_id BETWEEN 140 AND 153 OR product_catalogue_id BETWEEN 99 AND 104;
DELETE FROM product_language WHERE product_id BETWEEN 140 AND 153;
DELETE FROM products WHERE id BETWEEN 140 AND 153;
DELETE FROM product_catalogue_language WHERE product_catalogue_id BETWEEN 99 AND 104;
DELETE FROM product_catalogues WHERE id BETWEEN 99 AND 104;

-- 3. Noi dung trang chu WACO khong con dung (storefront EMHAUS viet san tieng Anh)
DELETE FROM home_features;
DELETE FROM introduces;
DELETE FROM widgets WHERE id IN (22, 23);
DELETE FROM slides WHERE id = 35;

-- 4. Menu: bo menu tieng Viet, dung lai menu chinh tieng Anh dung theo thanh menu cua website
DELETE FROM menu_language;
DELETE FROM menus;
INSERT INTO menus (id, parent_id, menu_catalogue_id, lft, rgt, level, publish, `order`, user_id, created_at, updated_at) VALUES
  (500, 0, 1, 2, 3, 1, 2, 9, 1, NOW(), NOW()),
  (501, 0, 1, 4, 5, 1, 2, 8, 1, NOW(), NOW()),
  (502, 0, 1, 6, 7, 1, 2, 7, 1, NOW(), NOW()),
  (503, 0, 1, 8, 9, 1, 2, 6, 1, NOW(), NOW()),
  (504, 0, 1, 10, 11, 1, 2, 5, 1, NOW(), NOW()),
  (505, 0, 1, 12, 13, 1, 2, 4, 1, NOW(), NOW()),
  (506, 0, 1, 14, 15, 1, 2, 3, 1, NOW(), NOW()),
  (507, 0, 1, 16, 17, 1, 2, 2, 1, NOW(), NOW()),
  (508, 0, 1, 18, 19, 1, 2, 1, 1, NOW(), NOW());
INSERT INTO menu_language (menu_id, language_id, name, canonical, created_at, updated_at) VALUES
  (500, 1, 'Home', '', NOW(), NOW()),
  (501, 1, 'Embroidered Hats', 'embroidered-hats', NOW(), NOW()),
  (502, 1, 'Embroidered Bags', 'embroidered-bags', NOW(), NOW()),
  (503, 1, 'Embroidered Coasters', 'embroidered-coasters', NOW(), NOW()),
  (504, 1, 'Design', 'design', NOW(), NOW()),
  (505, 1, 'About Us', 'about', NOW(), NOW()),
  (506, 1, 'Promotion', 'promotions', NOW(), NOW()),
  (507, 1, 'News', 'news', NOW(), NOW()),
  (508, 1, 'Contact Us', 'contact', NOW(), NOW());

-- 5. Ngon ngu: id 1 = English (mac dinh), bo Tieng Anh cu (id 2), Tieng Trung (3), Test (5)
DELETE FROM systems WHERE language_id IN (2, 3, 5);
DELETE FROM languages WHERE id IN (2, 3, 5);
UPDATE languages SET name = 'English', canonical = 'en', image = '/public/userfiles/image/language/en.png', current = 1, publish = 2, updated_at = NOW() WHERE id = 1;

COMMIT;

-- 6. Cau hinh chung: chi giu cac truong storefront doc (xem src/modules/system/config.ts)
DELETE FROM systems WHERE keyword NOT IN (
  'homepage_company',
  'contact_address', 'contact_email', 'contact_phone', 'contact_hotline', 'contact_working_hours',
  'seo_meta_title', 'seo_meta_keyword', 'seo_meta_description', 'seo_meta_images'
);
