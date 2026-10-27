const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { DISABILITY_VISIBLE_SQL } = require('../services/consent');

// GET /api/disability-types - Disability types with the number of stores in each
router.get('/', async (req, res, next) => {
    try {
        const types = await db.all(`
            SELECT dt.id, dt.code, dt.name, COALESCE(dt.label, dt.name) as label, COUNT(s.id) as store_count
            FROM disability_types dt
            LEFT JOIN stores s ON s.disability_type = dt.code AND ${DISABILITY_VISIBLE_SQL}
            WHERE COALESCE(dt.is_active, 1) = 1   -- closed groups (e.g. intellectual) are not offered
            GROUP BY dt.id, dt.code, dt.name, dt.label
            ORDER BY dt.id ASC
        `);
        res.json({ success: true, data: types.map(t => ({ ...t, store_count: Number(t.store_count) })) });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
