// ==============================================================================
// ADMIN DASHBOARD CONTROLLER
// Platform stats, verification approvals, store moderation & campaigns
// ==============================================================================

async function initAdminDashboard() {
    if (!Auth.isLoggedIn()) {
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    const user = Auth.getUser();
    if (user.role !== 'admin') {
        alert('หน้านี้สำหรับบัญชีผู้ดูแลระบบ (Admin) เท่านั้น');
        window.location.href = '/index.html';
        return;
    }

    const name = document.getElementById('admin-topbar-name');
    const initials = document.getElementById('admin-topbar-initials');
    const avatar = document.getElementById('admin-topbar-avatar');
    if (name) name.textContent = user.full_name || 'ผู้ดูแลระบบ';
    if (initials) initials.textContent = Array.from((user.full_name || 'Admin').trim())[0] || 'A';
    if (avatar && initials && user.avatar_url) {
        avatar.onerror = () => { avatar.hidden = true; initials.hidden = false; };
        avatar.src = user.avatar_url;
        avatar.hidden = false;
        initials.hidden = true;
    }

    // Each page loads only the data it displays.
    if (document.getElementById('admin-total-revenue')) await loadAdminStats();
    if (document.getElementById('admin-stores-table-container')) await loadAdminStores();
    if (document.getElementById('admin-users-table-container')) await loadAdminUsers();
    if (document.getElementById('admin-reports-table-container')) await loadAdminReports();
    if (document.getElementById('campaign-form')) initCampaignForm();
    if (document.getElementById('ai-status-pill')) await loadAiStatus();
}

let adminTrend = null;
let adminStatsLoaded = false;

async function loadAdminStats() {
    // The cards show their own "—" while loading; this line is only for errors (nothing above the cards appears and disappears)
    const status = document.getElementById('admin-overview-status');
    if (!adminTrend) adminTrend = TJDash.trend(document.getElementById('admin-trend'), { period: 'month' });
    try {
        const [res, shared, users] = await Promise.all([
            API.get('/admin/stats'),
            API.get('/marketplace/stats').catch(() => null),
            API.get('/admin/users').catch(() => null)
        ]);
        if (!res.success || !res.data) throw new Error(res.message || 'โหลดข้อมูลไม่สำเร็จ');
        const d = res.data;
        if (d.sales_revenue == null || d.shipped_orders == null || !Array.isArray(d.sales_daily)) {
            throw new Error('ข้อมูลสรุปจากเซิร์ฟเวอร์ยังไม่ครบ กรุณารีสตาร์ตเซิร์ฟเวอร์แล้วกดรีเฟรชข้อมูล');
        }
        // Same API and formula as the homepage "รายได้ผู้ขายสะสม" (subtotal + tips, no shipping)
        document.getElementById('admin-total-revenue').textContent = TJFormat.money(Number(shared?.data?.seller_revenue ?? d.sales_revenue) || 0);
        renderAdminOverviewDetails(d, users?.success && Array.isArray(users.data) ? users.data : null);
        adminTrend.setDaily(d.sales_daily);
        adminStatsLoaded = true;
        if (status) status.textContent = '';
    } catch (err) {
        if (status) status.textContent = `โหลดข้อมูลไม่สำเร็จ${adminStatsLoaded ? ' (ยังแสดงข้อมูลครั้งก่อน)' : ''}: ${err.message}`;
    }
}

let adminStores = [];
const adminStoreStatusLabels = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ระงับ / ไม่อนุมัติ', closed: 'เจ้าของปิดบัญชีแล้ว' };
const pendingStoreUpdates = new Set();

async function loadAdminStores() {
    const container = document.getElementById('admin-stores-table-container');
    const status = document.getElementById('admin-stores-status');
    if (status) status.textContent = 'กำลังโหลดข้อมูลร้านค้า...';
    try {
        const res = await API.get('/admin/stores');
        if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'โหลดข้อมูลไม่สำเร็จ');
        adminStores = res.data;
        for (const state of ['all', 'pending', 'approved', 'rejected']) {
            const count = document.getElementById(`stores-count-${state}`);
            if (count) count.textContent = (state === 'all' ? adminStores.length : adminStores.filter(store => store.verification_status === state).length).toLocaleString('th-TH');
        }
        renderAdminStores();
    } catch (err) {
        if (status) status.textContent = `โหลดข้อมูลไม่สำเร็จ: ${err.message}`;
        if (!adminStores.length) container.textContent = 'กรุณาลองรีเฟรชข้อมูลอีกครั้ง';
    }
}

