-- Module tim nguon noi dung (src/modules/curate): nguon lay ve + kho muc cho admin duyet.
-- Ap dung: docker exec -i next-core-db mysql -uroot -proot --default-character-set=utf8mb4 next_core < prisma/sql/2026-10-31-curate.sql
-- Gio luu kieu Laravel: gio dia phuong (Asia/Ho_Chi_Minh) ghi thang vao DATETIME.

CREATE TABLE IF NOT EXISTS `curate_sources` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `provider` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'openverse|wikimedia|pexels|pixabay|rss',
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `query` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'tu khoa (anh/video) hoac URL feed (rss)',
  `media` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'image' COMMENT 'image|video|article',
  `interval_hours` int unsigned NOT NULL DEFAULT 24,
  `per_run` int unsigned NOT NULL DEFAULT 20,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `last_run_at` datetime DEFAULT NULL,
  `last_result` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `curate_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source_id` bigint unsigned DEFAULT NULL,
  `provider` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'image|video|article',
  `title` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `excerpt` text COLLATE utf8mb4_unicode_ci COMMENT 'bai viet: tom tat tu feed (khong luu toan van)',
  `page_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'trang goc (dan nguon)',
  `media_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'file anh/video goc',
  `thumb_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `width` int unsigned DEFAULT NULL,
  `height` int unsigned DEFAULT NULL,
  `duration` int unsigned DEFAULT NULL COMMENT 'giay (video)',
  `author` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'cc0|pdm|by|by-sa|by-nd|pexels|pixabay|copyrighted...',
  `license_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attribution` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'dong dan nguon dung san',
  `attribution_required` tinyint(1) NOT NULL DEFAULT 1,
  `can_modify` tinyint(1) NOT NULL DEFAULT 1 COMMENT '0 = ND: khong cat/chen chu',
  `can_republish` tinyint(1) NOT NULL DEFAULT 1 COMMENT '0 = bai bao co ban quyen: chi tom tat + link',
  `published_at` datetime DEFAULT NULL COMMENT 'ngay dang goc (bai viet)',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new' COMMENT 'new|approved|rejected|used',
  `post_id` bigint unsigned DEFAULT NULL,
  `local_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '/userfiles/... sau khi tai ve',
  `note` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decided_by` bigint unsigned DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `curate_items_provider_external_unique` (`provider`,`external_id`),
  KEY `curate_items_status_index` (`status`,`kind`),
  KEY `curate_items_source_index` (`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nguon mac dinh: Openverse va Wikimedia Commons khong can key; Pexels/Pixabay can key (tat san, bat sau khi dien key).
INSERT INTO `curate_sources` (`provider`, `name`, `query`, `media`, `interval_hours`, `per_run`, `active`, `created_at`, `updated_at`)
SELECT * FROM (
  SELECT 'openverse' AS p, 'Openverse – ảnh thêu máy' AS n, 'machine embroidery' AS q, 'image' AS m, 24 AS i, 20 AS r, 1 AS a, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) AS c, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) AS u
  UNION ALL SELECT 'openverse', 'Openverse – ảnh thêu tay', 'embroidery', 'image', 24, 20, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)
  UNION ALL SELECT 'wikimedia', 'Wikimedia – video thêu', 'embroidery', 'video', 72, 20, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)
  UNION ALL SELECT 'wikimedia', 'Wikimedia – ảnh dệt may', 'textile embroidery', 'image', 72, 20, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)
  UNION ALL SELECT 'pexels', 'Pexels – video thêu / may', 'embroidery', 'video', 24, 15, 0, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)
  UNION ALL SELECT 'pixabay', 'Pixabay – ảnh thêu', 'embroidery', 'image', 24, 20, 0, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)
) s WHERE NOT EXISTS (SELECT 1 FROM `curate_sources`);

INSERT IGNORE INTO `permissions` (`name`, `canonical`, `created_at`, `updated_at`) VALUES
  ('Xem kho nội dung tìm nguồn', 'curate.item.index', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Duyệt / loại nội dung tìm nguồn', 'curate.item.update', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Quản lý nguồn lấy nội dung', 'curate.source.update', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR));

INSERT INTO `user_catalogue_permission` (`user_catalogue_id`, `permission_id`)
SELECT 1, p.id FROM `permissions` p
WHERE p.canonical IN ('curate.item.index', 'curate.item.update', 'curate.source.update')
  AND NOT EXISTS (SELECT 1 FROM `user_catalogue_permission` u WHERE u.user_catalogue_id = 1 AND u.permission_id = p.id);
