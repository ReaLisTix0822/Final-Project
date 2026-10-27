const fs = require('fs');
const path = require('path');
const { getSeedData } = require('../db/seed');

let dbDriver = null; // 'mysql' or 'sqlite'
let pool = null;
let sqliteDb = null;

class Database {
    async init() {
        const host = process.env.DB_HOST || 'localhost';
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASSWORD || '';
        const database = process.env.DB_NAME || 'inclusive_marketplace';
        const port = parseInt(process.env.DB_PORT || '3306', 10);

        let mysqlConnected = false;
        try {
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({ host, user, password, port, connectTimeout: 1000 });
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
            await connection.end();

            pool = mysql.createPool({
                host,
                user,
                password,
                database,
                port,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });

            const [rows] = await pool.query('SELECT 1 as test');
            if (rows && rows[0].test === 1) {
                dbDriver = 'mysql';
                mysqlConnected = true;
                console.log(`✅ [Database] Connected successfully to MySQL (${host}:${port}/${database})`);
                await this.initMySQLTables();
            }
        } catch (err) {
            console.log(`ℹ️ [Database] MySQL not reachable locally (${err.message}). Using embedded SQLite database with full SQL relational persistence.`);
        }

        if (!mysqlConnected) {
            const sqlite3 = require('sqlite3').verbose();
            const dbPath = path.join(__dirname, '../db/marketplace.sqlite');
            
            await new Promise((resolve, reject) => {
                sqliteDb = new sqlite3.Database(dbPath, (err) => {
                    if (err) return reject(err);
                    dbDriver = 'sqlite';
                    console.log(`✅ [Database] SQLite relational database initialized at ${dbPath}`);
                    resolve();
                });
            });

            await this.initSQLiteTables();
        }

        await this.backfillLinkedTables();
    }

    // Fill the linked tables (payments, tips, shipping_tracking, product_images, product_3d_models)
    // for rows created before those tables existed. Safe to run on every start.
    async backfillLinkedTables() {
        // Columns added after the first release (CREATE TABLE IF NOT EXISTS does not add them)
        await this.ensureColumn('stores', 'rejection_reason', 'TEXT');
        await this.ensureColumn('users', 'last_login_at', 'DATETIME NULL');
        await this.ensureColumn('products', 'removed_by_admin', 'INTEGER DEFAULT 0');
        await this.ensureColumn('products', 'removal_reason', 'TEXT');
        await this.ensureColumn('products', 'removed_at', 'DATETIME NULL');
        await this.moveStoreVideosToOwnTable();
        // PDPA s.26: explicit consent for disability data + soft delete (see db/migrations/2026-10-15-pdpa-consent.sql)
        await this.ensureColumn('users', 'disability_consent', 'BOOLEAN NOT NULL DEFAULT FALSE');
        await this.ensureColumn('users', 'consent_at', 'DATETIME NULL');
        await this.ensureColumn('users', 'deleted_at', 'DATETIME NULL');
        if (dbDriver === 'mysql') {
            await this.run('ALTER TABLE stores MODIFY disability_type VARCHAR(100) NULL').catch(e => console.warn('[Database]', e.message));
        }

        const statements = [
            `INSERT INTO payments (order_id, method, amount, status, created_at)
             SELECT o.id, o.payment_method, o.grand_total,
                    CASE WHEN o.status = 'cancelled' THEN 'cancelled'
                         WHEN o.payment_method = 'cod' AND o.status NOT IN ('delivered', 'completed') THEN 'pending'
                         ELSE 'paid' END,
                    o.created_at
             FROM orders o
             WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id)`,
            `INSERT INTO tips (buyer_id, store_id, order_id, amount, created_at)
             SELECT o.buyer_id, o.store_id, o.id, o.tip_amount, o.created_at
             FROM orders o
             WHERE o.tip_amount > 0 AND NOT EXISTS (SELECT 1 FROM tips t WHERE t.order_id = o.id)`,
            `INSERT INTO shipping_tracking (order_id, carrier, tracking_number, status, last_updated)
             SELECT o.id, o.courier_name, NULLIF(o.tracking_number, ''), o.status, o.updated_at
             FROM orders o
             WHERE NOT EXISTS (SELECT 1 FROM shipping_tracking st WHERE st.order_id = o.id)`,
            `INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
             SELECT p.id, p.image_url, p.name, 0
             FROM products p
             WHERE p.image_url IS NOT NULL AND p.image_url != ''
               AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id)`,
            `INSERT INTO product_3d_models (product_id, model_url, status, source_image_count)
             SELECT p.id, p.model_3d_url, 'completed', 1
             FROM products p
             WHERE p.model_3d_url IS NOT NULL AND p.model_3d_url != ''
               AND NOT EXISTS (SELECT 1 FROM product_3d_models m WHERE m.product_id = p.id)`,
            // Support goal progress = real tips received (direct tips + order tips, cancelled orders excluded)
            `UPDATE stores SET support_goal_current = (
                SELECT COALESCE(SUM(t.amount), 0) FROM tips t
                WHERE t.store_id = stores.id
                  AND (t.order_id IS NULL OR NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = t.order_id AND o.status = 'cancelled'))
             )`
        ];

        for (const sql of statements) {
            try {
                await this.run(sql);
            } catch (e) {
                console.warn('[Database] Backfill skipped:', e.message);
            }
        }

        await this.alignWith32TableDesign();
    }

