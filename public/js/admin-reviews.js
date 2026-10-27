// ==============================================================================
// ADMIN REVIEWS PAGE (/admin-reviews.html) — every product review on the platform
// Admins can filter, hide/show (status approved|hidden) and delete reviews.
// ==============================================================================

let adminReviewItems = [];
const adminReviewBusy = new Set();

const arvEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function arvDate(value) {
    const raw = String(value || '');
    const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function arvStars(rating) {
    const full = Math.max(0, Math.min(5, Number(rating) || 0));
    const star = filled => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>`;
    return `<span class="arv-stars" role="img" aria-label="${full} จาก 5 ดาว">${[1, 2, 3, 4, 5].map(i => star(i <= full)).join('')}</span>`;
}

function arvFiltered() {
    const q = (document.getElementById('arv-search').value || '').trim().toLowerCase();
    const rating = document.getElementById('arv-rating').value;
    const store = document.getElementById('arv-store').value;
    const status = document.getElementById('arv-status').value;
    const sort = document.getElementById('arv-sort').value;

    const rows = adminReviewItems.filter(r => {
        if (rating !== 'all' && r.rating !== Number(rating)) return false;
        if (store !== 'all' && String(r.store_id) !== store) return false;
        if (status === 'approved' && r.status !== 'approved') return false;
        if (status === 'hidden' && r.status !== 'hidden') return false;
        if (status === 'unreplied' && r.seller_reply) return false;
        if (status === 'reported' && !r.report_count) return false;
        if (q) {
            const text = [r.comment, r.product_name, r.store_name, r.buyer_name, r.buyer_email, r.seller_reply].join(' ').toLowerCase();
            if (!text.includes(q)) return false;
        }
        return true;
    });

    const time = r => new Date(String(r.created_at).replace(' ', 'T')).getTime() || 0;
    if (sort === 'oldest') rows.sort((a, b) => time(a) - time(b));
    else if (sort === 'rating_low') rows.sort((a, b) => a.rating - b.rating || time(b) - time(a));
    else if (sort === 'rating_high') rows.sort((a, b) => b.rating - a.rating || time(b) - time(a));
    else rows.sort((a, b) => time(b) - time(a));
    return rows;
}

function renderAdminReviewSummary() {
    const total = adminReviewItems.length;
    const visible = adminReviewItems.filter(r => r.status === 'approved');
    const average = visible.length ? visible.reduce((sum, r) => sum + r.rating, 0) / visible.length : 0;
    document.getElementById('arv-count-all').textContent = total.toLocaleString('th-TH');
    document.getElementById('arv-average').textContent = visible.length ? `${average.toFixed(1)} / 5` : '—';
    document.getElementById('arv-count-unreplied').textContent = adminReviewItems.filter(r => !r.seller_reply).length.toLocaleString('th-TH');
    document.getElementById('arv-count-hidden').textContent = adminReviewItems.filter(r => r.status === 'hidden').length.toLocaleString('th-TH');

    const ratingFilter = document.getElementById('arv-rating');
    document.getElementById('arv-distribution').innerHTML = [5, 4, 3, 2, 1].map(star => {
        const count = adminReviewItems.filter(r => r.rating === star).length;
        const pct = total ? Math.round((count / total) * 100) : 0;
        const active = ratingFilter.value === String(star);
        return `<button type="button" class="arv-dist-row${active ? ' is-active' : ''}" data-star="${star}" aria-pressed="${active}" aria-label="กรองรีวิว ${star} ดาว (${count} รีวิว)">
            <span class="arv-dist-label">${star} ดาว</span>
            <span class="arv-dist-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
            <span class="arv-dist-count">${count.toLocaleString('th-TH')}</span>
        </button>`;
    }).join('');
}

function renderAdminReviews() {
    const rows = arvFiltered();
    const list = document.getElementById('arv-list');
    document.getElementById('arv-status-text').textContent = `แสดง ${rows.length.toLocaleString('th-TH')} จาก ${adminReviewItems.length.toLocaleString('th-TH')} รีวิว`;
    renderAdminReviewSummary();

    if (!rows.length) {
        list.innerHTML = `<li class="arv-empty">${adminReviewItems.length ? 'ไม่พบรีวิวที่ตรงกับเงื่อนไข' : 'ยังไม่มีรีวิวในระบบ'}</li>`;
        return;
    }

    list.innerHTML = rows.map(r => {
        const id = Number(r.id);
        const hidden = r.status === 'hidden';
        const busy = adminReviewBusy.has(id) ? 'disabled' : '';
        const productName = arvEsc(r.product_name || `สินค้า #${r.product_id} (ถูกลบแล้ว)`);
        const buyerInitial = arvEsc(Array.from((r.buyer_name || '?').trim())[0] || '?');
        return `
        <li class="arv-item${hidden ? ' is-hidden' : ''}" data-id="${id}">
            <a class="arv-product" href="/product-detail.html?id=${Number(r.product_id)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
                <img loading="lazy" decoding="async" src="${arvEsc(r.product_image || '')}" alt="" data-image-store-id="${Number(r.store_id) || ''}">
            </a>
            <div class="arv-body">
                <div class="arv-head">
                    <div class="arv-target">
                        <a href="/product-detail.html?id=${Number(r.product_id)}" target="_blank" rel="noopener" class="arv-product-name">${productName}</a>
                        ${r.store_id ? `<a href="/store-detail.html?id=${Number(r.store_id)}" target="_blank" rel="noopener" class="arv-store-name">${arvEsc(r.store_name)}</a>` : ''}
                    </div>
                    <div class="arv-tags">
                        ${hidden ? '<span class="arv-tag arv-tag--hidden">ถูกซ่อน</span>' : '<span class="arv-tag arv-tag--live">แสดงบนเว็บไซต์</span>'}
                        ${r.report_count ? `<span class="arv-tag arv-tag--report">ถูกรายงาน ${r.report_count} ครั้ง</span>` : ''}
                    </div>
                </div>
                <div class="arv-rating-line">${arvStars(r.rating)}<span class="arv-date">${arvEsc(arvDate(r.created_at))}</span></div>
                <p class="arv-comment">${r.comment ? arvEsc(r.comment) : '<em>ไม่มีข้อความ ให้คะแนนอย่างเดียว</em>'}</p>
                <div class="arv-buyer">
                    <span class="arv-avatar" aria-hidden="true">${r.buyer_avatar ? `<img src="${arvEsc(r.buyer_avatar)}" alt="" loading="lazy">` : buyerInitial}</span>
                    <span><strong>${arvEsc(r.buyer_name || 'ผู้ใช้ที่ถูกลบ')}</strong><small>${arvEsc(r.buyer_email || '')}</small></span>
                </div>
                ${r.seller_reply ? `
                <div class="arv-reply">
                    <span class="arv-reply-label">ร้านค้าตอบกลับ${r.seller_replied_at ? ` · ${arvEsc(arvDate(r.seller_replied_at))}` : ''}</span>
                    <p>${arvEsc(r.seller_reply)}</p>
                </div>` : '<p class="arv-no-reply">ร้านค้ายังไม่ได้ตอบกลับรีวิวนี้</p>'}
            </div>
            <div class="arv-actions">
                <button type="button" class="btn btn-sm ${hidden ? 'btn-primary' : 'btn-outline-dark'}" onclick="setAdminReviewStatus(${id}, '${hidden ? 'approved' : 'hidden'}')" ${busy}
                    aria-label="${hidden ? 'แสดง' : 'ซ่อน'}รีวิวของ ${arvEsc(r.buyer_name || '')} ต่อ ${productName}">${hidden ? 'แสดงรีวิว' : 'ซ่อนรีวิว'}</button>
                <button type="button" class="btn btn-sm arv-delete" onclick="deleteAdminReview(${id})" ${busy}
                    aria-label="ลบรีวิวของ ${arvEsc(r.buyer_name || '')} ต่อ ${productName}">ลบ</button>
            </div>
        </li>`;
    }).join('');
}

