const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/stores (list all approved stores)
router.get('/', async (req, res, next) => {
    try {
        const { disability_type, search } = req.query;
        let query = `
            SELECT 
                s.*,
                u.full_name as owner_name,
                COUNT(DISTINCT p.id) as product_count,
                COALESCE(AVG(r.rating), 5.0) as average_rating,
                COUNT(DISTINCT r.id) as total_reviews
            FROM stores s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN products p ON s.id = p.store_id AND p.is_active = 1
            LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
            WHERE s.verification_status = 'approved'
        `;
        const params = [];

        if (disability_type) {
            query += ` AND s.disability_type = ?`;
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
            SELECT id, store_id, name, price, image_url
            FROM products
            WHERE is_active = 1
            ORDER BY is_featured DESC, id ASC
        `);

        const mappedStores = stores.map(s => {
            const storeProducts = products.filter(p => p.store_id === s.id);
            return {
                ...s,
                average_rating: s.average_rating != null ? parseFloat(s.average_rating) : 5.0,
                product_count: parseInt(s.product_count || 0, 10),
                total_reviews: parseInt(s.total_reviews || 0, 10),
                sample_products: storeProducts.slice(0, 3)
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
                u.full_name as owner_name,
                u.email as owner_email,
                COALESCE(AVG(r.rating), 5.0) as average_rating,
                COUNT(DISTINCT r.id) as total_reviews
            FROM stores s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN products p ON s.id = p.store_id AND p.is_active = 1
            LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
            WHERE s.id = ?
            GROUP BY s.id
        `, [storeId]);

        if (!store) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลร้านค้านี้ในระบบ' });
        }

        store.average_rating = store.average_rating != null ? parseFloat(store.average_rating) : 5.0;
        store.total_reviews = parseInt(store.total_reviews || 0, 10);

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
                ...store,
                products,
                campaigns
            }
        });
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

        await db.run(`
            UPDATE stores SET
                store_name = COALESCE(?, store_name),
                disability_type = COALESCE(?, disability_type),
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
            disability_type,
            story,
            craft_technique,
            support_goal_title,
            support_goal_target ? parseFloat(support_goal_target) : null,
            phone,
            province,
            address,
            avatar_image,
            cover_image,
            storeId
        ]);

        const updatedStore = await db.get('SELECT * FROM stores WHERE id = ?', [storeId]);
        res.json({ success: true, message: 'อัปเดตข้อมูลร้านค้าและเรื่องราวเรียบร้อยแล้ว', data: updatedStore });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