    // The 32-table design in the report (db/migrations/20261019_align_32_tables.sql does the same on MySQL
    // with FK rules, CHECKs and generated columns). Here: the columns the code writes, the backfill,
    // and on MySQL the triggers. Works on SQLite too; safe to run on every start.
    async alignWith32TableDesign() {
        const mysql = dbDriver === 'mysql';
        await this.ensureColumn('stores', 'type_id', 'INTEGER NULL');
        await this.ensureColumn('store_videos', 'title', 'VARCHAR(150) NULL');
        await this.ensureColumn('store_videos', 'thumbnail_url', 'VARCHAR(255) NULL');
        await this.ensureColumn('product_3d_models', 'tripo_task_id', 'VARCHAR(100) NULL');
        await this.ensureColumn('complaints', 'target_type', mysql ? "ENUM('store', 'product', 'review', 'message', 'order') NULL" : 'TEXT');
        await this.ensureColumn('complaints', 'target_id', 'INTEGER NULL');
        await this.ensureColumn('complaints', 'admin_id', 'INTEGER NULL');
        await this.ensureColumn('chat_messages', 'chat_id', 'INTEGER NULL');
        await this.ensureColumn('chat_messages', 'message_type', mysql ? "ENUM('text', 'image', 'voice', 'product') NOT NULL DEFAULT 'text'" : "TEXT NOT NULL DEFAULT 'text'");
        await this.ensureColumn('chat_messages', 'alt_text', 'VARCHAR(255) NULL');
        await this.ensureColumn('chat_messages', 'read_at', 'DATETIME NULL');
        await this.ensureColumn('search_history', 'input_type', mysql ? "ENUM('text', 'voice') NOT NULL DEFAULT 'text'" : "TEXT NOT NULL DEFAULT 'text'");
        await this.ensureColumn('search_history', 'filters', 'TEXT NULL');
        // Every option of the accessibility menu (db/migrations/20261027_accessibility_settings_columns.sql)
        for (const column of ['dyslexia_font', 'highlight_links', 'text_spacing', 'big_cursor', 'easy_mode', 'focus_reading']) {
            await this.ensureColumn('accessibility_settings', column, mysql ? 'BOOLEAN NOT NULL DEFAULT FALSE' : 'INTEGER NOT NULL DEFAULT 0');
        }
        // Seller groups can be closed without deleting them; "intellectual" is closed
        // (db/migrations/20261027_close_intellectual_seller_group.sql)
        await this.ensureColumn('disability_types', 'is_active', mysql ? 'BOOLEAN NOT NULL DEFAULT TRUE' : 'INTEGER NOT NULL DEFAULT 1');
        await this.run("UPDATE disability_types SET is_active = 0 WHERE code = 'intellectual' AND is_active <> 0").catch(() => {});
        await this.ensureColumn('accessibility_settings', 'show_tooltips', mysql ? 'BOOLEAN NOT NULL DEFAULT FALSE' : 'INTEGER NOT NULL DEFAULT 0');
        await this.ensureColumn('accessibility_settings', 'speech_rate', mysql ? 'DECIMAL(3,2) NOT NULL DEFAULT 1.00' : 'REAL NOT NULL DEFAULT 1.0');

        const statements = [
            `UPDATE stores SET type_id = (SELECT d.id FROM disability_types d WHERE d.code = stores.disability_type)
             WHERE type_id IS NULL AND disability_type IS NOT NULL`,
            `INSERT INTO support_goals (store_id, title, target_amount, current_amount, start_date, status)
             SELECT s.id, SUBSTR(s.support_goal_title, 1, 150), s.support_goal_target, COALESCE(s.support_goal_current, 0),
                    DATE(COALESCE(s.created_at, CURRENT_TIMESTAMP)),
                    CASE WHEN COALESCE(s.support_goal_current, 0) >= s.support_goal_target THEN 'completed' ELSE 'active' END
             FROM stores s
             WHERE s.support_goal_target > 0 AND s.support_goal_title IS NOT NULL AND s.support_goal_title <> ''
               AND NOT EXISTS (SELECT 1 FROM support_goals g WHERE g.store_id = s.id)`,
            `INSERT INTO order_status_history (order_id, status, changed_by, note, changed_at)
             SELECT o.id, o.status,
                    CASE WHEN o.status IN ('pending_payment', 'paid', 'cancelled') THEN o.buyer_id ELSE s.user_id END,
                    'บันทึกย้อนหลังจากสถานะปัจจุบัน', COALESCE(o.updated_at, o.created_at, CURRENT_TIMESTAMP)
             FROM orders o JOIN stores s ON s.id = o.store_id
             WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id)`,
            `INSERT INTO store_verifications (store_id, document_url, status, reject_reason, reviewed_by, submitted_at, reviewed_at)
             SELECT s.id, d.file_path,
                    CASE WHEN s.verification_status IN ('approved', 'rejected') THEN s.verification_status ELSE 'pending' END,
                    CASE WHEN s.verification_status = 'rejected' THEN s.rejection_reason END,
                    CASE WHEN s.verification_status IN ('approved', 'rejected') THEN (SELECT MIN(a.id) FROM users a WHERE a.role = 'admin') END,
                    COALESCE(d.created_at, s.created_at, CURRENT_TIMESTAMP),
                    CASE WHEN s.verification_status IN ('approved', 'rejected') THEN COALESCE(d.created_at, s.created_at, CURRENT_TIMESTAMP) END
             FROM stores s
             JOIN store_documents d ON d.id = (SELECT MIN(d2.id) FROM store_documents d2 WHERE d2.store_id = s.id)
             WHERE NOT EXISTS (SELECT 1 FROM store_verifications v WHERE v.store_id = s.id)`,
            `UPDATE product_images SET alt_text = (SELECT SUBSTR(p.name, 1, 255) FROM products p WHERE p.id = product_images.product_id)
             WHERE alt_text IS NULL OR alt_text = ''`,
            `UPDATE complaints SET target_type = 'order', target_id = order_id WHERE target_type IS NULL AND order_id IS NOT NULL`,
            `INSERT INTO chat_rooms (buyer_id, store_id, last_message_at, created_at)
             SELECT x.buyer_id, x.store_id, MAX(x.created_at), MIN(x.created_at)
             FROM (SELECT m.store_id, m.created_at, CASE WHEN m.sender_id = s.user_id THEN m.receiver_id ELSE m.sender_id END AS buyer_id
                   FROM chat_messages m JOIN stores s ON s.id = m.store_id
                   WHERE m.sender_id = s.user_id OR m.receiver_id = s.user_id) x
             WHERE x.buyer_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM chat_rooms r WHERE r.buyer_id = x.buyer_id AND r.store_id = x.store_id)
             GROUP BY x.buyer_id, x.store_id`,
            `UPDATE chat_messages SET chat_id = (
                SELECT r.chat_id FROM chat_rooms r JOIN stores s ON s.id = r.store_id
                WHERE r.store_id = chat_messages.store_id
                  AND r.buyer_id = CASE WHEN chat_messages.sender_id = s.user_id THEN chat_messages.receiver_id ELSE chat_messages.sender_id END)
             WHERE chat_id IS NULL AND store_id IS NOT NULL`,
            `UPDATE chat_messages SET read_at = created_at WHERE is_read = 1 AND read_at IS NULL`
        ];
        for (const sql of statements) {
            try {
                await this.run(sql);
            } catch (e) {
                console.warn('[Database] 32-table backfill skipped:', e.message);
            }
        }

        try {
            // Story titles, and the chatbot log as bot sessions / messages (first start only)
            for (const v of await this.all('SELECT v.id, s.store_name FROM store_videos v JOIN stores s ON s.id = v.store_id WHERE v.title IS NULL')) {
                await this.run('UPDATE store_videos SET title = ? WHERE id = ?', [`เรื่องราวของ ${v.store_name}`.slice(0, 150), v.id]);
            }
            const sessions = await this.get('SELECT COUNT(*) as n FROM bot_sessions');
            if (Number(sessions.n) === 0) {
                const logs = await this.all('SELECT * FROM chatbot_logs ORDER BY id');
                const ids = new Map();
                for (const log of logs) {
                    const key = log.session_id || `log-${log.id}`;
                    if (!ids.has(key)) {
                        const created = await this.run(
                            "INSERT INTO bot_sessions (client_session_key, user_id, assist_mode, page_context, started_at, ended_at) VALUES (?, ?, 'visual', ?, ?, ?)",
                            [key, log.user_id, log.page_path ? String(log.page_path).slice(0, 100) : null, log.created_at, log.created_at]);
                        ids.set(key, created.insertId);
                    }
                    const sessionId = ids.get(key);
                    await this.run('UPDATE bot_sessions SET ended_at = ?, user_id = COALESCE(user_id, ?) WHERE session_id = ?', [log.created_at, log.user_id, sessionId]);
                    await this.run("INSERT INTO bot_messages (session_id, sender, input_type, content, created_at) VALUES (?, 'user', 'text', ?, ?)", [sessionId, log.user_message, log.created_at]);
                    if (log.bot_reply) {
                        await this.run("INSERT INTO bot_messages (session_id, sender, input_type, content, created_at) VALUES (?, 'assistant', 'text', ?, ?)", [sessionId, log.bot_reply, log.created_at]);
                    }
                }
            }
        } catch (e) {
            console.warn('[Database] 32-table backfill skipped:', e.message);
        }

        if (mysql) await this.ensureStoreTriggers();
    }

