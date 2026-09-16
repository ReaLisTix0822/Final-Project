const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/reviews (Buyer submit review)
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { product_id, rating, comment } = req.body;

        if (!product_id || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุคะแนน 1-5 ดาว และสินค้าที่ต้องการรีวิว' });
        }

        // Insert review
        const result = await db.run(`
            INSERT INTO reviews (product_id, buyer_id, rating, comment, status)
            VALUES (?, ?, ?, ?, 'approved')
        `, [
            parseInt(product_id, 10),
            req.user.id,
            parseInt(rating, 10),
            comment || ''
        ]);

        const review = await db.get('SELECT * FROM reviews WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, message: 'ส่งความคิดเห็นและให้คะแนนสำเร็จ ขอบพระคุณครับ!', data: review });
    } catch (err) {
        next(err);
    }
});

// PUT /api/reviews/:id/reply (Seller reply to review)
router.put('/:id/reply', authenticate, authorize('seller', 'admin'), async (req, res, next) => {
    try {
        const reviewId = parseInt(req.params.id, 10);
        const { seller_reply } = req.body;

        if (!seller_reply) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อความตอบกลับ' });
        }

        const review = await db.get(`
            SELECT r.*, p.store_id 
            FROM reviews r
            JOIN products p ON r.product_id = p.id
            WHERE r.id = ?
        `, [reviewId]);

        if (!review) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลรีวิว' });
        }

        if (req.user.role !== 'admin' && req.store && review.store_id !== req.store.id) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ตอบกลับรีวิวของร้านอื่น' });
        }

        await db.run(`
            UPDATE reviews SET
                seller_reply = ?,
                seller_replied_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [seller_reply, reviewId]);

        const updated = await db.get('SELECT * FROM reviews WHERE id = ?', [reviewId]);
        res.json({ success: true, message: 'ตอบกลับรีวิวเรียบร้อยแล้ว', data: updated });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
