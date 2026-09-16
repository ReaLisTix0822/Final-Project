const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/admin/stats (Platform overview dashboard statistics)
router.get('/stats', async (req, res, next) => {
    try {
        const totalSales = await db.get('SELECT COALESCE(SUM(grand_total), 0) as total, COALESCE(SUM(tip_amount), 0) as total_tips FROM orders');
        const ordersCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status = "paid" THEN 1 ELSE 0 END) as pending_shipment FROM orders');
        const storesCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN verification_status = "approved" THEN 1 ELSE 0 END) as verified, SUM(CASE WHEN verification_status = "pending" THEN 1 ELSE 0 END) as pending FROM stores');
        const productsCount = await db.get('SELECT COUNT(*) as total, SUM(CASE WHEN model_3d_url IS NOT NULL AND model_3d_url != "" THEN 1 ELSE 0 END) as with_3d FROM products WHERE is_active = 1');
        const usersCount = await db.get('SELECT COUNT(*) as total FROM users');

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

        res.json({
            success: true,
            data: {
                total_revenue: totalSales.total,
                total_tips: totalSales.total_tips,
                total_orders: ordersCount.total,
                pending_shipment_orders: ordersCount.pending_shipment || 0,
                total_stores: storesCount.total,
                verified_stores: storesCount.verified || 0,
                pending_stores: storesCount.pending || 0,
                total_products: productsCount.total,
                products_with_3d: productsCount.with_3d || 0,
                total_users: usersCount.total,
                recent_orders: recentOrders,
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
router.get('/users', async (req, res, next) => {
    try {
        const users = await db.all('SELECT id, email, full_name, phone, role, created_at FROM users ORDER BY created_at DESC');
        res.json({ success: true, count: users.length, data: users });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/stores
router.get('/stores', async (req, res, next) => {
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
router.put('/stores/:id/verify', async (req, res, next) => {
    try {
        const storeId = parseInt(req.params.id, 10);
        const { status } = req.body;

        await db.run('UPDATE stores SET verification_status = ? WHERE id = ?', [status, storeId]);
        res.json({ success: true, message: `อัปเดตสถานะการยืนยันตัวตนร้านค้าเป็น ${status} เรียบร้อยแล้ว` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