    // MySQL triggers (same as the migration): stores.type_id follows disability_type, and the
    // support_goals row follows the goal columns on stores, whichever code path writes stores.
    async ensureStoreTriggers() {
        const triggers = {
            trg_stores_type_id_insert: `CREATE TRIGGER trg_stores_type_id_insert BEFORE INSERT ON stores FOR EACH ROW
                BEGIN
                    SET NEW.type_id = (SELECT id FROM disability_types WHERE code = NEW.disability_type LIMIT 1);
                END`,
            trg_stores_type_id_update: `CREATE TRIGGER trg_stores_type_id_update BEFORE UPDATE ON stores FOR EACH ROW
                BEGIN
                    IF NOT (NEW.disability_type <=> OLD.disability_type) THEN
                        SET NEW.type_id = (SELECT id FROM disability_types WHERE code = NEW.disability_type LIMIT 1);
                    END IF;
                END`,
            trg_stores_goal_insert: `CREATE TRIGGER trg_stores_goal_insert AFTER INSERT ON stores FOR EACH ROW
                BEGIN
                    IF NEW.support_goal_target > 0 AND NEW.support_goal_title IS NOT NULL AND NEW.support_goal_title <> '' THEN
                        INSERT INTO support_goals (store_id, title, target_amount, current_amount, start_date, status)
                        VALUES (NEW.id, LEFT(NEW.support_goal_title, 150), NEW.support_goal_target, COALESCE(NEW.support_goal_current, 0), CURDATE(), 'active');
                    END IF;
                END`,
            trg_stores_goal_update: `CREATE TRIGGER trg_stores_goal_update AFTER UPDATE ON stores FOR EACH ROW
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
                END`
        };
        try {
            const existing = new Set((await this.all(
                'SELECT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema = DATABASE()'
            )).map(t => t.name || t.TRIGGER_NAME));
            for (const [name, sql] of Object.entries(triggers)) {
                if (!existing.has(name)) await this.run(sql);
            }
        } catch (e) {
            console.warn('[Database] Store triggers not created:', e.message);
        }
    }

