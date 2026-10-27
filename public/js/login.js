// ==============================================================================
// LOGIN & REGISTRATION CONTROLLER (MODERN AUTH & WCAG AA COMPLIANT)
// ==============================================================================

function initLoginPage() {
    const isLoggedIn = (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));
    if (isLoggedIn) {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : JSON.parse(localStorage.getItem('user') || 'null');
        if (user) {
            const containerCard = document.querySelector('.auth-form-card');
            if (containerCard && !document.getElementById('already-logged-in-box')) {
                const roleLabel = user.role === 'seller' ? 'ช่างฝีมือ/ผู้ขาย' : user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้สนับสนุน/ผู้ซื้อ';
                const destUrl = user.role === 'seller' ? '/seller-dashboard.html' : user.role === 'admin' ? '/admin-dashboard.html' : '/index.html';
                const alertDiv = document.createElement('div');
                alertDiv.id = 'already-logged-in-box';
                alertDiv.style.cssText = 'background:var(--color-success-soft); border:1.5px solid var(--color-divider); border-radius:16px; padding:1.25rem; margin-bottom:1.5rem; text-align:center;';
                alertDiv.innerHTML = `
                    <div style="font-size:1.05rem; font-weight:700; color:var(--color-success); margin-bottom:4px;">
                        คุณเข้าสู่ระบบแล้ว ในชื่อ <b>${String(user.full_name || user.email).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</b> (${roleLabel})
                    </div>
                    <p style="font-size: 1rem; color:var(--color-success); margin-bottom:12px;">
                        คุณไม่จำเป็นต้องเข้าสู่ระบบซ้ำ สามารถไปยังแดชบอร์ด หรือออกจากระบบเพื่อเปลี่ยนบัญชีได้
                    </p>
                    <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                        <a href="${destUrl}" class="btn btn-primary" style="padding:0.45rem 1.25rem; font-size: 1rem; font-weight:700; border-radius:var(--radius-full);">ไปยังแดชบอร์ด / ร้านค้า</a>
                        <button type="button" onclick="Auth.logout()" class="btn btn-outline-dark" style="padding:0.45rem 1.1rem; font-size: 1rem; border-radius:var(--radius-full);">ออกจากระบบ</button>
                    </div>
                `;
                // Signed in already: only this box is shown, the login / register forms are hidden
                Array.from(containerCard.children).forEach(child => { child.hidden = true; });
                containerCard.prepend(alertDiv);
                alertDiv.setAttribute('role', 'status');
            }
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const roleParam = urlParams.get('role');

    if (tabParam === 'register') {
        setAuthTab('register');
        if (roleParam === 'seller') {
            if (document.getElementById('reg-role-seller')) onRoleChange('seller');
        }
    }
}

function setAuthTab(tab) {
    const breadcrumb = document.getElementById('breadcrumb-auth');
    if (breadcrumb) breadcrumb.textContent = tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login-btn');
    const tabReg = document.getElementById('tab-register-btn');
    document.querySelector('.seller-pending-panel')?.remove();
    const isLogin = tab === 'login';
    const loginPanel = document.getElementById('login-panel');
    const regPanel = document.getElementById('register-panel');
    if (loginPanel) loginPanel.hidden = !isLogin;
    if (regPanel) regPanel.hidden = isLogin;
    if (loginForm) loginForm.hidden = false;
    if (regForm) regForm.hidden = false;
    tabLogin?.classList.toggle('active', isLogin);
    tabLogin?.setAttribute('aria-selected', String(isLogin));
    tabReg?.classList.toggle('active', !isLogin);
    tabReg?.setAttribute('aria-selected', String(!isLogin));
    // Both tabs stay in the Tab order: people who do not know the arrow keys can still reach
    // "สมัครสมาชิก" with Tab (the arrow keys below work too)
    tabLogin?.setAttribute('tabindex', '0');
    tabReg?.setAttribute('tabindex', '0');
    // Demo accounts belong to signing in only
    const demo = document.getElementById('quick-demo-container');
    if (demo) demo.hidden = !isLogin || demo.dataset.enabled !== 'true';
}

// Arrow keys move between the two account-type cards and choose the one they land on
document.addEventListener('DOMContentLoaded', () => {
    const radios = [document.getElementById('reg-role-buyer'), document.getElementById('reg-role-seller')].filter(Boolean);
    radios.forEach((radio, i) => radio.addEventListener('keydown', e => {
        // Enter chooses the card like Space (on a radio the browser would send the form instead)
        if (e.key === 'Enter') {
            e.preventDefault();
            onRoleChange(radio.value);
            return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const next = radios[(i + 1) % radios.length];
        next.focus();
        onRoleChange(next.value);
    }));
});

// Arrow keys move between the two tabs (WAI-ARIA tabs pattern)
document.addEventListener('DOMContentLoaded', () => {
    const tabs = [document.getElementById('tab-login-btn'), document.getElementById('tab-register-btn')].filter(Boolean);
    tabs.forEach((tab, i) => tab.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        next.click();
    }));
});

