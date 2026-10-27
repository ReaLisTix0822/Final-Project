const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { PUBLIC_DISABILITY_SQL } = require('../services/consent');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/campaigns
router.get('/', async (req, res, next) => {
    try {
        const campaigns = await db.all(`
            SELECT 
                c.*,
                CASE WHEN c.end_date < CURRENT_DATE THEN 1 ELSE 0 END as has_ended,
                COUNT(DISTINCT cp.store_id) as participating_stores_count
            FROM campaigns c
            LEFT JOIN campaign_participants cp ON c.id = cp.campaign_id AND cp.status = 'approved'
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY has_ended ASC, c.start_date ASC   -- campaigns that are still open come first
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
                s.id, s.store_name, ${PUBLIC_DISABILITY_SQL} as disability_type, s.province, s.craft_technique,
                s.avatar_image, s.cover_image,
                COALESCE(dt.label, dt.name) as disability_name,
                u.full_name as owner_name,
                u.avatar_url as owner_avatar_url,
                (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.is_active = 1) as product_count
            FROM campaign_participants cp
            JOIN stores s ON cp.store_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN disability_types dt ON dt.code = ${PUBLIC_DISABILITY_SQL}
            WHERE cp.campaign_id = ? AND cp.status = 'approved'
            ORDER BY cp.booth_number ASC
        `, [campaignId]);

        // Products from the stores that join this campaign
        const products = participants.length === 0 ? [] : await db.all(`
            SELECT p.id, p.name, p.price, p.image_url, p.model_3d_url, p.store_id, s.store_name
            FROM products p
            JOIN stores s ON p.store_id = s.id
            WHERE p.is_active = 1 AND p.store_id IN (${participants.map(() => '?').join(', ')})
            ORDER BY p.is_featured DESC, p.created_at DESC
            LIMIT 8
        `, participants.map(pt => pt.id));

        res.json({
            success: true,
            data: {
                ...campaign,
                participants: participants.map(pt => ({ ...pt, product_count: Number(pt.product_count) })),
                products: products.map(pr => ({ ...pr, price: Number(pr.price) }))
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
