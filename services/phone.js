// Phone numbers are stored as digits only, at most 10 (e.g. 0812345678).
// cleanPhone(value) -> '' for empty, the digits when valid, or null when longer than 10 digits.
const PHONE_MAX_DIGITS = 10;
const PHONE_ERROR = `เบอร์โทรศัพท์ต้องเป็นตัวเลขไม่เกิน ${PHONE_MAX_DIGITS} หลัก`;

function cleanPhone(value) {
    if (value === undefined || value === null) return '';
    const digits = String(value).replace(/\D/g, '');
    return digits.length > PHONE_MAX_DIGITS ? null : digits;
}

// Recipient phone for delivery: 9-10 digits starting with 0, dashes allowed (02-123-4567, 081-234-5678)
const RECIPIENT_PHONE_ERROR = 'เบอร์โทรผู้รับต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0 (ใส่ขีดคั่นได้ เช่น 081-234-5678)';
function isRecipientPhone(value) {
    const text = String(value ?? '').trim();
    if (!/^[0-9-]+$/.test(text)) return false;
    const digits = text.replace(/-/g, '');
    return /^0\d{8,9}$/.test(digits);
}

module.exports = { cleanPhone, PHONE_MAX_DIGITS, PHONE_ERROR, isRecipientPhone, RECIPIENT_PHONE_ERROR };
