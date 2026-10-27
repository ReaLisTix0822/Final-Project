// ==============================================================================
// ADMIN COMPLAINTS (/admin-complaints.html) — reply to and track member complaints
// ==============================================================================

let acmItems = [];
let acmCategories = {};
let acmStatuses = {};
const acmBusy = new Set();

const acmEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function acmDate(value) {
    if (!value) return '';
    const raw = String(value);
    const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function acmFiltered() {
    const q = document.getElementById('acm-search').value.trim().toLowerCase();
    const status = document.getElementById('acm-status').value;
    const category = document.getElementById('acm-category').value;
    return acmItems.filter(c =>
        (status === 'all' || c.status === status) &&
        (category === 'all' || c.category === category) &&
        (!q || [c.subject, c.detail, c.user_name, c.user_email, c.admin_reply].join(' ').toLowerCase().includes(q)));
}

function renderAcmSummary() {
    const count = s => acmItems.filter(c => c.status === s).length;
    document.getElementById('acm-count-all').textContent = acmItems.length.toLocaleString('th-TH');
    document.getElementById('acm-count-open').textContent = count('open').toLocaleString('th-TH');
    document.getElementById('acm-count-in_progress').textContent = count('in_progress').toLocaleString('th-TH');
    document.getElementById('acm-count-done').textContent = (count('resolved') + count('closed')).toLocaleString('th-TH');
}

// Two tabs on one page: member complaints and content reports (reports are rendered by admin.js)
function setAcmTab(tab, focus = false) {
    document.querySelectorAll('[data-acm-tab]').forEach(btn => {
        const active = btn.dataset.acmTab === tab;
        btn.setAttribute('aria-selected', String(active));
        btn.tabIndex = 0;   // every tab is reachable with Tab, not only the chosen one
        document.getElementById(btn.getAttribute('aria-controls')).hidden = !active;
        if (active && focus) btn.focus();
    });
    const url = new URL(window.location.href);
    if (tab === 'reports') url.searchParams.set('tab', 'reports'); else url.searchParams.delete('tab');
    history.replaceState(null, '', url);
}

function updateAcmTabCounts() {
    const open = acmItems.filter(c => c.status === 'open' || c.status === 'in_progress').length;
    document.getElementById('acm-tab-count-complaints').textContent = open.toLocaleString('th-TH');
    const reports = typeof adminReports !== 'undefined' ? adminReports.filter(r => r.status === 'pending' || r.status === 'reviewing').length : 0;
    document.getElementById('acm-tab-count-reports').textContent = reports.toLocaleString('th-TH');
}

if (typeof renderAdminReports === 'function') {
    const renderReportsTable = renderAdminReports;
    window.renderAdminReports = function () { renderReportsTable(); updateAcmTabCounts(); };
}

function renderAcm() {
    renderAcmSummary();
    updateAcmTabCounts();
    const rows = acmFiltered();
    const list = document.getElementById('acm-list');
    document.getElementById('acm-status-text').textContent = `แสดง ${rows.length} จาก ${acmItems.length} เรื่อง`;
    if (!rows.length) {
        list.innerHTML = `<li class="acm-empty">${acmItems.length ? 'ไม่พบเรื่องที่ตรงกับเงื่อนไข' : 'ยังไม่มีเรื่องร้องเรียน'}</li>`;
        return;
    }
    list.innerHTML = rows.map(c => {
        const id = Number(c.id);
        const busy = acmBusy.has(id) ? 'disabled' : '';
        const options = Object.entries(acmStatuses).map(([v, l]) => `<option value="${v}" ${v === c.status ? 'selected' : ''}>${acmEsc(l)}</option>`).join('');
        return `
        <li class="acm-item acm-item--${acmEsc(c.status)}" id="acm-${id}" tabindex="-1">
            <div class="acm-head">
                <div>
                    <span class="acm-no">#${id} · ${acmEsc(acmCategories[c.category] || c.category)}</span>
                    <h2>${acmEsc(c.subject)}</h2>
                </div>
                <span class="acm-status acm-status--${acmEsc(c.status)}">${acmEsc(acmStatuses[c.status] || c.status)}</span>
            </div>
            <p class="acm-detail">${acmEsc(c.detail)}</p>
            <p class="acm-meta">
                <a href="/admin-user-detail.html?id=${Number(c.user_id)}">${acmEsc(c.user_name || 'ผู้ใช้ที่ถูกลบ')}</a>
                · ${acmEsc(c.user_email || '')}${c.user_phone ? ` · ${acmEsc(c.user_phone)}` : ''}
                · ส่งเมื่อ ${acmEsc(acmDate(c.created_at))}${c.order_id ? ` · คำสั่งซื้อ #${Number(c.order_id)}` : ''}
            </p>
            <form class="acm-reply-form" data-id="${id}">
                <div class="acm-reply-grid">
                    <div>
                        <label for="acm-reply-${id}">คำตอบถึงผู้ร้องเรียน${c.replied_at ? ` <small>(ตอบล่าสุด ${acmEsc(acmDate(c.replied_at))})</small>` : ''}</label>
                        <textarea id="acm-reply-${id}" rows="3" maxlength="3000" placeholder="พิมพ์คำตอบ ผู้ร้องเรียนจะเห็นในการแจ้งเตือนและหน้าเรื่องร้องเรียนของตน">${acmEsc(c.admin_reply || '')}</textarea>
                    </div>
                    <div class="acm-reply-side">
                        <label for="acm-state-${id}">สถานะ</label>
                        <select id="acm-state-${id}">${options}</select>
                        <button type="submit" class="btn btn-primary" ${busy}>บันทึกและแจ้งผู้ร้องเรียน</button>
                    </div>
                </div>
            </form>
        </li>`;
    }).join('');
}

async function saveAcm(form) {
    const id = Number(form.dataset.id);
    const item = acmItems.find(c => Number(c.id) === id);
    if (!item || acmBusy.has(id)) return;
    const status = document.getElementById(`acm-state-${id}`).value;
    const reply = document.getElementById(`acm-reply-${id}`).value.trim();
    acmBusy.add(id);
    form.querySelector('button[type="submit"]').disabled = true;
    try {
        const res = await API.put(`/complaints/${id}`, { status, admin_reply: reply });
        window.showToast?.(res.message, 'success');
        await loadAcm(id);
    } catch (err) {
        window.showToast?.(err.message || 'บันทึกไม่สำเร็จ', 'error');
    } finally {
        acmBusy.delete(id);
        renderAcm();
    }
}

async function loadAcm(focusId = null) {
    const text = document.getElementById('acm-status-text');
    try {
        const res = await API.get('/complaints');
        acmItems = res.data || [];
        renderAcm();
        const target = focusId && document.getElementById(`acm-${focusId}`);
        if (target) { target.classList.add('is-target'); target.scrollIntoView({ block: 'center' }); target.focus(); }
    } catch (err) {
        text.textContent = `โหลดเรื่องร้องเรียนไม่สำเร็จ: ${err.message}`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!(window.Auth && Auth.isLoggedIn() && Auth.getUser()?.role === 'admin')) return; // admin.js handles the redirect
    try {
        const res = await API.get('/complaints/categories');
        acmCategories = res.data.categories;
        acmStatuses = res.data.statuses;
        document.getElementById('acm-status').insertAdjacentHTML('beforeend', Object.entries(acmStatuses).map(([v, l]) => `<option value="${v}">${acmEsc(l)}</option>`).join(''));
        document.getElementById('acm-category').insertAdjacentHTML('beforeend', Object.entries(acmCategories).map(([v, l]) => `<option value="${v}">${acmEsc(l)}</option>`).join(''));
    } catch (err) { /* list still loads; labels fall back to codes */ }
    ['acm-status', 'acm-category'].forEach(id => document.getElementById(id).addEventListener('change', renderAcm));
    document.getElementById('acm-search').addEventListener('input', renderAcm);
    document.getElementById('acm-refresh').addEventListener('click', () => loadAcm());
    const tabs = document.querySelectorAll('[data-acm-tab]');
    tabs.forEach(btn => btn.addEventListener('click', () => setAcmTab(btn.dataset.acmTab)));
    document.querySelector('.acm-tabs').addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const current = document.querySelector('[data-acm-tab][aria-selected="true"]').dataset.acmTab;
        setAcmTab(current === 'complaints' ? 'reports' : 'complaints', true);
    });
    setAcmTab(new URLSearchParams(window.location.search).get('tab') === 'reports' ? 'reports' : 'complaints');
    document.getElementById('acm-list').addEventListener('submit', e => {
        e.preventDefault();
        saveAcm(e.target.closest('.acm-reply-form'));
    });
    loadAcm(Number(new URLSearchParams(window.location.search).get('id')) || null);
});