function renderAdminStores() {
    const query = (document.getElementById('admin-store-search')?.value || '').trim().toLocaleLowerCase('th-TH');
    const filter = document.getElementById('admin-store-filter')?.value || 'all';
    const rows = adminStores.filter(store => (filter === 'all' || store.verification_status === filter) &&
        [store.store_name, store.owner_name, store.owner_email, store.phone, store.province].some(value => String(value || '').toLocaleLowerCase('th-TH').includes(query)));
    const status = document.getElementById('admin-stores-status');
    if (status) status.textContent = `แสดง ${rows.length} จาก ${adminStores.length} ร้านค้า`;
    const container = document.getElementById('admin-stores-table-container');
    if (!rows.length) {
        container.innerHTML = `<p class="admin-users-empty">${query || filter !== 'all' ? 'ไม่พบร้านค้าที่ตรงกับเงื่อนไข' : 'ยังไม่มีร้านค้าในระบบ'}</p>`;
        return;
    }
    const money = value => TJFormat.number(value);
    container.innerHTML = `<div class="admin-users-scroll" role="region" aria-label="ตารางร้านค้า เลื่อนแนวนอนเพื่อดูข้อมูลเพิ่มเติม" tabindex="0"><table class="admin-users-table admin-stores-table">
        <thead><tr><th scope="col">ร้านค้า / จังหวัด</th><th scope="col">เจ้าของร้าน / ติดต่อ</th><th scope="col">กลุ่มความพิการ</th><th scope="col">ทุนสะสม / เป้าหมาย</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr></thead>
        <tbody>${rows.map(store => {
            const id = Number(store.id);
            const name = escapeAdminText(store.store_name);
            const state = Object.hasOwn(adminStoreStatusLabels, store.verification_status) ? store.verification_status : 'unknown';
            const busy = pendingStoreUpdates.has(id) ? 'disabled' : '';
            return `<tr><td><strong>${name}</strong><small>${escapeAdminText(store.province || 'ไม่ระบุจังหวัด')}</small></td>
                <td><strong>${escapeAdminText(store.owner_name)}</strong><small>${escapeAdminText(store.owner_email)}</small><small>${escapeAdminText(store.phone || '—')}</small></td>
                <td>${escapeAdminText(store.disability_name || store.disability_type || '—')}</td>
                <td class="admin-store-funding">฿${money(store.support_goal_current)}<small>จาก ฿${money(store.support_goal_target)}</small></td>
                <td><span class="admin-store-state state-${state}">${escapeAdminText(adminStoreStatusLabels[state] || 'ไม่ระบุสถานะ')}</span>${state === 'rejected' && store.rejection_reason ? `<small class="admin-reject-note">เหตุผล: ${escapeAdminText(store.rejection_reason)}</small>` : ''}</td>
                <td><div class="admin-store-actions"><a href="/store-detail.html?id=${id}" class="btn btn-sm btn-outline-dark" aria-label="ดูร้าน ${name}">ดูร้านค้า</a>
                <button type="button" class="btn btn-sm btn-outline-dark admin-docs-btn" onclick="openStoreDocuments(${id})" aria-label="ดูเอกสารยืนยันตัวตนของ ${name}">เอกสาร (${Number(store.document_count) || 0})</button>
                ${state !== 'approved' && state !== 'closed' ? `<button type="button" class="btn btn-sm admin-approve-store" onclick="setStoreStatus(${id}, 'approved')" ${busy} aria-label="อนุมัติ ${name}">อนุมัติ</button>` : ''}
                ${state !== 'rejected' && state !== 'closed' ? `<button type="button" class="btn btn-sm admin-delete-user" onclick="setStoreStatus(${id}, 'rejected')" ${busy} aria-label="ระงับหรือไม่อนุมัติ ${name}">${state === 'pending' ? 'ไม่อนุมัติ' : 'ระงับ'}</button>` : ''}
                </div></td></tr>`;
        }).join('')}</tbody></table></div>`;
}

// Verification documents: fetched with the admin token (files are not public) and opened in a new tab
async function openStoreDocuments(storeId) {
    const dialog = document.getElementById('admin-docs-dialog');
    const list = document.getElementById('admin-docs-list');
    const store = adminStores.find(s => Number(s.id) === storeId);
    document.getElementById('admin-docs-store').textContent = store ? `${store.store_name} · ${store.owner_name}` : '';
    list.innerHTML = '<li class="admin-docs-empty">กำลังโหลดเอกสาร...</li>';
    dialog.showModal();
    try {
        const res = await API.get(`/admin/stores/${storeId}/documents`);
        const docs = res.data || [];
        if (!docs.length) {
            list.innerHTML = '<li class="admin-docs-empty">ร้านค้านี้ยังไม่มีเอกสารแนบ (สมัครก่อนเปิดระบบแนบเอกสาร)</li>';
            return;
        }
        const size = bytes => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
        list.innerHTML = docs.map(doc => `
            <li class="admin-docs-item">
                <span class="admin-docs-icon" aria-hidden="true">${doc.mime_type === 'application/pdf' ? 'PDF' : 'IMG'}</span>
                <span class="admin-docs-info"><strong>${escapeAdminText(doc.doc_label)}</strong><small>${escapeAdminText(doc.original_name)} · ${size(Number(doc.file_size) || 0)}</small></span>
                <button type="button" class="btn btn-sm btn-primary" onclick="viewStoreDocument(${storeId}, ${Number(doc.id)}, this)">เปิดดู</button>
            </li>`).join('');
    } catch (err) {
        list.innerHTML = `<li class="admin-docs-empty">โหลดเอกสารไม่สำเร็จ: ${escapeAdminText(err.message)}</li>`;
    }
}

