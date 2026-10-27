const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_inclusive_marketplace_key_2026';

const SELLER_STATUS_MESSAGES = {
    pending: 'บัญชีผู้ขายของคุณอยู่ระหว่างรอผู้ดูแลระบบตรวจสอบและอนุมัติ จึงยังเข้าสู่ระบบไม่ได้',
    rejected: 'บัญชีผู้ขายของคุณไม่ผ่านการอนุมัติหรือถูกระงับ กรุณาติดต่อผู้ดูแลระบบ'
};

// Message for a seller whose store is not approved (includes the admin's reason when rejected)
const sellerStatusMessage = store => {
    const status = store ? store.verification_status : 'pending';
    const base = SELLER_STATUS_MESSAGES[status] || SELLER_STATUS_MESSAGES.pending;
    return status === 'rejected' && store.rejection_reason ? `${base} (เหตุผล: ${store.rejection_reason})` : base;
};

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await db.get('SELECT id, email, full_name, role, phone, avatar_url, deleted_at FROM users WHERE id = ?', [decoded.id]);
        // Closed (soft-deleted) accounts: old tokens stop working at once
        if (!user || user.deleted_at) {
            return res.status(401).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้งานในระบบ' });
        }
        delete user.deleted_at;

        req.user = user;

        // If seller, attach store details
        if (user.role === 'seller') {
            const store = await db.get('SELECT * FROM stores WHERE user_id = ?', [user.id]);
            req.store = store || null;
            // Stores waiting for (or refused) admin approval cannot use the account yet
            const status = store ? store.verification_status : 'pending';
            if (status !== 'approved') {
                return res.status(403).json({ success: false, verification_status: status, message: sellerStatusMessage(store) });
            }
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

// For routes that also serve guests: the user id from a valid token, otherwise null
const optionalUserId = req => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(header.split(' ')[1], JWT_SECRET).id || null;
    } catch (e) {
        return null;
    }
};

module.exports = { authenticate, authorize, optionalUserId, JWT_SECRET, SELLER_STATUS_MESSAGES, sellerStatusMessage };
