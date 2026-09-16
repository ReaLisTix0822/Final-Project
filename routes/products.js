const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/products (filter, search, sort, pagination)
router.get('/', async (req, res, next) => {
    try {
        const {
            search,
            category_id,
            disability_type,
            min_price,
            max_price,
            featured,
            has_3d,
            sort
        } = req.query;

        let query = `
            SELECT 
                p.*,
                c.name as category_name,
                c.icon as category_icon,
                s.store_name,
                s.disability_type,
                s.province,
                s.support_goal_title,
                s.support_goal_target,
                s.support_goal_current,
                COALESCE(AVG(r.rating), 5.0) as average_rating,
                COUNT(r.id) as review_count
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN stores s ON p.store_id = s.id
            LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
            WHERE p.is_active = 1 AND s.verification_status = 'approved'
        `;

        const params = [];

        if (search) {
            query += ` AND (p.name LIKE ? OR p.story LIKE ? OR p.description LIKE ? OR s.store_name LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (category_id) {
            query += ` AND p.category_id = ?`;
            params.push(parseInt(category_id, 10));
        }

        if (disability_type) {
            query += ` AND s.disability_type = ?`;
            params.push(disability_type);
        }

        if (min_price) {
            query += ` AND p.price >= ?`;
            params.push(parseFloat(min_price));
        }

        if (max_price) {
            query += ` AND p.price <= ?`;
            params.push(parseFloat(max_price));
        }

        if (featured === 'true' || featured === '1') {
            query += ` AND p.is_featured = 1`;
        }

        if (has_3d === 'true' || has_3d === '1') {
            query += ` AND p.model_3d_url IS NOT NULL AND p.model_3d_url != ''`;
        }

        query += ` GROUP BY p.id`;

        if (sort === 'price_asc') {
            query += ` ORDER BY p.price ASC`;
        } else if (sort === 'price_desc') {
            query += ` ORDER BY p.price DESC`;
        } else if (sort === 'rating') {
            query += ` ORDER BY average_rating DESC, review_count DESC`;
        } else {
            query += ` ORDER BY p.is_featured DESC, p.created_at DESC`;
        }

        const products = await db.all(query, params);
        const mappedProducts = products.map(p => ({
            ...p,
            price: Number(p.price),
            average_rating: p.average_rating != null ? parseFloat(p.average_rating) : 5.0,
            review_count: parseInt(p.review_count || 0, 10)
        }));
        res.json({ success: true, count: mappedProducts.length, data: mappedProducts });
    } catch (err) {
        next(err);
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
    try {
        const productId = parseInt(req.params.id, 10);
        const product = await db.get(`
            SELECT 
                p.*,
                c.name as category_name,
                c.icon as category_icon,
                s.id as store_id,
                s.store_name,
                s.disability_type,
                s.story as store_story,
                s.craft_technique,
                s.support_goal_title,
                s.support_goal_target,
                s.support_goal_current,
                s.province,
                s.avatar_image as store_avatar,
                s.cover_image as store_cover,
                COALESCE(AVG(r.rating), 5.0) as average_rating,
                COUNT(r.id) as review_count
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN stores s ON p.store_id = s.id
            LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
            WHERE p.id = ?
            GROUP BY p.id
        `, [productId]);

        if (!product) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสินค้านี้ในระบบ' });
        }

        product.price = Number(product.price);
        product.average_rating = product.average_rating != null ? parseFloat(product.average_rating) : 5.0;
        product.review_count = parseInt(product.review_count || 0, 10);

        // Fetch reviews
        const reviews = await db.all(`
            SELECT 
                r.*,
                u.full_name as buyer_name,
                u.avatar_url as buyer_avatar
            FROM reviews r
            JOIN users u ON r.buyer_id = u.id
            WHERE r.product_id = ? AND r.status = 'approved'
            ORDER BY r.created_at DESC
        `, [productId]);

        // Fetch related products from same store
        const relatedProducts = await db.all(`
            SELECT id, name, price, image_url, model_3d_url
            FROM products
            WHERE store_id = ? AND id != ? AND is_active = 1
            LIMIT 4
        `, [product.store_id, productId]);

        res.json({
            success: true,
            data: {
                ...product,
                reviews,
                relatedProducts
            }
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/products (Seller only)
router.post('/', authenticate, authorize('seller', 'admin'), async (req, res, next) => {
    try {
        const { category_id, name, story, description, price, stock, image_url, model_3d_url, dimensions, weight, is_featured } = req.body;

        if (!req.store && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลร้านค้าของคุณ' });
        }

        const storeId = req.store ? req.store.id : 1;

        if (!name || !price || !category_id || !image_url) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลสินค้าให้ครบถ้วน (ชื่อ, ราคา, หมวดหมู่, รูปภาพ)' });
        }

        const result = await db.run(`
            INSERT INTO products (store_id, category_id, name, story, description, price, stock, image_url, model_3d_url, dimensions, weight, is_featured, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            storeId,
            category_id,
            name,
            story || '',
            description || '',
            parseFloat(price),
            parseInt(stock, 10) || 10,
            image_url,
            model_3d_url || null,
            dimensions || '',
            weight || '',
            is_featured ? 1 : 0
        ]);

        const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, message: 'เพิ่มสินค้าใหม่เรียบร้อยแล้ว', data: newProduct });
    } catch (err) {
        next(err);
    }
});

// PUT /api/products/:id (Seller only)
router.put('/:id', authenticate, authorize('seller', 'admin'), async (req, res, next) => {
    try {
        const productId = parseInt(req.params.id, 10);
        const { category_id, name, story, description, price, stock, image_url, model_3d_url, dimensions, weight, is_featured, is_active } = req.body;

        const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            return res.status(404).json({ success: false, message: 'ไม่พบสินค้าที่ต้องการแก้ไข' });
        }

        if (req.user.role !== 'admin' && req.store && product.store_id !== req.store.id) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขสินค้านี้' });
        }

        await db.run(`
            UPDATE products SET
                category_id = COALESCE(?, category_id),
                name = COALESCE(?, name),
                story = COALESCE(?, story),
                description = COALESCE(?, description),
                price = COALESCE(?, price),
                stock = COALESCE(?, stock),
                image_url = COALESCE(?, image_url),
                model_3d_url = COALESCE(?, model_3d_url),
                dimensions = COALESCE(?, dimensions),
                weight = COALESCE(?, weight),
                is_featured = COALESCE(?, is_featured),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            category_id,
            name,
            story,
            description,
            price ? parseFloat(price) : null,
            stock !== undefined ? parseInt(stock, 10) : null,
            image_url,
            model_3d_url,
            dimensions,
            weight,
            is_featured !== undefined ? (is_featured ? 1 : 0) : null,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            productId
        ]);

        const updated = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        res.json({ success: true, message: 'บันทึกการแก้ไขสินค้าเรียบร้อยแล้ว', data: updated });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/products/:id (Seller/Admin)
router.delete('/:id', authenticate, authorize('seller', 'admin'), async (req, res, next) => {
    try {
        const productId = parseInt(req.params.id, 10);
        const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            return res.status(404).json({ success: false, message: 'ไม่พบสินค้าที่ต้องการลบ' });
        }

        if (req.user.role !== 'admin' && req.store && product.store_id !== req.store.id) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ลบสินค้านี้' });
        }

        await db.run('DELETE FROM products WHERE id = ?', [productId]);
        res.json({ success: true, message: 'ลบสินค้าเรียบร้อยแล้ว' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
