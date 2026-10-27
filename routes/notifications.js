const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/notifications - Latest notifications + unread count of current user
router.get('/', async (req, res, next) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
        const data = await db.all(
            `SELECT id, type, title, message, link, is_read, created_at
             FROM notifications WHERE user_id = ?
             ORDER BY created_at DESC, id DESC LIMIT ${limit}`,
            [req.user.id]
        );
        const unread = await db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);

        res.json({
            success: true,
            unread_count: Number(unread.count),
            data: data.map(n => ({ ...n, is_read: Boolean(Number(n.is_read)) }))
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', async (req, res, next) => {
    try {
        await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// POST /api/notifications/:id/read - Mark one as read
router.post('/:id/read', async (req, res, next) => {
    try {
        const notificationId = parseInt(req.params.id, 10);
        if (!notificationId) {
            return res.status(400).json({ success: false, message: 'หมายเลขการแจ้งเตือนไม่ถูกต้อง' });
        }
        await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notificationId, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
