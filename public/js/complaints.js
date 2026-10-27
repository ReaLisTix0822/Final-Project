// ==============================================================================
// COMPLAINTS PAGE (/complaints.html) — members send a complaint to the admin team
// and follow the status / admin reply of what they sent before.
// ==============================================================================

const cmpEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function cmpDate(value) {
    if (!value) return '';
    const raw = String(value);
    const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

let cmpCategories = {};
let cmpStatuses = {};
const CMP_ORDER_CATEGORIES = ['order', 'payment', 'seller', 'product'];

function cmpSetError(id, message) {
    const field = document.getElementById(id);
    const error = document.getElementById(`${id}-error`);
    if (error) error.textContent = message;
    if (message) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
    return !message;
}

async function loadCmpOptions() {
    const res = await API.get('/complaints/categories');
    cmpCategories = res.data.categories;
    cmpStatuses = res.data.statuses;
    document.getElementById('cmp-category').insertAdjacentHTML('beforeend',
        Object.entries(cmpCategories).map(([value, label]) => `<option value="${cmpEsc(value)}">${cmpEsc(label)}</option>`).join(''));
    // Links such as /complaints.html?category=privacy (privacy policy) open with the topic chosen
    const preset = new URLSearchParams(location.search).get('category');
    if (preset && Object.hasOwn(cmpCategories, preset)) document.getElementById('cmp-category').value = preset;
}

async function loadCmpOrders() {
    const user = Auth.getUser();
    const sources = [API.get('/orders/my-orders').catch(() => ({ data: [] }))];
    if (user?.role === 'seller') sources.push(API.get('/orders/seller-orders').catch(() => ({ data: [] })));
    const orders = (await Promise.all(sources)).flatMap(res => res.data || []);
    const seen = new Set();
    document.getElementById('cmp-order').insertAdjacentHTML('beforeend', orders
        .filter(o => !seen.has(o.id) && seen.add(o.id))
        .map(o => `<option value="${Number(o.id)}">#${Number(o.id)} · ${cmpEsc(o.store_name || o.buyer_name || '')} · ${TJFormat.money(Number(o.grand_total))} · ${cmpEsc(cmpDate(o.created_at))}</option>`).join(''));
}

async function loadMyComplaints() {
    const status = document.getElementById('cmp-mine-status');
    const list = document.getElementById('cmp-list');
    try {
        const res = await API.get('/complaints/mine');
        const rows = res.data || [];
        status.textContent = rows.length ? `ทั้งหมด ${rows.length} เรื่อง` : 'ยังไม่เคยส่งเรื่องร้องเรียน';
        list.innerHTML = rows.map(c => `
            <li class="cmp-item" id="complaint-${Number(c.id)}" tabindex="-1">
                <div class="cmp-item-head">
                    <div>
                        <span class="cmp-item-no">#${Number(c.id)} · ${cmpEsc(cmpCategories[c.category] || c.category)}</span>
                        <h3>${cmpEsc(c.subject)}</h3>
                    </div>
                    <span class="cmp-status cmp-status--${cmpEsc(c.status)}">${cmpEsc(cmpStatuses[c.status] || c.status)}</span>
                </div>
                <p class="cmp-item-detail">${cmpEsc(c.detail)}</p>
                <p class="cmp-item-meta">ส่งเมื่อ ${cmpEsc(cmpDate(c.created_at))}${c.order_id ? ` · คำสั่งซื้อ #${Number(c.order_id)}` : ''}</p>
                ${c.admin_reply ? `
                <div class="cmp-reply">
                    <span class="cmp-reply-label">คำตอบจากผู้ดูแลระบบ${c.replied_at ? ` · ${cmpEsc(cmpDate(c.replied_at))}` : ''}</span>
                    <p>${cmpEsc(c.admin_reply)}</p>
                </div>` : '<p class="cmp-waiting">รอผู้ดูแลระบบตอบกลับ</p>'}
            </li>`).join('');
        // Arriving from a notification link (#complaint-12): bring that complaint into view
        const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
        if (target) { target.classList.add('is-target'); target.focus(); target.scrollIntoView({ block: 'center' }); }
    } catch (err) {
        status.textContent = `โหลดเรื่องร้องเรียนไม่สำเร็จ: ${err.message}`;
    }
}

async function submitComplaint(e) {
    e.preventDefault();
    const category = document.getElementById('cmp-category').value;
    const subject = document.getElementById('cmp-subject').value.trim();
    const detail = document.getElementById('cmp-detail').value.trim();
    const okCategory = cmpSetError('cmp-category', category ? '' : 'กรุณาเลือกประเภทเรื่อง');
    const okSubject = cmpSetError('cmp-subject', subject.length >= 5 ? '' : 'กรุณากรอกหัวข้ออย่างน้อย 5 ตัวอักษร');
    const okDetail = cmpSetError('cmp-detail', detail.length >= 10 ? '' : 'กรุณาอธิบายรายละเอียดอย่างน้อย 10 ตัวอักษร');
    if (!(okCategory && okSubject && okDetail)) {
        document.querySelector('#cmp-form [aria-invalid="true"]')?.focus();
        return;
    }

    const submit = document.getElementById('cmp-submit');
    const status = document.getElementById('cmp-form-status');
    submit.disabled = true;
    status.textContent = 'กำลังส่งเรื่อง...';
    try {
        const orderId = document.getElementById('cmp-order').value;
        const res = await API.post('/complaints', { category, subject, detail, order_id: orderId || null });
        status.textContent = res.message;
        window.showToast?.(res.message, 'success');
        e.target.reset();
        document.getElementById('cmp-detail-count').textContent = '0 / 3000';
        document.getElementById('cmp-order-field').hidden = true;
        await loadMyComplaints();
    } catch (err) {
        status.textContent = `ส่งไม่สำเร็จ: ${err.message}`;
        window.showToast?.(err.message, 'error');
    } finally {
        submit.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!(window.Auth && Auth.isLoggedIn())) {
        document.getElementById('cmp-guest').hidden = false;
        return;
    }
    const form = document.getElementById('cmp-form');
    form.hidden = false;
    document.getElementById('cmp-mine').hidden = false;
    form.addEventListener('submit', submitComplaint);
    document.getElementById('cmp-category').addEventListener('change', e => {
        document.getElementById('cmp-order-field').hidden = !CMP_ORDER_CATEGORIES.includes(e.target.value);
        if (e.target.value) cmpSetError('cmp-category', '');
    });
    document.getElementById('cmp-detail').addEventListener('input', e => {
        document.getElementById('cmp-detail-count').textContent = `${e.target.value.length} / 3000`;
    });
    try {
        await loadCmpOptions();
    } catch (err) {
        document.getElementById('cmp-form-status').textContent = `โหลดประเภทเรื่องไม่สำเร็จ: ${err.message}`;
    }
    loadCmpOrders();
    loadMyComplaints();
});