async function viewStoreDocument(storeId, docId, button) {
    const tab = window.open('', '_blank');
    button.disabled = true;
    try {
        const response = await fetch(`${API.baseUrl}/admin/stores/${storeId}/documents/${docId}/file`, {
            headers: { Authorization: `Bearer ${API.getToken()}` }
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'เปิดเอกสารไม่สำเร็จ');
        const url = URL.createObjectURL(await response.blob());
        if (tab) tab.location.href = url; else window.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
        if (tab) tab.close();
        window.showToast ? window.showToast(err.message, 'error') : alert(err.message);
    } finally {
        button.disabled = false;
    }
}

let adminUsers = [];
let adminUserRoleFilter = 'all';
const adminRoleLabels = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'ผู้ดูแลระบบ' };
function escapeAdminText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function loadAdminUsers() {
    const container = document.getElementById('admin-users-table-container');
    const status = document.getElementById('admin-users-status');
    if (status) status.textContent = 'กำลังโหลดข้อมูลสมาชิก...';
    try {
        const res = await API.get('/admin/users');
        if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'โหลดข้อมูลไม่สำเร็จ');
        adminUsers = res.data;
        for (const role of ['all', 'buyer', 'seller', 'admin']) {
            const count = document.getElementById(`users-count-${role}`);
            if (count) count.textContent = (role === 'all' ? adminUsers.length : adminUsers.filter(u => u.role === role).length).toLocaleString('th-TH');
        }
        renderAdminUsers();
    } catch (err) {
        if (status) status.textContent = `โหลดข้อมูลไม่สำเร็จ: ${err.message}`;
        if (!adminUsers.length) container.textContent = 'กรุณาลองรีเฟรชข้อมูลอีกครั้ง';
    }
}

function filterAdminUsers(role) {
    if (!['all', 'buyer', 'seller', 'admin'].includes(role)) return;
    adminUserRoleFilter = role;
    document.querySelectorAll('[data-user-role]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.userRole === role));
    });
    renderAdminUsers();
}

function renderAdminUsers() {
    const query = (document.getElementById('admin-user-search')?.value || '').trim().toLocaleLowerCase('th-TH');
    const rows = adminUsers.filter(user =>
        (adminUserRoleFilter === 'all' || user.role === adminUserRoleFilter) &&
        [user.full_name, user.phone, user.email].some(value => String(value || '').toLocaleLowerCase('th-TH').includes(query)));
    const status = document.getElementById('admin-users-status');
    if (status) status.textContent = `แสดง ${rows.length} จาก ${adminUsers.length} สมาชิก`;
    const container = document.getElementById('admin-users-table-container');
    if (!rows.length) {
        container.innerHTML = `<p class="admin-users-empty">${query || adminUserRoleFilter !== 'all' ? 'ไม่พบสมาชิกที่ตรงกับคำค้นหาและตัวกรอง' : 'ยังไม่มีสมาชิกในระบบ'}</p>`;
        return;
    }
    container.innerHTML = `<div class="admin-users-scroll" role="region" aria-label="ตารางสมาชิก เลื่อนแนวนอนเพื่อดูข้อมูลเพิ่มเติม" tabindex="0"><table class="admin-users-table">
        <thead><tr><th scope="col">ชื่อสมาชิก</th><th scope="col">เบอร์โทร</th><th scope="col">อีเมล</th><th scope="col">บทบาทสมาชิก</th><th scope="col">วันที่สมัคร</th><th scope="col">จัดการ</th></tr></thead>
        <tbody>${rows.map(user => {
            const id = Number(user.id);
            const name = escapeAdminText(user.full_name);
            const role = Object.hasOwn(adminRoleLabels, user.role) ? user.role : 'buyer';
            const protectedUser = user.role === 'admin' || id === Number(Auth.getUser()?.id);
            const date = new Date(user.created_at);
            return `<tr><td><a class="admin-user-link" href="/admin-user-detail.html?id=${id}"><strong>${name}</strong></a></td><td>${escapeAdminText(user.phone || '—')}</td><td>${escapeAdminText(user.email)}</td>
                <td><span class="admin-user-role role-${role}">${escapeAdminText(adminRoleLabels[user.role] || user.role)}</span></td>
                <td>${Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('th-TH')}</td>
                <td><div class="admin-user-actions"><a href="/admin-user-detail.html?id=${id}" class="btn btn-sm btn-primary admin-user-view" aria-label="ดูข้อมูลและประวัติการใช้งานของ ${name}">ดูข้อมูล</a>
                <button type="button" class="btn btn-sm btn-outline-dark" onclick="editAdminUser(${id})" aria-label="แก้ไข ${name}">✎ แก้ไข</button>
                <button type="button" class="btn btn-sm admin-delete-user" onclick="deleteAdminUser(${id}, this)" ${protectedUser ? 'disabled title="ไม่สามารถลบบัญชีผู้ดูแลระบบหรือบัญชีตนเอง"' : ''} aria-label="ลบ ${name}">ลบ</button></div></td></tr>`;
        }).join('')}</tbody></table></div>`;
}

