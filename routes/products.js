const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/database');
const { PUBLIC_DISABILITY_SQL } = require('../services/consent');
const { authenticate, authorize, optionalUserId } = require('../middleware/auth');
const { notify } = require('../services/notificationService');

// Mirror the product's main image and 3D model into product_images / product_3d_models
async function syncProductMedia(product) {
    if (product.image_url) {
        const main = await db.get('SELECT id FROM product_images WHERE product_id = ? AND sort_order = 0', [product.id]);
        if (main) {
            await db.run('UPDATE product_images SET image_url = ?, alt_text = ? WHERE id = ?', [product.image_url, product.name, main.id]);
        } else {
            await db.run('INSERT INTO product_images (product_id, image_url, alt_text, sort_order) VALUES (?, ?, ?, 0)', [product.id, product.image_url, product.name]);
        }
    }

    if (product.model_3d_url) {
        const model = await db.get('SELECT id FROM product_3d_models WHERE product_id = ?', [product.id]);
        const imageCount = await db.get('SELECT COUNT(*) as count FROM product_images WHERE product_id = ?', [product.id]);
        // Product_3D_Models.source_image_count is 1-4 (CHECK in db/migrations/20261019_align_32_tables.sql)
        imageCount.count = Math.min(4, Math.max(1, Number(imageCount.count) || 1));
        if (model) {
            await db.run(
                "UPDATE product_3d_models SET model_url = ?, status = 'completed', source_image_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [product.model_3d_url, Number(imageCount.count), model.id]
            );
        } else {
            await db.run(
                "INSERT INTO product_3d_models (product_id, model_url, status, source_image_count) VALUES (?, ?, 'completed', ?)",
                [product.id, product.model_3d_url, Number(imageCount.count)]
            );
        }
    }
}

// Multer Storage Configuration for Product Images
const uploadDir = path.join(__dirname, '../public/uploads/products');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `prod-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowed = /jpeg|jpg|png|webp|gif/;
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.test(ext) || file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WebP, GIF) เท่านั้น'));
        }
    }
});

// POST /api/products/upload (Upload single product image)
router.post('/upload', authenticate, authorize('seller', 'admin'), upload.single('image'), (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์รูปภาพที่ต้องการอัปโหลด' });
        }
        const fileUrl = `/uploads/products/${req.file.filename}`;
        res.json({
            success: true,
            message: 'อัปโหลดรูปภาพสินค้าเรียบร้อยแล้ว',
            imageUrl: fileUrl,
            filename: req.file.filename
        });
    } catch (err) {
        next(err);
    }
});

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
            store_id,
            sort
        } = req.query;

        let query = `
            SELECT 
                p.*,
                c.name as category_name,
                c.icon as category_icon,
                s.store_name,
                ${PUBLIC_DISABILITY_SQL} as disability_type,
                s.province,
                s.support_goal_title,
                s.support_goal_target,
                s.support_goal_current,
                AVG(r.rating) as average_rating,   -- NULL when there are no reviews (no fake 5 stars)
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

        if (store_id) {
            query += ` AND p.store_id = ?`;
            params.push(parseInt(store_id, 10) || 0);
        }

        if (category_id) {
            query += ` AND p.category_id = ?`;
            params.push(parseInt(category_id, 10));
        }

        if (disability_type) {
            query += ` AND ${PUBLIC_DISABILITY_SQL} = ?`;
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
            average_rating: p.average_rating != null ? parseFloat(p.average_rating) : null,
            review_count: parseInt(p.review_count || 0, 10)
        }));
        res.json({ success: true, count: mappedProducts.length, data: mappedProducts });
    } catch (err) {
        next(err);
    }
});

