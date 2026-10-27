-- ==============================================================================
-- MIGRATION 2026-10-19: align the database with the 32-table design in the report
-- (ER Diagram + Data Dictionary). Additive only:
--   * no table or column is dropped or renamed (the report <-> real name mapping is
--     in db/migrations/20261019_align_32_tables.md)
--   * new tables use CREATE TABLE IF NOT EXISTS, new columns / indexes / checks / FKs are
--     added only when information_schema says they are missing, so it can be run again.
-- Rollback: db/migrations/20261019_align_32_tables_rollback.sql
--
-- Needs MySQL 8.0.16+ or MariaDB 10.2.1+ (CHECK constraints are enforced from those versions).
-- This project runs on MariaDB 10.4 (XAMPP).
--
-- Run (XAMPP):
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/20261019_align_32_tables.sql
-- ==============================================================================

SET NAMES utf8mb4;

-- Each "add if missing" step is: look in information_schema, then run the ALTER (or DO 0)
-- as a prepared statement. No stored procedures are used, so it also runs on XAMPP
-- installs whose mysql.proc table is out of date.

-- ------------------------------------------------------------------------------
-- 1. New tables (report #3, #5, #7, #20, #25, #27, #28)
-- ------------------------------------------------------------------------------

-- #3 Accessibility_Settings
CREATE TABLE IF NOT EXISTS accessibility_settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    font_size VARCHAR(20) DEFAULT 'normal',
    contrast_mode VARCHAR(20) DEFAULT 'default',
    voice_enabled BOOLEAN DEFAULT FALSE,
    reduce_motion BOOLEAN DEFAULT FALSE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_accessibility_settings_user (user_id),
    CONSTRAINT fk_accessibility_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- #5 Store_Verifications (one row per request, files stay in store_documents)
CREATE TABLE IF NOT EXISTS store_verifications (
    verification_id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    document_url VARCHAR(255) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reject_reason TEXT NULL,
    reviewed_by INT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    KEY idx_store_verifications_store (store_id),
    KEY idx_store_verifications_reviewer (reviewed_by),
    CONSTRAINT fk_store_verifications_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT fk_store_verifications_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- #7 Support_Goals
CREATE TABLE IF NOT EXISTS support_goals (
    goal_id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    target_amount DECIMAL(10,2) NOT NULL,
    current_amount DECIMAL(10,2) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    status VARCHAR(20) DEFAULT 'active',
    KEY idx_support_goals_store (store_id),
    CONSTRAINT chk_support_goals_target CHECK (target_amount > 0),
    CONSTRAINT fk_support_goals_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- #20 Order_Status_History
CREATE TABLE IF NOT EXISTS order_status_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    status VARCHAR(30) NOT NULL,
    changed_by INT NOT NULL,
    note TEXT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_order_status_history_order (order_id, changed_at),
    KEY idx_order_status_history_user (changed_by),
    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_status_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- #25 Chat_Room (buyer <-> store); chat_messages.chat_id points here
CREATE TABLE IF NOT EXISTS chat_rooms (
    chat_id INT AUTO_INCREMENT PRIMARY KEY,
    buyer_id INT NOT NULL,
    store_id INT NOT NULL,
    last_message_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_chat_rooms_buyer_store (buyer_id, store_id),
    KEY idx_chat_rooms_store (store_id),
    CONSTRAINT fk_chat_rooms_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_rooms_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- #27 Bot_Sessions (client_session_key = the browser's chatbot session id)
CREATE TABLE IF NOT EXISTS bot_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    client_session_key VARCHAR(64) NULL,
    user_id INT NULL,
    assist_mode ENUM('visual', 'motor', 'cognitive', 'low_vision', 'hearing') NOT NULL DEFAULT 'visual',
    page_context VARCHAR(100) NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    UNIQUE KEY uk_bot_sessions_client_key (client_session_key),
    KEY idx_bot_sessions_user (user_id),
    CONSTRAINT fk_bot_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- #28 Bot_Messages
CREATE TABLE IF NOT EXISTS bot_messages (
    bot_message_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    sender ENUM('user', 'assistant') NOT NULL,
    input_type ENUM('text', 'voice') NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_bot_messages_session (session_id, created_at),
    CONSTRAINT fk_bot_messages_session FOREIGN KEY (session_id) REFERENCES bot_sessions(session_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Missing columns on existing tables
-- ------------------------------------------------------------------------------

-- #4 Stores: type_id (-> disability_types), verified (follows verification_status, never out of step)
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'stores' AND column_name = 'type_id') = 0, 'ALTER TABLE `stores` ADD COLUMN `type_id` INT NULL AFTER `disability_type`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'stores' AND index_name = 'idx_stores_type_id') = 0, 'ALTER TABLE `stores` ADD INDEX `idx_stores_type_id` (`type_id`)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'stores' AND constraint_name = 'fk_stores_type' AND delete_rule <> 'SET NULL') > 0, 'ALTER TABLE `stores` DROP FOREIGN KEY `fk_stores_type`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'stores' AND constraint_name = 'fk_stores_type') = 0, 'ALTER TABLE `stores` ADD CONSTRAINT `fk_stores_type` FOREIGN KEY (`type_id`) REFERENCES `disability_types` (`id`) ON DELETE SET NULL', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'stores' AND column_name = 'verified') = 0, 'ALTER TABLE `stores` ADD COLUMN `verified` TINYINT(1) AS (verification_status = ''approved'') VIRTUAL', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- #6 Store_Stories = store_videos
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'store_videos' AND column_name = 'title') = 0, 'ALTER TABLE `store_videos` ADD COLUMN `title` VARCHAR(150) NULL AFTER `store_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'store_videos' AND column_name = 'thumbnail_url') = 0, 'ALTER TABLE `store_videos` ADD COLUMN `thumbnail_url` VARCHAR(255) NULL', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- #10 Products: status (follows is_active)
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'status') = 0, 'ALTER TABLE `products` ADD COLUMN `status` VARCHAR(10) AS (CASE WHEN is_active = 1 THEN ''active'' ELSE ''inactive'' END) VIRTUAL', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- #12 Product_3D_Models: tripo_task_id (meshy_task_id is kept); 1-4 source images
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_3d_models' AND column_name = 'tripo_task_id') = 0, 'ALTER TABLE `product_3d_models` ADD COLUMN `tripo_task_id` VARCHAR(100) NULL AFTER `meshy_task_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
UPDATE product_3d_models SET source_image_count = 1 WHERE source_image_count IS NULL OR source_image_count < 1;
UPDATE product_3d_models SET source_image_count = 4 WHERE source_image_count > 4;
ALTER TABLE product_3d_models MODIFY source_image_count INT DEFAULT 1;

-- #24 Complaints: what the complaint is about + the admin who handled it
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'complaints' AND column_name = 'target_type') = 0, 'ALTER TABLE `complaints` ADD COLUMN `target_type` ENUM(''store'', ''product'', ''review'', ''message'', ''order'') NULL AFTER `order_id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'complaints' AND column_name = 'target_id') = 0, 'ALTER TABLE `complaints` ADD COLUMN `target_id` INT NULL AFTER `target_type`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'complaints' AND column_name = 'admin_id') = 0, 'ALTER TABLE `complaints` ADD COLUMN `admin_id` INT NULL AFTER `status`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'complaints' AND index_name = 'idx_complaints_admin') = 0, 'ALTER TABLE `complaints` ADD INDEX `idx_complaints_admin` (`admin_id`)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'complaints' AND constraint_name = 'fk_complaints_admin' AND delete_rule <> 'SET NULL') > 0, 'ALTER TABLE `complaints` DROP FOREIGN KEY `fk_complaints_admin`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'complaints' AND constraint_name = 'fk_complaints_admin') = 0, 'ALTER TABLE `complaints` ADD CONSTRAINT `fk_complaints_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- #26 Messages = chat_messages
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'chat_id') = 0, 'ALTER TABLE `chat_messages` ADD COLUMN `chat_id` INT NULL AFTER `id`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'message_type') = 0, 'ALTER TABLE `chat_messages` ADD COLUMN `message_type` ENUM(''text'', ''image'', ''voice'', ''product'') NOT NULL DEFAULT ''text'' AFTER `sender_role`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'alt_text') = 0, 'ALTER TABLE `chat_messages` ADD COLUMN `alt_text` VARCHAR(255) NULL AFTER `message`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'read_at') = 0, 'ALTER TABLE `chat_messages` ADD COLUMN `read_at` DATETIME NULL AFTER `is_read`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND index_name = 'idx_chat_messages_chat') = 0, 'ALTER TABLE `chat_messages` ADD INDEX `idx_chat_messages_chat` (`chat_id`)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'chat_messages' AND constraint_name = 'fk_chat_messages_room' AND delete_rule <> 'CASCADE') > 0, 'ALTER TABLE `chat_messages` DROP FOREIGN KEY `fk_chat_messages_room`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'chat_messages' AND constraint_name = 'fk_chat_messages_room') = 0, 'ALTER TABLE `chat_messages` ADD CONSTRAINT `fk_chat_messages_room` FOREIGN KEY (`chat_id`) REFERENCES `chat_rooms` (`chat_id`) ON DELETE CASCADE', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- #32 Search_History: text or voice + the filters used
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'search_history' AND column_name = 'input_type') = 0, 'ALTER TABLE `search_history` ADD COLUMN `input_type` ENUM(''text'', ''voice'') NOT NULL DEFAULT ''text'' AFTER `source`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'search_history' AND column_name = 'filters') = 0, 'ALTER TABLE `search_history` ADD COLUMN `filters` TEXT NULL AFTER `input_type`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- ------------------------------------------------------------------------------
-- 3. Backfill
-- ------------------------------------------------------------------------------