function editAdminUser(id) {
    const user = adminUsers.find(item => Number(item.id) === id);
    if (!user) return;
    document.getElementById('admin-edit-user-id').value = id;
    document.getElementById('admin-edit-user-name').value = user.full_name || '';
    document.getElementById('admin-edit-user-phone').value = user.phone || '';
    document.getElementById('admin-edit-user-email').value = user.email || '';
    document.getElementById('admin-user-form-status').textContent = '';
    document.getElementById('admin-user-dialog').showModal();
    document.getElementById('admin-edit-user-name').focus();
}

async function saveAdminUser(event) {
    event.preventDefault();
    const button = document.getElementById('admin-user-save');
    if (button.disabled) return;
    const status = document.getElementById('admin-user-form-status');
    const id = Number(document.getElementById('admin-edit-user-id').value);
    const payload = {
        full_name: document.getElementById('admin-edit-user-name').value.trim(),
        phone: document.getElementById('admin-edit-user-phone').value.trim(),
        email: document.getElementById('admin-edit-user-email').value.trim()
    };
    button.disabled = true;
    status.textContent = 'กำลังบันทึก...';
    try {
        const res = await API.put(`/admin/users/${id}`, payload);
        if (!res.success) throw new Error(res.message || 'บันทึกไม่สำเร็จ');
        const current = Auth.getUser();
        if (Number(current?.id) === id) Auth.saveSession(API.getToken(), { ...current, ...payload }, Auth.getStore());
        document.getElementById('admin-user-dialog').close();
        window.showToast('บันทึกข้อมูลสมาชิกแล้ว', 'success');
        await loadAdminUsers();
    } catch (err) {
        status.textContent = err.message;
    } finally {
        button.disabled = false;
    }
}

async function deleteAdminUser(id, button) {
    const user = adminUsers.find(item => Number(item.id) === id);
    if (!user || button.disabled) return;
    if (!window.confirm(`ลบบัญชีของ ${user.full_name} (${user.email}) ถาวรหรือไม่?\nสินค้าที่ถูกใจ แชท ตะกร้า ที่อยู่ และการแจ้งเตือนของบัญชีนี้จะถูกลบด้วย\n(บัญชีที่มีร้านค้า คำสั่งซื้อ หรือรีวิว จะไม่สามารถลบได้)`)) return;
    button.disabled = true;
    try {
        const res = await API.delete(`/admin/users/${id}`);
        if (!res.success) throw new Error(res.message || 'ลบไม่สำเร็จ');
        await loadAdminUsers();
        window.showToast('ลบบัญชีสมาชิกแล้ว', 'success');
    } catch (err) {
        window.showToast(err.message, 'error');
    } finally {
        button.disabled = false;
    }
}

