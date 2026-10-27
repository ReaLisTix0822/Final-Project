// ==============================================================================
// ADMIN PRODUCTS (/admin-products.html) — take illegal / unsuitable products off the site
// ?remove=<id> opens the removal popup for that product straight away (used from reports and product pages)
// ==============================================================================

let apdItems = [];
const apdBusy = new Set();

const apdEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function apdDate(value) {
    if (!value) return '';
    const raw = String(value);
    const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

const apdState = p => p.removed_by_admin ? 'removed' : !p.is_active ? 'hidden' : 'active';

function apdFiltered() {
    const q = document.getElementById('apd-search').value.trim().toLowerCase();
    const store = document.getElementById('apd-store').value;
    const status = document.getElementById('apd-status').value;
    return apdItems.filter(p =>
        (store === 'all' || String(p.store_id) === store) &&
        (status === 'all' || (status === 'reported' ? p.report_count > 0 && !p.removed_by_admin : apdState(p) === status)) &&
        (!q || [p.name, p.store_name, p.owner_name, p.category_name].join(' ').toLowerCase().includes(q)));
}

function renderApd() {
    const count = fn => apdItems.filter(fn).length.toLocaleString('th-TH');
    document.getElementById('apd-count-all').textContent = apdItems.length.toLocaleString('th-TH');
    document.getElementById('apd-count-active').textContent = count(p => apdState(p) === 'active');
    document.getElementById('apd-count-reported').textContent = count(p => p.report_count > 0 && !p.removed_by_admin);
    document.getElementById('apd-count-removed').textContent = count(p => p.removed_by_admin);

    const rows = apdFiltered();
    document.getElementById('apd-status-text').textContent = `แสดง ${rows.length} จาก ${apdItems.length} สินค้า`;
    const list = document.getElementById('apd-list');
    if (!rows.length) {
        list.innerHTML = `<li class="apd-empty">${apdItems.length ? 'ไม่พบสินค้าที่ตรงกับเงื่อนไข' : 'ยังไม่มีสินค้าในระบบ'}</li>`;
        return;
    }
    const stateLabel = { active: ['วางขายอยู่', 'ok'], hidden: ['ผู้ขายปิดการขาย', 'muted'], removed: ['ถูกนำออกโดยผู้ดูแล', 'bad'] };
    list.innerHTML = rows.map(p => {
        const id = Number(p.id);
        const state = apdState(p);
        const [label, tone] = stateLabel[state];
        const busy = apdBusy.has(id) ? 'disabled' : '';
        const name = apdEsc(p.name);
        return `
        <li class="apd-item apd-item--${state}" id="apd-${id}">
            <a class="apd-thumb" href="/product-detail.html?id=${id}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
                <img loading="lazy" decoding="async" src="${apdEsc(p.image_url)}" alt="" data-image-store-id="${Number(p.store_id) || ''}">
            </a>
            <div class="apd-body">
                <div class="apd-head">
                    <a class="apd-name" href="/product-detail.html?id=${id}" target="_blank" rel="noopener">${name}</a>
                    <span class="apd-tags">
                        <span class="apd-tag apd-tag--${tone}">${label}</span>
                        ${p.report_count ? `<a class="apd-tag apd-tag--report" href="/admin-complaints.html?tab=reports">ถูกรายงาน ${p.report_count} ครั้ง</a>` : ''}
                    </span>
                </div>
                <p class="apd-meta">
                    <a href="/store-detail.html?id=${Number(p.store_id)}" target="_blank" rel="noopener">${apdEsc(p.store_name || '—')}</a>
                    · ${apdEsc(p.owner_name || '')} · ${apdEsc(p.category_name || '')}
                    · ${TJFormat.money(Number(p.price))} · คงเหลือ ${Number(p.stock).toLocaleString('th-TH')}
                    · ขายแล้ว ${p.order_count.toLocaleString('th-TH')} คำสั่งซื้อ · ลงขาย ${apdEsc(apdDate(p.created_at))}
                </p>
                ${p.removed_by_admin ? `<p class="apd-reason">เหตุผลที่นำออก (${apdEsc(apdDate(p.removed_at))}): ${apdEsc(p.removal_reason)}</p>` : ''}
            </div>
            <div class="apd-actions">
                ${p.removed_by_admin
                    ? `<button type="button" class="btn btn-sm btn-outline-dark" onclick="restoreApd(${id})" ${busy} aria-label="คืนสถานะ ${name}">คืนสถานะ</button>`
                    : `<button type="button" class="btn btn-sm admin-delete-user" onclick="openApdDialog(${id})" ${busy} aria-label="นำ ${name} ออกจากเว็บไซต์">นำสินค้าออก</button>`}
                ${p.order_count === 0 && p.removed_by_admin ? `<button type="button" class="btn btn-sm admin-delete-user" onclick="openApdDialog(${id}, true)" ${busy} aria-label="ลบ ${name} ถาวร">ลบถาวร</button>` : ''}
            </div>
        </li>`;
    }).join('');
}

function fillApdStores() {
    const select = document.getElementById('apd-store');
    const stores = new Map(apdItems.filter(p => p.store_id).map(p => [String(p.store_id), p.store_name]));
    const current = select.value;
    select.innerHTML = '<option value="all">ทุกร้านค้า</option>' + [...stores].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'th'))
        .map(([id, name]) => `<option value="${apdEsc(id)}">${apdEsc(name)}</option>`).join('');
    if (stores.has(current)) select.value = current;
}