-- #14 Disability_Types: every code used by a store exists (intellectual was added on 2026-10-18)
INSERT IGNORE INTO disability_types (code, name, label) VALUES
    ('visual', 'ทางสายตา', 'ผู้บกพร่องทางสายตา'),
    ('hearing', 'การได้ยิน', 'ผู้บกพร่องทางการได้ยิน'),
    ('physical', 'ทางร่างกาย', 'ผู้บกพร่องทางร่างกาย'),
    ('organization', 'องค์กรสำหรับผู้ที่มีความพิการ', 'องค์กรสำหรับผู้ที่มีความพิการ'),
    ('intellectual', 'ทางสติปัญญาและการเรียนรู้', 'ผู้ที่มีความบกพร่องทางสติปัญญาและการเรียนรู้');
INSERT IGNORE INTO disability_types (code, name, label)
SELECT DISTINCT s.disability_type, s.disability_type, s.disability_type FROM stores s
WHERE s.disability_type IS NOT NULL AND s.disability_type <> '';

-- #13 Categories: every category a product points to already exists (FK), nothing to add

-- #4 stores.type_id from the old text column
UPDATE stores s JOIN disability_types dt ON dt.code = s.disability_type
SET s.type_id = dt.id
WHERE s.type_id IS NULL OR s.type_id <> dt.id;
UPDATE stores SET type_id = NULL WHERE disability_type IS NULL OR disability_type = '';

