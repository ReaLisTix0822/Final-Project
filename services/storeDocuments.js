// Verification documents a seller attaches when applying (disability card / organisation certificate).
// Files are kept OUTSIDE /public and are only served to admins through /api/admin/stores/:id/documents/:docId.
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/database');

const DOCUMENT_DIR = path.join(__dirname, '../private-uploads/store-documents');
fs.mkdirSync(DOCUMENT_DIR, { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

const DOC_TYPE_LABELS = {
    disability_card: 'บัตรประจำตัวคนพิการ',
    organization_cert: 'หนังสือรับรองการจดทะเบียนองค์กร',
    other: 'เอกสารประกอบเพิ่มเติม'
};

const multerUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, DOCUMENT_DIR),
        filename: (req, file, cb) => cb(null, `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${ALLOWED[file.mimetype]}`)
    }),
    limits: { fileSize: MAX_FILE_SIZE, files: 3 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED[file.mimetype]) return cb(null, true);
        cb(Object.assign(new Error('รองรับเฉพาะไฟล์ PDF, JPG, PNG หรือ WebP เท่านั้น'), { status: 400 }));
    }
}).fields([
    { name: 'id_document', maxCount: 1 },
    { name: 'extra_documents', maxCount: 2 }
]);

function uploadedFiles(req) {
    return Object.values(req.files || {}).flat();
}

function removeFiles(files) {
    files.forEach(file => fs.unlink(file.path, () => {}));
}

// Parses the upload; files are deleted again unless the request saved them (failed or buyer sign-ups)
function documentUpload(req, res, next) {
    multerUpload(req, res, err => {
        if (err) {
            removeFiles(uploadedFiles(req));
            const message = err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์เอกสารต้องมีขนาดไม่เกิน 5 MB ต่อไฟล์'
                : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'แนบเอกสารได้สูงสุด 3 ไฟล์'
                : err.message;
            return res.status(400).json({ success: false, message });
        }
        res.on('finish', () => { if (!req.documentsSaved) removeFiles(uploadedFiles(req)); });
        next();
    });
}

function hasIdDocument(req) {
    return Boolean(req.files && req.files.id_document && req.files.id_document.length);
}

async function saveStoreDocuments(storeId, req, mainType) {
    const rows = [
        ...(req.files.id_document || []).map(file => [mainType, file]),
        ...(req.files.extra_documents || []).map(file => ['other', file])
    ];
    for (const [type, file] of rows) {
        await db.run(
            'INSERT INTO store_documents (store_id, doc_type, file_path, original_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)',
            [storeId, type, path.basename(file.path), Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255), file.mimetype, file.size]
        );
    }
    req.documentsSaved = true;
    await recordVerificationRequest(storeId);
}

// Store_Verifications: one request per upload of documents, decided by an admin
async function recordVerificationRequest(storeId) {
    const doc = await db.get('SELECT file_path FROM store_documents WHERE store_id = ? ORDER BY id LIMIT 1', [storeId]);
    if (!doc) return;
    await db.run("INSERT INTO store_verifications (store_id, document_url, status) VALUES (?, ?, 'pending')", [storeId, doc.file_path]);
}

// The pending request gets the decision; a later decision (e.g. suspending an approved store) is a new row
async function recordVerificationDecision(storeId, status, reason, adminId) {
    const latest = await db.get('SELECT verification_id, status FROM store_verifications WHERE store_id = ? ORDER BY verification_id DESC LIMIT 1', [storeId]);
    const rejectReason = status === 'rejected' ? reason : null;
    if (latest && latest.status === 'pending') {
        await db.run(
            'UPDATE store_verifications SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE verification_id = ?',
            [status, rejectReason, adminId, latest.verification_id]
        );
        return;
    }
    const doc = await db.get('SELECT file_path FROM store_documents WHERE store_id = ? ORDER BY id LIMIT 1', [storeId]);
    await db.run(
        'INSERT INTO store_verifications (store_id, document_url, status, reject_reason, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [storeId, doc ? doc.file_path : 'ไม่มีเอกสาร', status, rejectReason, adminId]
    );
}

// Stream one document from the private folder (callers must check admin / owner first)
function sendStoreDocument(res, doc) {
    if (!doc) return res.status(404).json({ success: false, message: 'ไม่พบเอกสาร' });
    res.set('Content-Type', doc.mime_type || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.original_name || path.basename(doc.file_path))}`);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.basename(doc.file_path), { root: DOCUMENT_DIR }, err => {
        if (err && !res.headersSent) res.status(404).json({ success: false, message: 'ไม่พบไฟล์เอกสาร' });
    });
}

// Delete a store's documents (rows and files), e.g. when the owner closes the account
async function deleteStoreDocuments(storeId) {
    const docs = await db.all('SELECT file_path FROM store_documents WHERE store_id = ?', [storeId]);
    docs.forEach(doc => fs.unlink(path.join(DOCUMENT_DIR, path.basename(doc.file_path)), () => {}));
    await db.run('DELETE FROM store_documents WHERE store_id = ?', [storeId]);
    // The request history stays, without the name of the deleted file
    await db.run("UPDATE store_verifications SET document_url = 'ลบเอกสารแล้ว' WHERE store_id = ?", [storeId]);
}

module.exports = { DOCUMENT_DIR, DOC_TYPE_LABELS, documentUpload, hasIdDocument, saveStoreDocuments, sendStoreDocument, deleteStoreDocuments, recordVerificationDecision };
