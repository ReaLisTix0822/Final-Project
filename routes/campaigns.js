const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/campaigns
router.get('/', async (req, res, next) => {
    try {
        const campaigns = await db.all(`
            SELECT 
                c.*,
                COUNT(DISTINCT cp.store_id) as participating_stores_count
            FROM campaigns c
            LEFT JOIN campaign_participants cp ON c.id = cp.campaign_id AND cp.status = 'approved'
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.start_date ASC
        `);
        res.json({ success: true, count: campaigns.length, data: campaigns });
    } catch (err) {
        next(err);
    }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res, next) => {
    try {
        const campaignId = parseInt(req.params.id, 10);
        const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
        if (!campaign) {
            return res.status(404).json({ success: false, message: 'ไม่พบแคมเปญนี้' });
        }

        const participants = await db.all(`
            SELECT 
                cp.booth_number,
                cp.status as participant_status,
                s.*,
                u.full_name as owner_name
            FROM campaign_participants cp
            JOIN stores s ON cp.store_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE cp.campaign_id = ? AND cp.status = 'approved'
        `, [campaignId]);

        res.json({
            success: true,
            data: {
                ...campaign,
                participants
            }
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/campaigns/:id/join (Seller join campaign)
router.post('/:id/join', authenticate, authorize('seller', 'admin'), async (req, res, next) => {
    try {
        const campaignId = parseInt(req.params.id, 10);
        if (!req.store) {
            return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลร้านค้าของคุณ' });
        }

        const existing = await db.get('SELECT * FROM campaign_participants WHERE campaign_id = ? AND store_id = ?', [campaignId, req.store.id]);
        if (existing) {
            return res.status(400).json({ success: false, message: 'ร้านค้าของคุณได้สมัครเข้าร่วมแคมเปญนี้แล้ว' });
        }

        const boothNumber = `B-${Math.floor(10 + Math.random() * 90)}`;

        await db.run(`
            INSERT INTO campaign_participants (campaign_id, store_id, status, booth_number)
            VALUES (?, ?, 'approved', ?)
        `, [campaignId, req.store.id, boothNumber]);

        res.json({ success: true, message: `สมัครเข้าร่วมงานสำเร็จ! หมายเลขบูธของคุณคือ ${boothNumber}` });
    } catch (err) {
        next(err);
    }
});

// POST /api/campaigns (Admin create campaign)
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { title, description, location, start_date, end_date, event_type, image_url } = req.body;
        const result = await db.run(`
            INSERT INTO campaigns (title, description, location, start_date, end_date, event_type, image_url, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [title, description, location, start_date, end_date, event_type || 'both', image_url]);

        const newCamp = await db.get('SELECT * FROM campaigns WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, message: 'สร้างแคมเปญใหม่สำเร็จ', data: newCamp });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