-- #7 Support_Goals from the goal columns on stores
INSERT INTO support_goals (store_id, title, target_amount, current_amount, start_date, status)
SELECT s.id, LEFT(s.support_goal_title, 150), s.support_goal_target, COALESCE(s.support_goal_current, 0),
       DATE(COALESCE(s.created_at, NOW())),
       CASE WHEN COALESCE(s.support_goal_current, 0) >= s.support_goal_target THEN 'completed' ELSE 'active' END
FROM stores s
WHERE s.support_goal_target > 0 AND s.support_goal_title IS NOT NULL AND s.support_goal_title <> ''
  AND NOT EXISTS (SELECT 1 FROM support_goals g WHERE g.store_id = s.id);

-- #12 Product_3D_Models from products.model_3d_url
INSERT INTO product_3d_models (product_id, model_url, status, source_image_count)
SELECT p.id, p.model_3d_url, 'completed', 1 FROM products p
WHERE p.model_3d_url IS NOT NULL AND p.model_3d_url <> ''
  AND NOT EXISTS (SELECT 1 FROM product_3d_models m WHERE m.product_id = p.id);

-- #11 Product_Images from products.image_url (alt text = product name for now)
INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
SELECT p.id, p.image_url, LEFT(p.name, 255), 0 FROM products p
WHERE p.image_url IS NOT NULL AND p.image_url <> ''
  AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id);
UPDATE product_images pi JOIN products p ON p.id = pi.product_id
SET pi.alt_text = LEFT(p.name, 255)
WHERE pi.alt_text IS NULL OR pi.alt_text = '';
ALTER TABLE product_images MODIFY alt_text VARCHAR(255) NOT NULL;

-- #20 Order_Status_History: the current status of each order (one row per order).
-- changed_by: the buyer for statuses the buyer causes, otherwise the store owner.
INSERT INTO order_status_history (order_id, status, changed_by, note, changed_at)
SELECT o.id, o.status,
       CASE WHEN o.status IN ('pending_payment', 'paid', 'cancelled') THEN o.buyer_id ELSE s.user_id END,
       'บันทึกย้อนหลังจากสถานะปัจจุบัน (migration 2026-10-19)',
       COALESCE(o.updated_at, o.created_at, NOW())
