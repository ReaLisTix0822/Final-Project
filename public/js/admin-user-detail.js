// ==============================================================================
// ADMIN USER DETAIL (/admin-user-detail.html?id=N) — profile, statistics and usage history
// ==============================================================================

const audEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function audDate(value, withTime = true) {
    if (!value) return '—';
    const raw = String(value);
    const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('th-TH', withTime
        ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' });
}
const audMoney = value => `${TJFormat.money((Number(value) || 0))}`;
const audNum = value => (Number(value) || 0).toLocaleString('th-TH');

const AUD_ROLE = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'ผู้ดูแลระบบ' };
const AUD_ORDER_STATUS = { pending: 'รอชำระ', paid: 'ชำระแล้ว', processing: 'กำลังเตรียมสินค้า', preparing: 'กำลังเตรียมสินค้า', shipped: 'กำลังจัดส่ง', delivered: 'จัดส่งสำเร็จ', completed: 'จัดส่งสำเร็จ', cancelled: 'ยกเลิก' };
const AUD_STORE_STATUS = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ระงับ / ไม่อนุมัติ' };
const AUD_LOGIN = { success: ['เข้าสู่ระบบสำเร็จ', 'ok'], wrong_password: ['รหัสผ่านผิด', 'bad'], blocked: ['ถูกปิดกั้น (ร้านยังไม่อนุมัติ)', 'warn'] };
const AUD_EVENT_ICON = {
    register: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    order: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    review: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
    tip: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    favorite: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    follow: '<path d="M3 10v10h18V10M2 10l2-7h16l2 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    chatbot: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    report: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>'
};

let audData = null;
let audTab = 'timeline';