// ==============================================================================
// ONE ERROR SYSTEM FOR BOTH FORMS (WCAG 3.3.1 / 3.3.3)
// - a message under the field: <p id="<field id>-error" class="field-error">, linked with aria-describedby
// - the field gets aria-invalid="true" (red border + ⚠ icon in the message, not colour alone)
// - on submit: a summary box above the form lists every problem as a link to the field
// ==============================================================================
const FormErrors = {
    set(field, message) {
        const box = document.getElementById(`${field.id}-error`);
        if (box) box.textContent = message;
        field.setAttribute('aria-invalid', 'true');
    },
    clear(field) {
        const box = document.getElementById(`${field.id}-error`);
        if (box) box.textContent = '';
        field.removeAttribute('aria-invalid');
    },
    // errors: [{ field, message }] (field may be null for a message that belongs to no field)
    showSummary(summaryId, errors) {
        const summary = document.getElementById(summaryId);
        if (!summary) return;
        const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        summary.innerHTML = `
            <h2><span aria-hidden="true">⚠</span> พบข้อผิดพลาด ${errors.length} รายการ</h2>
            <ul>${errors.map(err => err.field
                ? `<li><a href="#${err.field.id}" data-error-target="${err.field.id}">${esc(err.label)}: ${esc(err.message)}</a></li>`
                : `<li>${esc(err.message)}</li>`).join('')}</ul>`;
        summary.hidden = false;
        summary.focus();
    },
    hideSummary(summaryId) {
        const summary = document.getElementById(summaryId);
        if (summary) { summary.hidden = true; summary.innerHTML = ''; }
    }
};

// Summary links move focus to the field (file inputs are visually hidden: focus them all the same)
document.addEventListener('click', e => {
    const link = e.target.closest('[data-error-target]');
    if (!link) return;
    e.preventDefault();
    const field = document.getElementById(link.dataset.errorTarget);
    if (!field) return;
    field.scrollIntoView({ block: 'center' });
    field.focus();
});

const PHONE_PATTERN = /^0\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REG_DOC_MAX = 5 * 1024 * 1024;
const REG_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const isSeller = () => document.getElementById('reg-role-seller')?.checked === true;

function checkDocumentFiles(files, max) {
    if (files.length > max) return `เลือกได้สูงสุด ${max} ไฟล์ กรุณาลบไฟล์ที่เกิน`;
    if (files.some(f => !REG_DOC_TYPES.includes(f.type))) return 'รองรับเฉพาะไฟล์ PDF, JPG, PNG หรือ WebP กรุณาเลือกไฟล์ใหม่';
    if (files.some(f => f.size > REG_DOC_MAX)) return 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB ต่อไฟล์ กรุณาย่อขนาดหรือเลือกไฟล์อื่น';
    return '';
}

