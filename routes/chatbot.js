const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { PUBLIC_DISABILITY_SQL } = require('../services/consent');
const geminiService = require('../services/geminiService');
const { optionalUserId } = require('../middleware/auth');
const { logChat } = require('../services/chatbotLogService');

// A message is a navigation command only when it starts with a clear verb.
// Returns { type: 'navigate', url, label, speak } or null (then Gemini answers the question).
const NAV_VERB = /^(?:ช่วย|ขอ)?\s*(?:พา(?:ฉัน|ผม|หนู|เรา)?\s*ไป(?:ที่|หน้า)?|ไปที่|ไปหน้า|เปิด(?:หน้า)?|นำทาง(?:ไป)?|กลับไป(?:ที่)?|go to|open)\s*/;
const NAV_TARGETS = [
    [/หน้าแรก|home/, '/index.html', 'ไปที่หน้าแรก'],
    [/จับคู่|matching|แบบสอบถาม|แบบประเมิน/, '/matching.html?fresh=1', 'ไปที่หน้าจับคู่ผู้สนับสนุน'],
    [/3d|สามมิติ|3 มิติ|โมเดล/, '/products.html?has_3d=true', 'ชมสินค้าที่มีโมเดล 3D 360°'],
    [/ตะกร้า|cart|เช็คเอาท์/, '/cart.html', 'ไปที่ตะกร้าสินค้า'],
    [/แดชบอร์ด|จัดการร้าน|หลังบ้าน/, '/seller-dashboard.html', 'ไปที่แดชบอร์ดร้านค้า'],
    [/โปรไฟล์|บัญชี|คำสั่งซื้อ|profile/, '/profile.html', 'ไปที่หน้าบัญชีของฉัน'],
    [/แคมเปญ|กิจกรรม|บูธ/, '/campaigns.html', 'ไปที่หน้ากิจกรรมและงานออกบูธ'],
    [/ร้านค้า|ช่างฝีมือ/, '/stores.html', 'ไปที่หน้ารวมร้านค้า'],
    [/สินค้า|ช็อป|shop/, '/products.html', 'ไปที่หน้ารวมสินค้า'],
    [/เข้าสู่ระบบ|ล็อกอิน|login|สมัคร/, '/login.html', 'ไปที่หน้าเข้าสู่ระบบ']
];
function detectNavigationCommand(text) {
    const search = text.match(/^(?:ค้นหา|ค้น)\s*(?:สินค้า|ผลงาน)?\s+(.+)/);
    if (search && search[1].trim()) {
        const term = search[1].trim();
        return { type: 'navigate', url: `/products.html?search=${encodeURIComponent(term)}`, label: `ดูผลการค้นหา "${term}"`, speak: `กำลังค้นหาสินค้า ${term} ให้ครับ` };
    }
    if (!NAV_VERB.test(text)) return null;
    const rest = text.replace(NAV_VERB, '');
    const target = NAV_TARGETS.find(([pattern]) => pattern.test(rest));
    return target ? { type: 'navigate', url: target[1], label: target[2], speak: `กำลัง${target[2]}ครับ` } : null;
}