function audTable(headers, rows, empty) {
    if (!rows.length) return `<p class="aud-empty">${empty}</p>`;
    return `<div class="admin-users-scroll" role="region" aria-label="ตารางข้อมูล เลื่อนแนวนอนเพื่อดูเพิ่มเติม" tabindex="0"><table class="admin-users-table aud-table">
        <thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const AUD_TABS = {
    timeline: {
        label: 'ไทม์ไลน์',
        count: d => d.timeline.length,
        render: d => d.timeline.length ? `<ol class="aud-timeline">${d.timeline.map(e => `
            <li class="aud-event aud-event--${audEsc(e.type)}">
                <span class="aud-event-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${AUD_EVENT_ICON[e.type] || ''}</svg></span>
                <span class="aud-event-text">${e.link ? `<a href="${audEsc(e.link)}" target="_blank" rel="noopener">${audEsc(e.text)}</a>` : audEsc(e.text)}</span>
                <time class="aud-event-time">${audEsc(audDate(e.at))}</time>
            </li>`).join('')}</ol>` : '<p class="aud-empty">ยังไม่มีกิจกรรม</p>'
    },
    orders: {
        label: 'คำสั่งซื้อ',
        count: d => d.orders.length + d.store_orders.length,
        render: d => `
            <h3 class="aud-sub">คำสั่งซื้อที่สั่ง</h3>
            ${audTable(['เลขที่', 'ร้านค้า', 'จำนวนชิ้น', 'ยอดรวม', 'สถานะ', 'วันที่'], d.orders.map(o => [
                `#${Number(o.id)}`, audEsc(o.store_name || '—'), audNum(o.item_count), audMoney(o.grand_total),
                `<span class="aud-pill aud-pill--${o.status === 'cancelled' ? 'bad' : 'ok'}">${TJFormat.statusIcon(TJFormat.orderStatusKind(o.status))}${audEsc(AUD_ORDER_STATUS[o.status] || o.status)}</span>`, audEsc(audDate(o.created_at))
            ]), 'ยังไม่เคยสั่งซื้อ')}
            ${d.store ? `<h3 class="aud-sub">คำสั่งซื้อที่ร้านได้รับ</h3>
            ${audTable(['เลขที่', 'ผู้ซื้อ', 'ยอดรวม', 'สถานะ', 'วันที่'], d.store_orders.map(o => [
                `#${Number(o.id)}`, audEsc(o.buyer_name || '—'), audMoney(o.grand_total),
                `<span class="aud-pill aud-pill--${o.status === 'cancelled' ? 'bad' : 'ok'}">${TJFormat.statusIcon(TJFormat.orderStatusKind(o.status))}${audEsc(AUD_ORDER_STATUS[o.status] || o.status)}</span>`, audEsc(audDate(o.created_at))
            ]), 'ร้านยังไม่มีคำสั่งซื้อ')}` : ''}`
    },
    reviews: {
        label: 'รีวิว',
        count: d => d.reviews.length,
        render: d => audTable(['สินค้า', 'คะแนน', 'ข้อความ', 'สถานะ', 'วันที่'], d.reviews.map(r => [
            `<a href="/product-detail.html?id=${Number(r.product_id)}" target="_blank" rel="noopener">${audEsc(r.product_name || 'สินค้าที่ถูกลบ')}</a>`,
            `${'★'.repeat(Number(r.rating) || 0)}<span class="sr-only">${Number(r.rating)} ดาว</span>`,
            audEsc(r.comment || '—'),
            `<span class="aud-pill aud-pill--${r.status === 'hidden' ? 'warn' : 'ok'}">${TJFormat.statusIcon(r.status === 'hidden' ? 'warning' : 'success')}${r.status === 'hidden' ? 'ถูกซ่อน' : 'แสดงอยู่'}</span>`,
            audEsc(audDate(r.created_at))
        ]), 'ยังไม่เคยเขียนรีวิว')
    },
    support: {
        label: 'สนับสนุนและติดตาม',
        count: d => d.tips.length + d.favorites.length + d.follows.length,
        render: d => `
            <h3 class="aud-sub">เงินสนับสนุน</h3>
            ${audTable(['ร้านค้า', 'จำนวนเงิน', 'ช่องทาง', 'วันที่'], d.tips.map(t => [
                audEsc(t.store_name || '—'), audMoney(t.amount), t.order_id ? `ทิปในคำสั่งซื้อ #${Number(t.order_id)}` : 'สนับสนุนโดยตรง', audEsc(audDate(t.created_at))
            ]), 'ยังไม่เคยสนับสนุนเงิน')}
            <h3 class="aud-sub">สินค้าที่ถูกใจ</h3>
            ${audTable(['สินค้า', 'วันที่'], d.favorites.map(f => [
                `<a href="/product-detail.html?id=${Number(f.product_id)}" target="_blank" rel="noopener">${audEsc(f.product_name || 'สินค้าที่ถูกลบ')}</a>`, audEsc(audDate(f.created_at))
            ]), 'ยังไม่มีสินค้าที่ถูกใจ')}
            <h3 class="aud-sub">ร้านที่ติดตาม</h3>
            ${audTable(['ร้านค้า', 'วันที่'], d.follows.map(f => [
                `<a href="/store-detail.html?id=${Number(f.store_id)}" target="_blank" rel="noopener">${audEsc(f.store_name || '—')}</a>`, audEsc(audDate(f.created_at))
            ]), 'ยังไม่ได้ติดตามร้านใด')}`
    },
    search: {
        label: 'ค้นหาและแชทบอท',
        count: d => d.searches.length + d.chatbot.length,
        render: d => `
            <h3 class="aud-sub">ประวัติการค้นหา</h3>
            ${audTable(['คำค้นหา', 'หน้า', 'ผลลัพธ์', 'วันที่'], d.searches.map(q => [
                audEsc(q.query), audEsc({ products: 'สินค้า', stores: 'ร้านค้า', home: 'หน้าแรก' }[q.source] || q.source), q.results_count == null ? '—' : audNum(q.results_count), audEsc(audDate(q.created_at))
            ]), 'ยังไม่มีประวัติการค้นหา')}
            <h3 class="aud-sub">คำถามถึงแชทบอท</h3>
            ${audTable(['คำถาม', 'วันที่'], d.chatbot.map(c => [audEsc(c.user_message), audEsc(audDate(c.created_at))]), 'ยังไม่เคยใช้แชทบอท')}`
    },
    logins: {
        label: 'การเข้าสู่ระบบ',
        count: d => d.logins.length,
        render: d => audTable(['ผลลัพธ์', 'IP', 'อุปกรณ์ / เบราว์เซอร์', 'วันเวลา'], d.logins.map(l => {
            const [label, tone] = AUD_LOGIN[l.status] || [l.status, 'warn'];
            return [`<span class="aud-pill aud-pill--${tone}">${TJFormat.statusIcon({ ok: 'success', bad: 'error', warn: 'warning' }[tone])}${audEsc(label)}</span>`, audEsc(l.ip_address || '—'), `<span class="aud-ua">${audEsc(audDevice(l.user_agent))}</span>`, audEsc(audDate(l.created_at))];
        }), 'ยังไม่มีบันทึกการเข้าสู่ระบบ (เริ่มบันทึกตั้งแต่เปิดใช้ฟีเจอร์นี้)')
    },
    other: {
        label: 'ร้องเรียน ที่อยู่ และรายงาน',
        count: d => d.addresses.length + d.reports.length + (d.complaints || []).length,
        render: d => `
            <h3 class="aud-sub">เรื่องร้องเรียนถึงผู้ดูแลระบบ</h3>
            ${audTable(['เลขที่', 'หัวข้อ', 'สถานะ', 'วันที่'], (d.complaints || []).map(c => [
                `<a href="/admin-complaints.html?id=${Number(c.id)}">#${Number(c.id)}</a>`, audEsc(c.subject),
                audEsc({ open: 'รอดำเนินการ', in_progress: 'กำลังดำเนินการ', resolved: 'แก้ไขแล้ว', closed: 'ปิดเรื่อง' }[c.status] || c.status), audEsc(audDate(c.created_at))
            ]), 'ยังไม่เคยส่งเรื่องร้องเรียน')}
            <h3 class="aud-sub">ที่อยู่จัดส่ง</h3>
            ${audTable(['ชื่อที่อยู่', 'ผู้รับ', 'จังหวัด', ''], d.addresses.map(a => [
                audEsc(a.label || '—'), audEsc(a.recipient_name || '—'), audEsc(a.province || '—'), a.is_default ? '<span class="aud-pill aud-pill--ok">ค่าเริ่มต้น</span>' : ''
            ]), 'ยังไม่ได้บันทึกที่อยู่')}
            <h3 class="aud-sub">รายงานปัญหาที่ส่ง</h3>
            ${audTable(['ประเภท', 'เหตุผล', 'สถานะ', 'วันที่'], d.reports.map(r => [
                audEsc({ product: 'สินค้า', store: 'ร้านค้า', review: 'รีวิว', user: 'ผู้ใช้' }[r.target_type] || r.target_type), audEsc(r.reason), audEsc(r.status), audEsc(audDate(r.created_at))
            ]), 'ยังไม่เคยส่งรายงาน')}`
    }
};

// Short, readable device name from a user agent string
function audDevice(ua) {
    const s = String(ua || '');
    if (!s) return '—';
    const os = /iPhone|iPad/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android' : /Mac OS X/.test(s) ? 'macOS' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : '';
    const browser = /Edg\//.test(s) ? 'Edge' : /Chrome\//.test(s) ? 'Chrome' : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : /curl|node/i.test(s) ? 'โปรแกรม/สคริปต์' : 'อื่น ๆ';
    return [browser, os].filter(Boolean).join(' บน ');
}

function renderAudTabs() {
    const tabs = document.getElementById('aud-tabs');
    tabs.innerHTML = Object.entries(AUD_TABS).map(([key, tab]) => `
        <button type="button" role="tab" id="aud-tab-${key}" data-tab="${key}" aria-selected="${key === audTab}" aria-controls="aud-panel" tabindex="0">
            ${tab.label}<span class="aud-tab-count">${audNum(tab.count(audData))}</span>
        </button>`).join('');
    const panel = document.getElementById('aud-panel');
    panel.setAttribute('aria-labelledby', `aud-tab-${audTab}`);
    panel.innerHTML = AUD_TABS[audTab].render(audData);
}

function renderAudProfile(d) {
    const u = d.user;
    document.title = `${u.full_name} | ผู้ดูแลระบบตลาดใจ`;
    document.getElementById('aud-crumb').textContent = u.full_name;
    document.getElementById('aud-name').textContent = u.full_name;
    const role = document.getElementById('aud-role');
    role.textContent = AUD_ROLE[u.role] || u.role;
    role.className = `admin-user-role role-${u.role}`;
    document.getElementById('aud-email').textContent = u.email;
    document.getElementById('aud-phone').textContent = u.phone || '—';
    document.getElementById('aud-joined').textContent = audDate(u.created_at, false);
    document.getElementById('aud-last-login').textContent = u.last_login_at ? audDate(u.last_login_at) : 'ยังไม่มีบันทึก';
    const bio = document.getElementById('aud-bio');
    bio.hidden = !u.bio;
    bio.textContent = u.bio || '';

    const img = document.getElementById('aud-avatar');
    const initial = document.getElementById('aud-initial');
    initial.textContent = Array.from((u.full_name || '?').trim())[0] || '?';
    img.hidden = !u.avatar_url;
    initial.hidden = Boolean(u.avatar_url);
    if (u.avatar_url) {
        img.onerror = () => { img.hidden = true; initial.hidden = false; };
        img.src = u.avatar_url;
    }

    const store = document.getElementById('aud-store');
    store.hidden = !d.store;
    if (d.store) {
        const s = d.store;
        store.innerHTML = `
            <div class="aud-store-head">
                <div>
                    <span class="aud-store-eyebrow">ร้านค้าของสมาชิก</span>
                    <h2 id="aud-store-title"><a href="/store-detail.html?id=${Number(s.id)}" target="_blank" rel="noopener">${audEsc(s.store_name)}</a></h2>
                    <p>${audEsc(s.disability_name || '—')} · ${audEsc(s.province || 'ไม่ระบุจังหวัด')} · เปิดร้าน ${audEsc(audDate(s.created_at, false))}</p>
                </div>
                <span class="admin-store-state state-${audEsc(s.verification_status)}">${audEsc(AUD_STORE_STATUS[s.verification_status] || s.verification_status)}</span>
            </div>
            ${s.verification_status === 'rejected' && s.rejection_reason ? `<p class="aud-store-reason">เหตุผล: ${audEsc(s.rejection_reason)}</p>` : ''}
            <dl class="aud-store-stats">
                <div><dt>สินค้า</dt><dd>${audNum(s.product_count)}</dd></div>
                <div><dt>คำสั่งซื้อที่ได้รับ</dt><dd>${audNum(s.order_count)}</dd></div>
                <div><dt>ยอดขาย</dt><dd>${audMoney(s.revenue)}</dd></div>
                <div><dt>ผู้ติดตาม</dt><dd>${audNum(s.follower_count)}</dd></div>
                <div><dt>ทุนสะสม / เป้าหมาย</dt><dd>${audMoney(s.support_goal_current)} / ${audMoney(s.support_goal_target)}</dd></div>
            </dl>
            <a href="/admin-stores.html" class="btn btn-sm btn-outline-dark">จัดการร้านค้านี้</a>`;
    }

    const st = d.stats;
    const tiles = [
        ['คำสั่งซื้อ', audNum(st.orders)], ['ยอดซื้อรวม', audMoney(st.spent)], ['เงินสนับสนุน', audMoney(st.tips)],
        ['รีวิว', audNum(st.reviews)], ['ถูกใจ / ติดตาม', `${audNum(st.favorites)} / ${audNum(st.follows)}`],
        ['ค้นหา', audNum(st.searches)], ['ถามแชทบอท', audNum(st.chatbot)], ['ข้อความแชท', audNum(st.messages)], ['เข้าสู่ระบบ', `${audNum(st.logins)} ครั้ง`]
    ];
    document.getElementById('aud-stats').innerHTML = tiles.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
}

async function loadAdminUserDetail() {
    const status = document.getElementById('aud-status');
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    if (!Number.isSafeInteger(id) || id < 1) {
        status.textContent = 'ไม่พบรหัสสมาชิก กรุณาเลือกจากหน้าสมาชิกผู้ใช้งาน';
        return;
    }
    try {
        const res = await API.get(`/admin/users/${id}/activity`);
        audData = res.data;
        renderAudProfile(audData);
        renderAudTabs();
        status.hidden = true;
        document.getElementById('aud-root').hidden = false;
    } catch (err) {
        status.textContent = `โหลดข้อมูลสมาชิกไม่สำเร็จ: ${err.message}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!(window.Auth && Auth.isLoggedIn() && Auth.getUser()?.role === 'admin')) return; // admin.js handles the redirect
    const tabs = document.getElementById('aud-tabs');
    tabs.addEventListener('click', e => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        audTab = btn.dataset.tab;
        renderAudTabs();
        document.getElementById(`aud-tab-${audTab}`).focus();
    });
    // Arrow keys move between tabs (WAI-ARIA tabs pattern)
    tabs.addEventListener('keydown', e => {
        const keys = Object.keys(AUD_TABS);
        const i = keys.indexOf(audTab);
        const next = e.key === 'ArrowRight' ? keys[(i + 1) % keys.length] : e.key === 'ArrowLeft' ? keys[(i - 1 + keys.length) % keys.length]
            : e.key === 'Home' ? keys[0] : e.key === 'End' ? keys[keys.length - 1] : null;
        if (!next) return;
        e.preventDefault();
        audTab = next;
        renderAudTabs();
        document.getElementById(`aud-tab-${audTab}`).focus();
    });
    loadAdminUserDetail();
});
