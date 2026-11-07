-- Module mang xa hoi (src/modules/social): tai khoan ket noi + hang doi dang bai.
-- Ap dung: docker exec -i next-core-db mysql -uroot -proot --default-character-set=utf8mb4 next_core < prisma/sql/2026-10-25-social.sql
-- Gio luu kieu Laravel: gio dia phuong (Asia/Ho_Chi_Minh) ghi thang vao DATETIME (xem now() trong src/lib/helpers.ts).

CREATE TABLE IF NOT EXISTS `social_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `platform` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'facebook|instagram|tiktok|youtube|pinterest',
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ten hien thi (page, kenh, tai khoan)',
  `username` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'id nguoi dung tren nen tang (fb user id, tiktok open_id, google sub...)',
  `page_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Facebook Page id (ca IG: page lien ket)',
  `ig_user_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Instagram professional account id',
  `channel_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'YouTube channel id',
  `board_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Pinterest board mac dinh',
  `access_token_enc` text COLLATE utf8mb4_unicode_ci COMMENT 'AES-256-GCM (SOCIAL_TOKEN_KEY)',
  `refresh_token_enc` text COLLATE utf8mb4_unicode_ci COMMENT 'AES-256-GCM; Meta: long-lived user token',
  `token_expires_at` datetime DEFAULT NULL,
  `refresh_expires_at` datetime DEFAULT NULL,
  `scopes` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'active|needs_reconnect|disabled',
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `meta` json DEFAULT NULL COMMENT 'pages, boards, dry_run...',
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `social_accounts_platform_index` (`platform`),
  KEY `social_accounts_status_index` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `social_posts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Product|Post',
  `source_id` bigint unsigned NOT NULL,
  `account_id` bigint unsigned NOT NULL,
  `platform` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `format` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'fb_feed|fb_photos|fb_video|fb_reel|ig_image|ig_carousel|ig_reel|tiktok_video|tiktok_photo|yt_video|yt_short|pin_image|pin_video|pin_carousel',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `caption` text COLLATE utf8mb4_unicode_ci COMMENT 'noi dung chinh (message / caption / description)',
  `description` text COLLATE utf8mb4_unicode_ci,
  `link` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `media` json DEFAULT NULL COMMENT '[{type:image|video,url}] theo thu tu dang',
  `ai_generated` tinyint(1) NOT NULL DEFAULT 0,
  `meta` json DEFAULT NULL COMMENT 'lua chon rieng cua nen tang (tiktok privacy, board, tags...) + trang thai poll',
  `scheduled_at` datetime DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued' COMMENT 'queued|processing|published|failed|cancelled',
  `stage` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NULL = chua gui; poll = da gui, cho nen tang xu ly',
  `attempts` int unsigned NOT NULL DEFAULT 0,
  `next_attempt_at` datetime DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `remote_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remote_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error` text COLLATE utf8mb4_unicode_ci,
  `dry_run` tinyint(1) NOT NULL DEFAULT 0,
  `published_at` datetime DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `social_posts_queue_index` (`status`,`next_attempt_at`),
  KEY `social_posts_source_index` (`source_type`,`source_id`),
  KEY `social_posts_account_index` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quyen (giong cach luu cua cac module khac) + cap cho nhom "Quan tri vien" (id 1)
INSERT IGNORE INTO `permissions` (`name`, `canonical`, `created_at`, `updated_at`) VALUES
  ('Xem tài khoản mạng xã hội', 'social.account.index', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Kết nối / ngắt tài khoản mạng xã hội', 'social.account.update', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Xem lịch sử đăng mạng xã hội', 'social.post.index', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Đăng bài lên mạng xã hội', 'social.post.create', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Thử lại / hủy bài đăng mạng xã hội', 'social.post.update', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR));

INSERT INTO `user_catalogue_permission` (`user_catalogue_id`, `permission_id`)
SELECT 1, p.id FROM `permissions` p
WHERE p.canonical IN ('social.account.index', 'social.account.update', 'social.post.index', 'social.post.create', 'social.post.update')
  AND NOT EXISTS (SELECT 1 FROM `user_catalogue_permission` u WHERE u.user_catalogue_id = 1 AND u.permission_id = p.id);
