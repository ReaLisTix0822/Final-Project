const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/admin/stats (Platform overview dashboard statistics)
router.get('/stats', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const totalSales = await db.get('SELECT COALESCE(SUM(grand_total), 0) as total, COALESCE(SUM(tip_amount), 0) as total_tips FROM orders');
        const ordersCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status = "paid" THEN 1 ELSE 0 END) as pending_shipment, SUM(CASE WHEN status IN ("shipped", "delivered", "completed") THEN 1 ELSE 0 END) as shipped FROM orders');
        const storesCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN verification_status = "approved" THEN 1 ELSE 0 END) as verified, SUM(CASE WHEN verification_status = "pending" THEN 1 ELSE 0 END) as pending FROM stores');
        const productsCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN model_3d_url IS NOT NULL AND model_3d_url != "" THEN 1 ELSE 0 END) as with_3d FROM products WHERE is_active = 1');
        const usersCount = await db.get('SELECT COUNT(*) as total FROM users');
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

        const salesDaily = await db.all(`
            SELECT CAST(DATE(created_at) AS CHAR) AS date, COUNT(*) AS order_count,
                COALESCE(SUM(grand_total), 0) AS revenue
            FROM orders WHERE status IN ('paid', 'processing', 'preparing', 'shipped', 'delivered', 'completed')
            GROUP BY DATE(created_at) ORDER BY DATE(created_at)
        `);
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
router.get('/tables', async (req, res, next) => {
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
            'complaints'
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
router.get('/table/:tableName', async (req, res, next) => {
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
            'complaints'
        ];

        if (!allowedTables.includes(tableName)) {
            return res.status(400).json({ success: false, message: 'ไม่อนุญาตให้เข้าถึงตารางนี้' });
        }

        const rows = await db.all(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 100`);
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
        const users = await db.all('SELECT id, email, full_name, phone, role, created_at FROM users ORDER BY created_at DESC');
        res.json({ success: true, count: users.length, data: users });
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
            typeof phone !== 'string' || phone.trim().length > 20) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อ อีเมล และเบอร์โทรให้ถูกต้อง' });
        }
        if (!await db.get('SELECT id FROM users WHERE id = ?', [id])) return res.status(404).json({ success: false, message: 'ไม่พบสมาชิก' });
        if (await db.get('SELECT id FROM users WHERE email = ? AND id <> ?', [email.trim(), id])) {
            return res.status(409).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }
        await db.run('UPDATE users SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name.trim(), email.trim(), phone.trim(), id]);
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
        // Keep dependent records intact, including tables with cascading deletes.
        const result = await db.run(`DELETE FROM users WHERE id = ? AND role <> 'admin'
            AND NOT EXISTS (SELECT 1 FROM stores WHERE user_id = ?)
            AND NOT EXISTS (SELECT 1 FROM orders WHERE buyer_id = ?)
            AND NOT EXISTS (SELECT 1 FROM reviews WHERE buyer_id = ?)
            AND NOT EXISTS (SELECT 1 FROM favorites WHERE user_id = ?)
            AND NOT EXISTS (SELECT 1 FROM chat_messages WHERE sender_id = ? OR receiver_id = ?)`, Array(7).fill(id));
        if (!result.affectedRows) return res.status(409).json({ success: false, message: 'ไม่สามารถลบบัญชีที่มีร้านค้า คำสั่งซื้อ หรือประวัติการใช้งานผูกอยู่' });
        res.json({ success: true, message: 'ลบบัญชีสมาชิกแล้ว' });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/stores
router.get('/stores', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const stores = await db.all(`
            SELECT s.*, u.full_name as owner_name, u.email as owner_email
            FROM stores s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC
        `);
        res.json({ success: true, count: stores.length, data: stores });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/stores/:id/verify
router.put('/stores/:id/verify', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const storeId = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isSafeInteger(storeId) || storeId < 1 || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'รหัสร้านค้าหรือสถานะไม่ถูกต้อง' });
        }
        if (!await db.get('SELECT id FROM stores WHERE id = ?', [storeId])) {
            return res.status(404).json({ success: false, message: 'ไม่พบร้านค้า' });
        }
        await db.run('UPDATE stores SET verification_status = ? WHERE id = ?', [status, storeId]);
        res.json({ success: true, message: `อัปเดตสถานะการยืนยันตัวตนร้านค้าเป็น ${status === 'approved' ? 'อนุมัติแล้ว' : 'ระงับ / ไม่อนุมัติ'} เรียบร้อยแล้ว` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
