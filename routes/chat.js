const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);
const id = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
async function resolveThread(req, source) {
    const storeId = id(source.store_id);
    const store = storeId && await db.get('SELECT id, user_id FROM stores WHERE id = ?', [storeId]);
    if (!store) throw Object.assign(new Error('ไม่พบร้านค้า'), { status: 404 });
    const owner = Number(store.user_id);
    const self = Number(req.user.id);
    const contact = self === owner ? id(source.receiver_id) : owner;
    if (!contact || contact === self || (self !== owner && source.receiver_id && id(source.receiver_id) !== owner)) {
        throw Object.assign(new Error('ผู้รับข้อความไม่ถูกต้อง'), { status: 400 });
    }
    if (self === owner) {
        const existing = await db.get('SELECT id FROM chat_messages WHERE store_id = ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) LIMIT 1', [storeId, self, contact, contact, self]);
        if (!existing) throw Object.assign(new Error('ไม่พบการสนทนากับลูกค้านี้'), { status: 403 });
    }
    return { storeId, self, contact };
}
router.get('/messages', async (req, res, next) => {
    try {
        const { storeId, self, contact } = await resolveThread(req, req.query);
        const after = req.query.after == null ? 0 : Number(req.query.after);
        if (!Number.isSafeInteger(after) || after < 0) return res.status(400).json({ success: false, message: 'หมายเลขข้อความไม่ถูกต้อง' });
        const data = await db.all(`SELECT id, sender_id, receiver_id, message, created_at, is_read FROM chat_messages WHERE store_id = ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND id > ? ORDER BY id ASC LIMIT 200`, [storeId, self, contact, contact, self, after]);
        res.json({ success: true, data });
    } catch (err) { next(err); }
});
router.post('/messages', async (req, res, next) => {
    try {
        const { storeId, self, contact } = await resolveThread(req, req.body);
        const message = req.body.message;
        if (typeof message !== 'string' || !message.trim() || message.trim().length > 2000) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อความ 1–2,000 ตัวอักษร' });
        const result = await db.run('INSERT INTO chat_messages (sender_id, receiver_id, store_id, sender_role, message, is_read) VALUES (?, ?, ?, ?, ?, 0)', [self, contact, storeId, req.user.role, message.trim()]);
        res.status(201).json({ success: true, id: result.lastID || result.insertId });
    } catch (err) { next(err); }
});
router.post('/read', async (req, res, next) => {
    try {
        const { storeId, self, contact } = await resolveThread(req, req.body);
        const through = id(req.body.through_id);
        if (!through) return res.status(400).json({ success: false, message: 'หมายเลขข้อความไม่ถูกต้อง' });
        await db.run('UPDATE chat_messages SET is_read = 1 WHERE store_id = ? AND receiver_id = ? AND sender_id = ? AND id <= ?', [storeId, self, contact, through]);
        res.json({ success: true });
    } catch (err) { next(err); }
});
router.get('/conversations', async (req, res, next) => {
    try {
        const self = Number(req.user.id);
        const rows = await db.all(`SELECT m.*, s.store_name, s.user_id AS owner_id, u.full_name AS contact_name, u.avatar_url AS contact_avatar,
            CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS contact_user_id
            FROM chat_messages m JOIN stores s ON s.id = m.store_id
            JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
            WHERE (m.sender_id = ? OR m.receiver_id = ?) AND (m.sender_id = s.user_id OR m.receiver_id = s.user_id)
            ORDER BY m.id DESC`, [self, self, self, self]);
        const threads = new Map();
        for (const row of rows) {
            const key = `${row.store_id}:${row.contact_user_id}`;
            if (!threads.has(key)) threads.set(key, { store_id: row.store_id, contact_user_id: row.contact_user_id, name: Number(row.owner_id) === self ? row.contact_name : row.store_name, avatar_url: row.contact_avatar || null, last_message: row.message, unread: 0 });
            if (Number(row.receiver_id) === self && !row.is_read) threads.get(key).unread++;
        }
        res.json({ success: true, data: [...threads.values()] });
    } catch (err) { next(err); }
});
module.exports = router;
