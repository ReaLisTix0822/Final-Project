// ==============================================================================
// PDPA SECTION 26: EXPLICIT CONSENT FOR DISABILITY DATA
// Disability type is sensitive personal data. It is saved only when the user ticked
// the consent box (users.disability_consent = 1, consent_at = time of the choice),
// and it is shown to other people only while that consent is in place.
// ==============================================================================
const db = require('../config/database');

const CONSENT_REQUIRED_MESSAGE = 'กรุณาติ๊กยินยอมให้เก็บข้อมูลประเภทความพิการก่อน หรือเว้นช่องประเภทความพิการไว้ (ไม่บังคับกรอก)';

// Checkbox values arrive as true / "true" / "1" / "on" (JSON or multipart form)
const isConsentGiven = value => value === true || value === 1 || ['true', '1', 'on', 'yes'].includes(String(value).toLowerCase());

// SQL for queries that read a store as alias `s`: the owner's consent is still in place
const DISABILITY_VISIBLE_SQL = `EXISTS (SELECT 1 FROM users consent_u WHERE consent_u.id = s.user_id AND consent_u.disability_consent = 1 AND consent_u.deleted_at IS NULL)`;
// The store's disability type for other people (NULL when the owner has not consented)
const PUBLIC_DISABILITY_SQL = `CASE WHEN ${DISABILITY_VISIBLE_SQL} THEN s.disability_type END`;

async function giveConsent(userId) {
    await db.run('UPDATE users SET disability_consent = 1, consent_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

// Withdraw consent: remove the user's own disability data (the store's disability type), then record the withdrawal.
// Buyers' matching choices are interests ("which artisans to support"), not their own disability data.
async function withdrawConsent(userId) {
    await db.run('UPDATE stores SET disability_type = NULL WHERE user_id = ?', [userId]);
    await db.run('UPDATE users SET disability_consent = 0, consent_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

async function getConsent(userId) {
    const row = await db.get('SELECT disability_consent, consent_at FROM users WHERE id = ?', [userId]);
    return { disability_consent: Boolean(Number(row?.disability_consent)), consent_at: row?.consent_at || null };
}

module.exports = {
    CONSENT_REQUIRED_MESSAGE, isConsentGiven, DISABILITY_VISIBLE_SQL, PUBLIC_DISABILITY_SQL,
    giveConsent, withdrawConsent, getConsent
};
