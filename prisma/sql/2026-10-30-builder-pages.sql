-- Trinh dung giao dien (page builder): moi trang la mot cay JSON (src/modules/builder/schema.ts).
-- draft: ban dang sua trong editor; published: ban dang hien tren storefront (NULL = chua xuat ban, dung giao dien code cung).

CREATE TABLE IF NOT EXISTS `builder_pages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'home, ...',
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `draft` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `published` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `builder_pages_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