    // Story videos used to be 4 columns on stores. Copy them into store_videos once, then drop the columns.
    async moveStoreVideosToOwnTable() {
        try {
            await this.get('SELECT story_video_url FROM stores LIMIT 1');
        } catch (e) {
            return;   // already moved
        }
        try {
            await this.run(`
                INSERT INTO store_videos (store_id, video_url, source, transcript, captions_url, captions_status)
                SELECT s.id, s.story_video_url,
                       CASE WHEN s.story_video_url LIKE '%youtu%' THEN 'youtube'
                            WHEN s.story_video_url LIKE '/videos/stories/%' THEN 'sample' ELSE 'upload' END,
                       s.story_video_transcript, s.story_video_captions_url, s.story_video_captions_status
                FROM stores s
                WHERE s.story_video_url IS NOT NULL AND s.story_video_url != ''
                  AND NOT EXISTS (SELECT 1 FROM store_videos v WHERE v.store_id = s.id)`);
            const missing = await this.get(`SELECT COUNT(*) as n FROM stores s
                WHERE s.story_video_url IS NOT NULL AND s.story_video_url != ''
                  AND NOT EXISTS (SELECT 1 FROM store_videos v WHERE v.store_id = s.id)`);
            if (Number(missing.n) > 0) throw new Error(`${missing.n} videos were not copied`);
            for (const column of ['story_video_url', 'story_video_transcript', 'story_video_captions_url', 'story_video_captions_status']) {
                await this.run(`ALTER TABLE stores DROP COLUMN ${column}`);
            }
            console.log('[Database] Moved store story videos into store_videos');
        } catch (err) {
            console.warn('[Database] Could not move story videos to store_videos:', err.message);
        }
    }