// Each check returns '' when the value is fine, otherwise a message that says how to fix it
const FIELD_RULES = {
    'login-email': { label: 'อีเมล', check: v => !v.trim() ? 'กรุณากรอกอีเมล' : !EMAIL_PATTERN.test(v.trim()) ? 'รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com' : '' },
    'login-password': { label: 'รหัสผ่าน', check: v => !v ? 'กรุณากรอกรหัสผ่าน' : '' },
    'reg-fullname': { label: 'ชื่อ - นามสกุล', check: v => !v.trim() ? 'กรุณากรอกชื่อ-นามสกุล' : '' },
    'reg-email': { label: 'อีเมล', check: v => !v.trim() ? 'กรุณากรอกอีเมล เช่น name@example.com' : !EMAIL_PATTERN.test(v.trim()) ? 'รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com' : '' },
    'reg-phone': { label: 'เบอร์โทรศัพท์', check: v => v.trim() && !PHONE_PATTERN.test(v.replace(/[\s-]/g, '')) ? 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0' : '' },
    'reg-password': { label: 'รหัสผ่าน', check: v => !v ? 'กรุณากรอกรหัสผ่าน อย่างน้อย 8 ตัวอักษร' : v.length < 8 ? 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' : '' },
    'reg-store-name': { label: 'ชื่อร้านค้า', when: isSeller, check: v => !v.trim() ? 'กรุณากรอกชื่อร้านค้าหรือแบรนด์งานคราฟต์' : '' },
    'reg-disability-consent': {
        label: 'ความยินยอมข้อมูลความพิการ', when: isSeller,
        check: (v, el) => document.getElementById('reg-disability-type')?.value && !el.checked ? 'เลือกกลุ่มความพิการแล้ว กรุณาติ๊กยินยอมให้เก็บข้อมูล หรือเลือก "ไม่ระบุ"' : ''
    },
    'reg-id-document': {
        label: 'เอกสารยืนยันตัวตน', when: isSeller,
        check: (v, el) => !el.files.length
            ? (document.getElementById('reg-disability-type')?.value === 'organization' ? 'กรุณาแนบหนังสือรับรองการจดทะเบียนองค์กร (PDF, JPG, PNG ไม่เกิน 5 MB)' : 'กรุณาแนบบัตรประจำตัวคนพิการ (PDF, JPG, PNG ไม่เกิน 5 MB)')
            : checkDocumentFiles(Array.from(el.files), 1)
    },
    'reg-extra-documents': { label: 'เอกสารเพิ่มเติม', when: isSeller, check: (v, el) => checkDocumentFiles(Array.from(el.files), 2) },
    'reg-accept-terms': { label: 'เงื่อนไขการใช้งาน', check: (v, el) => !el.checked ? 'กรุณาติ๊กยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว' : '' }
};

// Check one field: show or clear its message. Returns { field, label, message } or null.
function validateField(field) {
    const rule = FIELD_RULES[field.id];
    if (!rule) return null;
    const message = rule.when && !rule.when() ? '' : rule.check(field.value || '', field);
    if (message) { FormErrors.set(field, message); return { field, label: rule.label, message }; }
    FormErrors.clear(field);
    return null;
}

function validateForm(form) {
    return Object.keys(FIELD_RULES)
        .map(id => form.querySelector(`#${id}`))
        .filter(Boolean)
        .map(validateField)
        .filter(Boolean);
}

// Check again when leaving a field; clear the message as soon as the value becomes right
document.addEventListener('DOMContentLoaded', () => {
    Object.keys(FIELD_RULES).forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;
        const isChoice = field.type === 'checkbox' || field.type === 'file';
        field.addEventListener('blur', () => { if (!isChoice && (field.value || field.hasAttribute('aria-invalid'))) validateField(field); });
        field.addEventListener(isChoice ? 'change' : 'input', () => { if (field.hasAttribute('aria-invalid')) validateField(field); });
    });
    // Choosing "ไม่ระบุ" removes the reason for the consent error
    document.getElementById('reg-disability-type')?.addEventListener('change', () => {
        const consent = document.getElementById('reg-disability-consent');
        if (consent?.hasAttribute('aria-invalid')) validateField(consent);
    });
});

