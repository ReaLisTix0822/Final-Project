// ==============================================================================
// PRIVACY SETTINGS (profile page, PDPA)
// Shows the data we keep about the signed-in user, lets them give or withdraw
// consent for disability data, open their own verification documents, and close
// the account through a confirm dialog (focus trap, Esc closes, aria-modal).
// ==============================================================================
const PrivacySettings = (() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtDate = v => v ? new Date(String(v).replace(' ', 'T')).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    const ROLE_LABELS = { buyer: 'ผู้ซื้อ / ผู้สนับสนุน', seller: 'ผู้ขาย / ช่างฝีมือ', admin: 'ผู้ดูแลระบบ' };
    let data = null;
    let lastFocus = null;
    let madeInert = [];

    const $ = id => document.getElementById(id);

    function announce(message, type = 'success') {
        const el = $('pvs-status');
        if (!el) return;
        el.textContent = '';
        el.className = `pvs-status pvs-status--${type}`;
        // Clearing first makes screen readers read the same message again
        setTimeout(() => { el.textContent = message; }, 50);
    }

    async function load() {
        if (!$('privacy-settings')) return;
        try {
            const res = await API.get('/auth/privacy');
            data = res.data;
            render();
        } catch (err) {
            announce(`โหลดข้อมูลความเป็นส่วนตัวไม่สำเร็จ: ${err.message}`, 'error');
        }
    }

    function render() {
        const u = data.user || {};
        const disability = data.store_disability?.label || 'ไม่มีข้อมูล';
        const interests = data.matching_disability_preferences.join(', ') || 'ไม่ได้เลือก (ทุกกลุ่ม)';
        const rows = [
            ['ชื่อ - นามสกุล', u.full_name],
            ['อีเมล', u.email],
            ['เบอร์โทรศัพท์', u.phone || 'ไม่ได้ระบุ'],
            ['ประเภทบัญชี', ROLE_LABELS[u.role] || u.role],
            ['สมัครสมาชิกเมื่อ', fmtDate(u.created_at)],
            ['เข้าสู่ระบบล่าสุด', fmtDate(u.last_login_at)],
            ['ที่อยู่จัดส่งที่บันทึกไว้', `${data.address_count} รายการ`],
            ...(u.role === 'seller' ? [['ข้อมูลประเภทความพิการ', disability]] : []),
            ['กลุ่มช่างฝีมือที่สนใจ (ระบบจับคู่)', interests]
        ];
        $('pvs-data').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

        const docsWrap = $('pvs-documents');
        docsWrap.hidden = !data.documents.length;
        $('pvs-document-list').innerHTML = data.documents.map(d => `
            <li>
                <span>${esc(d.original_name || 'เอกสาร')} <small>(อัปโหลด ${esc(fmtDate(d.created_at))})</small></span>
                <button type="button" class="btn btn-outline-dark btn-sm" data-doc-id="${Number(d.id)}">เปิดดู<span class="sr-only"> ${esc(d.original_name || '')}</span></button>
            </li>`).join('');

        // Only sellers keep disability data (their store's disability type)
        $('pvs-consent-section').hidden = u.role !== 'seller';
        const consented = data.disability_consent;
        $('pvs-consent-state').innerHTML = consented
            ? `<strong>ให้ความยินยอมแล้ว</strong> เมื่อ ${esc(fmtDate(data.consent_at))}`
            : data.consent_at
                ? `<strong>ไม่ได้ให้ความยินยอม</strong> (ถอนความยินยอมล่าสุดเมื่อ ${esc(fmtDate(data.consent_at))})`
                : '<strong>ยังไม่ได้ให้ความยินยอม</strong> ระบบจะไม่แสดงข้อมูลประเภทความพิการของคุณ';
        $('pvs-consent-give').hidden = consented;
        $('pvs-consent-withdraw').hidden = !consented;
        $('pvs-consent-checkbox').checked = false;
    }

    async function giveConsent() {
        if (!$('pvs-consent-checkbox').checked) {
            announce('กรุณาติ๊กช่องยินยอมก่อนกดบันทึก', 'error');
            $('pvs-consent-checkbox').focus();
            return;
        }
        try {
            const res = await API.post('/auth/consent', { disability_consent: true });
            announce(res.message);
            await load();
            $('pvs-consent-withdraw-btn').focus();
        } catch (err) {
            announce(err.message, 'error');
        }
    }

    async function withdrawConsent() {
        if (!window.confirm('ถอนความยินยอม? ระบบจะลบข้อมูลประเภทความพิการของร้านคุณทันที')) return;
        try {
            const res = await API.delete('/auth/consent');
            announce(res.message);
            await load();
            $('pvs-consent-checkbox').focus();
        } catch (err) {
            announce(err.message, 'error');
        }
    }

    // Documents are behind the auth header, so they are fetched and opened as a blob
    async function openDocument(docId) {
        try {
            const res = await fetch(`/api/stores/my-store/documents/${docId}/file`, { headers: { Authorization: `Bearer ${API.getToken()}` } });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'เปิดเอกสารไม่สำเร็จ');
            const url = URL.createObjectURL(await res.blob());
            window.open(url, '_blank', 'noopener');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            announce(err.message, 'error');
        }
    }

    // ---- Delete account dialog ----
    const focusables = root => [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);

    function openDialog() {
        const backdrop = $('pvs-delete-dialog');
        lastFocus = document.activeElement;
        $('pvs-delete-form').reset();
        $('pvs-delete-error').textContent = '';
        backdrop.hidden = false;
        document.body.classList.add('pvs-dialog-open');
        // Everything behind the dialog is out of reach for keyboard and screen readers
        madeInert = [...document.body.children].filter(el => el !== backdrop && !el.inert);
        madeInert.forEach(el => { el.inert = true; });
        $('pvs-delete-password').focus();
    }

    function closeDialog() {
        $('pvs-delete-dialog').hidden = true;
        document.body.classList.remove('pvs-dialog-open');
        madeInert.forEach(el => { el.inert = false; });
        madeInert = [];
        if (lastFocus) lastFocus.focus();
    }

    function onDialogKey(e) {
        if ($('pvs-delete-dialog').hidden) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDialog();
            return;
        }
        if (e.key !== 'Tab') return;
        const items = focusables($('pvs-delete-dialog'));
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    async function deleteAccount(e) {
        e.preventDefault();
        const password = $('pvs-delete-password').value;
        const error = $('pvs-delete-error');
        if (!password) { error.textContent = 'กรุณากรอกรหัสผ่านปัจจุบัน'; $('pvs-delete-password').focus(); return; }
        if (!$('pvs-delete-understand').checked) { error.textContent = 'กรุณาติ๊กยืนยันว่าเข้าใจว่าการลบบัญชีย้อนกลับไม่ได้'; $('pvs-delete-understand').focus(); return; }
        const button = $('pvs-delete-confirm');
        button.disabled = true;
        button.textContent = 'กำลังลบบัญชี...';
        try {
            const res = await API.request('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) });
            error.textContent = '';
            announce(res.message);
            closeDialog();
            if (window.showToast) window.showToast(res.message, 'success');
            setTimeout(() => Auth.logout(), 1200);
        } catch (err) {
            error.textContent = err.message;
            button.disabled = false;
            button.textContent = 'ลบบัญชีถาวร';
            $('pvs-delete-password').focus();
        }
    }

    function init() {
        if (!$('privacy-settings')) return;
        $('pvs-consent-save').addEventListener('click', giveConsent);
        $('pvs-consent-withdraw-btn').addEventListener('click', withdrawConsent);
        $('pvs-document-list').addEventListener('click', e => {
            const btn = e.target.closest('[data-doc-id]');
            if (btn) openDocument(btn.dataset.docId);
        });
        $('pvs-delete-open').addEventListener('click', openDialog);
        $('pvs-delete-form').addEventListener('submit', deleteAccount);
        $('pvs-delete-dialog').addEventListener('click', e => {
            if (e.target.id === 'pvs-delete-dialog' || e.target.closest('[data-pvs-close]')) closeDialog();
        });
        document.addEventListener('keydown', onDialogKey);
        if (API.getToken()) load().then(() => {
            if (location.hash === '#privacy-settings') {
                const card = $('privacy-settings');
                card.scrollIntoView({ block: 'start' });
                card.focus({ preventScroll: true });
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
    return { load };
})();