// POST /api/chatbot/message
router.post('/message', async (req, res, next) => {
    const startedAt = Date.now();
    // The user comes from the login token, never from the request body
    const user_id = optionalUserId(req);
    const logBase = { sessionId: req.body.session_id, userId: user_id, userMessage: req.body.message, pagePath: req.body.page_path,
        assistMode: req.body.assist_mode, inputType: req.body.input_type };
    try {
        const { message, order_tracking_code, history = [] } = req.body;

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
                reply = `📦 ข้อมูลคำสั่งซื้อล่าสุด (หมายเลข #${order.id}):\n• ร้านค้า: **${order.store_name}**\n• สถานะปัจจุบัน: **${statusMap[order.status] || order.status}**\n• ขนส่ง: ${order.courier_name || 'ไปรษณีย์ไทย'}\n• หมายเลขติดตามพัสดุ: **${order.tracking_number || 'กำลังจัดเตรียมพัสดุ'}**\n• ยอดรวม: ฿${Number(order.grand_total).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
                quickActions = ['เปิดหน้าคำสั่งซื้อของฉัน', 'แนะนำสินค้าขายดี'];

                await logChat({ ...logBase, botReply: reply, source: 'tracking_system', responseMs: Date.now() - startedAt });
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
            SELECT p.id, p.name, p.price, p.image_url, s.store_name, ${PUBLIC_DISABILITY_SQL} as disability_type
            FROM products p
            JOIN stores s ON p.store_id = s.id
            WHERE p.is_active = 1 AND s.verification_status = 'approved'
            ORDER BY p.is_featured DESC, p.id
        `);
        const storesContext = await db.all(`
            SELECT s.store_name, COALESCE(dt.label, 'ไม่ระบุ') as disability_group, s.support_goal_title
            FROM stores s LEFT JOIN disability_types dt ON dt.code = ${PUBLIC_DISABILITY_SQL}
            WHERE s.verification_status = 'approved'`);

        // Budget in the question ("ไม่เกิน 500 บาท", "งบ 300"): suggest products within it
        const budgetMatch = cleanMsg.match(/(?:ไม่เกิน|ต่ำกว่า|น้อยกว่า|งบ(?:ประมาณ)?|ราคา)\s*([\d,]+)/);
        const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : null;

        // Check if user specifically requested a disability category
        if (cleanMsg.includes('ตาบอด') || cleanMsg.includes('สายตา') || cleanMsg.includes('สาน')) {
            suggestedProducts = await db.all(`SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id WHERE ${PUBLIC_DISABILITY_SQL} = 'visual' AND p.is_active = 1 LIMIT 3`);
            quickActions = ['ค้นหา จักสาน', 'เปิดหน้าจับคู่ผู้สนับสนุน'];
        } else if (cleanMsg.includes('หูหนวก') || cleanMsg.includes('ได้ยิน') || cleanMsg.includes('ผ้าไหม')) {
            suggestedProducts = await db.all(`SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id WHERE ${PUBLIC_DISABILITY_SQL} = 'hearing' AND p.is_active = 1 LIMIT 3`);
            quickActions = ['ค้นหา ผ้า', 'เปิดหน้าจับคู่ผู้สนับสนุน'];
        } else if (cleanMsg.includes('วีลแชร์') || cleanMsg.includes('เคลื่อนไหว') || cleanMsg.includes('ไม้')) {
            suggestedProducts = await db.all(`SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id WHERE ${PUBLIC_DISABILITY_SQL} = 'physical' AND p.is_active = 1 LIMIT 3`);
            quickActions = ['ค้นหา ไม้', 'เปิดหน้าจับคู่ผู้สนับสนุน'];
        } else if (cleanMsg.includes('ออทิสติก') || cleanMsg.includes('สติปัญญา') || cleanMsg.includes('เซรามิก')) {
            suggestedProducts = await db.all(`SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id WHERE ${PUBLIC_DISABILITY_SQL} = 'organization' AND p.is_active = 1 LIMIT 3`);   // their work is sold through organizations
            quickActions = ['ค้นหา เซรามิก', 'เปิดหน้าจับคู่ผู้สนับสนุน'];
        } else if (budget) {
            suggestedProducts = await db.all(`SELECT p.*, s.store_name FROM products p JOIN stores s ON p.store_id = s.id
                WHERE p.is_active = 1 AND s.verification_status = 'approved' AND p.price <= ? ORDER BY p.is_featured DESC, p.price DESC LIMIT 3`, [budget]);
            quickActions = ['เปิดหน้าจับคู่ผู้สนับสนุน', 'พาไปหน้าสินค้า'];
        } else {
            suggestedProducts = featuredProducts.slice(0, 3);
            quickActions = ['แนะนำสินค้าขายดี', 'เปิดหน้าจับคู่ผู้สนับสนุน', 'เป้าหมายระดมทุนของร้านคืออะไร'];
        }

        // 3. Navigation only for a clear command ("พาไป...", "เปิด...", "ไปหน้า...", "ค้นหา ...").
        //    Questions such as "แนะนำของขวัญราคาไม่เกิน 500 บาท" are answered by Gemini, never redirected.
        const action = detectNavigationCommand(cleanMsg);

        // 4. Generate Smart Response via Gemini Flash
        const aiResponse = await geminiService.chat({
            message,
            history,
            marketplaceContext: {
                featuredProducts: featuredProducts.map(p => ({ id: p.id, name: p.name, price: Number(p.price), store: p.store_name })),
                stores: storesContext
            }
        });

        await logChat({
            ...logBase,
            botReply: aiResponse.reply,
            source: aiResponse.source,
            model: aiResponse.model || geminiService.modelName,
            actionUrl: action && action.url,
            responseMs: Date.now() - startedAt,
            errorMessage: aiResponse.note || null
        });

        res.json({
            success: true,
            reply: aiResponse.reply,
            source: aiResponse.source,
            model: aiResponse.model || geminiService.modelName,
            suggestedProducts,
            quickActions,
            action,
            note: aiResponse.note || null
        });
    } catch (err) {
        await logChat({ ...logBase, source: 'error', responseMs: Date.now() - startedAt, errorMessage: err.message });
        next(err);
    }
});

// POST /api/chatbot/log - Log a command the widget answered itself (quick voice / text navigation)
router.post('/log', async (req, res) => {
    const { message, reply, action_url, session_id, page_path, assist_mode, input_type } = req.body;
    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'ไม่มีข้อความ' });
    }
    await logChat({
        sessionId: session_id,
        userId: optionalUserId(req),
        userMessage: message.trim(),
        botReply: typeof reply === 'string' ? reply : null,
        source: 'quick_action',
        actionUrl: typeof action_url === 'string' && action_url.startsWith('/') ? action_url : null,
        pagePath: page_path,
        assistMode: assist_mode,
        inputType: input_type
    });
    res.status(201).json({ success: true });
});

module.exports = router;
