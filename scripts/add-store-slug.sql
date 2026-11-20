-- Store links by name: gazagate.store/store/<slug>
--
-- Run ONCE per database (test, then production) BEFORE deploying the backend
-- that includes the slug feature, then run:  npm run backfill:store-slugs
--
-- Safe for existing data: new columns start NULL, and the code falls back to
-- /customer/store/<id> links for stores without a slug.

ALTER TABLE `seller`
  ADD COLUMN `slug` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER `store_name`,
  ADD COLUMN `slug_changed_at` DATETIME NULL AFTER `slug`,
  ADD UNIQUE KEY `seller_slug_unique` (`slug`);

-- Old slugs keep redirecting to their store forever, and can't be reused.
CREATE TABLE `seller_slug_history` (
  `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `seller_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `slug` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `seller_slug_history_slug_unique` (`slug`),
  KEY `seller_slug_history_seller_id` (`seller_id`),
  CONSTRAINT `seller_slug_history_seller_fk` FOREIGN KEY (`seller_id`)
    REFERENCES `seller` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