// Password strength: a 4-step bar and words ("อ่อน", "ปานกลาง", ...), not colour alone
function updatePasswordStrength() {
    const input = document.getElementById('reg-password');
    const bar = document.querySelector('.password-strength');
    const text = document.getElementById('reg-password-strength-text');
    if (!input || !bar || !text) return;
    const v = input.value;
    let level = 0;
    if (v.length) {
        level = v.length >= 8 ? 1 : 0;
        if (v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v)) level++;
        if (v.length >= 8 && /\d/.test(v)) level++;
        if (v.length >= 12 || (v.length >= 8 && /[^A-Za-z0-9]/.test(v))) level++;
        level = Math.max(level, 1);
        level = Math.min(level, v.length >= 8 ? 4 : 1);
    }
    const words = ['ยังไม่ได้กรอก', v.length < 8 ? 'สั้นเกินไป (ต้องมีอย่างน้อย 8 ตัวอักษร)' : 'อ่อน', 'ปานกลาง', 'แข็งแรง', 'แข็งแรงมาก'];
    bar.dataset.level = String(level);
    text.innerHTML = `ความแข็งแรงของรหัสผ่าน: <b>${words[level]}</b>`;
}
document.addEventListener('DOMContentLoaded', () => document.getElementById('reg-password')?.addEventListener('input', updatePasswordStrength));

// The two account-type cards are separate radios (not one group), so Tab reaches both;
// this keeps exactly one of them checked
function onRoleChange(role) {
    const buyer = document.getElementById('reg-role-buyer');
    const seller = document.getElementById('reg-role-seller');
    if (buyer) buyer.checked = role !== 'seller';
    if (seller) seller.checked = role === 'seller';
    document.getElementById('role-card-seller')?.classList.toggle('selected', role === 'seller');
    document.getElementById('role-card-buyer')?.classList.toggle('selected', role !== 'seller');
    toggleSellerFields(role === 'seller');
}

function toggleSellerFields(show) {
    const fields = document.getElementById('seller-fields');
    if (!fields) return;
    const wasShown = !fields.hidden;
    fields.hidden = !show;
    ['reg-store-name', 'reg-id-document'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.required = show;
    });
    if (!show) fields.querySelectorAll('[aria-invalid]').forEach(field => FormErrors.clear(field));
    const live = document.getElementById('reg-live');
    if (live && show !== wasShown) {
        live.textContent = '';
        setTimeout(() => {
            live.textContent = show ? 'แสดงช่องข้อมูลร้านค้าและเอกสารยืนยันตัวตนเพิ่มเติมแล้ว' : 'ซ่อนช่องข้อมูลร้านค้าแล้ว';
        }, 50);
    }
}

// Verification documents: label follows the chosen group; picked files are listed with a "ลบไฟล์" button
function updateIdDocumentLabel() {
    const isOrg = document.getElementById('reg-disability-type')?.value === 'organization';
    const label = document.getElementById('reg-id-document-label');
    if (label) label.textContent = isOrg ? 'หนังสือรับรองการจดทะเบียนองค์กร' : 'บัตรประจำตัวคนพิการ';
}

function showPickedDocuments(input, emptyText) {
    const files = Array.from(input.files || []);
    const name = document.getElementById(`${input.id}-name`);
    const picked = document.getElementById(`${input.id}-picked`);
    const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    if (name) name.textContent = files.length ? `เลือกแล้ว ${files.length} ไฟล์ (กดเพื่อเปลี่ยน)` : emptyText;
    name?.closest('.reg-doc-drop')?.classList.toggle('has-file', files.length > 0);
    if (picked) {
        picked.hidden = !files.length;
        picked.innerHTML = files.map((f, i) => `
            <span class="reg-doc-chip"><span>${esc(f.name)}</span>
                <button type="button" class="reg-doc-remove" data-remove-file="${i}" aria-label="ลบไฟล์ ${esc(f.name)}">ลบไฟล์</button>
            </span>`).join('');
    }
    validateField(input);
}