FROM orders o JOIN stores s ON s.id = o.store_id
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id);

-- #5 Store_Verifications: one request per store from its first uploaded document
INSERT INTO store_verifications (store_id, document_url, status, reject_reason, reviewed_by, submitted_at, reviewed_at)
SELECT s.id, d.file_path,
       CASE WHEN s.verification_status IN ('approved', 'rejected') THEN s.verification_status ELSE 'pending' END,
       CASE WHEN s.verification_status = 'rejected' THEN s.rejection_reason END,
       CASE WHEN s.verification_status IN ('approved', 'rejected')
            THEN (SELECT MIN(a.id) FROM users a WHERE a.role = 'admin') END,
       COALESCE(d.created_at, s.created_at, NOW()),
       CASE WHEN s.verification_status IN ('approved', 'rejected') THEN COALESCE(d.created_at, s.created_at, NOW()) END
FROM stores s
JOIN store_documents d ON d.id = (SELECT MIN(d2.id) FROM store_documents d2 WHERE d2.store_id = s.id)
WHERE NOT EXISTS (SELECT 1 FROM store_verifications v WHERE v.store_id = s.id);

-- #6 Store_Stories: a title and a thumbnail for the existing videos
UPDATE store_videos v JOIN stores s ON s.id = v.store_id
SET v.title = LEFT(CONCAT('เรื่องราวของ ', s.store_name), 150)
WHERE v.title IS NULL OR v.title = '';
UPDATE store_videos v JOIN stores s ON s.id = v.store_id
SET v.thumbnail_url = s.cover_image
WHERE v.thumbnail_url IS NULL AND s.cover_image IS NOT NULL AND CHAR_LENGTH(s.cover_image) <= 255;

-- #24 Complaints: an order complaint points at its order
UPDATE complaints SET target_type = 'order', target_id = order_id
WHERE target_type IS NULL AND order_id IS NOT NULL;
UPDATE complaints SET target_type = category
WHERE target_type IS NULL AND category IN ('store', 'product', 'review', 'message', 'order');

-- #25/#26 Chat rooms from buyer <-> store messages (the buyer is the side that is not the store owner)
INSERT IGNORE INTO chat_rooms (buyer_id, store_id, last_message_at, created_at)
SELECT x.buyer_id, x.store_id, MAX(x.created_at), MIN(x.created_at)
FROM (
    SELECT m.store_id, m.created_at,
           CASE WHEN m.sender_id = s.user_id THEN m.receiver_id ELSE m.sender_id END AS buyer_id
    FROM chat_messages m JOIN stores s ON s.id = m.store_id
    WHERE m.store_id IS NOT NULL AND (m.sender_id = s.user_id OR m.receiver_id = s.user_id)
) x
WHERE x.buyer_id IS NOT NULL
GROUP BY x.buyer_id, x.store_id;
UPDATE chat_messages m
JOIN stores s ON s.id = m.store_id
JOIN chat_rooms r ON r.store_id = m.store_id
                 AND r.buyer_id = CASE WHEN m.sender_id = s.user_id THEN m.receiver_id ELSE m.sender_id END
SET m.chat_id = r.chat_id
WHERE m.chat_id IS NULL AND (m.sender_id = s.user_id OR m.receiver_id = s.user_id);
UPDATE chat_messages SET read_at = created_at WHERE is_read = 1 AND read_at IS NULL;

-- #27/#28 Bot sessions and messages from chatbot_logs (assist_mode unknown for old logs: 'visual')
INSERT INTO bot_sessions (client_session_key, user_id, assist_mode, page_context, started_at, ended_at)
SELECT g.k, g.user_id, 'visual', g.page_context, g.started_at, g.ended_at
FROM (
    SELECT COALESCE(l.session_id, CONCAT('log-', l.id)) AS k, MAX(l.user_id) AS user_id,
           LEFT(SUBSTRING_INDEX(GROUP_CONCAT(l.page_path ORDER BY l.id SEPARATOR '\n'), '\n', 1), 100) AS page_context,
           MIN(l.created_at) AS started_at, MAX(l.created_at) AS ended_at
    FROM chatbot_logs l
    GROUP BY COALESCE(l.session_id, CONCAT('log-', l.id))
) g
WHERE NOT EXISTS (SELECT 1 FROM bot_sessions b WHERE b.client_session_key = g.k);
INSERT INTO bot_messages (session_id, sender, input_type, content, created_at)
SELECT b.session_id, x.sender, 'text', x.content, x.created_at
FROM (
    SELECT COALESCE(session_id, CONCAT('log-', id)) AS k, id, 'user' AS sender, user_message AS content, created_at FROM chatbot_logs
    UNION ALL
    SELECT COALESCE(session_id, CONCAT('log-', id)), id, 'assistant', bot_reply, created_at FROM chatbot_logs
    WHERE bot_reply IS NOT NULL AND bot_reply <> ''
) x
JOIN bot_sessions b ON b.client_session_key = x.k
WHERE NOT EXISTS (SELECT 1 FROM bot_messages bm WHERE bm.session_id = b.session_id)
ORDER BY x.id, x.sender DESC;

