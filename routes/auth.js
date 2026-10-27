const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/database');
const { authenticate, JWT_SECRET, sellerStatusMessage } = require('../middleware/auth');
const { notify } = require('../services/notificationService');
const { cleanPhone, PHONE_ERROR } = require('../services/phone');
const { documentUpload, hasIdDocument, saveStoreDocuments } = require('../services/storeDocuments');
const { withStoreVideo } = require('../services/storeVideos');
const { CONSENT_REQUIRED_MESSAGE, isConsentGiven, giveConsent, withdrawConsent, getConsent } = require('../services/consent');
const { deleteStoreDocuments } = require('../services/storeDocuments');

// Multer Storage Configuration for User Avatars
const uploadDir = path.join(__dirname, '../public/uploads/avatars');
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
        cb(null, `avatar-${req.user ? req.user.id : 'user'}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

// POST /api/auth/register
router.post('/register', documentUpload, async (req, res, next) => {
    try {
        const { email, password, full_name, phone, role, disability_type, store_name, story, craft_technique, support_goal_title, support_goal_target } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (อีเมล, รหัสผ่าน, ชื่อ-นามสกุล)' });
        }
        if (!isConsentGiven(req.body.accept_terms)) {
            return res.status(400).json({ success: false, message: 'กรุณายอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว' });
        }

        const phoneDigits = cleanPhone(req.body.phone);
        if (phoneDigits === null) {
            return res.status(400).json({ success: false, message: PHONE_ERROR });
        }

        const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const userRole = role === 'seller' ? 'seller' : 'buyer';

        // Disability type is optional sensitive data (PDPA s.26): only saved with explicit consent
        const disabilityType = userRole === 'seller' && disability_type ? String(disability_type) : null;
        const disabilityConsent = isConsentGiven(req.body.disability_consent);
        if (disabilityType && !disabilityConsent) {
            return res.status(400).json({ success: false, message: CONSENT_REQUIRED_MESSAGE });
        }
        if (disabilityType && !await db.get('SELECT id FROM disability_types WHERE code = ? AND COALESCE(is_active, 1) = 1', [disabilityType])) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกกลุ่มความพิการที่ระบบรองรับ' });
        }
        if (userRole === 'seller' && !hasIdDocument(req)) {
            return res.status(400).json({
                success: false,
                message: disabilityType === 'organization'
                    ? 'กรุณาแนบหนังสือรับรองการจดทะเบียนองค์กร'
                    : 'กรุณาแนบบัตรประจำตัวคนพิการ'
            });
        }
        
        const userResult = await db.run(
            `INSERT INTO users (email, password_hash, full_name, phone, role, avatar_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                email, 
                password_hash, 
                full_name, 
                phoneDigits,
                userRole,
                '/images/default-avatar.svg'
            ]
        );

        const userId = userResult.insertId;
        if (disabilityType) await giveConsent(userId);

        // If registered as seller, create store profile
        if (userRole === 'seller') {
            const storeResult = await db.run(
                `INSERT INTO stores (user_id, store_name, disability_type, story, craft_technique, support_goal_title, support_goal_target, support_goal_current, verification_status, phone, avatar_image)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?)`,
                [
                    userId,
                    store_name || `ร้านค้าของ ${full_name}`,
                    disabilityType,
                    story || 'ช่างฝีมือผู้สร้างสรรค์ผลงานด้วยความมุ่งมั่นและประณีต',
                    craft_technique || 'งานฝีมือแฮนด์เมดประณีต',
                    support_goal_title || 'ระดมทุนสนับสนุนอุปกรณ์และวัตถุดิบในการผลิต',
                    parseFloat(support_goal_target) || 10000.00,
                    phoneDigits,
                    '/images/default-avatar.svg'
                ]
            );
            await saveStoreDocuments(storeResult.insertId, req, disabilityType === 'organization' ? 'organization_cert' : 'disability_card');
        }

        // Sellers are not signed in until an admin approves the store
        if (userRole === 'seller') {
            const admins = await db.all("SELECT id FROM users WHERE role = 'admin'");
            for (const admin of admins) {
                await notify(admin.id, {
                    type: 'store_application',
                    title: 'มีคำขอสมัครเป็นผู้ขายใหม่',
                    message: `${store_name || `ร้านค้าของ ${full_name}`} โดย ${full_name} รอการอนุมัติ`,
                    link: '/admin-stores.html'
                });
            }
            return res.status(201).json({
                success: true,
                pending: true,
                message: 'ส่งคำขอสมัครเป็นผู้ขายเรียบร้อยแล้ว กรุณารอผู้ดูแลระบบตรวจสอบและอนุมัติก่อนเข้าสู่ระบบ'
            });
        }

        const token = jwt.sign({ id: userId, email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
        await recordLogin(req, userId, 'success');
        const user = await db.get('SELECT id, email, full_name, phone, role, avatar_url FROM users WHERE id = ?', [userId]);
        const store = null;

        res.status(201).json({
            success: true,
            message: 'ลงทะเบียนสำเร็จ ยินดีต้อนรับสู่แพลตฟอร์ม',
            token,
            user,
            store
        });
    } catch (err) {
        next(err);
    }
});

