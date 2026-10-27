// ==============================================================================
// ACCESSIBILITY SETTINGS (table accessibility_settings, report #3)
// The options of the A11y menu, kept per account so they follow the user to any device.
//   GET /api/accessibility-settings   -> { data: {...} } or { data: null } when the account has none yet
//   PUT /api/accessibility-settings   -> saves the options sent (each one is checked), returns the saved row
// Visitors who are not logged in keep the options in the browser only (public/js/accessibility.js).
// ==============================================================================
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const BOOLEAN_FIELDS = ['voice_enabled', 'reduce_motion', 'dyslexia_font', 'highlight_links', 'text_spacing', 'big_cursor', 'show_tooltips', 'focus_reading'];
const CHOICES = {
    font_size: ['normal', 'large', 'x-large'],
    contrast_mode: ['default', 'high', 'grayscale']
};
const SPEECH_RATES = [0.75, 1, 1.5];
const DEFAULTS = {
    font_size: 'normal', contrast_mode: 'default', voice_enabled: false, reduce_motion: false, dyslexia_font: false,
    highlight_links: false, text_spacing: false, big_cursor: false, show_tooltips: false, focus_reading: false, speech_rate: 1
};
const FIELDS = Object.keys(DEFAULTS);

// Row from MySQL (0/1, "1.00") or SQLite -> plain JSON types
const toClient = row => {
    const data = {};
    for (const field of FIELDS) {
        if (BOOLEAN_FIELDS.includes(field)) data[field] = Boolean(Number(row[field]));
        else if (field === 'speech_rate') data[field] = Number(row[field]) || 1;
        else data[field] = row[field] ?? DEFAULTS[field];
    }
    data.updated_at = row.updated_at;
    return data;
};

// Checks every field that was sent; fields not sent keep their current value
function validate(body, current) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' };
    // easy_mode: the removed easy mode; an older page may still send it, it is ignored
    const unknown = Object.keys(body).filter(key => !FIELDS.includes(key) && !['updated_at', 'easy_mode'].includes(key));
    if (unknown.length) return { error: `ไม่รู้จักการตั้งค่า: ${unknown.join(', ')}` };
    const values = { ...current };
    for (const field of FIELDS) {
        if (!(field in body)) continue;
        const value = body[field];
        if (CHOICES[field]) {
            if (!CHOICES[field].includes(value)) return { error: `${field} ต้องเป็นค่าใดค่าหนึ่ง: ${CHOICES[field].join(', ')}` };
        } else if (field === 'speech_rate') {
            if (typeof value !== 'number' || !SPEECH_RATES.some(rate => Math.abs(rate - value) < 0.001)) return { error: 'speech_rate ต้องเป็น 0.75, 1 หรือ 1.5' };
        } else if (typeof value !== 'boolean') {
            return { error: `${field} ต้องเป็น true หรือ false` };
        }
        values[field] = value;
    }
    return { values };
}

// GET /api/accessibility-settings
router.get('/', async (req, res, next) => {
    try {
        const row = await db.get('SELECT * FROM accessibility_settings WHERE user_id = ?', [req.user.id]);
        res.json({ success: true, data: row ? toClient(row) : null });
    } catch (err) {
        next(err);
    }
});

// PUT /api/accessibility-settings
router.put('/', async (req, res, next) => {
    try {
        const row = await db.get('SELECT * FROM accessibility_settings WHERE user_id = ?', [req.user.id]);
        const { values, error } = validate(req.body, row ? toClient(row) : DEFAULTS);
        if (error) return res.status(400).json({ success: false, message: error });

        const params = FIELDS.map(field => BOOLEAN_FIELDS.includes(field) ? (values[field] ? 1 : 0) : values[field]);
        if (row) {
            await db.run(
                `UPDATE accessibility_settings SET ${FIELDS.map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                [...params, req.user.id]
            );
        } else {
            await db.run(
                `INSERT INTO accessibility_settings (user_id, ${FIELDS.join(', ')}) VALUES (?, ${FIELDS.map(() => '?').join(', ')})`,
                [req.user.id, ...params]
            );
        }
        const saved = await db.get('SELECT * FROM accessibility_settings WHERE user_id = ?', [req.user.id]);
        res.json({ success: true, data: toClient(saved) });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