// Popup asking why a store is rejected / suspended. Resolves with the reason, or null when cancelled.
function askRejectReason(store) {
    const dialog = document.getElementById('admin-reject-dialog');
    if (!dialog) {
        const text = window.prompt('ระบุเหตุผลที่ไม่อนุมัติ / ระงับร้านค้า');
        return Promise.resolve(text && text.trim().length >= 5 ? text.trim() : null);
    }
    const form = document.getElementById('admin-reject-form');
    const field = document.getElementById('admin-reject-reason');
    const error = document.getElementById('admin-reject-error');
    const count = document.getElementById('admin-reject-count');
    const suspend = store?.verification_status === 'approved';
    document.getElementById('admin-reject-title').textContent = suspend ? 'ระงับร้านค้า' : 'ไม่อนุมัติร้านค้า';
    document.getElementById('admin-reject-submit').textContent = suspend ? 'ยืนยันระงับร้านค้า' : 'ยืนยันไม่อนุมัติ';
    document.getElementById('admin-reject-label').textContent = suspend ? 'เหตุผลที่ระงับร้านค้า *' : 'เหตุผลที่ไม่อนุมัติ *';
    document.getElementById('admin-reject-hint').textContent = suspend
        ? 'ร้านค้าจะเห็นเหตุผลนี้ในการแจ้งเตือนและตอนเข้าสู่ระบบ'
        : 'ผู้สมัครจะเห็นเหตุผลนี้ในการแจ้งเตือนและตอนเข้าสู่ระบบ';
    dialog.querySelectorAll('[data-reject-mode]').forEach(group => { group.hidden = group.dataset.rejectMode !== (suspend ? 'suspend' : 'reject'); });
    document.getElementById('admin-reject-store').textContent = store ? `${store.store_name} · ${store.owner_name || ''}` : '';
    field.value = '';
    field.placeholder = suspend ? 'อธิบายให้ร้านค้าทราบว่าถูกระงับเพราะอะไร' : 'อธิบายให้ผู้สมัครทราบว่าต้องแก้ไขอะไร';
    error.textContent = '';
    field.removeAttribute('aria-invalid');
    count.textContent = '0 / 500';

    return new Promise(resolve => {
        const updateCount = () => { count.textContent = `${field.value.length} / 500`; };
        const pick = e => {
            const btn = e.target.closest('[data-reject-reason]');
            if (!btn) return;
            field.value = btn.dataset.rejectReason;
            updateCount();
            field.focus();
        };
        const submit = e => {
            e.preventDefault();
            const reason = field.value.trim();
            if (reason.length < 5) {
                error.textContent = `กรุณาระบุเหตุผลที่${suspend ? 'ระงับ' : 'ไม่อนุมัติ'}อย่างน้อย 5 ตัวอักษร`;
                field.setAttribute('aria-invalid', 'true');
                field.focus();
                return;
            }
            finish(reason);
        };
        const cancel = () => finish(null);
        function finish(value) {
            form.removeEventListener('submit', submit);
            form.removeEventListener('click', pick);
            field.removeEventListener('input', updateCount);
            document.getElementById('admin-reject-cancel').removeEventListener('click', cancel);
            dialog.removeEventListener('cancel', cancel);
            if (dialog.open) dialog.close();
            resolve(value);
        }
        form.addEventListener('submit', submit);
        form.addEventListener('click', pick);
        field.addEventListener('input', updateCount);
        document.getElementById('admin-reject-cancel').addEventListener('click', cancel);
        dialog.addEventListener('cancel', cancel);
        dialog.showModal();
        field.focus();
    });
}

async function setStoreStatus(storeId, status) {
    if (!['approved', 'rejected'].includes(status) || pendingStoreUpdates.has(storeId)) return;
    const store = adminStores.find(item => Number(item.id) === storeId);
    let reason = '';
    if (status === 'rejected') {
        reason = await askRejectReason(store);
        if (reason === null) return;
    }
    pendingStoreUpdates.add(storeId);
    renderAdminStores();
    try {
        const res = await API.put(`/admin/stores/${storeId}/verify`, status === 'rejected' ? { status, reason } : { status });
        if (!res.success) throw new Error(res.message || 'เปลี่ยนสถานะไม่สำเร็จ');
        window.showToast(res.message, 'success');
        await loadAdminStores();
        if (document.getElementById('admin-total-revenue')) await loadAdminStats();
    } catch (err) {
        window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
        pendingStoreUpdates.delete(storeId);
        renderAdminStores();
    }
}

async function handleCreateCampaign(e) {
    e.preventDefault();
    const submit = document.getElementById('campaign-submit');
    if (submit.disabled) return;
    const status = document.getElementById('campaign-status');
    status.textContent = '';
    const payload = {
        title: document.getElementById('camp-title').value.trim(),
        location: document.getElementById('camp-location').value.trim(),
        start_date: document.getElementById('camp-start').value,
        end_date: document.getElementById('camp-end').value,
        image_url: document.getElementById('camp-image').value.trim(),
        description: document.getElementById('camp-desc').value.trim()
    };

    if (payload.end_date < payload.start_date) {
        status.textContent = 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
        document.getElementById('camp-end').focus();
        return;
    }
    submit.disabled = true;
    submit.textContent = 'กำลังสร้างแคมเปญ...';
    try {
        const res = await API.post('/campaigns', payload);
        if (res.success) {
            window.showToast('สร้างแคมเปญเรียบร้อยแล้ว', 'success');
            document.getElementById('campaign-form').reset();
            updateCampaignPreview();
            status.textContent = 'สร้างแคมเปญเรียบร้อยแล้ว';
        } else {
            throw new Error(res.message || 'ไม่สามารถสร้างแคมเปญได้');
        }
    } catch (err) {
        status.textContent = `สร้างแคมเปญไม่สำเร็จ: ${err.message}`;
        window.showToast(status.textContent, 'error');
    } finally {
        submit.disabled = false;
        submit.textContent = 'สร้างแคมเปญ';
    }
}

