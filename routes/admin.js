const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { notify } = require('../services/notificationService');
const { cleanPhone } = require('../services/phone');
const { DOC_TYPE_LABELS, sendStoreDocument, recordVerificationDecision } = require('../services/storeDocuments');
const { getSellerRevenueDaily } = require('../services/salesStats');

// GET /api/admin/stats (Platform overview dashboard statistics)
router.get('/stats', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const totalSales = await db.get(`
            SELECT COALESCE(SUM(grand_total), 0) as total,
                   (SELECT COALESCE(SUM(amount), 0) FROM tips) as total_tips
            FROM orders`);
        const ordersCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status = "paid" THEN 1 ELSE 0 END) as pending_shipment, SUM(CASE WHEN status IN ("shipped", "delivered", "completed") THEN 1 ELSE 0 END) as shipped FROM orders');
        const storesCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN verification_status = "approved" THEN 1 ELSE 0 END) as verified, SUM(CASE WHEN verification_status = "pending" THEN 1 ELSE 0 END) as pending FROM stores');
        const productsCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN model_3d_url IS NOT NULL AND model_3d_url != "" THEN 1 ELSE 0 END) as with_3d FROM products WHERE is_active = 1');
        // Sellers still waiting for approval are applicants, not members yet
        const usersCount = await db.get("SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.user_id = users.id AND s.verification_status = 'pending')");
        const orderStatuses = await db.all('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
        const approvedStores = await db.all("SELECT id, store_name, disability_type FROM stores WHERE verification_status = 'approved' ORDER BY id LIMIT 6");

        const recentOrders = await db.all(`
            SELECT o.*, u.full_name as buyer_name, s.store_name
            FROM orders o
            JOIN users u ON o.buyer_id = u.id
            JOIN stores s ON o.store_id = s.id
            ORDER BY o.created_at DESC
            LIMIT 5
        `);

        const storesByDisability = await db.all(`
            SELECT disability_type, COUNT(*) as count 
            FROM stores 
            GROUP BY disability_type
        `);

        // Same formula as the homepage: subtotal + tips of paid orders, without shipping (services/salesStats.js)
        const salesDaily = await getSellerRevenueDaily();
        const salesRevenue = salesDaily.reduce((sum, row) => sum + Number(row.revenue), 0);
        const paidOrderCount = salesDaily.reduce((sum, row) => sum + Number(row.order_count), 0);

        res.json({
            success: true,
            data: {
                total_revenue: totalSales.total,
                sales_revenue: salesRevenue,
                paid_order_count: paidOrderCount,
                average_order_value: paidOrderCount ? salesRevenue / paidOrderCount : 0,
                sales_daily: salesDaily,
                total_tips: totalSales.total_tips,
                total_orders: ordersCount.total,
                shipped_orders: ordersCount.shipped || 0,
                pending_shipment_orders: ordersCount.pending_shipment || 0,
                total_stores: storesCount.total,
                verified_stores: storesCount.verified || 0,
                pending_stores: storesCount.pending || 0,
                total_products: productsCount.total,
                products_with_3d: productsCount.with_3d || 0,
                total_users: usersCount.total,
                recent_orders: recentOrders,
                order_statuses: orderStatuses,
                approved_stores: approvedStores,
                stores_by_disability: storesByDisability,
                database_driver: db.getDriver()
            }
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/tables (List all available database tables & row counts)
router.get('/tables', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const tableNames = [
            'users',
            'stores',
            'categories',
            'products',
            'orders',
            'order_items',
            'reviews',
            'favorites',
            'campaigns',
            'campaign_participants',
            'chat_messages',
            'disability_types',
            'product_images',
            'product_3d_models',
            'addresses',
            'cart_items',
            'payments',
            'shipping_tracking',
            'tips',
            'follows',
            'matching_preferences',
            'reports',
            'notifications',
            'chatbot_logs',
            'search_history',
            // the rest of the 32 tables in the report (db/migrations/20261019_align_32_tables.md)
            'complaints',
            'store_videos',
            'accessibility_settings',
            'store_verifications',
            'support_goals',
            'order_status_history',
            'chat_rooms',
            'bot_sessions',
            'bot_messages'
        ];

        const tablesInfo = [];
        for (const name of tableNames) {
            try {
                const countRes = await db.get(`SELECT COUNT(*) as total FROM ${name}`);
                tablesInfo.push({
                    name,
                    total_rows: countRes ? countRes.total : 0
                });
            } catch (e) {
                // Table might not exist yet
            }
        }

        res.json({
            success: true,
            database_driver: db.getDriver(),
            tables: tablesInfo
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/table/:tableName (Inspect all records of a specific table)
router.get('/table/:tableName', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { tableName } = req.params;
        const allowedTables = [
            'users',
            'stores',
            'categories',
            'products',
            'orders',
            'order_items',
            'reviews',
            'favorites',
            'campaigns',
            'campaign_participants',
            'chat_messages',
            'disability_types',
            'product_images',
            'product_3d_models',
            'addresses',
            'cart_items',
            'payments',
            'shipping_tracking',
            'tips',
            'follows',
            'matching_preferences',
            'reports',
            'notifications',
            'chatbot_logs',
            'search_history',
            // the rest of the 32 tables in the report (db/migrations/20261019_align_32_tables.md)
            'complaints',
            'store_videos',
            'accessibility_settings',
            'store_verifications',
            'support_goals',
            'order_status_history',
            'chat_rooms',
            'bot_sessions',
            'bot_messages'
        ];

        if (!allowedTables.includes(tableName)) {
            return res.status(400).json({ success: false, message: 'ไม่อนุญาตให้เข้าถึงตารางนี้' });
        }

        // Tables added from the report keep the report's primary key names
        const primaryKey = {
            accessibility_settings: 'setting_id', store_verifications: 'verification_id', support_goals: 'goal_id',
            order_status_history: 'history_id', chat_rooms: 'chat_id', bot_sessions: 'session_id', bot_messages: 'bot_message_id'
        }[tableName] || 'id';
        const rows = await db.all(`SELECT * FROM ${tableName} ORDER BY ${primaryKey} DESC LIMIT 100`);
        res.json({
            success: true,
            table: tableName,
            count: rows.length,
            data: rows
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/users
router.get('/users', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        // Sellers whose store is still pending approval are listed under store management only
        // Closed (soft-deleted) accounts are not members any more
        const users = await db.all(`SELECT id, email, full_name, phone, role, created_at FROM users
            WHERE deleted_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.user_id = users.id AND s.verification_status = 'pending')
            ORDER BY created_at DESC`);
        res.json({ success: true, count: users.length, data: users });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/users/:id/activity - Profile, statistics and usage history of one member
router.get('/users/:id/activity', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'รหัสสมาชิกไม่ถูกต้อง' });
        const user = await db.get(
            'SELECT id, email, full_name, phone, role, avatar_url, bio, created_at, updated_at, last_login_at FROM users WHERE id = ?', [id]);
        if (!user) return res.status(404).json({ success: false, message: 'ไม่พบสมาชิก' });

        const num = value => Number(value) || 0;
        const one = async (sql, params = [id]) => (await db.get(sql, params)) || {};

        const store = user.role === 'seller' ? await db.get(`
            SELECT s.id, s.store_name, s.verification_status, s.rejection_reason, s.created_at, s.province,
                   s.support_goal_current, s.support_goal_target, COALESCE(dt.label, dt.name) as disability_name,
                   (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id) as product_count,
                   (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) as order_count,
                   (SELECT COALESCE(SUM(o.grand_total), 0) FROM orders o WHERE o.store_id = s.id AND o.status <> 'cancelled') as revenue,
                   (SELECT COUNT(*) FROM follows f WHERE f.store_id = s.id) as follower_count
            FROM stores s LEFT JOIN disability_types dt ON dt.code = s.disability_type
            WHERE s.user_id = ?`, [id]) : null;

        const [orders, storeOrders, reviews, tips, favorites, follows, searches, chatbot, logins, addresses, reports, complaints] = await Promise.all([
            db.all(`SELECT o.id, o.status, o.grand_total, o.tip_amount, o.payment_method, o.created_at, s.store_name,
                           (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) as item_count
                    FROM orders o LEFT JOIN stores s ON s.id = o.store_id WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 50`, [id]),
            store ? db.all(`SELECT o.id, o.status, o.grand_total, o.created_at, u.full_name as buyer_name
                            FROM orders o LEFT JOIN users u ON u.id = o.buyer_id WHERE o.store_id = ? ORDER BY o.created_at DESC LIMIT 50`, [store.id]) : [],
            db.all(`SELECT r.id, r.rating, r.comment, r.status, r.created_at, r.product_id, p.name as product_name
                    FROM reviews r LEFT JOIN products p ON p.id = r.product_id WHERE r.buyer_id = ? ORDER BY r.created_at DESC LIMIT 50`, [id]),
            db.all(`SELECT t.id, t.amount, t.order_id, t.created_at, s.store_name
                    FROM tips t LEFT JOIN stores s ON s.id = t.store_id WHERE t.buyer_id = ? ORDER BY t.created_at DESC LIMIT 50`, [id]),
            db.all(`SELECT f.product_id, f.created_at, p.name as product_name
                    FROM favorites f LEFT JOIN products p ON p.id = f.product_id WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT 50`, [id]),
            db.all(`SELECT f.store_id, f.created_at, s.store_name
                    FROM follows f LEFT JOIN stores s ON s.id = f.store_id WHERE f.buyer_id = ? ORDER BY f.created_at DESC LIMIT 50`, [id]),
            db.all('SELECT query, source, results_count, created_at FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [id]),
            db.all('SELECT user_message, source, created_at FROM chatbot_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [id]),
            db.all('SELECT status, ip_address, user_agent, created_at FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [id]),
            db.all('SELECT label, recipient_name, province, is_default FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id', [id]),
            db.all('SELECT target_type, target_id, reason, status, created_at FROM reports WHERE reporter_id = ? ORDER BY created_at DESC LIMIT 30', [id]),
            db.all('SELECT id, category, subject, status, created_at FROM complaints WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [id])
        ]);

        const totals = await one(`SELECT
            (SELECT COUNT(*) FROM orders WHERE buyer_id = ?) as orders,
            (SELECT COALESCE(SUM(grand_total), 0) FROM orders WHERE buyer_id = ? AND status <> 'cancelled') as spent,
            (SELECT COUNT(*) FROM reviews WHERE buyer_id = ?) as reviews,
            (SELECT COALESCE(SUM(amount), 0) FROM tips WHERE buyer_id = ?) as tips,
            (SELECT COUNT(*) FROM favorites WHERE user_id = ?) as favorites,
            (SELECT COUNT(*) FROM follows WHERE buyer_id = ?) as follows,
            (SELECT COUNT(*) FROM search_history WHERE user_id = ?) as searches,
            (SELECT COUNT(*) FROM chatbot_logs WHERE user_id = ?) as chatbot,
            (SELECT COUNT(*) FROM chat_messages WHERE sender_id = ?) as messages,
            (SELECT COUNT(*) FROM login_history WHERE user_id = ? AND status = 'success') as logins`, Array(10).fill(id));

        // One merged, newest-first timeline of everything this member did
        const timeline = [
            { type: 'register', at: user.created_at, text: 'สมัครสมาชิก' },
            ...orders.map(o => ({ type: 'order', at: o.created_at, text: `สั่งซื้อ #${o.id} จาก ${o.store_name || 'ร้านค้า'} ยอด ฿${num(o.grand_total).toLocaleString('th-TH')}`, link: null })),
            ...reviews.map(r => ({ type: 'review', at: r.created_at, text: `รีวิว ${r.rating} ดาว: ${r.product_name || 'สินค้า'}`, link: `/product-detail.html?id=${r.product_id}` })),
            ...tips.filter(t => !t.order_id).map(t => ({ type: 'tip', at: t.created_at, text: `สนับสนุนเงิน ฿${num(t.amount).toLocaleString('th-TH')} ให้ ${t.store_name || 'ร้านค้า'}` })),
            ...favorites.map(f => ({ type: 'favorite', at: f.created_at, text: `ถูกใจ ${f.product_name || 'สินค้า'}`, link: `/product-detail.html?id=${f.product_id}` })),
            ...follows.map(f => ({ type: 'follow', at: f.created_at, text: `ติดตามร้าน ${f.store_name || ''}`, link: `/store-detail.html?id=${f.store_id}` })),
            ...searches.map(q => ({ type: 'search', at: q.created_at, text: `ค้นหา "${q.query}"${q.results_count != null ? ` (พบ ${q.results_count} รายการ)` : ''}` })),
            ...chatbot.map(c => ({ type: 'chatbot', at: c.created_at, text: `ถามแชทบอท: ${String(c.user_message).slice(0, 80)}` })),
            ...logins.map(l => ({ type: 'login', at: l.created_at, text: { success: 'เข้าสู่ระบบ', wrong_password: 'เข้าสู่ระบบไม่สำเร็จ (รหัสผ่านผิด)', blocked: 'เข้าสู่ระบบไม่ได้ (ร้านยังไม่อนุมัติ)' }[l.status] || l.status })),
            ...reports.map(r => ({ type: 'report', at: r.created_at, text: `รายงานปัญหา: ${String(r.reason).slice(0, 80)}` })),
            ...complaints.map(c => ({ type: 'report', at: c.created_at, text: `ส่งเรื่องร้องเรียน #${c.id}: ${String(c.subject).slice(0, 80)}`, link: `/admin-complaints.html?id=${c.id}` }))
        ].filter(e => e.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 150);

        res.json({
            success: true,
            data: {
                user,
                store: store && { ...store, product_count: num(store.product_count), order_count: num(store.order_count), revenue: num(store.revenue), follower_count: num(store.follower_count) },
                stats: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, num(v)])),
                orders, store_orders: storeOrders, reviews, tips, favorites, follows, searches, chatbot, logins, addresses, reports, complaints, timeline
            }
        });
    } catch (err) {
        next(err);
    }
});

// User management requires server-side administrator authorization.
router.put('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const { full_name, email, phone = '' } = req.body;
        if (!Number.isSafeInteger(id) || id < 1 || typeof full_name !== 'string' || !full_name.trim() || full_name.trim().length > 100 ||
            typeof email !== 'string' || email.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            typeof phone !== 'string' || cleanPhone(phone) === null) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อ อีเมล และเบอร์โทรให้ถูกต้อง' });
        }
        if (!await db.get('SELECT id FROM users WHERE id = ?', [id])) return res.status(404).json({ success: false, message: 'ไม่พบสมาชิก' });
        if (await db.get('SELECT id FROM users WHERE email = ? AND id <> ?', [email.trim(), id])) {
            return res.status(409).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }
        await db.run('UPDATE users SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name.trim(), email.trim(), cleanPhone(phone), id]);
        res.json({ success: true, message: 'บันทึกข้อมูลสมาชิกแล้ว' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || (err.code === 'SQLITE_CONSTRAINT' && /UNIQUE/.test(err.message))) {
            return res.status(409).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }
        next(err);
    }
});

router.delete('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'รหัสสมาชิกไม่ถูกต้อง' });
        const user = await db.get('SELECT id, role FROM users WHERE id = ?', [id]);
        if (!user) return res.status(404).json({ success: false, message: 'ไม่พบสมาชิก' });
        if (Number(req.user.id) === id || user.role === 'admin') {
            return res.status(403).json({ success: false, message: 'ไม่สามารถลบบัญชีผู้ดูแลระบบหรือบัญชีตนเอง' });
        }
        // Records that matter to other people (store, orders, reviews, tips) block the delete
        const count = async sql => Number((await db.get(sql, [id])).total) || 0;
        const blockers = [
            [await count('SELECT COUNT(*) as total FROM stores WHERE user_id = ?'), n => 'มีร้านค้า'],
            [await count('SELECT COUNT(*) as total FROM orders WHERE buyer_id = ?'), n => `มีคำสั่งซื้อ ${n} รายการ`],
            [await count('SELECT COUNT(*) as total FROM reviews WHERE buyer_id = ?'), n => `มีรีวิว ${n} รายการ`],
            [await count('SELECT COUNT(*) as total FROM tips WHERE buyer_id = ?'), n => `มีประวัติสนับสนุนเงิน ${n} รายการ`]
        ].filter(([n]) => n > 0).map(([n, label]) => label(n));
        if (blockers.length) {
            return res.status(409).json({ success: false, message: `ไม่สามารถลบบัญชีนี้ได้ เพราะ${blockers.join(', ')}` });
        }

        // Personal data only: clear it, then delete the account
        await db.run('DELETE FROM chat_messages WHERE sender_id = ? OR receiver_id = ?', [id, id]);
        for (const table of ['favorites', 'cart_items', 'addresses', 'matching_preferences', 'notifications']) {
            await db.run(`DELETE FROM ${table} WHERE user_id = ?`, [id]);
        }
        await db.run('DELETE FROM follows WHERE buyer_id = ?', [id]);
        await db.run('DELETE FROM reports WHERE reporter_id = ?', [id]);
        await db.run('DELETE FROM complaints WHERE user_id = ?', [id]);
        await db.run('UPDATE chatbot_logs SET user_id = NULL WHERE user_id = ?', [id]);
        await db.run('UPDATE bot_sessions SET user_id = NULL WHERE user_id = ?', [id]);
        await db.run('UPDATE search_history SET user_id = NULL WHERE user_id = ?', [id]);
        const result = await db.run("DELETE FROM users WHERE id = ? AND role <> 'admin'", [id]);
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'ไม่พบสมาชิก' });
        res.json({ success: true, message: 'ลบบัญชีสมาชิกแล้ว' });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/stores
router.get('/stores', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const stores = await db.all(`
            SELECT s.*, u.full_name as owner_name, u.email as owner_email, COALESCE(dt.label, dt.name) as disability_name,
                   (SELECT COUNT(*) FROM store_documents d WHERE d.store_id = s.id) as document_count
            FROM stores s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN disability_types dt ON dt.code = s.disability_type
            ORDER BY s.created_at DESC
        `);
        res.json({ success: true, count: stores.length, data: stores });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/stores/:id/documents - Verification files the seller attached
router.get('/stores/:id/documents', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const storeId = Number(req.params.id);
        if (!Number.isSafeInteger(storeId) || storeId < 1) {
            return res.status(400).json({ success: false, message: 'รหัสร้านค้าไม่ถูกต้อง' });
        }
        const docs = await db.all(
            'SELECT id, doc_type, original_name, mime_type, file_size, created_at FROM store_documents WHERE store_id = ? ORDER BY id',
            [storeId]
        );
        res.json({ success: true, data: docs.map(d => ({ ...d, doc_label: DOC_TYPE_LABELS[d.doc_type] || d.doc_type })) });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/stores/:id/documents/:docId/file - Stream one document (admin only, never public)
router.get('/stores/:id/documents/:docId/file', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const doc = await db.get(
            'SELECT file_path, original_name, mime_type FROM store_documents WHERE id = ? AND store_id = ?',
            [Number(req.params.docId), Number(req.params.id)]
        );
        sendStoreDocument(res, doc);
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/stores/:id/verify
router.put('/stores/:id/verify', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const storeId = Number(req.params.id);
        const { status } = req.body;
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

        if (!Number.isSafeInteger(storeId) || storeId < 1 || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'รหัสร้านค้าหรือสถานะไม่ถูกต้อง' });
        }
        if (status === 'rejected' && (reason.length < 5 || reason.length > 500)) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ 5–500 ตัวอักษร' });
        }
        const store = await db.get('SELECT id, user_id, store_name, verification_status FROM stores WHERE id = ?', [storeId]);
        if (!store) {
            return res.status(404).json({ success: false, message: 'ไม่พบร้านค้า' });
        }
        if (store.verification_status === 'closed') {
            return res.status(409).json({ success: false, message: 'เจ้าของร้านลบบัญชีแล้ว จึงเปลี่ยนสถานะร้านนี้ไม่ได้' });
        }
        await db.run('UPDATE stores SET verification_status = ?, rejection_reason = ? WHERE id = ?',
            [status, status === 'rejected' ? reason : null, storeId]);
        await recordVerificationDecision(storeId, status, reason, req.user.id);
        if (status === 'rejected') {
            await notify(store.user_id, {
                type: 'store_rejected',
                title: store.verification_status === 'approved' ? 'ร้านค้าของคุณถูกระงับ' : 'คำขอเปิดร้านค้าไม่ผ่านการอนุมัติ',
                message: `เหตุผล: ${reason}`,
                link: '/login.html'
            });
        }
        if (status === 'approved' && store.verification_status !== 'approved') {
            await notify(store.user_id, {
                type: 'store_approved',
                title: 'ร้านค้าของคุณได้รับการอนุมัติแล้ว',
                message: `ยินดีต้อนรับ ${store.store_name} สู่ตลาดใจ เริ่มลงสินค้าได้เลย`,
                link: '/seller-dashboard.html'
            });
        }
        res.json({ success: true, message: `อัปเดตสถานะการยืนยันตัวตนร้านค้าเป็น ${status === 'approved' ? 'อนุมัติแล้ว' : 'ระงับ / ไม่อนุมัติ'} เรียบร้อยแล้ว` });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/products - Every product, including ones hidden by the seller or removed by an admin
router.get('/products', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const products = await db.all(`
            SELECT p.id, p.name, p.price, p.stock, p.image_url, p.is_active, p.removed_by_admin, p.removal_reason, p.removed_at, p.created_at,
                   s.id as store_id, s.store_name, u.full_name as owner_name, c.name as category_name,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = p.id) as order_count,
                   (SELECT COUNT(*) FROM reports rp WHERE rp.target_type = 'product' AND rp.target_id = p.id) as report_count
            FROM products p
            LEFT JOIN stores s ON s.id = p.store_id
            LEFT JOIN users u ON u.id = s.user_id
            LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY p.removed_by_admin ASC, report_count DESC, p.created_at DESC
        `);
        res.json({
            success: true,
            data: products.map(p => ({
                ...p, price: Number(p.price), stock: Number(p.stock), is_active: Boolean(Number(p.is_active)),
                removed_by_admin: Boolean(Number(p.removed_by_admin)), order_count: Number(p.order_count) || 0, report_count: Number(p.report_count) || 0
            }))
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/products/:id/remove - Take a product off the marketplace (e.g. illegal goods).
// The row stays so past orders keep their history; the seller cannot put it back on sale.
router.put('/products/:id/remove', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'รหัสสินค้าไม่ถูกต้อง' });
        if (reason.length < 5 || reason.length > 500) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผลที่นำสินค้าออก 5–500 ตัวอักษร' });
        }
        const product = await db.get(
            'SELECT p.id, p.name, s.user_id as owner_id FROM products p LEFT JOIN stores s ON s.id = p.store_id WHERE p.id = ?', [id]);
        if (!product) return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });

        await db.run('UPDATE products SET is_active = 0, removed_by_admin = 1, removal_reason = ?, removed_at = CURRENT_TIMESTAMP WHERE id = ?', [reason, id]);
        await db.run('DELETE FROM cart_items WHERE product_id = ?', [id]);
        await db.run(`UPDATE reports SET status = 'resolved' WHERE target_type = 'product' AND target_id = ? AND status IN ('pending', 'reviewing')`, [id]);
        await notify(product.owner_id, {
            type: 'product_removed',
            title: `สินค้า "${product.name}" ถูกนำออกจากตลาดใจ`,
            message: `เหตุผล: ${reason}`,
            link: '/seller-dashboard.html'
        });
        res.json({ success: true, message: `นำ "${product.name}" ออกจากเว็บไซต์แล้ว และแจ้งผู้ขายเรียบร้อย` });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/products/:id/restore - Undo an admin removal (the product goes back on sale)
router.put('/products/:id/restore', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const product = await db.get(
            'SELECT p.id, p.name, p.removed_by_admin, s.user_id as owner_id FROM products p LEFT JOIN stores s ON s.id = p.store_id WHERE p.id = ?', [id]);
        if (!product) return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
        if (!Number(product.removed_by_admin)) return res.status(400).json({ success: false, message: 'สินค้านี้ไม่ได้ถูกนำออกโดยผู้ดูแลระบบ' });
        await db.run('UPDATE products SET is_active = 1, removed_by_admin = 0, removal_reason = NULL, removed_at = NULL WHERE id = ?', [id]);
        await notify(product.owner_id, {
            type: 'product_restored',
            title: `สินค้า "${product.name}" กลับมาแสดงบนตลาดใจแล้ว`,
            message: 'ผู้ดูแลระบบตรวจสอบและคืนสถานะสินค้าเรียบร้อย',
            link: `/product-detail.html?id=${id}`
        });
        res.json({ success: true, message: `คืนสถานะ "${product.name}" แล้ว` });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/products/:id - Permanent delete, only for products nobody has ordered
// (deleting an ordered product would also erase those orders' line items)
router.delete('/products/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        const product = await db.get(
            'SELECT p.id, p.name, s.user_id as owner_id FROM products p LEFT JOIN stores s ON s.id = p.store_id WHERE p.id = ?', [id]);
        if (!product) return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
        const ordered = await db.get('SELECT COUNT(*) as total FROM order_items WHERE product_id = ?', [id]);
        if (Number(ordered.total) > 0) {
            return res.status(409).json({ success: false, message: `ลบถาวรไม่ได้ เพราะมีคำสั่งซื้อ ${ordered.total} รายการอ้างอิงสินค้านี้ ใช้ "นำสินค้าออก" แทน` });
        }
        const reviewed = await db.get('SELECT COUNT(*) as total FROM reviews WHERE product_id = ?', [id]);
        if (Number(reviewed.total) > 0) {
            return res.status(409).json({ success: false, message: `ลบถาวรไม่ได้ เพราะมีรีวิว ${reviewed.total} รายการอ้างอิงสินค้านี้ ใช้ "นำสินค้าออก" แทน` });
        }
        await db.run('DELETE FROM products WHERE id = ?', [id]);
        await notify(product.owner_id, {
            type: 'product_removed',
            title: `สินค้า "${product.name}" ถูกลบโดยผู้ดูแลระบบ`,
            message: reason ? `เหตุผล: ${reason}` : 'ติดต่อผู้ดูแลระบบหากมีข้อสงสัย',
            link: '/seller-dashboard.html'
        });
        res.json({ success: true, message: `ลบ "${product.name}" ถาวรแล้ว` });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/reviews - Every review on the platform (including hidden ones)
router.get('/reviews', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const reviews = await db.all(`
            SELECT r.id, r.product_id, r.buyer_id, r.rating, r.comment, r.seller_reply, r.seller_replied_at,
                   COALESCE(r.status, 'approved') as status, r.created_at,
                   p.name as product_name, p.image_url as product_image,
                   s.id as store_id, s.store_name,
                   u.full_name as buyer_name, u.email as buyer_email, u.avatar_url as buyer_avatar,
                   (SELECT COUNT(*) FROM reports rp WHERE rp.target_type = 'review' AND rp.target_id = r.id) as report_count
            FROM reviews r
            LEFT JOIN products p ON p.id = r.product_id
            LEFT JOIN stores s ON s.id = p.store_id
            LEFT JOIN users u ON u.id = r.buyer_id
            ORDER BY r.created_at DESC, r.id DESC
        `);
        res.json({
            success: true,
            data: reviews.map(r => ({ ...r, rating: Number(r.rating), report_count: Number(r.report_count) || 0 }))
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/reviews/:id/status - Show (approved) or hide (hidden) a review on the public site
router.put('/reviews/:id/status', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const reviewId = Number(req.params.id);
        const { status } = req.body;
        if (!Number.isSafeInteger(reviewId) || reviewId < 1 || !['approved', 'hidden'].includes(status)) {
            return res.status(400).json({ success: false, message: 'รหัสรีวิวหรือสถานะไม่ถูกต้อง' });
        }
        if (!await db.get('SELECT id FROM reviews WHERE id = ?', [reviewId])) {
            return res.status(404).json({ success: false, message: 'ไม่พบรีวิว' });
        }
        await db.run('UPDATE reviews SET status = ? WHERE id = ?', [status, reviewId]);
        res.json({ success: true, message: status === 'hidden' ? 'ซ่อนรีวิวจากหน้าเว็บไซต์แล้ว' : 'แสดงรีวิวบนหน้าเว็บไซต์แล้ว' });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/reviews/:id - Remove a review permanently
router.delete('/reviews/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const reviewId = Number(req.params.id);
        if (!Number.isSafeInteger(reviewId) || reviewId < 1) {
            return res.status(400).json({ success: false, message: 'รหัสรีวิวไม่ถูกต้อง' });
        }
        const result = await db.run('DELETE FROM reviews WHERE id = ?', [reviewId]);
        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: 'ไม่พบรีวิว' });
        }
        res.json({ success: true, message: 'ลบรีวิวเรียบร้อยแล้ว' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
