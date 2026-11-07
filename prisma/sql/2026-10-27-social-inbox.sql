-- Hop thu tong hop: binh luan + tin nhan tu Facebook / Instagram / website, danh dau khach can tu van.
-- Dong bo boi src/modules/social/inbox.ts (5 phut / lan + nut "Dong bo ngay").

CREATE TABLE IF NOT EXISTS `social_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `platform` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'facebook|instagram|website',
  `kind` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'comment|message|contact|review',
  `account_id` bigint unsigned DEFAULT NULL,
  `remote_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'id binh luan / tin nhan tren nen tang; website: contact:<id>, review:<id>',
  `thread_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'id bai dang (binh luan) hoac hoi thoai (tin nhan)',
  `parent_remote_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `social_post_id` bigint unsigned DEFAULT NULL COMMENT 'bai dang cua minh (social_posts) neu khop',
  `product_id` bigint unsigned DEFAULT NULL,
  `author_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `permalink` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phones` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emails` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_lead` tinyint(1) NOT NULL DEFAULT 0,
  `lead_reasons` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `from_page` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = shop tu tra loi',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new' COMMENT 'new|contacted|done|spam',
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_time` datetime DEFAULT NULL COMMENT 'gio VN luc khach gui',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `social_messages_remote_unique` (`platform`,`remote_id`),
  KEY `social_messages_lead_index` (`is_lead`,`status`),
  KEY `social_messages_time_index` (`created_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `permissions` (`name`, `canonical`, `created_at`, `updated_at`) VALUES
  ('Xem hộp thư & bình luận mạng xã hội', 'social.inbox.index', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)),
  ('Cập nhật trạng thái khách cần tư vấn', 'social.inbox.update', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR));

INSERT INTO `user_catalogue_permission` (`user_catalogue_id`, `permission_id`)
SELECT 1, p.id FROM `permissions` p
WHERE p.canonical IN ('social.inbox.index', 'social.inbox.update')
  AND NOT EXISTS (SELECT 1 FROM `user_catalogue_permission` u WHERE u.user_catalogue_id = 1 AND u.permission_id = p.id);
