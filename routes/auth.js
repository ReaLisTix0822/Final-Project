const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

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
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, full_name, phone, role, disability_type, store_name, story, craft_technique, support_goal_title, support_goal_target } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (อีเมล, รหัสผ่าน, ชื่อ-นามสกุล)' });
        }

        const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const userRole = role === 'seller' ? 'seller' : 'buyer';
        
        const userResult = await db.run(
            `INSERT INTO users (email, password_hash, full_name, phone, role, avatar_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                email, 
                password_hash, 
                full_name, 
                phone || '', 
                userRole,
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'
            ]
        );

        const userId = userResult.insertId;

        // If registered as seller, create store profile
        if (userRole === 'seller') {
            await db.run(
                `INSERT INTO stores (user_id, store_name, disability_type, story, craft_technique, support_goal_title, support_goal_target, support_goal_current, verification_status, phone, avatar_image)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'approved', ?, ?)`,
                [
                    userId,
                    store_name || `ร้านค้าของ ${full_name}`,
                    disability_type || 'physical',
                    story || 'ช่างฝีมือผู้สร้างสรรค์ผลงานด้วยความมุ่งมั่นและประณีต',
                    craft_technique || 'งานฝีมือแฮนด์เมดประณีต',
                    support_goal_title || 'ระดมทุนสนับสนุนอุปกรณ์และวัตถุดิบในการผลิต',
                    parseFloat(support_goal_target) || 10000.00,
                    phone || '',
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'
                ]
            );
        }

        const token = jwt.sign({ id: userId, email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
        const user = await db.get('SELECT id, email, full_name, phone, role, avatar_url FROM users WHERE id = ?', [userId]);
        let store = null;
        if (userRole === 'seller') {
            store = await db.get('SELECT * FROM stores WHERE user_id = ?', [userId]);
        }

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

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
        }

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        
        let store = null;
        if (user.role === 'seller') {
            store = await db.get('SELECT * FROM stores WHERE user_id = ?', [user.id]);
        }

        const userResponse = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            role: user.role,
            avatar_url: user.avatar_url,
            bio: user.bio
        };

        res.json({
            success: true,
            message: 'เข้าสู่ระบบสำเร็จ',
            token,
            user: userResponse,
            store
        });
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
            store = await db.get('SELECT * FROM stores WHERE user_id = ?', [updatedUser.id]);
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
                phone || '',
                bio || '',
                avatar_url || req.user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
                req.user.id
            ]
        );

        const updatedUser = await db.get(
            'SELECT id, email, full_name, phone, role, avatar_url, bio FROM users WHERE id = ?',
            [req.user.id]
        );

        let store = null;
        if (updatedUser.role === 'seller') {
            store = await db.get('SELECT * FROM stores WHERE user_id = ?', [updatedUser.id]);
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

module.exports = router;