async function loadApd() {
    try {
        const res = await API.get('/admin/products');
        apdItems = res.data || [];
        fillApdStores();
        renderApd();
    } catch (err) {
        document.getElementById('apd-status-text').textContent = `โหลดสินค้าไม่สำเร็จ: ${err.message}`;
    }
}

// Removal popup: reason is required; "permanent" is only offered when no order references the product
function openApdDialog(productId, permanentOnly = false) {
    const product = apdItems.find(p => Number(p.id) === productId);
    if (!product) return;
    const dialog = document.getElementById('apd-dialog');
    const field = document.getElementById('apd-reason');
    const permanent = document.getElementById('apd-permanent');
    const canDelete = product.order_count === 0;
    dialog.dataset.productId = String(productId);
    document.getElementById('apd-dialog-title').textContent = permanentOnly ? 'ลบสินค้าถาวร' : 'นำสินค้าออกจากเว็บไซต์';
    document.getElementById('apd-dialog-product').textContent = `${product.name} · ${product.store_name || ''}`;
    field.value = permanentOnly ? (product.removal_reason || '') : '';
    field.removeAttribute('aria-invalid');
    document.getElementById('apd-count').textContent = `${field.value.length} / 500`;
    document.getElementById('apd-error').textContent = '';
    permanent.checked = permanentOnly;
    permanent.disabled = !canDelete || permanentOnly;
    document.getElementById('apd-permanent-note').textContent = canDelete
        ? '(สินค้านี้ยังไม่มีคำสั่งซื้อ ลบได้)'
        : `(ลบไม่ได้: มีคำสั่งซื้อ ${product.order_count} รายการ จึงเก็บข้อมูลไว้เป็นประวัติ)`;
    updateApdSubmitLabel();
    dialog.showModal();
    field.focus();
}

function updateApdSubmitLabel() {
    document.getElementById('apd-submit').textContent = document.getElementById('apd-permanent').checked ? 'ลบสินค้าถาวร' : 'นำสินค้าออก';
}

async function submitApd(e) {
    e.preventDefault();
    const dialog = document.getElementById('apd-dialog');
    const id = Number(dialog.dataset.productId);
    const field = document.getElementById('apd-reason');
    const reason = field.value.trim();
    const permanent = document.getElementById('apd-permanent').checked;
    if (reason.length < 5) {
        document.getElementById('apd-error').textContent = 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร';
        field.setAttribute('aria-invalid', 'true');
        field.focus();
        return;
    }
    if (permanent && !window.confirm('ลบสินค้าถาวร กู้คืนไม่ได้ ยืนยันหรือไม่?')) return;
    const submit = document.getElementById('apd-submit');
    submit.disabled = true;
    apdBusy.add(id);
    try {
        const product = apdItems.find(p => Number(p.id) === id);
        if (!permanent || !product?.removed_by_admin) {
            await API.put(`/admin/products/${id}/remove`, { reason });
        }
        const res = permanent
            ? await API.request(`/admin/products/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) })
            : { message: `นำ "${product?.name}" ออกจากเว็บไซต์แล้ว และแจ้งผู้ขายเรียบร้อย` };
        dialog.close();
        window.showToast?.(res.message, 'success');
        await loadApd();
    } catch (err) {
        document.getElementById('apd-error').textContent = err.message;
    } finally {
        submit.disabled = false;
        apdBusy.delete(id);
        renderApd();
    }
}

async function restoreApd(productId) {
    const product = apdItems.find(p => Number(p.id) === productId);
    if (!product || !window.confirm(`คืนสถานะ "${product.name}" ให้กลับมาวางขายหรือไม่?`)) return;
    apdBusy.add(productId);
    renderApd();
    try {
        const res = await API.put(`/admin/products/${productId}/restore`, {});
        window.showToast?.(res.message, 'success');
        await loadApd();
    } catch (err) {
        window.showToast?.(err.message, 'error');
    } finally {
        apdBusy.delete(productId);
        renderApd();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!(window.Auth && Auth.isLoggedIn() && Auth.getUser()?.role === 'admin')) return; // admin.js handles the redirect
    ['apd-store', 'apd-status'].forEach(id => document.getElementById(id).addEventListener('change', renderApd));
    document.getElementById('apd-search').addEventListener('input', renderApd);
    document.getElementById('apd-refresh').addEventListener('click', loadApd);
    const dialog = document.getElementById('apd-dialog');
    document.getElementById('apd-form').addEventListener('submit', submitApd);
    document.getElementById('apd-cancel').addEventListener('click', () => dialog.close());
    document.getElementById('apd-permanent').addEventListener('change', updateApdSubmitLabel);
    document.getElementById('apd-reason').addEventListener('input', e => {
        document.getElementById('apd-count').textContent = `${e.target.value.length} / 500`;
    });
    dialog.addEventListener('click', e => {
        const preset = e.target.closest('[data-apd-reason]');
        if (!preset) return;
        const field = document.getElementById('apd-reason');
        field.value = preset.dataset.apdReason;
        field.dispatchEvent(new Event('input'));
        field.focus();
    });

    const statusParam = new URLSearchParams(window.location.search).get('status');
    if (['active', 'reported', 'hidden', 'removed'].includes(statusParam)) document.getElementById('apd-status').value = statusParam;
    await loadApd();
    const removeId = Number(new URLSearchParams(window.location.search).get('remove'));
    if (removeId && apdItems.some(p => Number(p.id) === removeId && !p.removed_by_admin)) {
        document.getElementById(`apd-${removeId}`)?.scrollIntoView({ block: 'center' });
        openApdDialog(removeId);
    }
});