async function loadAiStatus() {
    const pill = document.getElementById('ai-status-pill');
    if (!pill) return;

    try {
        const res = await API.get('/ai/status');
        if (res.success) {
            // One model name everywhere: the value the backend really uses (GEMINI_MODEL)
            document.querySelectorAll('[data-ai-model-name]').forEach(el => { el.textContent = res.model; });
            if (res.configured) {
                pill.style.background = 'var(--color-success-soft)';
                pill.style.borderColor = 'var(--color-divider)';
                pill.style.color = 'var(--color-success)';
                pill.innerHTML = `ใช้งาน ${res.model} (Free Tier พร้อมใช้งาน)`;
            } else {
                pill.style.background = 'var(--color-primary-soft)';
                pill.style.borderColor = 'var(--color-divider)';
                pill.style.color = 'var(--color-accent)';
                pill.innerHTML = `ใช้ระบบอัจฉริยะสำรอง (พร้อมใส่ API Key)`;
            }
        }
    } catch (err) {
        pill.innerText = 'ตรวจสอบสถานะไม่ได้';
    }
}

async function saveGeminiKey() {
    const keyInput = document.getElementById('gemini-api-key-input');
    const key = keyInput.value.trim();

    if (!key) {
        alert('กรุณากรอก API Key ก่อนบันทึกครับ');
        keyInput.focus();
        return;
    }

    try {
        const res = await API.post('/ai/set-key', { apiKey: key });
        if (res.success) {
            window.showToast(res.message, 'success');
            keyInput.value = '';
            await loadAiStatus();
        }
    } catch (err) {
        window.showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
    }
}

function formatCampaignDate(value) {
    if (!value) return 'วว/ดด/ปปปป';
    return new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Live preview card on the create-campaign page
function updateCampaignPreview() {
    const value = id => document.getElementById(id)?.value.trim() || '';
    const title = value('camp-title');
    const location = value('camp-location');
    document.getElementById('camp-preview-title').textContent = title || 'ชื่องาน / แคมเปญ';
    document.getElementById('camp-preview-location').textContent = location || 'สถานที่จัดงาน';
    document.getElementById('camp-preview-dates').textContent = `${formatCampaignDate(value('camp-start'))} – ${formatCampaignDate(value('camp-end'))}`;
    document.querySelector('.camp-preview-card')?.classList.toggle('is-empty', !title && !location);

    const img = document.getElementById('camp-preview-img');
    const url = value('camp-image');
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) { img.hidden = true; img.removeAttribute('src'); return; }
    if (img.getAttribute('src') !== url) {
        img.onload = () => { img.hidden = false; };
        img.onerror = () => { img.hidden = true; };
        img.src = url;
    }
}

function initCampaignForm() {
    ['camp-title', 'camp-location', 'camp-start', 'camp-end', 'camp-image'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateCampaignPreview);
    });
    const fileInput = document.getElementById('camp-image-file');
    document.getElementById('camp-upload-btn')?.addEventListener('click', () => fileInput.click());

    const zone = document.getElementById('camp-dropzone');
    if (zone) {
        ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => {
            event.preventDefault();
            zone.classList.add('is-dragover');
        }));
        ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, () => zone.classList.remove('is-dragover')));
        zone.addEventListener('drop', event => {
            event.preventDefault();
            const file = event.dataTransfer?.files?.[0];
            if (file) uploadCampaignImage(file);
        });
    }
    updateCampaignPreview();
}

async function handleCampaignImageUpload(input) {
    if (!input || !input.files || !input.files[0]) return;
    await uploadCampaignImage(input.files[0]);
    input.value = '';
}

async function uploadCampaignImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        if (window.showToast) window.showToast('รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP', 'error');
        return;
    }
    const uploadText = document.getElementById('camp-upload-text');
    const uploadBtn = document.getElementById('camp-upload-btn');
    const prevText = uploadText ? uploadText.innerText : 'อัปโหลด';

    try {
        if (uploadText) uploadText.innerText = 'กำลังอัปโหลด...';
        if (uploadBtn) uploadBtn.disabled = true;
        const formData = new FormData();
        formData.append('image', file);

        const res = await API.request('/products/upload', {
            method: 'POST',
            body: formData
        });

        if (res.success && res.imageUrl) {
            document.getElementById('camp-image').value = new URL(res.imageUrl, window.location.origin).href;
            updateCampaignPreview();
            if (window.showToast) window.showToast('อัปโหลดรูปภาพแบนเนอร์เรียบร้อยแล้ว', 'success');
        } else {
            throw new Error(res.message || 'อัปโหลดไม่สำเร็จ');
        }
    } catch (err) {
        alert(`เกิดข้อผิดพลาดในการอัปโหลด: ${err.message}`);
    } finally {
        if (uploadText) uploadText.innerText = prevText;
        if (uploadBtn) uploadBtn.disabled = false;
    }
}

let adminReports = [];
const adminReportStatusLabels = { pending: 'รอตรวจสอบ', reviewing: 'กำลังตรวจสอบ', resolved: 'ดำเนินการแล้ว', rejected: 'ไม่พบการละเมิด' };
const adminReportTargetLabels = { product: 'สินค้า', store: 'ร้านค้า', review: 'รีวิว', user: 'ผู้ใช้' };

