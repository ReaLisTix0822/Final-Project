-- ==============================================================================
-- ROLLBACK for 20261019_align_32_tables.sql
-- Removes only what that migration created (new tables, new columns, indexes, checks,
-- triggers) and puts the changed foreign keys back to their old ON DELETE rule.
-- Data that existed before the migration is not touched. Rows written to the new
-- tables after the migration are lost with those tables.
--
-- Run (XAMPP):
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/20261019_align_32_tables_rollback.sql
-- ==============================================================================

SET NAMES utf8mb4;



-- Triggers
DROP TRIGGER IF EXISTS trg_stores_type_id_insert;
DROP TRIGGER IF EXISTS trg_stores_type_id_update;
DROP TRIGGER IF EXISTS trg_stores_goal_insert;
DROP TRIGGER IF EXISTS trg_stores_goal_update;

-- Foreign keys back to their old rule (all were ON DELETE CASCADE before)
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_buyer' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_buyer`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_buyer') = 0, 'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_store' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_store`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_store') = 0, 'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_items_order' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `order_items` DROP FOREIGN KEY `fk_items_order`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_items_order') = 0, 'ALTER TABLE `order_items` ADD CONSTRAINT `fk_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_items_product' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `order_items` DROP FOREIGN KEY `fk_items_product`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_items_product') = 0, 'ALTER TABLE `order_items` ADD CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'payments' AND constraint_name = 'fk_payments_order' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `payments` DROP FOREIGN KEY `fk_payments_order`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'payments' AND constraint_name = 'fk_payments_order') = 0, 'ALTER TABLE `payments` ADD CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'fk_tips_buyer' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `tips` DROP FOREIGN KEY `fk_tips_buyer`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'fk_tips_buyer') = 0, 'ALTER TABLE `tips` ADD CONSTRAINT `fk_tips_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'fk_tips_store' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `tips` DROP FOREIGN KEY `fk_tips_store`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'fk_tips_store') = 0, 'ALTER TABLE `tips` ADD CONSTRAINT `fk_tips_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'fk_reviews_buyer' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `reviews` DROP FOREIGN KEY `fk_reviews_buyer`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'fk_reviews_buyer') = 0, 'ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'fk_reviews_product' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `reviews` DROP FOREIGN KEY `fk_reviews_product`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'fk_reviews_product') = 0, 'ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- Checks and unique indexes
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'users' AND constraint_name = 'chk_users_role' AND constraint_type = 'CHECK') > 0, 'ALTER TABLE `users` DROP CONSTRAINT `chk_users_role`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'products' AND constraint_name = 'chk_products_price' AND constraint_type = 'CHECK') > 0, 'ALTER TABLE `products` DROP CONSTRAINT `chk_products_price`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'products' AND constraint_name = 'chk_products_stock' AND constraint_type = 'CHECK') > 0, 'ALTER TABLE `products` DROP CONSTRAINT `chk_products_stock`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'product_3d_models' AND constraint_name = 'chk_product_3d_models_images' AND constraint_type = 'CHECK') > 0, 'ALTER TABLE `product_3d_models` DROP CONSTRAINT `chk_product_3d_models_images`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'cart_items' AND constraint_name = 'chk_cart_items_qty' AND constraint_type = 'CHECK') > 0, 'ALTER TABLE `cart_items` DROP CONSTRAINT `chk_cart_items_qty`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'chk_order_items_qty' AND constraint_type = 'CHECK') > 0, 'ALTER TABLE `order_items` DROP CONSTRAINT `chk_order_items_qty`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'chk_tips_amount' AND constraint_type = 'CHECK') > 0, 'ALTER TABLE `tips` DROP CONSTRAINT `chk_tips_amount`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'chk_reviews_rating' AND constraint_type = 'CHECK') > 0, 'ALTER TABLE `reviews` DROP CONSTRAINT `chk_reviews_rating`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'categories' AND index_name = 'uk_categories_name') > 0, 'ALTER TABLE `categories` DROP INDEX `uk_categories_name`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'disability_types' AND index_name = 'uk_disability_types_name') > 0, 'ALTER TABLE `disability_types` DROP INDEX `uk_disability_types_name`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- Columns added to existing tables (their FKs first)
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'chat_messages' AND constraint_name = 'fk_chat_messages_room') > 0, 'ALTER TABLE `chat_messages` DROP FOREIGN KEY `fk_chat_messages_room`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND index_name = 'idx_chat_messages_chat') > 0, 'ALTER TABLE `chat_messages` DROP INDEX `idx_chat_messages_chat`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'chat_id') > 0, 'ALTER TABLE `chat_messages` DROP COLUMN `chat_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'message_type') > 0, 'ALTER TABLE `chat_messages` DROP COLUMN `message_type`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'alt_text') > 0, 'ALTER TABLE `chat_messages` DROP COLUMN `alt_text`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'read_at') > 0, 'ALTER TABLE `chat_messages` DROP COLUMN `read_at`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'complaints' AND constraint_name = 'fk_complaints_admin') > 0, 'ALTER TABLE `complaints` DROP FOREIGN KEY `fk_complaints_admin`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'complaints' AND index_name = 'idx_complaints_admin') > 0, 'ALTER TABLE `complaints` DROP INDEX `idx_complaints_admin`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'complaints' AND column_name = 'admin_id') > 0, 'ALTER TABLE `complaints` DROP COLUMN `admin_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'complaints' AND column_name = 'target_type') > 0, 'ALTER TABLE `complaints` DROP COLUMN `target_type`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'complaints' AND column_name = 'target_id') > 0, 'ALTER TABLE `complaints` DROP COLUMN `target_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'stores' AND constraint_name = 'fk_stores_type') > 0, 'ALTER TABLE `stores` DROP FOREIGN KEY `fk_stores_type`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'stores' AND index_name = 'idx_stores_type_id') > 0, 'ALTER TABLE `stores` DROP INDEX `idx_stores_type_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'stores' AND column_name = 'type_id') > 0, 'ALTER TABLE `stores` DROP COLUMN `type_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'stores' AND column_name = 'verified') > 0, 'ALTER TABLE `stores` DROP COLUMN `verified`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'status') > 0, 'ALTER TABLE `products` DROP COLUMN `status`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_3d_models' AND column_name = 'tripo_task_id') > 0, 'ALTER TABLE `product_3d_models` DROP COLUMN `tripo_task_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'store_videos' AND column_name = 'title') > 0, 'ALTER TABLE `store_videos` DROP COLUMN `title`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'store_videos' AND column_name = 'thumbnail_url') > 0, 'ALTER TABLE `store_videos` DROP COLUMN `thumbnail_url`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'search_history' AND column_name = 'input_type') > 0, 'ALTER TABLE `search_history` DROP COLUMN `input_type`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'search_history' AND column_name = 'filters') > 0, 'ALTER TABLE `search_history` DROP COLUMN `filters`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- Column definitions changed by the migration go back to the old definition (values are kept)
ALTER TABLE product_images MODIFY alt_text VARCHAR(255) NULL;
ALTER TABLE product_3d_models MODIFY source_image_count INT DEFAULT 0;

-- New tables (children first)
DROP TABLE IF EXISTS bot_messages;
DROP TABLE IF EXISTS bot_sessions;
DROP TABLE IF EXISTS chat_rooms;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS support_goals;
DROP TABLE IF EXISTS store_verifications;
DROP TABLE IF EXISTS accessibility_settings;

