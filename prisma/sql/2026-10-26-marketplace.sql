-- Module san TMDT (src/modules/marketplace): tai khoan shop tren san + ban ghi dong bo san pham -> san.
-- Ap dung: docker exec -i next-core-db mysql -uroot -proot --default-character-set=utf8mb4 next_core < prisma/sql/2026-10-26-marketplace.sql
-- Gio luu kieu Laravel: gio dia phuong (Asia/Ho_Chi_Minh) ghi thang vao DATETIME (xem now() trong src/lib/helpers.ts).

CREATE TABLE IF NOT EXISTS `marketplace_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `platform` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'etsy|shopee|lazada|tiktok_shop|amazon|ebay',
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ten shop tren san',
  `shop_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'id shop tren san',
  `external_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'id nguoi dung / seller tren san',
  `shop_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `access_token_enc` text COLLATE utf8mb4_unicode_ci COMMENT 'AES-256-GCM (SOCIAL_TOKEN_KEY)',
  `refresh_token_enc` text COLLATE utf8mb4_unicode_ci,
  `token_expires_at` datetime DEFAULT NULL,
  `refresh_expires_at` datetime DEFAULT NULL,
  `scopes` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'active|needs_reconnect|disabled',
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `meta` json DEFAULT NULL COMMENT 'du lieu shop lay ve (shipping profiles, return policies, processing profiles) + mac dinh dang san pham + dry_run',
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `marketplace_accounts_platform_index` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `marketplace_listings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint unsigned NOT NULL,
  `account_id` bigint unsigned NOT NULL,
  `platform` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `settings` json DEFAULT NULL COMMENT 'thong tin rieng cua san cho san pham nay (danh muc, tag, chat lieu, ca nhan hoa, che do dang...)',
  `remote_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'listing id tren san',
  `remote_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remote_state` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'draft|active|inactive... theo san',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'idle' COMMENT 'idle|queued|processing|synced|failed',
  `stage` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'buoc dang lam do (de chay tiep khi loi giua chung)',
  `attempts` int unsigned NOT NULL DEFAULT 0,
  `next_attempt_at` datetime DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `error` text COLLATE utf8mb4_unicode_ci,
  `progress` json DEFAULT NULL COMMENT 'trang thai trung gian (anh da tai, ...)',
  `dry_run` tinyint(1) NOT NULL DEFAULT 0,
  `synced_at` datetime DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `marketplace_listings_product_account_unique` (`product_id`, `account_id`),
  KEY `marketplace_listings_queue_index` (`status`, `next_attempt_at`),
  KEY `marketplace_listings_account_index` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `permissions` (`name`, `canonical`, `created_at`, `updated_at`) VALUES
  ('Xem tài khoản sàn TMĐT', 'marketplace.account.index', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Kết nối / cấu hình tài khoản sàn TMĐT', 'marketplace.account.update', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Xem sản phẩm trên sàn TMĐT', 'marketplace.listing.index', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Đẩy sản phẩm lên sàn TMĐT', 'marketplace.listing.update', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR));

INSERT INTO `user_catalogue_permission` (`user_catalogue_id`, `permission_id`)
SELECT 1, p.id FROM `permissions` p
WHERE p.canonical IN ('marketplace.account.index', 'marketplace.account.update', 'marketplace.listing.index', 'marketplace.listing.update')
  AND NOT EXISTS (SELECT 1 FROM `user_catalogue_permission` u WHERE u.user_catalogue_id = 1 AND u.permission_id = p.id);