function fillAdminReviewStores() {
    const select = document.getElementById('arv-store');
    const current = select.value;
    const stores = new Map();
    adminReviewItems.forEach(r => { if (r.store_id) stores.set(String(r.store_id), r.store_name); });
    select.innerHTML = '<option value="all">ทุกร้านค้า</option>' + [...stores.entries()]
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'th'))
        .map(([id, name]) => `<option value="${arvEsc(id)}">${arvEsc(name)}</option>`).join('');
    if (stores.has(current)) select.value = current;
}

async function loadAdminReviews() {
    const statusText = document.getElementById('arv-status-text');
    statusText.textContent = 'กำลังโหลดรีวิว...';
    try {
        const res = await API.get('/admin/reviews');
        adminReviewItems = (res.data || []).map(r => ({ ...r, id: Number(r.id), rating: Number(r.rating) }));
        fillAdminReviewStores();
        renderAdminReviews();
    } catch (err) {
        statusText.textContent = `โหลดรีวิวไม่สำเร็จ: ${err.message}`;
    }
}

async function setAdminReviewStatus(reviewId, status) {
    const review = adminReviewItems.find(r => r.id === reviewId);
    if (!review || adminReviewBusy.has(reviewId)) return;
    adminReviewBusy.add(reviewId);
    renderAdminReviews();
    try {
        const res = await API.put(`/admin/reviews/${reviewId}/status`, { status });
        review.status = status;
        window.showToast?.(res.message, 'success');
    } catch (err) {
        window.showToast?.(err.message || 'อัปเดตรีวิวไม่สำเร็จ', 'error');
    } finally {
        adminReviewBusy.delete(reviewId);
        renderAdminReviews();
    }
}

