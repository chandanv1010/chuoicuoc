-- Bao khach can tu van qua Telegram (src/modules/social/notify.ts).
ALTER TABLE `social_messages` ADD COLUMN `notified_at` datetime DEFAULT NULL COMMENT 'da bao Telegram luc' AFTER `note`;

CREATE TABLE IF NOT EXISTS `social_settings` (
  `k` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `v` text COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='cau hinh nho cua module mang xa hoi (telegram_chat_id...)';
