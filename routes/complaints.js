const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { notify } = require('../services/notificationService');

const CATEGORIES = {
    order: 'ปัญหาคำสั่งซื้อ / การจัดส่ง',
    payment: 'ปัญหาการชำระเงิน / คืนเงิน',
    seller: 'พฤติกรรมของร้านค้า / ผู้ขาย',
    product: 'สินค้าไม่ตรงปก / ชำรุด',
    account: 'บัญชีผู้ใช้ / การเข้าสู่ระบบ',
    privacy: 'ข้อมูลส่วนบุคคล / ใช้สิทธิตาม PDPA',
    accessibility: 'การเข้าถึงเว็บไซต์ (ผู้ที่มีความพิการใช้งานไม่สะดวก)',
    other: 'เรื่องอื่น ๆ'
};
const STATUSES = {
    open: 'รอดำเนินการ',
    in_progress: 'กำลังดำเนินการ',
    resolved: 'แก้ไขแล้ว',
    closed: 'ปิดเรื่อง'
};

// GET /api/complaints/categories - Options for the complaint form
router.get('/categories', (req, res) => {
    res.json({ success: true, data: { categories: CATEGORIES, statuses: STATUSES } });
});

// POST /api/complaints - A signed-in member files a complaint to the admin team
router.post('/', authenticate, async (req, res, next) => {
    try {
        const category = String(req.body.category || '');
        const subject = String(req.body.subject || '').trim();
        const detail = String(req.body.detail || '').trim();
        const orderId = req.body.order_id ? Number(req.body.order_id) : null;

        if (!CATEGORIES[category]) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกประเภทเรื่องร้องเรียน' });
        }
        if (subject.length < 5 || subject.length > 200) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกหัวข้อ 5–200 ตัวอักษร' });
        }
        if (detail.length < 10 || detail.length > 3000) {
            return res.status(400).json({ success: false, message: 'กรุณาอธิบายรายละเอียด 10–3,000 ตัวอักษร' });
        }
        // An attached order must belong to this member (as buyer or as the selling store)
        if (orderId !== null) {
            const owned = Number.isSafeInteger(orderId) && await db.get(`
                SELECT o.id FROM orders o LEFT JOIN stores s ON s.id = o.store_id
                WHERE o.id = ? AND (o.buyer_id = ? OR s.user_id = ?)`, [orderId, req.user.id, req.user.id]);
            if (!owned) return res.status(400).json({ success: false, message: 'ไม่พบคำสั่งซื้อนี้ในบัญชีของคุณ' });
        }

        const result = await db.run(
            "INSERT INTO complaints (user_id, category, subject, detail, order_id, target_type, target_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')",
            // target_type / target_id (report: Complaints): an order complaint points at its order
            [req.user.id, category, subject, detail, orderId, orderId ? 'order' : null, orderId]
        );

        const admins = await db.all("SELECT id FROM users WHERE role = 'admin'");
        for (const admin of admins) {
            await notify(admin.id, {
                type: 'complaint',
                title: `เรื่องร้องเรียนใหม่: ${CATEGORIES[category]}`,
                message: `${req.user.full_name}: ${subject.length > 80 ? `${subject.slice(0, 80)}…` : subject}`,
                link: `/admin-complaints.html?id=${result.insertId}`
            });
        }

        res.status(201).json({
            success: true,
            message: `ส่งเรื่องร้องเรียนเลขที่ #${result.insertId} แล้ว ผู้ดูแลระบบจะตอบกลับผ่านการแจ้งเตือนและหน้านี้`,
            data: { id: result.insertId }
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/complaints/mine - The member's own complaints with admin replies
router.get('/mine', authenticate, async (req, res, next) => {
    try {
        const rows = await db.all(
            'SELECT id, category, subject, detail, order_id, status, admin_reply, replied_at, created_at FROM complaints WHERE user_id = ? ORDER BY created_at DESC, id DESC',
            [req.user.id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
});

// GET /api/complaints - Every complaint (admin)
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const rows = await db.all(`
            SELECT c.*, u.full_name as user_name, u.email as user_email, u.phone as user_phone, u.role as user_role
            FROM complaints c LEFT JOIN users u ON u.id = c.user_id
            ORDER BY CASE c.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, c.created_at DESC, c.id DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
});

// PUT /api/complaints/:id - Admin changes the status and/or replies; the member is notified
router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const status = String(req.body.status || '');
        const reply = typeof req.body.admin_reply === 'string' ? req.body.admin_reply.trim() : '';
        if (!Number.isSafeInteger(id) || id < 1 || !STATUSES[status]) {
            return res.status(400).json({ success: false, message: 'รหัสเรื่องหรือสถานะไม่ถูกต้อง' });
        }
        if (reply.length > 3000) {
            return res.status(400).json({ success: false, message: 'ข้อความตอบกลับยาวเกิน 3,000 ตัวอักษร' });
        }
        const complaint = await db.get('SELECT id, user_id, subject, status, admin_reply FROM complaints WHERE id = ?', [id]);
        if (!complaint) return res.status(404).json({ success: false, message: 'ไม่พบเรื่องร้องเรียน' });

        const replyChanged = reply && reply !== (complaint.admin_reply || '');
        if (replyChanged) {
            await db.run('UPDATE complaints SET status = ?, admin_reply = ?, admin_id = ?, replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, reply, req.user.id, id]);
        } else {
            await db.run('UPDATE complaints SET status = ?, admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.user.id, id]);
        }

        if (replyChanged || status !== complaint.status) {
            await notify(complaint.user_id, {
                type: 'complaint',
                title: replyChanged ? `ผู้ดูแลระบบตอบกลับเรื่อง #${id}` : `เรื่อง #${id}: ${STATUSES[status]}`,
                message: replyChanged ? (reply.length > 100 ? `${reply.slice(0, 100)}…` : reply) : complaint.subject,
                link: `/complaints.html#complaint-${id}`
            });
        }
        res.json({ success: true, message: replyChanged ? 'ส่งคำตอบให้ผู้ร้องเรียนแล้ว' : `เปลี่ยนสถานะเป็น "${STATUSES[status]}" แล้ว` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
