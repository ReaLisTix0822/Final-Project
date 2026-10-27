const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { notify } = require('../services/notificationService');

const TARGET_TABLES = { product: 'products', store: 'stores', review: 'reviews', user: 'users' };
const STATUSES = ['pending', 'reviewing', 'resolved', 'rejected'];
const STATUS_LABELS = { pending: 'รอตรวจสอบ', reviewing: 'กำลังตรวจสอบ', resolved: 'ดำเนินการแล้ว', rejected: 'ไม่พบการละเมิด' };

router.use(authenticate);

// POST /api/reports - Report a product / store / review / user
router.post('/', async (req, res, next) => {
    try {
        const { target_type } = req.body;
        const targetId = parseInt(req.body.target_id, 10);
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

        if (!Object.hasOwn(TARGET_TABLES, target_type) || !targetId) {
            return res.status(400).json({ success: false, message: 'ข้อมูลสิ่งที่ต้องการรายงานไม่ถูกต้อง' });
        }
        if (reason.length < 5 || reason.length > 1000) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผล 5 – 1,000 ตัวอักษร' });
        }
        const target = await db.get(`SELECT id FROM ${TARGET_TABLES[target_type]} WHERE id = ?`, [targetId]);
        if (!target) {
            return res.status(404).json({ success: false, message: 'ไม่พบสิ่งที่ต้องการรายงาน' });
        }
        const duplicate = await db.get(
            "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status IN ('pending', 'reviewing')",
            [req.user.id, target_type, targetId]
        );
        if (duplicate) {
            return res.status(409).json({ success: false, message: 'คุณรายงานรายการนี้ไปแล้ว ผู้ดูแลระบบกำลังตรวจสอบ' });
        }

        await db.run(
            "INSERT INTO reports (reporter_id, target_type, target_id, reason, status) VALUES (?, ?, ?, ?, 'pending')",
            [req.user.id, target_type, targetId, reason]
        );

        const admins = await db.all("SELECT id FROM users WHERE role = 'admin'");
        for (const admin of admins) {
            await notify(admin.id, {
                type: 'report',
                title: 'มีรายงานปัญหาใหม่',
                message: reason.length > 80 ? `${reason.slice(0, 80)}…` : reason,
                link: '/admin-complaints.html?tab=reports'
            });
        }

        res.status(201).json({ success: true, message: 'ส่งรายงานเรียบร้อยแล้ว ผู้ดูแลระบบจะตรวจสอบโดยเร็ว' });
    } catch (err) {
        next(err);
    }
});

// GET /api/reports - All reports with target names (admin)
router.get('/', authorize('admin'), async (req, res, next) => {
    try {
        const reports = await db.all(`
            SELECT r.*, u.full_name as reporter_name, u.email as reporter_email,
                   CASE r.target_type
                       WHEN 'product' THEN (SELECT name FROM products WHERE id = r.target_id)
                       WHEN 'store' THEN (SELECT store_name FROM stores WHERE id = r.target_id)
                       WHEN 'review' THEN (SELECT comment FROM reviews WHERE id = r.target_id)
                       WHEN 'user' THEN (SELECT full_name FROM users WHERE id = r.target_id)
                   END as target_name
            FROM reports r
            JOIN users u ON r.reporter_id = u.id
            ORDER BY r.created_at DESC, r.id DESC
        `);
        res.json({ success: true, count: reports.length, data: reports });
    } catch (err) {
        next(err);
    }
});

// PUT /api/reports/:id/status - Update report status (admin)
router.put('/:id/status', authorize('admin'), async (req, res, next) => {
    try {
        const reportId = parseInt(req.params.id, 10);
        const { status } = req.body;
        if (!reportId || !STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
        }
        const report = await db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
        if (!report) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายงานนี้' });
        }

        await db.run('UPDATE reports SET status = ? WHERE id = ?', [status, reportId]);
        if (status !== report.status && ['resolved', 'rejected'].includes(status)) {
            await notify(report.reporter_id, {
                type: 'report_update',
                title: `รายงานของคุณ: ${STATUS_LABELS[status]}`,
                message: report.reason.length > 80 ? `${report.reason.slice(0, 80)}…` : report.reason,
                link: null
            });
        }

        res.json({ success: true, message: `อัปเดตสถานะเป็น "${STATUS_LABELS[status]}" แล้ว` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
