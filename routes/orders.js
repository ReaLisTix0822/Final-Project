const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/orders (Create order with items & tipping)
router.post('/', authenticate, async (req, res, next) => {
    try {
        const {
            items,              // [{ product_id, quantity }]
            tip_amount = 0,     // tip / donation amount
            shipping_name,
            shipping_phone,
            shipping_address,
            payment_method = 'promptpay',
            notes = ''
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'ไม่มีรายการสินค้าในคำสั่งซื้อ' });
        }

        if (!shipping_name || !shipping_phone || !shipping_address) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่อยู่จัดส่งให้ครบถ้วน' });
        }

        // Fetch products and verify store
        let subtotal = 0;
        const verifiedItems = [];
        let storeId = null;

        for (const item of items) {
            const product = await db.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [item.product_id]);
            if (!product) {
                return res.status(400).json({ success: false, message: `ไม่พบสินค้า ID ${item.product_id} หรือสินค้าไม่พร้อมจำหน่าย` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ success: false, message: `สินค้า "${product.name}" มีจำนวนคงเหลือไม่พอ (คงเหลือ ${product.stock} ชิ้น)` });
            }
            if (!storeId) {
                storeId = product.store_id;
            }

            const itemSubtotal = product.price * item.quantity;
            subtotal += itemSubtotal;
            verifiedItems.push({
                product_id: product.id,
                product_name: product.name,
                product_image: product.image_url,
                quantity: item.quantity,
                unit_price: product.price,
                subtotal: itemSubtotal
            });
        }

        const tip = Math.max(0, parseFloat(tip_amount) || 0);
        const shipping_cost = 50.00;
        const grand_total = subtotal + tip + shipping_cost;

        // Create order
        const orderResult = await db.run(`
            INSERT INTO orders (buyer_id, store_id, subtotal, tip_amount, shipping_cost, grand_total, status, shipping_name, shipping_phone, shipping_address, payment_method, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)
        `, [
            req.user.id,
            storeId,
            subtotal,
            tip,
            shipping_cost,
            grand_total,
            shipping_name,
            shipping_phone,
            shipping_address,
            payment_method,
            notes
        ]);

        const orderId = orderResult.insertId;

        // Insert order items & reduce product stock
        for (const vi of verifiedItems) {
            await db.run(`
                INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, unit_price, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [orderId, vi.product_id, vi.product_name, vi.product_image, vi.quantity, vi.unit_price, vi.subtotal]);

            await db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [vi.quantity, vi.product_id]);
        }

        // If tip provided, update store's support goal progress!
        if (tip > 0 && storeId) {
            await db.run('UPDATE stores SET support_goal_current = support_goal_current + ? WHERE id = ?', [tip, storeId]);
        }

        const createdOrder = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);

        res.status(201).json({
            success: true,
            message: 'สร้างรายการสั่งซื้อและชำระเงินเรียบร้อยแล้ว ขอบคุณที่ร่วมสนับสนุน!',
            order_id: orderId,
            data: createdOrder
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/orders/my-orders (Buyer order history)
router.get('/my-orders', authenticate, async (req, res, next) => {
    try {
        const orders = await db.all(`
            SELECT 
                o.*,
                s.store_name,
                s.disability_type,
                s.avatar_image as store_avatar
            FROM orders o
            JOIN stores s ON o.store_id = s.id
            WHERE o.buyer_id = ?
            ORDER BY o.created_at DESC
        `, [req.user.id]);

        // Attach items for each order
        for (const order of orders) {
            order.items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
        }

        res.json({ success: true, count: orders.length, data: orders });
    } catch (err) {
        next(err);
    }
});

// GET /api/orders/seller-orders (Seller order management)
router.get('/seller-orders', authenticate, authorize('seller', 'admin'), async (req, res, next) => {
    try {
        let storeId = req.store ? req.store.id : 1;
        
        const orders = await db.all(`
            SELECT 
                o.*,
                u.full_name as buyer_name,
                u.email as buyer_email
            FROM orders o
            JOIN users u ON o.buyer_id = u.id
            WHERE o.store_id = ?
            ORDER BY o.created_at DESC
        `, [storeId]);

        for (const order of orders) {
            order.items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
        }

        res.json({ success: true, count: orders.length, data: orders });
    } catch (err) {
        next(err);
    }
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const order = await db.get(`
            SELECT 
                o.*,
                s.store_name,
                s.phone as store_phone,
                u.full_name as buyer_name
            FROM orders o
            JOIN stores s ON o.store_id = s.id
            JOIN users u ON o.buyer_id = u.id
            WHERE o.id = ?
        `, [orderId]);

        if (!order) {
            return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อนี้' });
        }

        // Check ownership
        if (req.user.role !== 'admin' && order.buyer_id !== req.user.id && (!req.store || req.store.id !== order.store_id)) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้' });
        }

        order.items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

        res.json({ success: true, data: order });
    } catch (err) {
        next(err);
    }
});

// PUT /api/orders/:id/status (Update shipping status and tracking)
router.put('/:id/status', authenticate, authorize('seller', 'admin'), async (req, res, next) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const { status, tracking_number, courier_name } = req.body;

        const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!order) {
            return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
        }

        if (req.user.role !== 'admin' && req.store && order.store_id !== req.store.id) {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขคำสั่งซื้อนี้' });
        }

        await db.run(`
            UPDATE orders SET
                status = COALESCE(?, status),
                tracking_number = COALESCE(?, tracking_number),
                courier_name = COALESCE(?, courier_name),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, tracking_number, courier_name, orderId]);

        const updated = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
        res.json({ success: true, message: 'อัปเดตสถานะการจัดส่งเรียบร้อยแล้ว', data: updated });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
