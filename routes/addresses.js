const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Accept numbers too (e.g. a postcode sent as 10110) instead of silently dropping them
const text = (value, max) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '');
// A coordinate outside the valid range is dropped so it cannot fail the whole save
const coord = (value, limit) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n) <= limit ? Math.round(n * 1e7) / 1e7 : null;
};

// Row -> the address shape used by address-manager.js / address-modal.js
const toClient = row => ({
    id: row.client_ref || String(row.id),
    label: row.label,
    name: row.recipient_name,
    phone: row.phone,
    detail: row.address_detail,
    subdistrict: row.subdistrict,
    district: row.district,
    province: row.province,
    postcode: row.postcode,
    coords: row.latitude != null && row.longitude != null ? { lat: Number(row.latitude), lng: Number(row.longitude) } : null,
    isDefault: Boolean(Number(row.is_default))
});

// GET /api/addresses - Saved shipping addresses of current user
router.get('/', async (req, res, next) => {
    try {
        const rows = await db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY id ASC', [req.user.id]);
        res.json({ success: true, data: rows.map(toClient) });
    } catch (err) {
        next(err);
    }
});

// PUT /api/addresses - Replace all saved addresses of current user
// body: { addresses: [{ id, label, name, phone, detail, subdistrict, district, province, postcode, coords, isDefault }] }
router.put('/', async (req, res, next) => {
    try {
        const list = Array.isArray(req.body.addresses) ? req.body.addresses.slice(0, 20) : [];
        const rows = list
            .map(a => ({
                client_ref: text(a.id, 64) || null,
                label: text(a.label, 100),
                recipient_name: text(a.name, 150),
                phone: String(a.phone ?? '').replace(/\D/g, '').slice(0, 10),
                address_detail: text(a.detail, 1000),
                subdistrict: text(a.subdistrict, 100),
                district: text(a.district, 100),
                province: text(a.province, 100),
                postcode: text(a.postcode, 10),
                latitude: a.coords ? coord(a.coords.lat, 90) : null,
                longitude: a.coords ? coord(a.coords.lng, 180) : null,
                is_default: a.isDefault ? 1 : 0
            }))
            .filter(a => a.address_detail);

        // Only one default address
        let hasDefault = false;
        rows.forEach(a => {
            if (a.is_default && !hasDefault) hasDefault = true;
            else a.is_default = 0;
        });

        // Values are fully cleaned above; the rows go in as one INSERT so the list is saved all-or-nothing
        await db.run('DELETE FROM addresses WHERE user_id = ?', [req.user.id]);
        if (rows.length > 0) {
            await db.run(
                `INSERT INTO addresses (user_id, client_ref, label, recipient_name, phone, address_detail, subdistrict, district, province, postcode, latitude, longitude, is_default)
                 VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
                rows.flatMap(a => [req.user.id, a.client_ref, a.label, a.recipient_name, a.phone, a.address_detail, a.subdistrict, a.district, a.province, a.postcode, a.latitude, a.longitude, a.is_default])
            );
        }

        res.json({ success: true, count: rows.length });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