async function loadAdminReports() {
    const container = document.getElementById('admin-reports-table-container');
    const status = document.getElementById('admin-reports-status');
    if (status) status.textContent = 'กำลังโหลดรายงาน...';
    try {
        const res = await API.get('/reports');
        adminReports = res.data;
        const count = state => adminReports.filter(r => r.status === state).length;
        document.getElementById('reports-count-all').textContent = adminReports.length.toLocaleString('th-TH');
        document.getElementById('reports-count-pending').textContent = count('pending').toLocaleString('th-TH');
        document.getElementById('reports-count-reviewing').textContent = count('reviewing').toLocaleString('th-TH');
        document.getElementById('reports-count-closed').textContent = (count('resolved') + count('rejected')).toLocaleString('th-TH');
        renderAdminReports();
    } catch (err) {
        if (status) status.textContent = `โหลดข้อมูลไม่สำเร็จ: ${err.message}`;
        if (!adminReports.length) container.textContent = 'กรุณาลองรีเฟรชข้อมูลอีกครั้ง';
    }
}

function adminReportTargetLink(report) {
    const id = Number(report.target_id);
    if (report.target_type === 'product') return `/product-detail.html?id=${id}`;
    if (report.target_type === 'store') return `/store-detail.html?id=${id}`;
    return null;
}

