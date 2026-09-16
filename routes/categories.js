const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/categories
router.get('/', async (req, res, next) => {
    try {
        const categories = await db.all(`
            SELECT c.*, COUNT(p.id) as product_count 
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            GROUP BY c.id
            ORDER BY c.id ASC
        `);
        res.json({ success: true, data: categories });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
