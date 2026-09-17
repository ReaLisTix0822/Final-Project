const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/favorites - Get all favorited products for current user
router.get('/', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const favorites = await db.all(`
            SELECT f.id as favorite_id, f.created_at as favorited_at,
                   p.id, p.store_id, p.category_id, p.name, p.story, p.description,
                   p.price, p.stock, p.image_url, p.model_3d_url, p.dimensions, p.weight,
                   p.is_featured, p.is_active,
                   s.store_name, s.disability_type, s.avatar_image as store_avatar,
                   c.name as category_name
            FROM favorites f
            JOIN products p ON f.product_id = p.id
            JOIN stores s ON p.store_id = s.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE f.user_id = ? AND p.is_active = 1
            ORDER BY f.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            count: favorites.length,
            data: favorites
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/favorites/ids - Quick list of favorited product IDs for badge & heart state
router.get('/ids', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const rows = await db.all('SELECT product_id FROM favorites WHERE user_id = ?', [userId]);
        const ids = rows.map(r => r.product_id);

        res.json({
            success: true,
            data: ids
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/favorites/toggle - Toggle favorite status of a product
router.post('/toggle', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { product_id } = req.body;

        if (!product_id) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุ product_id' });
        }

        // Verify product exists
        const product = await db.get('SELECT id, name FROM products WHERE id = ?', [product_id]);
        if (!product) {
            return res.status(404).json({ success: false, message: 'ไม่พบสินค้านี้ในระบบ' });
        }

        // Check if already favorited
        const existing = await db.get('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?', [userId, product_id]);

        if (existing) {
            await db.run('DELETE FROM favorites WHERE id = ?', [existing.id]);
            const rows = await db.all('SELECT product_id FROM favorites WHERE user_id = ?', [userId]);
            return res.json({
                success: true,
                action: 'removed',
                is_favorited: false,
                message: `นำ ${product.name} ออกจากรายการโปรดแล้ว`,
                favorites: rows.map(r => r.product_id)
            });
        } else {
            await db.run('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)', [userId, product_id]);
            const rows = await db.all('SELECT product_id FROM favorites WHERE user_id = ?', [userId]);
            return res.json({
                success: true,
                action: 'added',
                is_favorited: true,
                message: `บันทึก ${product.name} ในรายการโปรดแล้ว`,
                favorites: rows.map(r => r.product_id)
            });
        }
    } catch (err) {
        next(err);
    }
});

module.exports = router;
