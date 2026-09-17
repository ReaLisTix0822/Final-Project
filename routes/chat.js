const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/chat/messages - Retrieve messages between current user and a store/user
router.get('/messages', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { store_id, receiver_id } = req.query;

        let query = '';
        let params = [];

        if (store_id) {
            // Get messages related to this store
            query = `
                SELECT m.*, 
                       u_sender.full_name as sender_name, u_sender.avatar_url as sender_avatar,
                       u_recv.full_name as receiver_name, u_recv.avatar_url as receiver_avatar,
                       s.store_name
                FROM chat_messages m
                LEFT JOIN users u_sender ON m.sender_id = u_sender.id
                LEFT JOIN users u_recv ON m.receiver_id = u_recv.id
                LEFT JOIN stores s ON m.store_id = s.id
                WHERE (m.store_id = ?) AND (m.sender_id = ? OR m.receiver_id = ?)
                ORDER BY m.created_at ASC
            `;
            params = [store_id, userId, userId];
        } else if (receiver_id) {
            query = `
                SELECT m.*, 
                       u_sender.full_name as sender_name, u_sender.avatar_url as sender_avatar,
                       u_recv.full_name as receiver_name, u_recv.avatar_url as receiver_avatar,
                       s.store_name
                FROM chat_messages m
                LEFT JOIN users u_sender ON m.sender_id = u_sender.id
                LEFT JOIN users u_recv ON m.receiver_id = u_recv.id
                LEFT JOIN stores s ON m.store_id = s.id
                WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
                ORDER BY m.created_at ASC
            `;
            params = [userId, receiver_id, receiver_id, userId];
        } else {
            // Get all messages where user is either sender or receiver
            query = `
                SELECT m.*, 
                       u_sender.full_name as sender_name, u_sender.avatar_url as sender_avatar,
                       u_recv.full_name as receiver_name, u_recv.avatar_url as receiver_avatar,
                       s.store_name
                FROM chat_messages m
                LEFT JOIN users u_sender ON m.sender_id = u_sender.id
                LEFT JOIN users u_recv ON m.receiver_id = u_recv.id
                LEFT JOIN stores s ON m.store_id = s.id
                WHERE m.sender_id = ? OR m.receiver_id = ?
                ORDER BY m.created_at ASC
            `;
            params = [userId, userId];
        }

        const messages = await db.all(query, params);

        res.json({
            success: true,
            count: messages.length,
            data: messages
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/chat/messages - Send a message to a store or another user
router.post('/messages', authenticate, async (req, res, next) => {
    try {
        const senderId = req.user.id;
        const senderRole = req.user.role || 'buyer';
        const { receiver_id, store_id, message } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อความ' });
        }

        let resolvedReceiverId = receiver_id ? parseInt(receiver_id, 10) : null;
        let resolvedStoreId = store_id ? parseInt(store_id, 10) : null;

        // If store_id provided but no receiver_id, look up the store owner's user_id
        if (resolvedStoreId && !resolvedReceiverId) {
            const store = await db.get('SELECT user_id FROM stores WHERE id = ?', [resolvedStoreId]);
            if (store) {
                resolvedReceiverId = store.user_id;
            }
        }

        const result = await db.run(`
            INSERT INTO chat_messages (sender_id, receiver_id, store_id, sender_role, message, is_read)
            VALUES (?, ?, ?, ?, ?, 0)
        `, [senderId, resolvedReceiverId, resolvedStoreId, senderRole, message.trim()]);

        const insertedId = result.lastID || result.insertId;
        const insertedMessage = await db.get(`
            SELECT m.*, 
                   u_sender.full_name as sender_name, u_sender.avatar_url as sender_avatar,
                   s.store_name
            FROM chat_messages m
            LEFT JOIN users u_sender ON m.sender_id = u_sender.id
            LEFT JOIN stores s ON m.store_id = s.id
            WHERE m.id = ?
        `, [insertedId]);

        res.status(201).json({
            success: true,
            message: 'ส่งข้อความเรียบร้อยแล้ว',
            data: insertedMessage
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/chat/conversations - List active conversation threads for current user/seller
router.get('/conversations', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const isSeller = req.user.role === 'seller';
        let storeId = null;
        if (isSeller && req.store) {
            storeId = req.store.id;
        }

        const threads = await db.all(`
            SELECT 
                CASE 
                    WHEN m.sender_id = ? THEN m.receiver_id 
                    ELSE m.sender_id 
                END as contact_user_id,
                m.store_id,
                s.store_name,
                u.full_name as contact_name,
                u.avatar_url as contact_avatar,
                m.message as last_message,
                m.created_at as last_message_at,
                m.is_read
            FROM chat_messages m
            JOIN users u ON u.id = (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END)
            LEFT JOIN stores s ON m.store_id = s.id
            WHERE m.sender_id = ? OR m.receiver_id = ? ${storeId ? 'OR m.store_id = ?' : ''}
            ORDER BY m.created_at DESC
        `, storeId ? [userId, userId, userId, userId, storeId] : [userId, userId, userId, userId]);

        // Deduplicate threads by contact_user_id
        const seen = new Set();
        const uniqueThreads = [];
        for (const t of threads) {
            const key = `${t.contact_user_id}_${t.store_id || 0}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueThreads.push(t);
            }
        }

        res.json({
            success: true,
            data: uniqueThreads
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