function removePickedDocument(input, index, emptyText) {
    const keep = new DataTransfer();
    Array.from(input.files).forEach((file, i) => { if (i !== index) keep.items.add(file); });
    input.files = keep.files;
    showPickedDocuments(input, emptyText);
    if (!input.files.length) FormErrors.clear(input);
    // Focus goes back to the file picker so the keyboard user is not lost
    input.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('reg-disability-type')?.addEventListener('change', updateIdDocumentLabel);
    const docs = { 'reg-id-document': 'เลือกไฟล์ (สำเนาหรือรูปถ่าย)', 'reg-extra-documents': 'เช่น สำเนาบัตรประชาชน ใบรับรองแพทย์' };
    Object.entries(docs).forEach(([id, emptyText]) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('change', () => showPickedDocuments(input, emptyText));
        document.getElementById(`${id}-picked`)?.addEventListener('click', e => {
            const btn = e.target.closest('[data-remove-file]');
            if (btn) removePickedDocument(input, Number(btn.dataset.removeFile), emptyText);
        });
    });
});

const EYE_OPEN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.btn-password-toggle').forEach(btn => { btn.innerHTML = EYE_OPEN; }));

function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btnEl.innerHTML = show ? EYE_OFF : EYE_OPEN;
    btnEl.setAttribute('aria-pressed', String(show));
    btnEl.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
}

