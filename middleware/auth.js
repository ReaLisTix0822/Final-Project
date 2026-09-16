const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_inclusive_marketplace_key_2026';

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await db.get('SELECT id, email, full_name, role, phone, avatar_url FROM users WHERE id = ?', [decoded.id]);
        if (!user) {
            return res.status(401).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้งานในระบบ' });
        }

        req.user = user;

        // If seller, attach store details
        if (user.role === 'seller') {
            const store = await db.get('SELECT * FROM stores WHERE user_id = ?', [user.id]);
            req.store = store || null;
        }

        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'เซสชันหมดอายุหรือโทเคนไม่ถูกต้อง', error: err.message });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (ต้องการสิทธิ์: ${roles.join(', ')})` 
            });
        }
        next();
    };
};

module.exports = { authenticate, authorize, JWT_SECRET };