// GET /api/products/stock?ids=1,2,3 - Live stock for the cart page (inactive products report 0)
router.get('/stock', async (req, res, next) => {
    try {
        const ids = String(req.query.ids || '').split(',').map(Number).filter(n => Number.isSafeInteger(n) && n > 0).slice(0, 100);
        if (!ids.length) return res.json({ success: true, data: {} });
        const rows = await db.all(`SELECT id, stock, is_active FROM products WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
        const data = Object.fromEntries(ids.map(id => [id, 0]));
        rows.forEach(r => { data[r.id] = Number(r.is_active) ? Math.max(0, Number(r.stock) || 0) : 0; });
        res.json({ success: true, data });
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
                ${PUBLIC_DISABILITY_SQL} as disability_type,
                s.story as store_story,
                s.craft_technique,
                s.support_goal_title,
                s.support_goal_target,
                s.support_goal_current,
                s.province,
                s.avatar_image as store_avatar,
                s.cover_image as store_cover,
                AVG(r.rating) as average_rating,   -- NULL when there are no reviews (no fake 5 stars)
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
        // Products removed by an admin are only visible to admins and the store owner
        if (Number(product.removed_by_admin)) {
            const viewerId = optionalUserId(req);
            const viewer = viewerId && await db.get(
                'SELECT u.role, (SELECT user_id FROM stores WHERE id = ?) as owner_id FROM users u WHERE u.id = ?', [product.store_id, viewerId]);
            if (!viewer || (viewer.role !== 'admin' && Number(viewer.owner_id) !== Number(viewerId))) {
                return res.status(410).json({ success: false, message: 'สินค้านี้ถูกนำออกจากตลาดใจโดยผู้ดูแลระบบแล้ว' });
            }
        }

        product.price = Number(product.price);
        product.average_rating = product.average_rating != null ? parseFloat(product.average_rating) : null;
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

        const images = await db.all('SELECT id, image_url, alt_text, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC', [productId]);
        const model3d = await db.get('SELECT model_url, status, source_image_count, updated_at FROM product_3d_models WHERE product_id = ?', [productId]);

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
                images,
                model_3d: model3d,
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
        await syncProductMedia(newProduct);

        // Tell the store's followers about the new product
        const store = await db.get('SELECT store_name FROM stores WHERE id = ?', [storeId]);
        const followers = await db.all('SELECT buyer_id FROM follows WHERE store_id = ?', [storeId]);
        for (const f of followers) {
            await notify(f.buyer_id, {
                type: 'new_product',
                title: `${store ? store.store_name : 'ร้านที่คุณติดตาม'} เพิ่มสินค้าใหม่`,
                message: newProduct.name,
                link: `/product-detail.html?id=${newProduct.id}`
            });
        }

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
        if (req.user.role !== 'admin' && Number(product.removed_by_admin)) {
            return res.status(403).json({ success: false, message: `สินค้านี้ถูกผู้ดูแลระบบนำออก (${product.removal_reason || 'ไม่ระบุเหตุผล'}) แก้ไขหรือเปิดขายไม่ได้ กรุณาส่งเรื่องร้องเรียนหากต้องการอุทธรณ์` });
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
        await syncProductMedia(updated);
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

        // Orders and reviews keep pointing at the product (FK ON DELETE RESTRICT), so it is hidden instead
        const used = await db.get(`SELECT (SELECT COUNT(*) FROM order_items WHERE product_id = ?) as orders,
                                          (SELECT COUNT(*) FROM reviews WHERE product_id = ?) as reviews`, [productId, productId]);
        if (Number(used.orders) > 0 || Number(used.reviews) > 0) {
            return res.status(409).json({
                success: false,
                message: `ลบถาวรไม่ได้ เพราะมีคำสั่งซื้อ ${Number(used.orders)} รายการและรีวิว ${Number(used.reviews)} รายการอ้างอิงสินค้านี้ หากต้องการหยุดขาย ให้แก้จำนวนคงเหลือเป็น 0 แทน`
            });
        }

        await db.run('DELETE FROM products WHERE id = ?', [productId]);
        res.json({ success: true, message: 'ลบสินค้าเรียบร้อยแล้ว' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