async function deleteAdminReview(reviewId) {
    const review = adminReviewItems.find(r => r.id === reviewId);
    if (!review || adminReviewBusy.has(reviewId)) return;
    if (!window.confirm(`ยืนยันลบรีวิวของ ${review.buyer_name || 'ผู้ใช้'} ต่อ "${review.product_name || 'สินค้า'}" หรือไม่?\nลบแล้วไม่สามารถกู้คืนได้ หากต้องการเก็บไว้ให้ใช้ "ซ่อนรีวิว" แทน`)) return;
    adminReviewBusy.add(reviewId);
    renderAdminReviews();
    try {
        const res = await API.delete(`/admin/reviews/${reviewId}`);
        adminReviewItems = adminReviewItems.filter(r => r.id !== reviewId);
        window.showToast?.(res.message, 'success');
    } catch (err) {
        window.showToast?.(err.message || 'ลบรีวิวไม่สำเร็จ', 'error');
    } finally {
        adminReviewBusy.delete(reviewId);
        fillAdminReviewStores();
        renderAdminReviews();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!(window.Auth && Auth.isLoggedIn() && Auth.getUser()?.role === 'admin')) return; // admin.js handles the redirect
    ['arv-rating', 'arv-store', 'arv-status', 'arv-sort'].forEach(id => document.getElementById(id).addEventListener('change', renderAdminReviews));
    document.getElementById('arv-search').addEventListener('input', renderAdminReviews);
    document.getElementById('arv-refresh').addEventListener('click', loadAdminReviews);
    document.getElementById('arv-distribution').addEventListener('click', e => {
        const row = e.target.closest('.arv-dist-row');
        if (!row) return;
        const select = document.getElementById('arv-rating');
        select.value = select.value === row.dataset.star ? 'all' : row.dataset.star;
        renderAdminReviews();
    });
    loadAdminReviews();
});
