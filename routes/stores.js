const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { cleanPhone, PHONE_ERROR } = require('../services/phone');
const { captionStoreVideo } = require('../services/videoCaptionService');
const { saveStoreVideo, withStoreVideo } = require('../services/storeVideos');
const { CONSENT_REQUIRED_MESSAGE, PUBLIC_DISABILITY_SQL, isConsentGiven, giveConsent, getConsent } = require('../services/consent');
const { DOC_TYPE_LABELS, sendStoreDocument } = require('../services/storeDocuments');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storeImageDir = path.join(__dirname, '../public/uploads/stores');
fs.mkdirSync(storeImageDir, { recursive: true });
const storeImageUpload = multer({
    storage: multer.diskStorage({
        destination: storeImageDir,
        filename: (req, file, cb) => cb(null, `store-${req.user.id}-${require('crypto').randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const valid = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
            && /^\.(jpe?g|png|webp)$/i.test(path.extname(file.originalname));
        cb(valid ? null : new Error('รองรับเฉพาะ JPG, PNG และ WebP'), valid);
    }
});

// Story video: uploaded file (MP4 / WebM, max 50MB) or a YouTube link
const storeVideoDir = path.join(__dirname, '../public/uploads/store-videos');
fs.mkdirSync(storeVideoDir, { recursive: true });
const storeVideoUpload = multer({
    storage: multer.diskStorage({
        destination: storeVideoDir,
        filename: (req, file, cb) => cb(null, `video-${req.user.id}-${require('crypto').randomUUID()}${file.mimetype === 'video/webm' ? '.webm' : '.mp4'}`)
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const valid = ['video/mp4', 'video/webm'].includes(file.mimetype) && /^\.(mp4|webm|m4v)$/i.test(path.extname(file.originalname));
        cb(valid ? null : Object.assign(new Error('รองรับเฉพาะวิดีโอ MP4 หรือ WebM'), { status: 400 }), valid);
    }
});

// Accepts '' (remove), an uploaded file path, or a YouTube watch / short / youtu.be link
function cleanStoryVideoUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^\/uploads\/store-videos\/video-[\w-]+\.(mp4|webm)$/.test(url)) return url;
    if (/^\/videos\/stories\/[\w-]+\.(mp4|webm)$/.test(url)) return url;   // bundled sample videos
    const yt = url.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    return yt ? `https://www.youtube.com/watch?v=${yt[1]}` : null;
}

router.post('/upload-video', authenticate, authorize('seller', 'admin'), (req, res, next) => {
    storeVideoUpload.single('video')(req, res, err => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์วิดีโอต้องมีขนาดไม่เกิน 50 MB' : err.message;
            return res.status(400).json({ success: false, message });
        }
        if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์วิดีโอ' });
        res.json({ success: true, video_url: `/uploads/store-videos/${req.file.filename}` });
    });
});

router.post('/upload-image', authenticate, authorize('seller', 'admin'), storeImageUpload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาเลือกภาพปกร้านค้า' });
    res.json({ success: true, cover_image: `/uploads/stores/${req.file.filename}` });
});

// Fields that must never leave the server on PUBLIC endpoints (admin / owner endpoints still return them)
const PRIVATE_STORE_FIELDS = ['verification_doc', 'rejection_reason', 'owner_email'];
const publicStore = store => {
    const copy = { ...store };
    PRIVATE_STORE_FIELDS.forEach(field => delete copy[field]);
    return copy;
};

// GET /api/stores (list all approved stores)
router.get('/', async (req, res, next) => {
    try {
        const { disability_type, search } = req.query;
        let query = `
            SELECT 
                s.*,
                ${PUBLIC_DISABILITY_SQL} as disability_type,   -- after s.*: hides the type unless the owner consented
                u.full_name as owner_name,
                u.avatar_url as owner_avatar_url,
                COALESCE(dt.label, dt.name) as disability_name,
                (SELECT COUNT(*) FROM follows f WHERE f.store_id = s.id) as follower_count,
                COUNT(DISTINCT p.id) as product_count,
                AVG(r.rating) as average_rating,   -- NULL when there are no reviews (no fake 5 stars)
                COUNT(DISTINCT r.id) as total_reviews
            FROM stores s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN disability_types dt ON dt.code = ${PUBLIC_DISABILITY_SQL}
            LEFT JOIN products p ON s.id = p.store_id AND p.is_active = 1
            LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
            WHERE s.verification_status = 'approved'
        `;
        const params = [];

        if (disability_type) {
            query += ` AND ${PUBLIC_DISABILITY_SQL} = ?`;
            params.push(disability_type);
        }

        if (search) {
            query += ` AND (s.store_name LIKE ? OR s.story LIKE ? OR s.craft_technique LIKE ?)`;
            const p = `%${search}%`;
            params.push(p, p, p);
        }

        query += ` GROUP BY s.id ORDER BY s.created_at DESC`;

        const stores = await db.all(query, params);
        const products = await db.all(`
            SELECT id, store_id, category_id, name, price, image_url
            FROM products
            WHERE is_active = 1
            ORDER BY is_featured DESC, id ASC
        `);

        const mappedStores = stores.map(s => {
            const storeProducts = products.filter(p => p.store_id === s.id);
            return {
                ...publicStore(s),
                average_rating: s.average_rating != null ? parseFloat(s.average_rating) : null,
                product_count: parseInt(s.product_count || 0, 10),
                total_reviews: parseInt(s.total_reviews || 0, 10),
                category_ids: [...new Set(storeProducts.map(p => Number(p.category_id)))],
                sample_products: storeProducts.slice(0, 3).map(p => ({ id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url }))
            };
        });
        res.json({ success: true, count: mappedStores.length, data: mappedStores });
    } catch (err) {
        next(err);
    }
});

// GET /api/stores/:id (store detail with products and story)
router.get('/:id', async (req, res, next) => {
    try {
        const storeId = parseInt(req.params.id, 10);
        const store = await db.get(`
            SELECT 
                s.*,
                ${PUBLIC_DISABILITY_SQL} as disability_type,   -- after s.*: hides the type unless the owner consented
                u.full_name as owner_name,
                u.avatar_url as owner_avatar_url,
                COALESCE(dt.label, dt.name) as disability_name,
                (SELECT COUNT(*) FROM follows f WHERE f.store_id = s.id) as follower_count,
                (SELECT COUNT(*) FROM tips t WHERE t.store_id = s.id) as tip_count,
                (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id AND o.status IN ('delivered', 'completed')) as completed_orders,
                AVG(r.rating) as average_rating,   -- NULL when there are no reviews (no fake 5 stars)
                COUNT(DISTINCT r.id) as total_reviews
            FROM stores s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN disability_types dt ON dt.code = ${PUBLIC_DISABILITY_SQL}
            LEFT JOIN products p ON s.id = p.store_id AND p.is_active = 1
            LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
            WHERE s.id = ?
            GROUP BY s.id
        `, [storeId]);

        if (!store) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลร้านค้านี้ในระบบ' });
        }

        store.average_rating = store.average_rating != null ? parseFloat(store.average_rating) : null;
        store.total_reviews = parseInt(store.total_reviews || 0, 10);
        store.follower_count = Number(store.follower_count || 0);
        store.tip_count = Number(store.tip_count || 0);
        store.completed_orders = Number(store.completed_orders || 0);

        const products = await db.all(`
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.store_id = ? AND p.is_active = 1
            ORDER BY p.is_featured DESC, p.created_at DESC
        `, [storeId]);

        // Campaigns participated
        const campaigns = await db.all(`
            SELECT c.*, cp.booth_number
            FROM campaigns c
            JOIN campaign_participants cp ON c.id = cp.campaign_id
            WHERE cp.store_id = ? AND cp.status = 'approved' AND c.is_active = 1
        `, [storeId]);

        res.json({
            success: true,
            data: {
                ...publicStore(await withStoreVideo(store)),
                products,
                campaigns
            }
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/stores/my-store/documents - The seller's own verification documents (list)
router.get('/my-store/documents', authenticate, authorize('seller'), async (req, res, next) => {
    try {
        if (!req.store) return res.status(404).json({ success: false, message: 'ไม่พบร้านค้าของคุณ' });
        const docs = await db.all('SELECT id, doc_type, original_name, mime_type, file_size, created_at FROM store_documents WHERE store_id = ? ORDER BY id', [req.store.id]);
        res.json({ success: true, data: docs.map(d => ({ ...d, doc_label: DOC_TYPE_LABELS[d.doc_type] || d.doc_type })) });
    } catch (err) {
        next(err);
    }
});

// GET /api/stores/my-store/documents/:docId/file - Open one of the seller's own documents (owner only)
router.get('/my-store/documents/:docId/file', authenticate, authorize('seller'), async (req, res, next) => {
    try {
        if (!req.store) return res.status(404).json({ success: false, message: 'ไม่พบร้านค้าของคุณ' });
        const doc = await db.get('SELECT file_path, original_name, mime_type FROM store_documents WHERE id = ? AND store_id = ?',
            [Number(req.params.docId), req.store.id]);
        sendStoreDocument(res, doc);
    } catch (err) {
        next(err);
    }
});

// PUT /api/stores/my-store (Update current seller's store profile)
router.put('/my-store', authenticate, authorize('seller', 'admin'), async (req, res, next) => {
    try {
        if (!req.store && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: 'ไม่พบร้านค้าของคุณ' });
        }

        const storeId = req.store ? req.store.id : parseInt(req.body.store_id, 10);
        const {
            store_name,
            disability_type,
            story,
            craft_technique,
            support_goal_title,
            support_goal_target,
            phone,
            province,
            address,
            avatar_image,
            cover_image
        } = req.body;

        if (phone !== undefined && cleanPhone(phone) === null) {
            return res.status(400).json({ success: false, message: PHONE_ERROR });
        }
        // Disability type (optional, PDPA s.26): sending "" removes it; a value needs explicit consent
        const store = await db.get('SELECT user_id FROM stores WHERE id = ?', [storeId]);
        if (!store) return res.status(404).json({ success: false, message: 'ไม่พบร้านค้า' });
        const disabilityType = disability_type === undefined ? undefined : (disability_type ? String(disability_type) : null);
        if (disabilityType) {
            // The owner gives consent in the request; an admin can only keep a consent the owner already gave
            const consented = req.user.role === 'admin'
                ? (await getConsent(store.user_id)).disability_consent
                : isConsentGiven(req.body.disability_consent);
            if (!consented) return res.status(400).json({ success: false, message: CONSENT_REQUIRED_MESSAGE });
            if (!await db.get('SELECT id FROM disability_types WHERE code = ? AND COALESCE(is_active, 1) = 1', [disabilityType])) {
                return res.status(400).json({ success: false, message: 'กรุณาเลือกกลุ่มความพิการที่ระบบรองรับ' });
            }
            if (req.user.role !== 'admin') await giveConsent(store.user_id);
        }
        if (disabilityType !== undefined) {
            await db.run('UPDATE stores SET disability_type = ? WHERE id = ?', [disabilityType, storeId]);
        }
        // Story video is optional; sending the fields (even empty) updates or removes it
        if (req.body.story_video_url !== undefined) {
            const videoUrl = cleanStoryVideoUrl(req.body.story_video_url);
            if (videoUrl === null) {
                return res.status(400).json({ success: false, message: 'ลิงก์วิดีโอไม่ถูกต้อง รองรับไฟล์ที่อัปโหลดหรือลิงก์ YouTube เท่านั้น' });
            }
            const transcript = String(req.body.story_video_transcript || '').trim().slice(0, 5000);
            const changed = await saveStoreVideo(storeId, videoUrl, transcript);
            // New video: create captions in the background (takes ~20-60s)
            if (changed && videoUrl) captionStoreVideo(storeId).catch(err => console.warn('[Captions]', err.message));
        }

        await db.run(`
            UPDATE stores SET
                store_name = COALESCE(?, store_name),
                story = COALESCE(?, story),
                craft_technique = COALESCE(?, craft_technique),
                support_goal_title = COALESCE(?, support_goal_title),
                support_goal_target = COALESCE(?, support_goal_target),
                phone = COALESCE(?, phone),
                province = COALESCE(?, province),
                address = COALESCE(?, address),
                avatar_image = COALESCE(?, avatar_image),
                cover_image = COALESCE(?, cover_image)
            WHERE id = ?
        `, [
            store_name,
            story,
            craft_technique,
            support_goal_title,
            support_goal_target ? parseFloat(support_goal_target) : null,
            phone !== undefined ? cleanPhone(phone) : null,
            province,
            address,
            avatar_image,
            cover_image,
            storeId
        ]);

        const updatedStore = await withStoreVideo(await db.get('SELECT * FROM stores WHERE id = ?', [storeId]));
        res.json({ success: true, message: 'อัปเดตข้อมูลร้านค้าและเรื่องราวเรียบร้อยแล้ว', data: updatedStore });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
