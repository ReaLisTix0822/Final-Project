const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { notify } = require('../services/notificationService');

router.use(authenticate);

// GET /api/follows/ids - Store IDs the current user follows
router.get('/ids', async (req, res, next) => {
    try {
        const rows = await db.all('SELECT store_id FROM follows WHERE buyer_id = ?', [req.user.id]);
        res.json({ success: true, data: rows.map(r => Number(r.store_id)) });
    } catch (err) {
        next(err);
    }
});

// GET /api/follows/followers - Who follows the signed-in seller's store, with what they bought there.
// Only names/avatars are shared (no email or phone) to protect buyers' privacy.
router.get('/followers', async (req, res, next) => {
    try {
        if (req.user.role !== 'seller' || !req.store) {
            return res.status(403).json({ success: false, message: 'เฉพาะบัญชีผู้ขายที่มีร้านค้าเท่านั้น' });
        }
        const storeId = req.store.id;
        const rows = await db.all(`
            SELECT u.id, u.full_name, u.avatar_url, f.created_at as followed_at,
                   (SELECT COUNT(*) FROM orders o WHERE o.store_id = ? AND o.buyer_id = u.id AND o.status <> 'cancelled') as order_count,
                   (SELECT COALESCE(SUM(o.grand_total), 0) FROM orders o WHERE o.store_id = ? AND o.buyer_id = u.id AND o.status <> 'cancelled') as total_spent,
                   (SELECT COALESCE(SUM(t.amount), 0) FROM tips t WHERE t.store_id = ? AND t.buyer_id = u.id) as total_tips,
                   (SELECT MAX(o.created_at) FROM orders o WHERE o.store_id = ? AND o.buyer_id = u.id) as last_order_at
            FROM follows f
            JOIN users u ON u.id = f.buyer_id
            WHERE f.store_id = ?
            ORDER BY f.created_at DESC
        `, [storeId, storeId, storeId, storeId, storeId]);
        res.json({
            success: true,
            store_id: storeId,
            data: rows.map(r => ({
                ...r,
                order_count: Number(r.order_count) || 0,
                total_spent: Number(r.total_spent) || 0,
                total_tips: Number(r.total_tips) || 0
            }))
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/follows/toggle - Follow / unfollow a store
router.post('/toggle', async (req, res, next) => {
    try {
        const storeId = parseInt(req.body.store_id, 10);
        const store = storeId && await db.get('SELECT id, user_id, store_name FROM stores WHERE id = ?', [storeId]);
        if (!store) {
            return res.status(404).json({ success: false, message: 'ไม่พบร้านค้านี้' });
        }
        if (Number(store.user_id) === Number(req.user.id)) {
            return res.status(400).json({ success: false, message: 'ไม่สามารถติดตามร้านค้าของตัวเองได้' });
        }

        const existing = await db.get('SELECT id FROM follows WHERE buyer_id = ? AND store_id = ?', [req.user.id, storeId]);
        if (existing) {
            await db.run('DELETE FROM follows WHERE id = ?', [existing.id]);
        } else {
            await db.run('INSERT INTO follows (buyer_id, store_id) VALUES (?, ?)', [req.user.id, storeId]);
            await notify(store.user_id, {
                type: 'follow',
                title: 'มีผู้ติดตามร้านค้าใหม่',
                message: `${req.user.full_name || 'ผู้ใช้'} กดติดตาม ${store.store_name}`,
                link: '/seller-dashboard.html'
            });
        }

        const count = await db.get('SELECT COUNT(*) as count FROM follows WHERE store_id = ?', [storeId]);
        res.json({
            success: true,
            is_following: !existing,
            follower_count: Number(count.count),
            message: existing ? `เลิกติดตาม ${store.store_name} แล้ว` : `ติดตาม ${store.store_name} แล้ว`
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