function renderAdminReports() {
    const filter = document.getElementById('admin-report-filter')?.value || 'all';
    const rows = adminReports.filter(r => filter === 'all' || r.status === filter);
    const status = document.getElementById('admin-reports-status');
    if (status) status.textContent = `แสดง ${rows.length} จาก ${adminReports.length} รายงาน`;
    const container = document.getElementById('admin-reports-table-container');
    if (!rows.length) {
        container.innerHTML = `<p class="admin-users-empty">${filter !== 'all' ? 'ไม่พบรายงานที่ตรงกับเงื่อนไข' : 'ยังไม่มีรายงานในระบบ'}</p>`;
        return;
    }
    container.innerHTML = `<div class="admin-users-scroll" role="region" aria-label="ตารางรายงาน เลื่อนแนวนอนเพื่อดูข้อมูลเพิ่มเติม" tabindex="0"><table class="admin-users-table admin-stores-table">
        <thead><tr><th scope="col">สิ่งที่ถูกรายงาน</th><th scope="col">เหตุผล</th><th scope="col">ผู้รายงาน</th><th scope="col">วันที่</th><th scope="col">สถานะ</th></tr></thead>
        <tbody>${rows.map(r => {
            const id = Number(r.id);
            const link = adminReportTargetLink(r);
            const targetName = escapeAdminText(r.target_name || `#${r.target_id} (ถูกลบแล้ว)`);
            const date = new Date(r.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
            const options = Object.entries(adminReportStatusLabels)
                .map(([value, label]) => `<option value="${value}" ${value === r.status ? 'selected' : ''}>${label}</option>`).join('');
            const removeLink = r.target_type === 'product' && r.target_name ? `<a class="admin-report-remove" href="/admin-products.html?remove=${Number(r.target_id)}">นำสินค้าออก</a>` : '';
            return `<tr><td><small>${escapeAdminText(adminReportTargetLabels[r.target_type] || r.target_type)}</small><strong>${link ? `<a href="${link}" target="_blank" rel="noopener">${targetName}</a>` : targetName}</strong>${removeLink}</td>
                <td>${escapeAdminText(r.reason)}</td>
                <td><strong>${escapeAdminText(r.reporter_name)}</strong><small>${escapeAdminText(r.reporter_email)}</small></td>
                <td>${escapeAdminText(date)}</td>
                <td><label class="sr-only" for="report-status-${id}">สถานะรายงาน #${id}</label>
                    <select id="report-status-${id}" onchange="setReportStatus(${id}, this)">${options}</select></td></tr>`;
        }).join('')}</tbody></table></div>`;
}

async function setReportStatus(reportId, selectEl) {
    const report = adminReports.find(r => Number(r.id) === reportId);
    selectEl.disabled = true;
    try {
        const res = await API.put(`/reports/${reportId}/status`, { status: selectEl.value });
        if (report) report.status = selectEl.value;
        if (window.showToast) window.showToast(res.message, 'success');
        await loadAdminReports();
    } catch (err) {
        if (report) selectEl.value = report.status;
        if (window.showToast) window.showToast(err.message || 'อัปเดตสถานะไม่สำเร็จ', 'error');
    } finally {
        selectEl.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', initAdminDashboard);

function renderAdminOverviewDetails(data, users) {
    const number = value => Number(value) || 0;
    const money = value => TJFormat.money(number(value));
    const text = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };

    // KPI cards: this month against last month, mini bars = the last 7 months
    const months = TJDash.monthBuckets(data.sales_daily || [], 7);
    const [previous, current] = months.slice(-2);
    TJDash.renderKpi('kpi-revenue', { value: money(current.revenue), values: months.map(m => m.revenue), current: current.revenue, previous: previous.revenue });
    TJDash.renderKpi('kpi-orders', { value: TJDash.count(current.orders), values: months.map(m => m.orders), current: current.orders, previous: previous.orders });
    TJDash.renderKpi('kpi-average', { value: money(current.average), values: months.map(m => m.average), current: current.average, previous: previous.average });
    text('admin-total-orders', TJDash.count(data.total_orders));
    text('admin-average-order', money(data.average_order_value));
    text('admin-total-tips', money(data.total_tips));
    text('admin-total-stores', `${number(data.verified_stores)} / ${number(data.total_stores)}`);
    text('admin-products-3d', `${number(data.products_with_3d)} / ${number(data.total_products)}`);
    const percent = data.total_products ? Math.round(number(data.products_with_3d) / number(data.total_products) * 100) : 0;
    text('admin-products-percent', `${percent}%`);
    document.getElementById('admin-products-progress').value = percent;

    TJDash.donut(document.getElementById('order-status-donut'), document.getElementById('order-status-legend'),
        TJDash.statusGroups(data.order_statuses || []), { unit: 'ออเดอร์', always: ['จัดส่งสำเร็จ', 'รอชำระ', 'ยกเลิก'] });
    TJDash.funnel(document.getElementById('order-funnel'), [
        { label: 'คำสั่งซื้อทั้งหมด', value: data.total_orders, icon: 'cart' },
        { label: 'ชำระเงินแล้ว', value: data.paid_order_count, icon: 'card' },
        { label: 'จัดส่งแล้ว', value: data.shipped_orders, icon: 'truck' }
    ]);

    // Newest members (the list comes newest first)
    if (users) {
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const joined = user => new Date(/[TZ]/.test(String(user.created_at)) ? user.created_at : String(user.created_at).replace(' ', 'T') + 'Z').getTime();
        text('people-count', TJDash.count(users.filter(user => joined(user) >= monthAgo).length));
        text('people-note', `สมาชิกทั้งหมด ${TJDash.count(users.length)} คน · รายชื่อคือผู้ที่สมัครล่าสุด`);
        TJDash.people(document.getElementById('people-list'), users.slice(0, 6).map(user => ({ name: user.full_name })));
    } else text('people-note', 'โหลดรายชื่อสมาชิกไม่สำเร็จ กรุณากดรีเฟรชข้อมูล');

    const labels = { completed: 'จัดส่งสำเร็จ', delivered: 'จัดส่งสำเร็จ', shipped: 'กำลังจัดส่ง', paid: 'ชำระแล้ว', processing: 'กำลังเตรียมสินค้า', preparing: 'กำลังเตรียมสินค้า', pending: 'รอชำระ', cancelled: 'ยกเลิก' };
    const esc = escapeAdminText;
    document.getElementById('overview-recent-orders').innerHTML = (data.recent_orders || []).length ? `<table class="tjd-table"><thead><tr><th scope="col">รายการ</th><th scope="col">ผู้รับ</th><th scope="col">ยอดรวม</th><th scope="col">ขนส่ง / พัสดุ</th><th scope="col">สถานะ</th></tr></thead><tbody>${data.recent_orders.map(order => `<tr><td>#${esc(order.id)}</td><td>${esc(order.shipping_name || order.buyer_name || '—')}</td><td><strong>${money(order.grand_total)}</strong></td><td>${esc(order.tracking_number ? `${order.courier_name || ''} · ${order.tracking_number}` : '—')}</td><td><span class="tjd-status-badge">${TJFormat.statusIcon(TJFormat.orderStatusKind(order.status))}${esc(labels[order.status] || order.status)}</span></td></tr>`).join('')}</tbody></table>` : '<p>ยังไม่มีคำสั่งซื้อ</p>';
    const disabilities = { visual: 'สายตา', hearing: 'การได้ยิน', physical: 'การเคลื่อนไหว', intellectual: 'สติปัญญาและการเรียนรู้', organization: 'องค์กร' };
    document.getElementById('overview-approved-stores').innerHTML = (data.approved_stores || []).length ? `<ul class="tjd-store-list">${data.approved_stores.map(store => `<li><a class="tjd-store-row" href="/store-detail.html?id=${encodeURIComponent(store.id)}"><span class="tjd-person-avatar" aria-hidden="true">${esc(Array.from(String(store.store_name || '?'))[0])}</span><span><strong>${esc(store.store_name)}</strong><small>${esc(disabilities[store.disability_type] || store.disability_type || 'ช่างฝีมือ')}</small></span></a></li>`).join('')}</ul>` : '<p>ยังไม่มีร้านค้าที่อนุมัติ</p>';
}
