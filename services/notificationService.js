const db = require('../config/database');

const ORDER_STATUS_LABELS = {
    pending: 'รอการชำระเงิน',
    paid: 'ชำระเงินแล้ว / รอดำเนินการ',
    processing: 'ร้านค้ากำลังเตรียมสินค้า',
    shipped: 'กำลังจัดส่งโดยบริษัทขนส่ง',
    delivered: 'จัดส่งสำเร็จเรียบร้อย',
    completed: 'จัดส่งสำเร็จเรียบร้อย',
    cancelled: 'ยกเลิกคำสั่งซื้อ'
};

// Create a notification. Never throws: a failed notification must not break the main action.
async function notify(userId, { type, title, message = '', link = null }) {
    if (!userId) return;
    try {
        await db.run(
            'INSERT INTO notifications (user_id, type, title, message, link, is_read) VALUES (?, ?, ?, ?, ?, 0)',
            [userId, type, title, message, link]
        );
    } catch (err) {
        console.warn('[Notification] Create failed:', err.message);
    }
}

// One unread notification per chat thread: refresh it instead of stacking a new row per message
async function notifyChat(userId, { title, message, link }) {
    if (!userId) return;
    try {
        const existing = await db.get(
            'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND link = ? AND is_read = 0',
            [userId, 'chat', link]
        );
        if (existing) {
            await db.run(
                'UPDATE notifications SET title = ?, message = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
                [title, message, existing.id]
            );
        } else {
            await notify(userId, { type: 'chat', title, message, link });
        }
    } catch (err) {
        console.warn('[Notification] Chat notify failed:', err.message);
    }
}

module.exports = { notify, notifyChat, ORDER_STATUS_LABELS };