// Busy state of a submit button: aria-busy, disabled, a visible "working" label
function setSubmitBusy(button, busyText) {
    if (busyText) {
        button.dataset.idleHtml = button.innerHTML;
        button.innerHTML = `<span class="auth-spinner" aria-hidden="true" style="width:16px; height:16px; border:2px solid var(--color-on-primary); border-top-color:transparent; border-radius:50%; display:inline-block; animation:spin 0.6s linear infinite; margin-right:6px;"></span><span>${busyText}</span>`;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
    } else {
        if (button.dataset.idleHtml) button.innerHTML = button.dataset.idleHtml;
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
}

// A server message goes under the field it is about (and into the summary)
function serverErrorField(form, message) {
    const has = (...words) => words.some(w => message.includes(w));
    const id = form.id === 'login-form'
        ? (has('อีเมล') && !has('รหัสผ่าน') ? 'login-email' : 'login-password')
        : has('อีเมล') ? 'reg-email'
        : has('เบอร์', 'โทรศัพท์') ? 'reg-phone'
        : has('รหัสผ่าน') ? 'reg-password'
        : has('ชื่อร้าน') ? 'reg-store-name'
        : has('ยินยอม', 'กลุ่มความพิการ') ? 'reg-disability-consent'
        : has('แนบ', 'เอกสาร', 'ไฟล์') ? 'reg-id-document'
        : has('เงื่อนไข') ? 'reg-accept-terms'
        : has('ชื่อ') ? 'reg-fullname' : null;
    return id ? form.querySelector(`#${id}`) : null;
}

function showServerError(form, summaryId, message) {
    const field = serverErrorField(form, message);
    if (field) FormErrors.set(field, message);
    FormErrors.showSummary(summaryId, [{ field, label: field ? FIELD_RULES[field.id]?.label || '' : '', message }]);
}

async function handleLogin(e) {
    e.preventDefault();
    const form = document.getElementById('login-form');
    const errors = validateForm(form);
    if (errors.length) { FormErrors.showSummary('login-error-summary', errors); return; }
    FormErrors.hideSummary('login-error-summary');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('login-submit-btn');
    setSubmitBusy(submitBtn, 'กำลังเข้าสู่ระบบ…');

    try {
        const res = await API.post('/auth/login', { email, password });
        if (res.success) {
            Auth.saveSession(res.token, res.user, res.store);
            const status = document.getElementById('login-status');
            if (status) status.textContent = 'เข้าสู่ระบบสำเร็จ กำลังพาไปยังหน้าถัดไป';
            if (window.showToast) window.showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับสู่ระบบตลาดใจ', 'success');
            const redirect = new URLSearchParams(window.location.search).get('redirect');
            setTimeout(() => {
                window.location.href = redirect || (res.user.role === 'seller' ? '/seller-dashboard.html' : res.user.role === 'admin' ? '/admin-dashboard.html' : '/index.html');
            }, 1200);
        }
    } catch (err) {
        setSubmitBusy(submitBtn, null);
        showServerError(form, 'login-error-summary', err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const form = document.getElementById('register-form');
    const errors = validateForm(form);
    if (errors.length) { FormErrors.showSummary('reg-error-summary', errors); return; }
    FormErrors.hideSummary('reg-error-summary');

    const role = isSeller() ? 'seller' : 'buyer';
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const full_name = document.getElementById('reg-fullname').value.trim();
    const phone = (document.getElementById('reg-phone')?.value || '').replace(/[\s-]/g, '');
    const payload = { role, email, password, full_name, phone, accept_terms: true };

    if (role === 'seller') {
        payload.store_name = document.getElementById('reg-store-name').value.trim();
        payload.disability_type = document.getElementById('reg-disability-type')?.value || '';
        // Terms and the disability-data consent are two separate choices (PDPA s.26)
        payload.disability_consent = Boolean(payload.disability_type && document.getElementById('reg-disability-consent')?.checked);
        payload.support_goal_title = document.getElementById('reg-goal-title')?.value.trim() || 'ระดมทุนสนับสนุนอุปกรณ์สร้างสรรค์';
        payload.support_goal_target = parseFloat(document.getElementById('reg-goal-target')?.value) || 20000;
    }

    const submitBtn = document.getElementById('register-submit-btn');
    setSubmitBusy(submitBtn, 'กำลังสมัครสมาชิก…');

    try {
        let body = payload;
        if (role === 'seller') {
            body = new FormData();
            Object.entries(payload).forEach(([key, value]) => body.append(key, value));
            body.append('id_document', document.getElementById('reg-id-document').files[0]);
            Array.from(document.getElementById('reg-extra-documents')?.files || []).slice(0, 2)
                .forEach(file => body.append('extra_documents', file));
        }
        const res = await API.post('/auth/register', body);
        if (res.success && res.pending) {
            setSubmitBusy(submitBtn, null);
            showSellerPending(res.message, payload.store_name, email);
        } else if (res.success) {
            Auth.saveSession(res.token, res.user, res.store);
            // Announced before leaving the page
            const status = document.getElementById('reg-status');
            if (status) status.textContent = 'สมัครสมาชิกสำเร็จ ยินดีต้อนรับสู่ตลาดใจ กำลังพาไปหน้าแรก';
            if (window.showToast) window.showToast('สมัครสมาชิกสำเร็จ ยินดีต้อนรับสู่ระบบตลาดใจ', 'success');
            setTimeout(() => { window.location.href = '/index.html'; }, 1500);
        }
    } catch (err) {
        setSubmitBusy(submitBtn, null);
        showServerError(form, 'reg-error-summary', err.message || 'การลงทะเบียนไม่สำเร็จ กรุณาตรวจสอบข้อมูล');
    }
}

// Seller application sent: the account waits for admin approval before it can sign in
function showSellerPending(message, storeName, email) {
    const form = document.getElementById('register-form');
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const panel = document.createElement('div');
    panel.className = 'seller-pending-panel';
    panel.setAttribute('role', 'status');
    panel.innerHTML = `
        <span class="seller-pending-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </span>
        <h3>ส่งคำขอสมัครเรียบร้อย รอการอนุมัติ</h3>
        <p>${esc(message)}</p>
        <dl>
            <div><dt>ร้านค้า</dt><dd>${esc(storeName)}</dd></div>
            <div><dt>อีเมล</dt><dd>${esc(email)}</dd></div>
            <div><dt>สถานะ</dt><dd><span class="seller-pending-badge">รอผู้ดูแลระบบอนุมัติ</span></dd></div>
        </dl>
        <ol>
            <li>ผู้ดูแลระบบตรวจสอบข้อมูลร้านค้าของคุณ</li>
            <li>เมื่ออนุมัติแล้ว เข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่สมัครไว้</li>
            <li>เริ่มลงสินค้าและเปิดร้านได้ทันที</li>
        </ol>
        <button type="button" class="btn-auth-submit" id="seller-pending-back"><span>กลับไปหน้าเข้าสู่ระบบ</span></button>`;
    form.reset();
    onRoleChange('buyer');
    form.querySelectorAll('.reg-doc-input').forEach(input => input.dispatchEvent(new Event('change')));
    form.querySelectorAll('[aria-invalid]').forEach(field => FormErrors.clear(field));
    updatePasswordStrength();
    form.hidden = true;
    form.insertAdjacentElement('afterend', panel);
    panel.querySelector('#seller-pending-back').addEventListener('click', () => {
        panel.remove();
        setAuthTab('login');
        const loginEmail = document.getElementById('login-email');
        if (loginEmail) loginEmail.value = email;
    });
    panel.querySelector('h3').setAttribute('tabindex', '-1');
    panel.querySelector('h3').focus();
}

// 1-click demo login: only the account key goes to the server (no passwords in the page).
// The buttons are shown only when the server has DEMO_MODE=true.
async function quickLogin(account) {
    try {
        const res = await API.post('/auth/demo-login', { account });
        if (!res.success) return;
        Auth.saveSession(res.token, res.user, res.store);
        if (window.showToast) window.showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับสู่ระบบตลาดใจ', 'success');
        const redirect = new URLSearchParams(window.location.search).get('redirect');
        setTimeout(() => {
            window.location.href = redirect || (res.user.role === 'seller' ? '/seller-dashboard.html' : res.user.role === 'admin' ? '/admin-dashboard.html' : '/index.html');
        }, 500);
    } catch (err) {
        if (window.showToast) window.showToast(err.message || 'เข้าสู่ระบบด่วนไม่สำเร็จ', 'error');
    }
}

async function showDemoAccounts() {
    const box = document.getElementById('quick-demo-container');
    if (!box) return;
    try {
        const res = await API.get('/auth/demo-accounts');
        // Signed-in users see only the "already signed in" box
        box.dataset.enabled = String(Boolean(res.enabled) && !document.getElementById('already-logged-in-box'));
        box.hidden = box.dataset.enabled !== 'true' || document.getElementById('login-panel')?.hidden;
    } catch (err) {
        box.hidden = true;
    }
}
document.addEventListener('DOMContentLoaded', showDemoAccounts);

// Fill the registration disability select from the disability_types table
async function loadDisabilityTypeOptions() {
    const select = document.getElementById('reg-disability-type');
    if (!select) return;
    try {
        const res = await API.get('/disability-types');
        if (!res.success || res.data.length === 0) return;
        const current = select.value;
        select.replaceChildren(new Option('ไม่ระบุ', ''), ...res.data.map(t => new Option(t.label, t.code)));
        if (res.data.some(t => t.code === current)) select.value = current;
    } catch (err) {
        console.warn('Unable to load disability types:', err.message);
    }
}

document.addEventListener('DOMContentLoaded', initLoginPage);
document.addEventListener('DOMContentLoaded', loadDisabilityTypeOptions);
