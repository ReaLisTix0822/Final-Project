const express = require('express');
const router = express.Router();
const db = require('../config/database');
const geminiService = require('../services/geminiService');

// POST /api/chatbot/message
router.post('/message', async (req, res, next) => {
    try {
        const { message, user_id, order_tracking_code, history = [] } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'กรุณาส่งข้อความคำถาม' });
        }

        const cleanMsg = message.toLowerCase().trim();
        let reply = '';
        let suggestedProducts = [];
        let quickActions = [];

        // 1. Specific Utility: Order Tracking Query
        if (cleanMsg.includes('สถานะ') || cleanMsg.includes('คำสั่งซื้อ') || cleanMsg.includes('พัสดุ') || cleanMsg.includes('ติดตาม') || cleanMsg.includes('track') || order_tracking_code) {
            let order = null;
            if (order_tracking_code) {
                order = await db.get('SELECT o.*, s.store_name FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.tracking_number = ? OR o.id = ?', [order_tracking_code, parseInt(order_tracking_code, 10) || 0]);
            } else if (user_id) {
                order = await db.get('SELECT o.*, s.store_name FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 1', [user_id]);
            }

            if (order) {
                const statusMap = {
                    paid: 'ชำระเงินแล้ว (เตรียมจัดส่ง)',
                    preparing: 'ร้านค้ากำลังจัดเตรียมสินค้า',
                    shipped: 'จัดส่งเรียบร้อยแล้ว',
                    completed: 'จัดส่งสำเร็จ',
                    cancelled: 'ยกเลิกคำสั่งซื้อ'
                };
                reply = `📦 ข้อมูลคำสั่งซื้อล่าสุด (หมายเลข #${order.id}):\n• ร้านค้า: **${order.store_name}**\n• สถานะปัจจุบัน: **${statusMap[order.status] || order.status}**\n• ขนส่ง: ${order.courier_name || 'ไปรษณีย์ไทย'}\n• หมายเลขติดตามพัสดุ: **${order.tracking_number || 'กำลังจัดเตรียมพัสดุ'}**\n• ยอดรวม: ฿${order.grand_total.toLocaleString()}`;
                quickActions = ['ดูประวัติคำสั่งซื้อทั้งหมด', 'แนะนำสินค้าเพิ่ม'];

                return res.json({
                    success: true,
                    reply,
                    suggestedProducts,
                    quickActions,
                    source: 'tracking_system'
                });
            }
        }

        // 2. Fetch live marketplace context (products & stores)
        const featuredProducts = await db.all(`
            SELECT p.id, p.name, p.price, p.image_url, s.store_name, s.disability_type
            FROM products p
            JOIN stores s ON p.store_id = s.id
            WHERE p.is_active = 1
            LIMIT 4
        `);

        // Check if user specifically requested a disability category
        if (cleanMsg.includes('ตาบอด') || cleanMsg.includes('สายตา') || cleanMsg.includes('สาน')) {
            suggestedProducts = await db.all('SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id WHERE s.disability_type = "visual" AND p.is_active = 1 LIMIT 3');
            quickActions = ['ดูงานจักสานทั้งหมด', 'ทำแบบจับคู่ผู้สนับสนุน'];
        } else if (cleanMsg.includes('หูหนวก') || cleanMsg.includes('ได้ยิน') || cleanMsg.includes('ผ้าไหม')) {
            suggestedProducts = await db.all('SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id WHERE s.disability_type = "hearing" AND p.is_active = 1 LIMIT 3');
            quickActions = ['ดูงานผ้าทอทั้งหมด', 'ทำแบบจับคู่ผู้สนับสนุน'];
        } else if (cleanMsg.includes('วีลแชร์') || cleanMsg.includes('เคลื่อนไหว') || cleanMsg.includes('ไม้')) {
            suggestedProducts = await db.all('SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id WHERE s.disability_type = "physical" AND p.is_active = 1 LIMIT 3');
            quickActions = ['ดูงานไม้และเครื่องหนัง', 'ทำแบบจับคู่ผู้สนับสนุน'];
        } else if (cleanMsg.includes('ออทิสติก') || cleanMsg.includes('สติปัญญา') || cleanMsg.includes('เซรามิก')) {
            suggestedProducts = await db.all('SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id WHERE s.disability_type = "intellectual" AND p.is_active = 1 LIMIT 3');
            quickActions = ['ดูงานศิลปะและเซรามิก', 'ทำแบบจับคู่ผู้สนับสนุน'];
        } else {
            suggestedProducts = featuredProducts.slice(0, 3);
            quickActions = ['แนะนำสินค้าขายดี', 'ทำแบบประเมินจับคู่ 4 คำถาม', 'เป้าหมายระดมทุนร้านค้า'];
        }

        // 3. Generate Smart Response via Gemini Flash
        const aiResponse = await geminiService.chat({
            message,
            history,
            marketplaceContext: {
                featuredProducts
            }
        });

        // Persist interaction to chat_messages if user_id is provided
        if (user_id) {
            try {
                await db.run('INSERT INTO chat_messages (sender_id, receiver_id, store_id, sender_role, message, is_read) VALUES (?, ?, ?, ?, ?, ?)', [user_id, null, null, 'buyer', message.trim(), 1]);
                await db.run('INSERT INTO chat_messages (sender_id, receiver_id, store_id, sender_role, message, is_read) VALUES (?, ?, ?, ?, ?, ?)', [1, user_id, null, 'bot', aiResponse.reply, 1]);
            } catch (saveErr) {
                console.warn('Could not persist chatbot message:', saveErr.message);
            }
        }

        res.json({
            success: true,
            reply: aiResponse.reply,
            source: aiResponse.source,
            model: aiResponse.model || geminiService.modelName,
            suggestedProducts,
            quickActions,
            note: aiResponse.note || null
        });
    } catch (err) {
        next(err);
    }
});


module.exports = router;
