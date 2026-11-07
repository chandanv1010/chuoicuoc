-- Tra loi binh luan tu admin, an spam, goi y tra loi (AI / mau), thong ke tuong tac theo bai dang.
ALTER TABLE `social_messages`
  ADD COLUMN `hidden` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = da an tren Facebook' AFTER `from_page`,
  ADD COLUMN `reply_draft` text COLLATE utf8mb4_unicode_ci COMMENT 'goi y tra loi (AI hoac mau)' AFTER `note`,
  ADD COLUMN `replied_at` datetime DEFAULT NULL COMMENT 'shop da tra loi tu admin' AFTER `reply_draft`;

ALTER TABLE `social_posts`
  ADD COLUMN `stats` json DEFAULT NULL COMMENT '{likes, comments, shares} lay tu nen tang' AFTER `published_at`,
  ADD COLUMN `stats_at` datetime DEFAULT NULL AFTER `stats`;

INSERT IGNORE INTO `permissions` (`name`, `canonical`, `created_at`, `updated_at`) VALUES
  ('Xem thống kê tương tác mạng xã hội', 'social.stats.index', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR));
INSERT INTO `user_catalogue_permission` (`user_catalogue_id`, `permission_id`)
SELECT 1, p.id FROM `permissions` p
WHERE p.canonical = 'social.stats.index'
  AND NOT EXISTS (SELECT 1 FROM `user_catalogue_permission` u WHERE u.user_catalogue_id = 1 AND u.permission_id = p.id);
