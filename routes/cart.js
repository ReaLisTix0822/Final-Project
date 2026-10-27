const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { PUBLIC_DISABILITY_SQL } = require('../services/consent');
const { authenticate } = require('../middleware/auth');

// GET /api/cart - Get cart items of current user (same shape as the frontend Cart items)
router.get('/', authenticate, async (req, res, next) => {
    try {
        const items = await db.all(`
            SELECT p.id, p.name, p.price, p.image_url, p.store_id,
                   s.store_name, ${PUBLIC_DISABILITY_SQL} as disability_type, ci.qty as quantity
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            JOIN stores s ON p.store_id = s.id
            WHERE ci.user_id = ?
            ORDER BY ci.created_at ASC, ci.id ASC
        `, [req.user.id]);

        res.json({
            success: true,
            count: items.length,
            data: items.map(i => ({ ...i, price: Number(i.price), quantity: Number(i.quantity) }))
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/cart - Replace the whole cart of current user
// body: { items: [{ product_id, qty }] }
router.put('/', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const items = Array.isArray(req.body.items) ? req.body.items : [];

        // Merge duplicates and drop invalid rows
        const qtyByProduct = new Map();
        for (const it of items) {
            const productId = parseInt(it.product_id, 10);
            const qty = parseInt(it.qty, 10);
            if (!productId || !qty || qty <= 0) continue;
            qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + qty);
        }

        await db.run('DELETE FROM cart_items WHERE user_id = ?', [userId]);

        for (const [productId, qty] of qtyByProduct) {
            const product = await db.get('SELECT id FROM products WHERE id = ? AND is_active = 1', [productId]);
            if (!product) continue;
            await db.run('INSERT INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)', [userId, productId, qty]);
        }

        const row = await db.get('SELECT COUNT(*) as count FROM cart_items WHERE user_id = ?', [userId]);
        res.json({ success: true, count: Number(row.count) });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