-- ------------------------------------------------------------------------------
-- 4. UNIQUE / CHECK constraints (existing data was checked first: all rows pass)
-- ------------------------------------------------------------------------------
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'categories' AND index_name = 'uk_categories_name') = 0, 'ALTER TABLE `categories` ADD UNIQUE INDEX `uk_categories_name` (`name`)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'disability_types' AND index_name = 'uk_disability_types_name') = 0, 'ALTER TABLE `disability_types` ADD UNIQUE INDEX `uk_disability_types_name` (`name`)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'users' AND constraint_name = 'chk_users_role' AND constraint_type = 'CHECK') = 0, 'ALTER TABLE `users` ADD CONSTRAINT `chk_users_role` CHECK (role IN (''buyer'', ''seller'', ''admin''))', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'products' AND constraint_name = 'chk_products_price' AND constraint_type = 'CHECK') = 0, 'ALTER TABLE `products` ADD CONSTRAINT `chk_products_price` CHECK (price > 0)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'products' AND constraint_name = 'chk_products_stock' AND constraint_type = 'CHECK') = 0, 'ALTER TABLE `products` ADD CONSTRAINT `chk_products_stock` CHECK (stock >= 0)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'product_3d_models' AND constraint_name = 'chk_product_3d_models_images' AND constraint_type = 'CHECK') = 0, 'ALTER TABLE `product_3d_models` ADD CONSTRAINT `chk_product_3d_models_images` CHECK (source_image_count IS NULL OR source_image_count BETWEEN 1 AND 4)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'cart_items' AND constraint_name = 'chk_cart_items_qty' AND constraint_type = 'CHECK') = 0, 'ALTER TABLE `cart_items` ADD CONSTRAINT `chk_cart_items_qty` CHECK (qty > 0)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'chk_order_items_qty' AND constraint_type = 'CHECK') = 0, 'ALTER TABLE `order_items` ADD CONSTRAINT `chk_order_items_qty` CHECK (quantity > 0)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'chk_tips_amount' AND constraint_type = 'CHECK') = 0, 'ALTER TABLE `tips` ADD CONSTRAINT `chk_tips_amount` CHECK (amount > 0)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'chk_reviews_rating' AND constraint_type = 'CHECK') = 0, 'ALTER TABLE `reviews` ADD CONSTRAINT `chk_reviews_rating` CHECK (rating BETWEEN 1 AND 5)', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- ------------------------------------------------------------------------------
-- 5. Foreign key rules
--    transactions: RESTRICT (an order, its items, payment, tips and reviews are never deleted by a cascade)
--    owned child rows (addresses, favorites, cart, follows, images, 3D models, messages,
--    campaign shops) already use CASCADE; reviewer / admin / search user use SET NULL.
-- ------------------------------------------------------------------------------
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_buyer' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_buyer`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_buyer') = 0, 'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_store' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_store`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_store') = 0, 'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_items_order' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `order_items` DROP FOREIGN KEY `fk_items_order`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_items_order') = 0, 'ALTER TABLE `order_items` ADD CONSTRAINT `fk_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_items_product' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `order_items` DROP FOREIGN KEY `fk_items_product`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_items_product') = 0, 'ALTER TABLE `order_items` ADD CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'payments' AND constraint_name = 'fk_payments_order' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `payments` DROP FOREIGN KEY `fk_payments_order`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'payments' AND constraint_name = 'fk_payments_order') = 0, 'ALTER TABLE `payments` ADD CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'fk_tips_buyer' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `tips` DROP FOREIGN KEY `fk_tips_buyer`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'fk_tips_buyer') = 0, 'ALTER TABLE `tips` ADD CONSTRAINT `fk_tips_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'fk_tips_store' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `tips` DROP FOREIGN KEY `fk_tips_store`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'tips' AND constraint_name = 'fk_tips_store') = 0, 'ALTER TABLE `tips` ADD CONSTRAINT `fk_tips_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'fk_reviews_buyer' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `reviews` DROP FOREIGN KEY `fk_reviews_buyer`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'fk_reviews_buyer') = 0, 'ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'fk_reviews_product' AND delete_rule <> 'RESTRICT') > 0, 'ALTER TABLE `reviews` DROP FOREIGN KEY `fk_reviews_product`', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;
SET @tj_sql = IF((SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'reviews' AND constraint_name = 'fk_reviews_product') = 0, 'ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT', 'DO 0');
PREPARE tj_stmt FROM @tj_sql; EXECUTE tj_stmt; DEALLOCATE PREPARE tj_stmt;

-- ------------------------------------------------------------------------------
-- 6. Triggers: the new columns / tables that copy data kept on stores stay in step
--    with every code path that writes stores (sign-up, store edit, consent withdrawal,
--    support goal progress after an order) without touching that code.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_stores_type_id_insert;
DROP TRIGGER IF EXISTS trg_stores_type_id_update;
DROP TRIGGER IF EXISTS trg_stores_goal_insert;
DROP TRIGGER IF EXISTS trg_stores_goal_update;

DELIMITER $$

CREATE TRIGGER trg_stores_type_id_insert BEFORE INSERT ON stores FOR EACH ROW
BEGIN
    SET NEW.type_id = (SELECT id FROM disability_types WHERE code = NEW.disability_type LIMIT 1);
END$$

CREATE TRIGGER trg_stores_type_id_update BEFORE UPDATE ON stores FOR EACH ROW
BEGIN
    IF NOT (NEW.disability_type <=> OLD.disability_type) THEN
        SET NEW.type_id = (SELECT id FROM disability_types WHERE code = NEW.disability_type LIMIT 1);
    END IF;
END$$

CREATE TRIGGER trg_stores_goal_insert AFTER INSERT ON stores FOR EACH ROW
BEGIN
    IF NEW.support_goal_target > 0 AND NEW.support_goal_title IS NOT NULL AND NEW.support_goal_title <> '' THEN
        INSERT INTO support_goals (store_id, title, target_amount, current_amount, start_date, status)
        VALUES (NEW.id, LEFT(NEW.support_goal_title, 150), NEW.support_goal_target, COALESCE(NEW.support_goal_current, 0), CURDATE(), 'active');
    END IF;
END$$

CREATE TRIGGER trg_stores_goal_update AFTER UPDATE ON stores FOR EACH ROW
BEGIN
    IF NOT (NEW.support_goal_title <=> OLD.support_goal_title)
       OR NOT (NEW.support_goal_target <=> OLD.support_goal_target)
       OR NOT (NEW.support_goal_current <=> OLD.support_goal_current) THEN
        IF NEW.support_goal_target > 0 AND NEW.support_goal_title IS NOT NULL AND NEW.support_goal_title <> '' THEN
            IF EXISTS (SELECT 1 FROM support_goals WHERE store_id = NEW.id) THEN
                UPDATE support_goals
                SET title = LEFT(NEW.support_goal_title, 150), target_amount = NEW.support_goal_target,
                    current_amount = COALESCE(NEW.support_goal_current, 0),
                    status = CASE WHEN COALESCE(NEW.support_goal_current, 0) >= NEW.support_goal_target THEN 'completed' ELSE 'active' END
                WHERE goal_id = (SELECT g.goal_id FROM (SELECT MAX(goal_id) AS goal_id FROM support_goals WHERE store_id = NEW.id) g);
            ELSE
                INSERT INTO support_goals (store_id, title, target_amount, current_amount, start_date, status)
                VALUES (NEW.id, LEFT(NEW.support_goal_title, 150), NEW.support_goal_target, COALESCE(NEW.support_goal_current, 0), CURDATE(), 'active');
            END IF;
        END IF;
    END IF;
END$$

DELIMITER ;

-- ------------------------------------------------------------------------------
-- 7. PDPA: consent lives on users only (already there since 2026-10-15). The 4 demo stores have consented.
-- ------------------------------------------------------------------------------
UPDATE users SET disability_consent = TRUE, consent_at = COALESCE(consent_at, NOW())
WHERE id IN (SELECT user_id FROM stores WHERE id IN (1, 2, 3, 4)) AND disability_consent = FALSE;

