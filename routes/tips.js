const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { notify } = require('../services/notificationService');

// POST /api/tips - Send a direct tip to a store (outside of an order)
router.post('/', authenticate, async (req, res, next) => {
    try {
        const storeId = parseInt(req.body.store_id, 10);
        const amount = Math.round(Number(req.body.amount) * 100) / 100;

        if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุจำนวนเงิน 1 – 100,000 บาท' });
        }
        const store = storeId && await db.get('SELECT id, user_id, store_name FROM stores WHERE id = ?', [storeId]);
        if (!store) {
            return res.status(404).json({ success: false, message: 'ไม่พบร้านค้านี้' });
        }

        await db.run('INSERT INTO tips (buyer_id, store_id, amount) VALUES (?, ?, ?)', [req.user.id, storeId, amount]);
        await db.run('UPDATE stores SET support_goal_current = support_goal_current + ? WHERE id = ?', [amount, storeId]);

        await notify(store.user_id, {
            type: 'tip',
            title: `ได้รับเงินสนับสนุน ฿${amount.toLocaleString()}`,
            message: `จาก ${req.user.full_name || 'ผู้สนับสนุน'}`,
            link: '/seller-dashboard.html?tab=goal'
        });

        const updated = await db.get('SELECT support_goal_current, support_goal_target FROM stores WHERE id = ?', [storeId]);
        res.status(201).json({
            success: true,
            message: `ขอบพระคุณที่ร่วมสนับสนุน ฿${amount.toLocaleString()} แก่ ${store.store_name}`,
            data: {
                support_goal_current: Number(updated.support_goal_current),
                support_goal_target: Number(updated.support_goal_target)
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
