const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize, optionalUserId } = require('../middleware/auth');

const SOURCES = ['navbar', 'products', 'stores'];

// POST /api/search-history - Record one search (guests too; the user comes from the token)
router.post('/', async (req, res) => {
    const query = typeof req.body.query === 'string' ? req.body.query.trim().replace(/\s+/g, ' ').slice(0, 200) : '';
    const source = SOURCES.includes(req.body.source) ? req.body.source : null;
    if (!query || !source) {
        return res.status(400).json({ success: false, message: 'ข้อมูลการค้นหาไม่ถูกต้อง' });
    }
    const count = Number.isInteger(req.body.results_count) && req.body.results_count >= 0 ? req.body.results_count : null;
    const sessionId = typeof req.body.session_id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(req.body.session_id) ? req.body.session_id : null;
    // Report: Search_History.input_type (typed or spoken) and the filters in use (JSON, at most 1,000 characters)
    const inputType = req.body.input_type === 'voice' ? 'voice' : 'text';
    let filters = null;
    if (req.body.filters && typeof req.body.filters === 'object' && !Array.isArray(req.body.filters)) {
        const json = JSON.stringify(req.body.filters);
        if (json !== '{}' && json.length <= 1000) filters = json;
    }
    try {
        await db.run(
            'INSERT INTO search_history (user_id, session_id, query, source, input_type, filters, results_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [optionalUserId(req), sessionId, query, source, inputType, filters, count]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        console.warn('[SearchHistory] Save failed:', err.message);
        res.status(500).json({ success: false, message: 'บันทึกประวัติการค้นหาไม่สำเร็จ' });
    }
});

// GET /api/search-history/mine - The signed-in user's recent searches (newest first, no duplicates)
router.get('/mine', authenticate, async (req, res, next) => {
    try {
        const rows = await db.all(`
            SELECT query, MAX(created_at) as last_searched
            FROM search_history
            WHERE user_id = ?
            GROUP BY query
            ORDER BY last_searched DESC
            LIMIT 20
        `, [req.user.id]);
        res.json({ success: true, data: rows.map(r => r.query) });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/search-history/mine - Remove one term ({ query }) or the whole history ({ all: true })
router.delete('/mine', authenticate, async (req, res, next) => {
    try {
        if (req.body && req.body.all === true) {
            await db.run('DELETE FROM search_history WHERE user_id = ?', [req.user.id]);
        } else {
            const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
            if (!query) return res.status(400).json({ success: false, message: 'ไม่มีคำค้นหาที่ต้องการลบ' });
            await db.run('DELETE FROM search_history WHERE user_id = ? AND query = ?', [req.user.id, query]);
        }
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// GET /api/search-history/popular - Most searched terms (admin)
router.get('/popular', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const rows = await db.all(`
            SELECT query, COUNT(*) as searches,
                   SUM(CASE WHEN results_count = 0 THEN 1 ELSE 0 END) as no_result_searches,
                   MAX(created_at) as last_searched
            FROM search_history
            GROUP BY query
            ORDER BY searches DESC, last_searched DESC
            LIMIT 50
        `);
        res.json({ success: true, data: rows.map(r => ({ ...r, searches: Number(r.searches), no_result_searches: Number(r.no_result_searches) })) });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