// One row per sign-in attempt on a known account (never throws: logging must not block a login)
async function recordLogin(req, userId, status) {
    try {
        const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 64);
        await db.run('INSERT INTO login_history (user_id, status, ip_address, user_agent) VALUES (?, ?, ?, ?)',
            [userId, status, ip, String(req.headers['user-agent'] || '').slice(0, 255)]);
        if (status === 'success') await db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    } catch (err) {
        console.warn('[Auth] Login history not saved:', err.message);
    }
}

// Shared by /login and /demo-login: seller approval check, token, login history, response
async function sendLoginSuccess(req, res, user) {
    let store = null;
    if (user.role === 'seller') {
        store = await withStoreVideo(await db.get('SELECT * FROM stores WHERE user_id = ?', [user.id]));
        const status = store ? store.verification_status : 'pending';
        if (status !== 'approved') {
            await recordLogin(req, user.id, 'blocked');
            return res.status(403).json({ success: false, verification_status: status, message: sellerStatusMessage(store) });
        }
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    await recordLogin(req, user.id, 'success');

    res.json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        token,
        user: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone, role: user.role, avatar_url: user.avatar_url, bio: user.bio },
        store
    });
}

// Demo accounts for the 1-click buttons on the login page. Only the KEY is sent from the browser;
// e-mails stay on the server and no password is needed. Works only when DEMO_MODE=true in .env.
const DEMO_ACCOUNTS = {
    admin: 'admin@inclusive-market.org',
    buyer: 'buyer.anurak@gmail.com',
    seller_visual: 'somchai.blindcraft@gmail.com',
    seller_hearing: 'wilai.deafcraft@gmail.com',
    seller_physical: 'ekkachai.woodart@gmail.com',
    seller_organization: 'nattapong.artheart@gmail.com'   // runs an organization store (the intellectual group is closed)
};

// GET /api/auth/demo-accounts - Is 1-click demo login available?
router.get('/demo-accounts', (req, res) => {
    res.json({ success: true, enabled: process.env.DEMO_MODE === 'true', accounts: process.env.DEMO_MODE === 'true' ? Object.keys(DEMO_ACCOUNTS) : [] });
});