    async ensureColumn(table, column, definition) {
        try {
            await this.get(`SELECT ${column} FROM ${table} LIMIT 1`);
        } catch (e) {
            try {
                await this.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                console.log(`[Database] Added column ${table}.${column}`);
            } catch (err) {
                console.warn(`[Database] Could not add ${table}.${column}:`, err.message);
            }
        }
    }

    async initMySQLTables() {
        const schemaPath = path.join(__dirname, '../db/schema.sql');
        let schemaSql = fs.readFileSync(schemaPath, 'utf8');
        schemaSql = schemaSql.replace(/AUTOINCREMENT/g, 'AUTO_INCREMENT');

        const statements = schemaSql
            .split(';')
            .map(s => s.replace(/^\s*--[^\n]*$/gm, '').trim()) // drop comment lines, keep the statement
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await pool.query(statement);
            } catch (e) {
                // Table might exist
            }
        }

        const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
        if (users[0].count === 0) {
            console.log('🌱 [Database] Seeding initial marketplace data into MySQL...');
            await this.seedAll();
        }
    }

    async initSQLiteTables() {
        const schemaPath = path.join(__dirname, '../db/schema.sqlite.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await new Promise((resolve, reject) => {
            sqliteDb.exec(schemaSql, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        const userCount = await this.get('SELECT COUNT(*) as count FROM users');
        if (!userCount || userCount.count === 0) {
            console.log('🌱 [Database] Seeding initial marketplace data into SQLite...');
            await this.seedAll();
        }
    }

    async seedAll() {
        const seed = await getSeedData();

        for (const u of seed.users) {
            await this.run(
                `INSERT INTO users (id, email, password_hash, full_name, phone, role, avatar_url, bio, disability_consent, consent_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${u.disability_consent ? 'CURRENT_TIMESTAMP' : 'NULL'})`,
                [u.id, u.email, u.password_hash, u.full_name, u.phone, u.role, u.avatar_url, u.bio, u.disability_consent ? 1 : 0]
            );
        }

        for (const s of seed.stores) {
            await this.run(
                `INSERT INTO stores (id, user_id, store_name, disability_type, story, craft_technique, support_goal_title, support_goal_target, support_goal_current, verification_status, phone, province, address, avatar_image, cover_image)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [s.id, s.user_id, s.store_name, s.disability_type, s.story, s.craft_technique, s.support_goal_title, s.support_goal_target, s.support_goal_current, s.verification_status, s.phone, s.province, s.address, s.avatar_image, s.cover_image]
            );
        }

        // DEMO DATA: approved demo stores get a placeholder verification document (not a real ID card)
        const { DOCUMENT_DIR } = require('../services/storeDocuments');
        const placeholder = path.join(__dirname, '../db/demo-documents/demo-verification-placeholder.pdf');
        if (fs.existsSync(placeholder)) {
            fs.copyFileSync(placeholder, path.join(DOCUMENT_DIR, 'demo-verification-placeholder.pdf'));
            for (const st of seed.stores.filter(x => x.verification_status === 'approved')) {
                await this.run(
                    `INSERT INTO store_documents (store_id, doc_type, file_path, original_name, mime_type, file_size)
                     VALUES (?, 'disability_card', 'demo-verification-placeholder.pdf', 'เอกสารตัวอย่าง (Demo).pdf', 'application/pdf', ?)`,
                    [st.id, fs.statSync(placeholder).size]
                );
            }
        }

        for (const c of seed.categories) {
            await this.run(
                `INSERT INTO categories (id, name, description, icon) VALUES (?, ?, ?, ?)`,
                [c.id, c.name, c.description, c.icon]
            );
        }

        for (const p of seed.products) {
            await this.run(
                `INSERT INTO products (id, store_id, category_id, name, story, description, price, stock, image_url, model_3d_url, dimensions, weight, is_featured, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [p.id, p.store_id, p.category_id, p.name, p.story, p.description, p.price, p.stock, p.image_url, p.model_3d_url, p.dimensions, p.weight, p.is_featured, p.is_active]
            );
        }

        for (const camp of seed.campaigns) {
            await this.run(
                `INSERT INTO campaigns (id, title, description, location, start_date, end_date, event_type, image_url, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [camp.id, camp.title, camp.description, camp.location, camp.start_date, camp.end_date, camp.event_type, camp.image_url, camp.is_active]
            );
        }

        for (const cp of seed.campaign_participants) {
            await this.run(
                `INSERT INTO campaign_participants (campaign_id, store_id, status, booth_number)
                 VALUES (?, ?, ?, ?)`,
                [cp.campaign_id, cp.store_id, cp.status, cp.booth_number]
            );
        }

        for (const r of seed.reviews) {
            await this.run(
                `INSERT INTO reviews (id, product_id, buyer_id, rating, comment, seller_reply, seller_replied_at, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [r.id, r.product_id, r.buyer_id, r.rating, r.comment, r.seller_reply, r.seller_replied_at, r.status]
            );
        }

        for (const o of seed.orders) {
            await this.run(
                `INSERT INTO orders (id, buyer_id, store_id, subtotal, tip_amount, shipping_cost, grand_total, status, shipping_name, shipping_phone, shipping_address, payment_method, tracking_number, courier_name, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [o.id, o.buyer_id, o.store_id, o.subtotal, o.tip_amount, o.shipping_cost, o.grand_total, o.status, o.shipping_name, o.shipping_phone, o.shipping_address, o.payment_method, o.tracking_number, o.courier_name, o.notes]
            );
        }

        for (const oi of seed.order_items) {
            await this.run(
                `INSERT INTO order_items (id, order_id, product_id, product_name, product_image, quantity, unit_price, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [oi.id, oi.order_id, oi.product_id, oi.product_name, oi.product_image, oi.quantity, oi.unit_price, oi.subtotal]
            );
        }

        if (seed.favorites && seed.favorites.length > 0) {
            for (const f of seed.favorites) {
                await this.run(
                    `INSERT INTO favorites (id, user_id, product_id, created_at)
                     VALUES (?, ?, ?, ?)`,
                    [f.id, f.user_id, f.product_id, f.created_at]
                );
            }
        }

        if (seed.chat_messages && seed.chat_messages.length > 0) {
            for (const m of seed.chat_messages) {
                await this.run(
                    `INSERT INTO chat_messages (id, sender_id, receiver_id, store_id, sender_role, message, is_read, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [m.id, m.sender_id, m.receiver_id, m.store_id, m.sender_role, m.message, m.is_read, m.created_at]
                );
            }
        }

        for (const m of seed.matching_preferences || []) {
            await this.run('INSERT INTO matching_preferences (user_id, type_id, category_id) VALUES (?, ?, ?)', [m.user_id, m.type_id, m.category_id]);
        }
        for (const a of seed.accessibility_settings || []) {
            await this.run(
                `INSERT INTO accessibility_settings (user_id, font_size, contrast_mode, voice_enabled, reduce_motion,
                    dyslexia_font, highlight_links, text_spacing, big_cursor, easy_mode, focus_reading, show_tooltips, speech_rate)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [a.user_id, a.font_size, a.contrast_mode, a.voice_enabled, a.reduce_motion,
                    a.dyslexia_font || 0, a.highlight_links || 0, a.text_spacing || 0, a.big_cursor || 0, a.easy_mode || 0, a.focus_reading || 0, a.show_tooltips || 0, a.speech_rate || 1]
            );
        }
        for (const b of seed.bot_sessions || []) {
            await this.run(
                'INSERT INTO bot_sessions (session_id, client_session_key, user_id, assist_mode, page_context, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [b.session_id, b.client_session_key, b.user_id, b.assist_mode, b.page_context, b.started_at, b.ended_at]
            );
        }
        for (const m of seed.bot_messages || []) {
            await this.run(
                'INSERT INTO bot_messages (session_id, sender, input_type, content, created_at) VALUES (?, ?, ?, ?, ?)',
                [m.session_id, m.sender, m.input_type, m.content, m.created_at]
            );
        }
        for (const h of seed.search_history || []) {
            await this.run(
                'INSERT INTO search_history (user_id, query, source, input_type, filters, results_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [h.user_id, h.query, h.source, h.input_type, h.filters, h.results_count, h.created_at]
            );
        }
        // support_goals, store_verifications, order_status_history and chat_rooms are filled from the rows
        // above by alignWith32TableDesign() right after seeding

        console.log('✅ [Database] Seed data successfully populated!');
    }


    async query(sql, params = []) {
        return this.all(sql, params);
    }

    async all(sql, params = []) {
        if (dbDriver === 'mysql') {
            const [rows] = await pool.query(sql, params);
            return rows;
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });
        }
    }

    async get(sql, params = []) {
        if (dbDriver === 'mysql') {
            const [rows] = await pool.query(sql, params);
            return rows[0] || null;
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.get(sql, params, (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                });
            });
        }
    }

    async run(sql, params = []) {
        if (dbDriver === 'mysql') {
            const [result] = await pool.query(sql, params);
            return {
                insertId: result.insertId,
                affectedRows: result.affectedRows
            };
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.run(sql, params, function (err) {
                    if (err) return reject(err);
                    resolve({
                        insertId: this.lastID,
                        affectedRows: this.changes
                    });
                });
            });
        }
    }

    getDriver() {
        return dbDriver;
    }
}

const db = new Database();
module.exports = db;