// POST /api/auth/demo-login { account: 'admin' | 'buyer' | 'seller_visual' | ... }
router.post('/demo-login', async (req, res, next) => {
    try {
        if (process.env.DEMO_MODE !== 'true') {
            return res.status(404).json({ success: false, message: 'ปิดการเข้าสู่ระบบด่วน (Demo) อยู่' });
        }
        const email = DEMO_ACCOUNTS[String(req.body.account || req.body.role || '')];
        if (!email) return res.status(400).json({ success: false, message: 'ไม่พบบัญชีทดลองนี้' });
        const user = await db.get('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
        if (!user) return res.status(404).json({ success: false, message: 'ไม่พบบัญชีทดลองในฐานข้อมูล' });
        await sendLoginSuccess(req, res, user);
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
        }

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user || user.deleted_at) {
            return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            await recordLogin(req, user.id, 'wrong_password');
            return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        await sendLoginSuccess(req, res, user);
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    res.json({
        success: true,
        user: req.user,
        store: req.store || null
    });
});

// POST /api/auth/upload-avatar
router.post('/upload-avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์รูปภาพที่ต้องการอัปโหลด' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        await db.run(
            'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [avatarUrl, req.user.id]
        );

        const updatedUser = await db.get(
            'SELECT id, email, full_name, phone, role, avatar_url, bio FROM users WHERE id = ?',
            [req.user.id]
        );

        let store = null;
        if (updatedUser.role === 'seller') {
            store = await withStoreVideo(await db.get('SELECT * FROM stores WHERE user_id = ?', [updatedUser.id]));
        }

        res.json({
            success: true,
            message: 'อัปโหลดรูปภาพโปรไฟล์เรียบร้อยแล้ว',
            avatar_url: avatarUrl,
            user: updatedUser,
            store
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/auth/profile (Supports both JSON and Multipart FormData)
router.put('/profile', authenticate, upload.single('avatar'), async (req, res, next) => {
    try {
        const { full_name, phone, bio } = req.body;
        let avatar_url = req.body.avatar_url;

        if (req.file) {
            avatar_url = `/uploads/avatars/${req.file.filename}`;
        }

        const phoneDigits = cleanPhone(phone);
        if (phoneDigits === null) {
            return res.status(400).json({ success: false, message: PHONE_ERROR });
        }
        if (!full_name || full_name.trim() === '') {
            return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ-นามสกุล' });
        }

        await db.run(
            `UPDATE users SET 
                full_name = ?, 
                phone = ?, 
                bio = ?, 
                avatar_url = ?, 
                updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [
                full_name.trim(),
                phoneDigits,
                bio || '',
                avatar_url || req.user.avatar_url || '/images/default-avatar.svg',
                req.user.id
            ]
        );

        const updatedUser = await db.get(
            'SELECT id, email, full_name, phone, role, avatar_url, bio FROM users WHERE id = ?',
            [req.user.id]
        );

        let store = null;
        if (updatedUser.role === 'seller') {
            store = await withStoreVideo(await db.get('SELECT * FROM stores WHERE user_id = ?', [updatedUser.id]));
        }

        res.json({
            success: true,
            message: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว',
            user: updatedUser,
            store
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/auth/password
router.put('/password', authenticate, async (req, res, next) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
        }

        const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้' });
        }

        const isMatch = await bcrypt.compare(current_password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        }

        const newHash = await bcrypt.hash(new_password, 10);
        await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id]);

        res.json({
            success: true,
            message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว'
        });
    } catch (err) {
        next(err);
    }
});

// ==============================================================================
// PRIVACY (PDPA): the owner's own data, consent for disability data, closing the account
// ==============================================================================

// GET /api/auth/privacy - What we keep about the signed-in user (right of access)
router.get('/privacy', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [user, consent, store, preferences, addressCount, documents] = await Promise.all([
            db.get('SELECT id, email, full_name, phone, role, bio, created_at, last_login_at FROM users WHERE id = ?', [userId]),
            getConsent(userId),
            db.get(`SELECT s.id, s.store_name, s.disability_type, COALESCE(dt.label, dt.name) as disability_label
                    FROM stores s LEFT JOIN disability_types dt ON dt.code = s.disability_type WHERE s.user_id = ?`, [userId]),
            db.all(`SELECT COALESCE(dt.label, dt.name) as label FROM matching_preferences mp
                    JOIN disability_types dt ON dt.id = mp.type_id WHERE mp.user_id = ?`, [userId]),
            db.get('SELECT COUNT(*) as total FROM addresses WHERE user_id = ?', [userId]),
            db.all(`SELECT d.id, d.doc_type, d.original_name, d.created_at FROM store_documents d
                    JOIN stores s ON s.id = d.store_id WHERE s.user_id = ? ORDER BY d.id`, [userId])
        ]);
        res.json({
            success: true,
            data: {
                user,
                ...consent,
                store_disability: store ? { code: store.disability_type, label: store.disability_label } : null,
                matching_disability_preferences: preferences.map(p => p.label),
                address_count: Number(addressCount?.total || 0),
                documents
            }
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/consent - Give explicit consent to keep disability data
router.post('/consent', authenticate, async (req, res, next) => {
    try {
        if (!isConsentGiven(req.body.disability_consent)) {
            return res.status(400).json({ success: false, message: 'กรุณาติ๊กช่องยินยอมก่อนบันทึก' });
        }
        await giveConsent(req.user.id);
        res.json({ success: true, message: 'บันทึกความยินยอมเรียบร้อยแล้ว', data: await getConsent(req.user.id) });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/auth/consent - Withdraw consent: disability type and matching preferences are deleted
router.delete('/consent', authenticate, async (req, res, next) => {
    try {
        await withdrawConsent(req.user.id);
        res.json({
            success: true,
            message: 'ถอนความยินยอมแล้ว ระบบลบข้อมูลประเภทความพิการของคุณเรียบร้อย',
            data: await getConsent(req.user.id)
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/auth/account - Close the account (soft delete). The row stays because orders
// still point to it, but name, e-mail, phone, addresses and disability data are erased.
router.delete('/account', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        if (req.user.role === 'admin') {
            return res.status(403).json({ success: false, message: 'บัญชีผู้ดูแลระบบลบด้วยตนเองไม่ได้ กรุณาติดต่อผู้ดูแลระบบคนอื่น' });
        }
        const account = await db.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (!req.body.password || !await bcrypt.compare(String(req.body.password), account.password_hash)) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการลบบัญชี' });
        }
        // Orders that are still on their way need both sides to finish them
        const openOrders = await db.get(`SELECT COUNT(*) as total FROM orders o LEFT JOIN stores s ON s.id = o.store_id
            WHERE (o.buyer_id = ? OR s.user_id = ?) AND o.status IN ('pending', 'paid', 'processing', 'preparing', 'shipped')`, [userId, userId]);
        if (Number(openOrders.total) > 0) {
            return res.status(409).json({ success: false, message: `ยังมีคำสั่งซื้อที่ยังไม่เสร็จสิ้น ${openOrders.total} รายการ กรุณารอให้จัดส่งเสร็จหรือยกเลิกก่อนลบบัญชี` });
        }

        await withdrawConsent(userId);
        const store = await db.get('SELECT id FROM stores WHERE user_id = ?', [userId]);
        if (store) {
            await deleteStoreDocuments(store.id);
            await db.run("UPDATE stores SET phone = NULL, address = NULL, verification_status = 'closed' WHERE id = ?", [store.id]);
            await db.run('UPDATE products SET is_active = 0 WHERE store_id = ?', [store.id]);
        }
        for (const table of ['addresses', 'cart_items', 'favorites', 'notifications', 'login_history', 'matching_preferences', 'accessibility_settings']) {
            await db.run(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
        }
        // Finished orders stay for the accounts, without the buyer's name, phone and address
        await db.run(`UPDATE orders SET shipping_name = 'ผู้ใช้ที่ลบบัญชีแล้ว', shipping_phone = '-',
                      shipping_address = '(ลบตามคำขอของเจ้าของข้อมูล)' WHERE buyer_id = ?`, [userId]);
        await db.run('DELETE FROM follows WHERE buyer_id = ?', [userId]);
        await db.run('UPDATE search_history SET user_id = NULL WHERE user_id = ?', [userId]);
        await db.run('UPDATE chatbot_logs SET user_id = NULL WHERE user_id = ?', [userId]);
        await db.run('UPDATE bot_sessions SET user_id = NULL WHERE user_id = ?', [userId]);
        // Unusable password: nobody can sign in to this row again
        const lockedHash = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 10);
        await db.run(`UPDATE users SET full_name = 'ผู้ใช้ที่ลบบัญชีแล้ว', email = ?, phone = NULL, bio = NULL,
                      avatar_url = '/images/default-avatar.svg', password_hash = ?, deleted_at = CURRENT_TIMESTAMP
                      WHERE id = ?`, [`deleted-${userId}@deleted.taladjai.invalid`, lockedHash, userId]);

        res.json({ success: true, message: 'ลบบัญชีและข้อมูลส่วนบุคคลของคุณเรียบร้อยแล้ว' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

