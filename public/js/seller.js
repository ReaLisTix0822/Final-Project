// ==============================================================================
// SELLER DASHBOARD CONTROLLER
// Products CRUD, Support Goal setup, Order fulfillment & Sales metrics
// ==============================================================================

let currentSellerStore = null;
let currentProducts = [];
let currentOrders = [];

let sellerTrend = null;

// Overview cards, built from this store's orders with the site-wide revenue formula
// (paid orders, product subtotal + support money, no shipping: services/salesStats.js)
function renderSellerOverview() {
    const trendCard = document.getElementById('seller-trend');
    if (!trendCard || typeof TJDash === 'undefined') return;
    if (!sellerTrend) sellerTrend = TJDash.trend(trendCard, { period: 'month' });
    const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    const daily = TJDash.dailyFromOrders(currentOrders);
    const months = TJDash.monthBuckets(daily, 7);
    const [previous, current] = months.slice(-2);
    TJDash.renderKpi('kpi-revenue', { value: TJDash.money(current.revenue), values: months.map(m => m.revenue), current: current.revenue, previous: previous.revenue });
    TJDash.renderKpi('kpi-orders', { value: TJDash.count(current.orders), values: months.map(m => m.orders), current: current.orders, previous: previous.orders });
    TJDash.renderKpi('kpi-average', { value: TJDash.money(current.average), values: months.map(m => m.average), current: current.average, previous: previous.average });

    const paidCount = currentOrders.filter(order => TJDash.PAID_STATUSES.includes(order.status)).length;
    const shippedCount = currentOrders.filter(order => ['shipped', 'delivered', 'completed'].includes(order.status)).length;
    const totalRevenue = daily.reduce((sum, row) => sum + row.revenue, 0);
    set('seller-total-revenue', TJDash.money(totalRevenue));
    set('seller-total-orders', TJDash.count(currentOrders.length));
    set('seller-average-order', TJDash.money(paidCount ? totalRevenue / paidCount : 0));

    const statusCounts = {};
    currentOrders.forEach(order => { statusCounts[order.status] = (statusCounts[order.status] || 0) + 1; });
    TJDash.donut(document.getElementById('order-status-donut'), document.getElementById('order-status-legend'),
        TJDash.statusGroups(Object.entries(statusCounts).map(([status, count]) => ({ status, count }))),
        { unit: 'ออเดอร์', always: ['จัดส่งสำเร็จ', 'รอชำระ', 'ยกเลิก'] });
    TJDash.funnel(document.getElementById('order-funnel'), [
        { label: 'คำสั่งซื้อทั้งหมด', value: currentOrders.length, icon: 'cart' },
        { label: 'ชำระเงินแล้ว', value: paidCount, icon: 'card' },
        { label: 'จัดส่งแล้ว', value: shippedCount, icon: 'truck' }
    ]);
    sellerTrend.setDaily(daily);
}

// Topbar avatar: the photo, or the first letter of the store name when there is none
function setSellerTopAvatar(url, name) {
    const avatar = document.getElementById('seller-top-avatar');
    const initial = document.getElementById('seller-top-initial');
    if (initial) initial.textContent = Array.from(String(name || '?').trim())[0] || '?';
    if (!avatar || !initial || !url) return;
    avatar.onerror = () => { avatar.hidden = true; initial.hidden = false; };
    avatar.src = url;
    avatar.hidden = false;
    initial.hidden = true;
}

// Row of the newest followers on the overview
function renderSellerFollowersRow() {
    const list = document.getElementById('people-list');
    if (!list || typeof TJDash === 'undefined') return;
    const followedAt = f => new Date(/[TZ]/.test(String(f.followed_at)) ? f.followed_at : String(f.followed_at).replace(' ', 'T') + 'Z').getTime();
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newest = [...storeFollowers].sort((a, b) => followedAt(b) - followedAt(a));
    document.getElementById('people-count').textContent = TJDash.count(newest.filter(f => followedAt(f) >= monthAgo).length);
    document.getElementById('people-note').textContent = storeFollowers.length
        ? `ผู้ติดตามทั้งหมด ${TJDash.count(storeFollowers.length)} คน · ส่งข้อความขอบคุณหรือแจ้งสินค้าใหม่ได้ที่หน้าผู้ติดตาม`
        : 'ยังไม่มีผู้ติดตาม ชวนลูกค้ากด "ติดตามร้าน" ที่หน้าร้านค้าของคุณ เพื่อรับข่าวสินค้าใหม่';
    TJDash.people(list, newest.slice(0, 6).map(f => ({ name: f.full_name, avatar: f.avatar_url })));
}

async function initSellerDashboard() {
    if (!Auth.isLoggedIn()) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        return;
    }

    const user = Auth.getUser();
    if (user.role !== 'seller' && user.role !== 'admin') {
        alert('หน้านี้สำหรับบัญชีผู้ขาย/ผู้ผลิตเท่านั้น');
        window.location.href = '/index.html';
        return;
    }

    const initialParams = new URLSearchParams(window.location.search);
    const initialView = window.location.pathname === '/seller-orders.html'
        ? 'orders' : initialParams.get('tab') || initialParams.get('view') || 'overview';
    switchDashView(initialView);
    currentSellerStore = Auth.getStore();

    // If store is not cached in localStorage, fetch from /api/auth/me
    if (!currentSellerStore) {
        try {
            const meRes = await API.get('/auth/me');
            if (meRes.success && meRes.store) {
                currentSellerStore = meRes.store;
                localStorage.setItem('store', JSON.stringify(currentSellerStore));
                Auth.renderSidebarProfile();
            }
        } catch (e) {
            console.warn('Could not fetch store from /api/auth/me:', e);
        }
    }

    if (currentSellerStore) {
        const titleEl = document.getElementById('seller-store-title');
        if (titleEl) titleEl.innerText = currentSellerStore.store_name;
        // Same photo as the sidebar: the account photo the seller uploaded, the store image only as a fallback
        setSellerTopAvatar(user.avatar_url || currentSellerStore.avatar_image, currentSellerStore.store_name);
        populateStoreProfileForm(currentSellerStore);
    }

    populateUserProfileData(user);

    // Period buttons and date controls work right away, the numbers follow when the orders load
    const trendCard = document.getElementById('seller-trend');
    if (trendCard && !sellerTrend) sellerTrend = TJDash.trend(trendCard, { period: 'month' });
    await loadSellerProducts();
    await loadSellerOrders();
    renderSupportGoalMetrics();

    // Check URL query params for initial tab/view (e.g. ?tab=profile&subtab=info)
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab') || urlParams.get('view');
    const targetSubTab = urlParams.get('subtab');

    if (targetTab && targetTab !== 'overview') {
        switchDashView(targetTab);
        if (targetSubTab && targetTab === 'profile') {
            switchProfileSubTab(targetSubTab);
        }
    }
}

function switchDashView(viewName) {
    if (viewName === 'settings') {
        switchDashView('store');
        return;
    }

    // 1. Hide all dash panels
    document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));

    // 2. Remove active state from all sidebar items
    document.querySelectorAll('.dash-menu-link').forEach(link => { link.classList.remove('active'); link.removeAttribute('aria-current'); });

    // 3. Activate target panel
    const targetPanel = document.getElementById(`view-${viewName}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // 4. Activate sidebar item
    const navItem = document.getElementById(`nav-item-${viewName}`);
    if (navItem) {
        navItem.classList.add('active');
        navItem.setAttribute('aria-current', 'page');
    }

    // 5. Update topbar breadcrumb & title
    const titles = {
        overview: 'ภาพรวมระบบ',
        products: 'จัดการสินค้า',
        orders: 'จัดการคำสั่งซื้อ',
        goal: 'เป้าหมายการสนับสนุน',
        followers: 'ผู้ติดตามร้านค้า',
        profile: 'โปรไฟล์และบัญชีผู้ขาย',
        store: 'จัดการร้านค้า',
        settings: 'ตั้งค่าร้านค้า & เป้าหมาย'
    };
    const titleText = titles[viewName] || 'ภาพรวมระบบ';
    const titleEl = document.getElementById('page-current-title');
    const subBreadcrumb = document.getElementById('breadcrumb-sub');
    document.title = titleText + ' | ศูนย์ผู้ขายตลาดใจ';
    if (titleEl) titleEl.innerText = titleText;
    if (subBreadcrumb) subBreadcrumb.innerText = titleText;

    if (viewName === 'profile') {
        populateUserProfileData(Auth.getUser());
        updateProfileHeroStats();
    } else if (viewName === 'goal' || viewName === 'overview') {
        renderSupportGoalMetrics();
    } else if (viewName === 'followers') {
        loadStoreFollowers();
    }

    // Update browser URL query params without reloading
    try {
        const url = new URL(window.location);
        url.pathname = '/seller-dashboard.html';
        url.searchParams.set('tab', viewName);
        if (viewName !== 'profile') url.searchParams.delete('subtab');
        window.history.replaceState({}, '', url);
    } catch (e) {}
}

// ==============================================================================
// FOLLOWERS (buyers who follow this store)
// ==============================================================================
let storeFollowers = [];
const followerEsc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function followerDate(value) {
    if (!value) return '';
    const raw = String(value);
    const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadStoreFollowers() {
    const status = document.getElementById('followers-status');
    if (!status) return;
    status.textContent = 'กำลังโหลด...';
    try {
        const res = await API.get('/follows/followers');
        storeFollowers = res.data || [];
        storeFollowers.storeId = res.store_id;
        const badge = document.getElementById('nav-followers-count');
        if (badge) { badge.textContent = storeFollowers.length; badge.hidden = !storeFollowers.length; }
        renderStoreFollowers();
        renderSellerFollowersRow();
    } catch (err) {
        status.textContent = `โหลดผู้ติดตามไม่สำเร็จ: ${err.message}`;
    }
}

function renderStoreFollowers() {
    const list = document.getElementById('followers-list');
    const status = document.getElementById('followers-status');
    if (!list) return;
    const money = v => `${TJFormat.money((Number(v) || 0))}`;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const followedAt = f => new Date(/[TZ]/.test(String(f.followed_at)) ? f.followed_at : String(f.followed_at).replace(' ', 'T') + 'Z').getTime();
    document.getElementById('followers-total').textContent = storeFollowers.length.toLocaleString('th-TH');
    document.getElementById('followers-buyers').textContent = storeFollowers.filter(f => f.order_count > 0).length.toLocaleString('th-TH');
    document.getElementById('followers-new').textContent = storeFollowers.filter(f => followedAt(f) >= monthAgo).length.toLocaleString('th-TH');
    document.getElementById('followers-spent').textContent = money(storeFollowers.reduce((s, f) => s + f.total_spent, 0));

    const q = (document.getElementById('followers-search')?.value || '').trim().toLowerCase();
    const sort = document.getElementById('followers-sort')?.value || 'recent';
    const rows = storeFollowers.filter(f => !q || String(f.full_name).toLowerCase().includes(q));
    if (sort === 'spent') rows.sort((a, b) => b.total_spent - a.total_spent);
    else if (sort === 'orders') rows.sort((a, b) => b.order_count - a.order_count);
    else if (sort === 'name') rows.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'th'));
    else rows.sort((a, b) => followedAt(b) - followedAt(a));

    status.textContent = storeFollowers.length
        ? `แสดง ${rows.length} จาก ${storeFollowers.length} คน`
        : 'ยังไม่มีผู้ติดตาม ชวนลูกค้ากด "ติดตามร้าน" ที่หน้าร้านค้าของคุณ เพื่อรับข่าวสินค้าใหม่';
    list.innerHTML = rows.map(f => {
        const name = followerEsc(f.full_name);
        const initial = followerEsc(Array.from(String(f.full_name || '?').trim())[0] || '?');
        return `
        <li class="dash-follower">
            <span class="dash-follower-avatar" aria-hidden="true">${f.avatar_url ? `<img src="${followerEsc(f.avatar_url)}" alt="" loading="lazy">` : initial}</span>
            <div class="dash-follower-main">
                <strong>${name}</strong>
                <span>ติดตามเมื่อ ${followerEsc(followerDate(f.followed_at))}${f.last_order_at ? ` · สั่งซื้อล่าสุด ${followerEsc(followerDate(f.last_order_at))}` : ''}</span>
            </div>
            <dl class="dash-follower-stats">
                <div><dt>คำสั่งซื้อ</dt><dd>${f.order_count.toLocaleString('th-TH')}</dd></div>
                <div><dt>ยอดซื้อ</dt><dd>${money(f.total_spent)}</dd></div>
                <div><dt>สนับสนุน</dt><dd>${money(f.total_tips)}</dd></div>
            </dl>
            <a class="btn btn-sm btn-outline-dark dash-follower-chat" href="/messages.html?store_id=${Number(storeFollowers.storeId)}&receiver_id=${Number(f.id)}" aria-label="ส่งข้อความถึง ${name}">ส่งข้อความ</a>
        </li>`;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('followers-search')?.addEventListener('input', renderStoreFollowers);
    document.getElementById('followers-sort')?.addEventListener('change', renderStoreFollowers);
    document.getElementById('followers-refresh')?.addEventListener('click', loadStoreFollowers);
    // Show the follower count on the menu right away
    if (window.Auth && Auth.getUser()?.role === 'seller' && !new URLSearchParams(location.search).get('tab')?.startsWith('followers')) loadStoreFollowers();
});

function switchTab(tabName) {
    switchDashView(tabName);
}

// ==============================================================================
// PROFILE & ACCOUNT MANAGEMENT CONTROLLER (TALADJAI THEME)
// ==============================================================================

function switchProfileSubTab(subTabName) {
    if (subTabName === 'store') { switchDashView('store'); return; }
    const subTabs = ['info', 'security'];
    if (!subTabs.includes(subTabName)) subTabName = 'info';

    subTabs.forEach(st => {
        const btn = document.getElementById(`btn-subtab-${st}`);
        const content = document.getElementById(`subtab-content-${st}`);
        if (btn) {
            btn.classList.toggle('active', st === subTabName);
            btn.setAttribute('aria-selected', String(st === subTabName));
        }
        if (content) content.classList.toggle('active', st === subTabName);
    });

    try {
        const url = new URL(window.location);
        url.searchParams.set('subtab', subTabName);
        window.history.replaceState({}, '', url);
    } catch (e) {}
}

function setSellerProfileAvatar(image, url, name) {
    if (!image) return;
    const initial = image.parentElement.querySelector('.seller-profile-initial');
    if (initial) initial.textContent = Array.from((name || 'ช').trim())[0] || 'ช';
    image.onload = () => { image.hidden = false; if (initial) initial.hidden = true; };
    image.onerror = () => { image.hidden = true; if (initial) initial.hidden = false; };
    image.hidden = true;
    if (initial) initial.hidden = false;
    if (url) image.src = url;
    else image.removeAttribute('src');
}

function populateUserProfileData(user) {
    if (!user) user = Auth.getUser();
    if (!user) return;

    const defaultAvatar = '';
    const userAvatar = user.avatar_url || (currentSellerStore && currentSellerStore.avatar_image) || defaultAvatar;

    // Hero elements
    const heroAvatar = document.getElementById('dash-profile-hero-avatar');
    const heroName = document.getElementById('dash-profile-hero-name');
    const heroEmail = document.getElementById('dash-profile-hero-email');
    const heroBio = document.getElementById('dash-profile-hero-bio');
    const heroRole = document.getElementById('dash-profile-hero-role');

    setSellerProfileAvatar(heroAvatar, userAvatar, user.full_name);
    if (heroName) heroName.innerText = user.full_name || (currentSellerStore && currentSellerStore.store_name) || 'ช่างฝีมือตลาดใจ';
    if (heroEmail) heroEmail.innerText = user.email || '';
    if (heroBio) heroBio.innerText = user.bio || 'ร่วมสืบสานงานหัตถศิลป์ไทยและส่งต่อคุณค่าสู่สังคม';
    if (heroRole) {
        heroRole.innerText = user.role === 'admin' ? 'ผู้ดูแลระบบตลาดใจ' : 'ช่างฝีมือตลาดใจ';
    }

    // Form inputs
    const editFullName = document.getElementById('dash-edit-fullname');
    const editEmail = document.getElementById('dash-edit-email');
    const editPhone = document.getElementById('dash-edit-phone');
    const editBio = document.getElementById('dash-edit-bio');
    const avatarPreview = document.getElementById('dash-avatar-preview');
    const avatarUrl = document.getElementById('dash-avatar-url');

    if (editFullName) editFullName.value = user.full_name || '';
    if (editEmail) editEmail.value = user.email || '';
    if (editPhone) editPhone.value = user.phone || '';
    if (editBio) editBio.value = user.bio || '';
    setSellerProfileAvatar(avatarPreview, userAvatar, user.full_name);
    if (avatarUrl) avatarUrl.value = user.avatar_url || '';

    updateProfileHeroStats();
}

function updateProfileHeroStats() {
    const prodCountEl = document.getElementById('dash-stat-prod-count');
    const ordersCountEl = document.getElementById('dash-stat-orders-count');
    const tipsAmountEl = document.getElementById('dash-stat-tips-amount');

    if (prodCountEl) prodCountEl.innerText = `${currentProducts.length} ชิ้น`;
    if (ordersCountEl) ordersCountEl.innerText = `${currentOrders.length} ออเดอร์`;
    if (tipsAmountEl) {
        const totalTips = currentOrders.reduce((sum, o) => sum + (parseFloat(o.tip_amount) || 0), 0);
        tipsAmountEl.innerText = `${TJFormat.money(totalTips)}`;
    }
}

function handleDashAvatarFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        if (window.showToast) window.showToast('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB', 'warning');
        e.target.value = '';
        return;
    }

    const nameLabel = document.getElementById('dash-selected-avatar-name');
    if (nameLabel) {
        nameLabel.innerHTML = `✓ เลือก: <b>${file.name}</b> (${(file.size / 1024).toFixed(0)} KB)`;
        nameLabel.style.color = 'var(--color-success)';
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
        const previewEl = document.getElementById('dash-avatar-preview');
        const heroEl = document.getElementById('dash-profile-hero-avatar');
        if (previewEl) previewEl.src = evt.target.result;
        if (heroEl) heroEl.src = evt.target.result;
    };
    reader.readAsDataURL(file);
}

async function handleDashUpdateProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-dash-profile');
    const originalText = btn.innerText;
    btn.innerText = 'กำลังบันทึก...';
    btn.disabled = true;

    const full_name = document.getElementById('dash-edit-fullname').value.trim();
    const phone = document.getElementById('dash-edit-phone').value.trim();
    const bio = document.getElementById('dash-edit-bio').value.trim();
    const fileInput = document.getElementById('dash-avatar-file');
    let avatar_url = document.getElementById('dash-avatar-url').value.trim();

    try {
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            btn.innerText = 'กำลังอัปโหลดรูปภาพ...';
            const formData = new FormData();
            formData.append('avatar', fileInput.files[0]);

            const uploadRes = await API.upload('/auth/upload-avatar', formData);
            if (uploadRes && uploadRes.success && uploadRes.avatar_url) {
                avatar_url = uploadRes.avatar_url;
            } else {
                throw new Error((uploadRes && uploadRes.message) || 'อัปโหลดรูปภาพไม่สำเร็จ');
            }
        }

        btn.innerText = 'กำลังบันทึกข้อมูลส่วนตัว...';
        const res = await API.put('/auth/profile', {
            full_name,
            phone,
            avatar_url,
            bio
        });

        if (res.success && res.user) {
            Auth.saveSession(API.getToken(), res.user, res.store || currentSellerStore);
            populateUserProfileData(res.user);

            // Update topbar avatar
            if (res.user.avatar_url) setSellerTopAvatar(res.user.avatar_url, currentSellerStore?.store_name);

            if (fileInput) fileInput.value = '';
            const nameLabel = document.getElementById('dash-selected-avatar-name');
            if (nameLabel) {
                nameLabel.innerHTML = 'รองรับ JPG, PNG, WebP (ขนาดไฟล์ไม่เกิน 5MB)';
                nameLabel.style.color = 'var(--dash-text-muted)';
            }

            if (window.showToast) {
                window.showToast('บันทึกข้อมูลส่วนตัวและรูปภาพสำเร็จเรียบร้อยแล้ว', 'success');
            }
        }
    } catch (err) {
        if (window.showToast) {
            window.showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
        }
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleDashChangePassword(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-dash-pwd');
    const current_password = document.getElementById('dash-pwd-current').value;
    const new_password = document.getElementById('dash-pwd-new').value;
    const confirm_password = document.getElementById('dash-pwd-confirm').value;

    if (new_password !== confirm_password) {
        if (window.showToast) window.showToast('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน', 'warning');
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = 'กำลังเปลี่ยนรหัสผ่าน...';
    btn.disabled = true;

    try {
        const res = await API.put('/auth/password', {
            current_password,
            new_password
        });

        if (res.success) {
            document.getElementById('dash-password-form').reset();
            if (window.showToast) {
                window.showToast('เปลี่ยนรหัสผ่านใหม่สำเร็จเรียบร้อยแล้ว', 'success');
            }
        }
    } catch (err) {
        if (window.showToast) {
            window.showToast(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${err.message}`, 'error');
        }
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function renderInventorySummary(source) {
    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };
    const format = value => value.toLocaleString('th-TH');
    if (source === 'products') {
        const total = currentProducts.length;
        const normal = currentProducts.filter(product => Number(product.stock) >= 10).length;
        const low = currentProducts.filter(product => Number(product.stock) > 0 && Number(product.stock) < 10).length;
        const out = currentProducts.filter(product => Number(product.stock) <= 0).length;
        for (const [key, count] of Object.entries({ total, normal, low, out })) {
            setText(`inventory-${key}`, format(count));
        }
        setText('inventory-normal-detail', `(${total ? (normal / total * 100).toFixed(1) : '0.0'}%)`);
        setText('inventory-total-note', 'ข้อมูลสินค้าล่าสุดของร้าน');
    }
    if (source === 'orders') {
        const picking = currentOrders.filter(order => ['paid', 'preparing', 'processing'].includes(order.status));
        const units = picking.reduce((sum, order) => sum + (order.items || []).reduce((count, item) => count + (Number(item.quantity) || 0), 0), 0);
        setText('inventory-picking', format(picking.length));
        setText('inventory-picking-detail', `(${format(units)} ชิ้น)`);
    }
}

function renderProductsTableHtml(products) {
    if (!products || products.length === 0) {
        return `
            <div style="padding:3rem 2rem; text-align:center; background:var(--color-surface); border:1.5px dashed var(--dash-border, var(--color-divider)); border-radius:12px;">
                <div style="font-size:1.1rem; font-weight:700; color:var(--brand-dark, var(--color-primary)); margin-bottom:8px;">ยังไม่มีสินค้าในร้านของคุณ</div>
                <p style="color:var(--color-text-muted); font-size: 1rem; margin-bottom:1.25rem;">เริ่มต้นสร้างรายได้ด้วยการลงชิ้นงานหัตถกรรม พร้อมสร้างโมเดล 3D ได้ทันที</p>
                <a href="/product-add.html" class="dash-btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>เพิ่มสินค้าใหม่ (พร้อม 3D)</span>
                </a>
            </div>
        `;
    }

    return `
        <div style="overflow-x:auto;">
            <table class="dashboard-table">
                <thead>
                    <tr>
                        <th style="min-width:280px;">สินค้า & เรื่องราว</th>
                        <th>หมวดหมู่</th>
                        <th>ราคา</th>
                        <th>สต็อก</th>
                        <th style="text-align:center;">โมเดล 3D 360°</th>
                        <th style="text-align:right; min-width:160px;">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td>
                                <div style="display:flex; align-items:center; gap:14px;">
                                    <div class="prod-thumb-container">
                                        <img loading="lazy" decoding="async" data-image-store-id="${p.store_id || ''}" src="${p.image_url}" alt="${p.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&auto=format&fit=crop&q=80';">
                                    </div>
                                    <div style="min-width:0;">
                                        <div style="font-weight:700; color:var(--brand-dark, var(--color-primary)); font-size: 1rem; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;" title="${p.name}">
                                            ${p.name}
                                        </div>
                                        <div style="font-size: 1rem; color:var(--color-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">
                                            ${(p.story || p.description || 'หัตถกรรมฝีมือประณีต').substring(0, 45)}...
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span style="background:var(--color-surface-alt); color:var(--color-primary); font-size: 1rem; font-weight:600; padding:4px 10px; border-radius:9999px; display:inline-block;">
                                    ${p.category_name || 'ทั่วไป'}
                                </span>
                            </td>
                            <td>
                                <span style="font-family:var(--font-heading); font-weight:800; color:var(--color-primary); font-size:1.05rem;">
                                    ${TJFormat.money((parseFloat(p.price) || 0))}
                                </span>
                            </td>
                            <td>
                                <span style="font-weight:600; color:${p.stock > 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                                    ${p.stock} ชิ้น
                                </span>
                            </td>
                            <td style="text-align:center;">
                                ${p.model_3d_url ? `
                                    <span class="badge-3d-active" title="มีโมเดล 3D 360°">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                                        โมเดล 3D 360°
                                    </span>
                                ` : '<span style="color:var(--color-text-muted); font-size: 1rem;">-</span>'}
                            </td>
                            <td style="text-align:right;">
                                <div class="table-action-group">
                                    <a href="/product-add.html?id=${p.id}" class="btn-action-edit" style="text-decoration:none;" title="แก้ไขข้อมูลสินค้า">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        แก้ไข
                                    </a>
                                    <button onclick="deleteProduct(${p.id})" class="btn-action-delete" title="ลบสินค้า">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        ลบ
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function loadSellerProducts() {
    const previewContainer = document.getElementById('seller-products-table-container');
    const fullContainer = document.getElementById('seller-products-full-table-container');
    try {
        const storeId = currentSellerStore ? currentSellerStore.id : 1;
        const res = await API.get(`/stores/${storeId}`);
        if (res.success && res.data) {
            currentProducts = res.data.products || [];
            renderInventorySummary('products');
            const countBadge = document.getElementById('metric-products');
            if (countBadge) countBadge.innerText = `${currentProducts.length} ชิ้น`;

            const tableHtml = renderProductsTableHtml(currentProducts);
            if (previewContainer) previewContainer.innerHTML = tableHtml;
            if (fullContainer) fullContainer.innerHTML = tableHtml;
            updateProfileHeroStats();
        }
    } catch (err) {
        const errorHtml = `<div style="color:var(--danger); padding:1.5rem; text-align:center;">โหลดสินค้าไม่สำเร็จ: ${err.message}</div>`;
        if (previewContainer) previewContainer.innerHTML = errorHtml;
        if (fullContainer) fullContainer.innerHTML = errorHtml;
    }
}

function renderOrderSummary(orders) {
    const counts = { total: orders.length, waiting: 0, shipped: 0, completed: 0, cancelled: 0 };
    orders.forEach(order => {
        if (['pending', 'paid', 'preparing', 'processing'].includes(order.status)) counts.waiting++;
        else if (order.status === 'shipped') counts.shipped++;
        else if (['completed', 'delivered'].includes(order.status)) counts.completed++;
        else if (order.status === 'cancelled') counts.cancelled++;
    });
    Object.entries(counts).forEach(([key, value]) => {
        const element = document.getElementById(`order-summary-${key}`);
        if (element) element.textContent = value.toLocaleString('th-TH');
    });
    const status = document.getElementById('order-summary-status');
    if (status) status.textContent = '';
}

async function loadSellerOrders() {
    const container = document.getElementById('seller-orders-container');
    try {
        const res = await API.get('/orders/seller-orders');
        if (!res.success) throw new Error(res.message || 'โหลดคำสั่งซื้อไม่สำเร็จ');
        if (res.success) {
            currentOrders = res.data || [];
            renderInventorySummary('orders');
            renderOrderSummary(currentOrders);
            renderSellerOverview();
            updateProfileHeroStats();
            renderSupportGoalMetrics();
            const totalTips = currentOrders.reduce((total, order) => total + (parseFloat(order.tip_amount) || 0), 0);
            const tipsEl = document.getElementById('metric-tips');
            if (tipsEl) tipsEl.innerText = `${TJFormat.money(totalTips)}`;

            const filterResult = document.getElementById('seller-order-filter-result');
            if (filterResult) filterResult.textContent = '';
            if (currentOrders.length === 0) {
                if (container) container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--color-text-muted); background:var(--color-surface); border-radius:12px; border:1px dashed var(--color-divider);">ยังไม่มีคำสั่งซื้อเข้ามาในร้าน</div>';
                return;
            }

            if (container) {
                container.innerHTML = `
                    <div style="overflow-x:auto;">
                        <table class="dashboard-table">
                            <thead>
                                <tr>
                                    <th>หมายเลขคำสั่งซื้อ</th>
                                    <th>ผู้สั่งซื้อ & สถานที่จัดส่ง</th>
                                    <th>ยอดรวมสินค้า</th>
                                    <th>เงินสมทบทุน</th>
                                    <th>สถานะพัสดุ</th>
                                    <th style="text-align:right;">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${currentOrders.map(o => {
                                    let statusBg = 'var(--color-surface-alt)';
                                    let statusColor = 'var(--color-text-muted)';
                                    let statusText = 'ไม่ทราบสถานะ';
                                    if (o.status === 'pending') {
                                        statusBg = 'var(--color-warning-bg)'; statusColor = 'var(--color-accent)'; statusText = 'รอชำระเงิน';
                                    } else if (o.status === 'paid') {
                                        statusBg = 'var(--color-warning-bg)'; statusColor = 'var(--color-accent)'; statusText = 'ชำระแล้ว รอจัดส่ง';
                                    } else if (o.status === 'preparing' || o.status === 'processing') {
                                        statusBg = 'var(--color-warning-bg)'; statusColor = 'var(--color-accent)'; statusText = 'กำลังเตรียมสินค้า';
                                    } else if (o.status === 'cancelled') {
                                        statusBg = 'var(--color-error-soft)'; statusColor = 'var(--color-error)'; statusText = 'ยกเลิกแล้ว';
                                    } else if (o.status === 'shipped') {
                                        statusBg = 'var(--color-info-soft)'; statusColor = 'var(--color-info)'; statusText = 'กำลังขนส่ง';
                                    } else if (o.status === 'completed' || o.status === 'delivered') {
                                        statusBg = 'var(--color-success-soft)'; statusColor = 'var(--color-success)'; statusText = 'จัดส่งสำเร็จ';
                                    }
                                    return `
                                        <tr data-seller-order-status="${['pending', 'paid', 'preparing', 'processing', 'shipped', 'completed', 'delivered', 'cancelled'].includes(o.status) ? o.status : 'unknown'}">
                                            <td>
                                                <div style="font-family:var(--font-heading); font-weight:800; color:var(--color-text);">
                                                    #ORD-${o.id}
                                                </div>
                                                <div style="font-size: 1rem; color:var(--color-text-muted); margin-top:2px;">
                                                    ${new Date(o.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </div>
                                            </td>
                                            <td>
                                                <div style="font-weight:700; color:var(--color-text);">
                                                    ${o.shipping_name || 'ผู้สนับสนุนใจดี'} 
                                                    <span style="font-weight:400; color:var(--color-text-muted); font-size: 1rem;">(${o.shipping_phone || '-'})</span>
                                                </div>
                                                <div style="font-size: 1rem; color:var(--color-text-muted); max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${o.shipping_address}">
                                                    ${o.shipping_address || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <span style="font-family:var(--font-heading); font-weight:800; color:var(--color-text); font-size:1.05rem;">
                                                    ${TJFormat.money((parseFloat(o.subtotal) || 0))}
                                                </span>
                                            </td>
                                            <td>
                                                <span style="font-family:var(--font-heading); font-weight:800; color:var(--color-primary); font-size:1.05rem;">
                                                    +${TJFormat.money((parseFloat(o.tip_amount) || 0))}
                                                </span>
                                            </td>
                                            <td>
                                                <span style="background:${statusBg}; color:${statusColor}; font-size: 1rem; font-weight:700; padding:4px 12px; border-radius:9999px; display:inline-block;">
                                                    ${TJFormat.statusIcon(TJFormat.orderStatusKind(o.status))}${statusText}
                                                </span>
                                                ${o.tracking_number ? `
                                                    <div style="font-size: 1rem; color:var(--color-text-muted); margin-top:4px; font-family:monospace;">
                                                        ${o.courier_name ? o.courier_name + ': ' : ''}${o.tracking_number}
                                                    </div>
                                                ` : ''}
                                            </td>
                                            <td style="text-align:right;">
                                                <a href="/seller-order.html?id=${encodeURIComponent(o.id)}" class="btn-action-edit" style="background:var(--color-primary); color:var(--color-on-primary-muted); border-color:var(--color-primary); white-space:nowrap; flex-shrink:0;" title="ดูรายละเอียดและจัดการคำสั่งซื้อ">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="flex-shrink:0;"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                                                    จัดการคำสั่งซื้อ
                                                </a>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }
            filterSellerOrders();
    } catch (err) {
        document.querySelectorAll('[id^="order-summary-"]').forEach(element => {
            element.textContent = element.id === 'order-summary-status' ? 'โหลดสรุปคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่' : '—';
        });
        if (container) container.innerHTML = `<div style="color:var(--danger); padding:1rem;">โหลดคำสั่งซื้อไม่สำเร็จ: ${err.message}</div>`;
    }
}

function populateStoreProfileForm(store) {
    setSellerProfileAvatar(document.getElementById('store-cover-preview'), store.cover_image, store.store_name);
    document.getElementById('store-name-input').value = store.store_name || '';
    document.getElementById('store-goal-title').value = store.support_goal_title || '';
    document.getElementById('store-goal-target').value = store.support_goal_target || 20000;
    document.getElementById('store-story-input').value = store.story || '';
    document.getElementById('store-craft-input').value = store.craft_technique || '';
    storeVideoState = { url: store.story_video_url || '', removed: false };
    document.getElementById('store-video-url').value = /youtube/.test(storeVideoState.url) ? storeVideoState.url : '';
    document.getElementById('store-video-transcript').value = store.story_video_transcript || '';
    document.getElementById('store-video-file').value = '';
    document.getElementById('store-video-file-name').textContent = 'อัปโหลดไฟล์วิดีโอ';
    renderStoreVideoPreview(storeVideoState.url);
    loadStoreDisabilityField(store);
}

// Disability type + explicit consent (PDPA s.26). The box shows the consent already given; it is never ticked by default.
async function loadStoreDisabilityField(store) {
    const select = document.getElementById('store-disability-type');
    const consent = document.getElementById('store-disability-consent');
    if (!select || !consent) return;
    try {
        const [types, privacy] = await Promise.all([API.get('/disability-types'), API.get('/auth/privacy')]);
        select.replaceChildren(new Option('ไม่ระบุ', ''), ...types.data.map(t => new Option(t.label, t.code)));
        select.value = store.disability_type || '';
        consent.checked = Boolean(privacy.data.disability_consent);
    } catch (err) {
        console.warn('Could not load disability field:', err.message);
    }
}

// ---- Store story video (upload or YouTube link) ----
let storeVideoState = { url: '', removed: false };

function youtubeId(url) {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
}

function renderStoreVideoPreview(url) {
    const box = document.getElementById('store-video-preview');
    const remove = document.getElementById('store-video-remove');
    if (!box) return;
    const id = youtubeId(url);
    box.innerHTML = id
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="ตัวอย่างวิดีโอเรื่องราวร้าน" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
        : url ? `<video src="${url.replace(/"/g, '')}" controls preload="metadata" aria-label="ตัวอย่างวิดีโอเรื่องราวร้าน"></video>` : '';
    box.hidden = !url;
    remove.hidden = !url;
}

document.addEventListener('DOMContentLoaded', () => {
    const file = document.getElementById('store-video-file');
    if (!file) return;
    file.addEventListener('change', () => {
        const picked = file.files[0];
        if (picked && picked.size > 50 * 1024 * 1024) {
            window.showToast?.('ไฟล์วิดีโอต้องมีขนาดไม่เกิน 50 MB', 'error');
            file.value = '';
            return;
        }
        document.getElementById('store-video-file-name').textContent = picked ? picked.name : 'อัปโหลดไฟล์วิดีโอ';
        if (picked) {
            document.getElementById('store-video-url').value = '';
            renderStoreVideoPreview(URL.createObjectURL(picked));
        }
    });
    document.getElementById('store-video-url').addEventListener('change', e => {
        const url = e.target.value.trim();
        if (url && !youtubeId(url)) { window.showToast?.('รองรับเฉพาะลิงก์ YouTube', 'warning'); return; }
        if (url) { file.value = ''; document.getElementById('store-video-file-name').textContent = 'อัปโหลดไฟล์วิดีโอ'; }
        renderStoreVideoPreview(url || (storeVideoState.removed ? '' : storeVideoState.url));
    });
    document.getElementById('store-video-remove').addEventListener('click', () => {
        storeVideoState.removed = true;
        file.value = '';
        document.getElementById('store-video-url').value = '';
        document.getElementById('store-video-file-name').textContent = 'อัปโหลดไฟล์วิดีโอ';
        renderStoreVideoPreview('');
        window.showToast?.('กด "บันทึกข้อมูลร้านค้า" เพื่อยืนยันการนำวิดีโอออก', 'info');
    });
});

async function handleSaveStoreProfile(e) {
    e.preventDefault();
    const button = e.currentTarget.querySelector('[type="submit"]');
    const fileInput = document.getElementById('store-cover-file');
    button.disabled = true;
    try {
        const body = {
            store_name: document.getElementById('store-name-input').value.trim(),
            support_goal_title: document.getElementById('store-goal-title').value.trim(),
            support_goal_target: parseFloat(document.getElementById('store-goal-target').value),
            story: document.getElementById('store-story-input').value.trim(),
            craft_technique: document.getElementById('store-craft-input').value.trim()
        };

        const disabilitySelect = document.getElementById('store-disability-type');
        const consentBox = document.getElementById('store-disability-consent');
        const consentError = document.getElementById('store-disability-consent-error');
        if (disabilitySelect && consentBox) {
            consentError.textContent = '';
            body.disability_type = disabilitySelect.value;
            body.disability_consent = consentBox.checked;
            if (body.disability_type && !body.disability_consent) {
                consentError.textContent = 'เลือกกลุ่มความพิการแล้ว กรุณาติ๊กยินยอมให้เก็บข้อมูล หรือเลือก "ไม่ระบุ"';
                consentBox.focus();
                return;
            }
        }

        // Story video: new upload > YouTube link > keep current (unless removed)
        const videoFile = document.getElementById('store-video-file').files[0];
        const videoLink = document.getElementById('store-video-url').value.trim();
        if (videoFile) {
            const videoForm = new FormData();
            videoForm.append('video', videoFile);
            const up = await API.upload('/stores/upload-video', videoForm);
            if (!up.success || !up.video_url) throw new Error(up.message || 'อัปโหลดวิดีโอไม่สำเร็จ');
            body.story_video_url = up.video_url;
        } else if (videoLink) {
            body.story_video_url = videoLink;
        } else {
            body.story_video_url = storeVideoState.removed ? '' : storeVideoState.url;
        }
        body.story_video_transcript = document.getElementById('store-video-transcript').value.trim();

        if (fileInput.files.length) {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            const uploaded = await API.upload('/stores/upload-image', formData);
            if (!uploaded.success || !uploaded.cover_image) throw new Error(uploaded.message || 'อัปโหลดรูปไม่สำเร็จ');
            body.cover_image = uploaded.cover_image;
        }
        const res = await API.put('/stores/my-store', body);
        if (!res.success) throw new Error(res.message || 'บันทึกไม่สำเร็จ');
        if (res.success) {
            window.showToast(body.story_video_url && body.story_video_url !== storeVideoState.url && !/youtube/.test(body.story_video_url)
                ? 'บันทึกแล้ว ระบบกำลังสร้างคำบรรยายวิดีโออัตโนมัติ (ประมาณ 1 นาที)'
                : 'บันทึกข้อมูลร้านค้าและเป้าหมายเรียบร้อยแล้ว', 'success');
            Auth.saveSession(API.getToken(), Auth.getUser(), res.data);
            currentSellerStore = res.data;
            fileInput.value = '';
            populateStoreProfileForm(res.data);
            document.getElementById('store-cover-hint').textContent = 'รองรับ JPG, PNG, WebP ขนาดไม่เกิน 5MB';
            renderSupportGoalMetrics();
        }
    } catch (err) {
        window.showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
        button.disabled = false;
    }
}

function handleStoreImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        window.showToast('กรุณาเลือก JPG, PNG หรือ WebP ขนาดไม่เกิน 5MB', 'warning');
        event.target.value = '';
        setSellerProfileAvatar(document.getElementById('store-cover-preview'), currentSellerStore?.cover_image, currentSellerStore?.store_name);
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        if (event.target.files[0] !== file) return;
        setSellerProfileAvatar(document.getElementById('store-cover-preview'), reader.result, currentSellerStore?.store_name);
    };
    reader.readAsDataURL(file);
    document.getElementById('store-cover-hint').textContent = `เลือก ${file.name} แล้ว กดบันทึกข้อมูลร้านค้าเพื่อยืนยัน`;
}

// ==============================================================================
// SUPPORT GOAL & CAMPAIGN CONTROLLER
// ==============================================================================

function renderSupportGoalMetrics() {
    if (!currentSellerStore) return;

    // Same source and formula as every other page: support_goal_current (all real tips) / support_goal_target
    const orderTips = currentOrders.reduce((sum, o) => sum + (parseFloat(o.tip_amount) || 0), 0);
    const totalTips = currentSellerStore.support_goal_current != null ? Number(currentSellerStore.support_goal_current) || 0 : orderTips;
    const target = parseFloat(currentSellerStore.support_goal_target) || 20000;
    const title = currentSellerStore.support_goal_title || 'ระดมทุนสนับสนุนพัฒนาอาชีพช่างฝีมือ';
    const pct = TJFormat.goalPercent(totalTips, target);
    const supporters = currentOrders.filter(o => (parseFloat(o.tip_amount) || 0) > 0);

    // 1. Overview Banner elements
    const ovTitle = document.getElementById('dash-overview-goal-title');
    const ovCurr = document.getElementById('dash-overview-goal-current');
    const ovTgt = document.getElementById('dash-overview-goal-target');
    const ovBar = document.getElementById('dash-overview-goal-bar');
    const ovPct = document.getElementById('dash-overview-goal-percent');
    const ovSupp = document.getElementById('dash-overview-goal-supporters');
    if (ovTitle) ovTitle.innerText = title;
    if (ovCurr) ovCurr.innerText = `${TJFormat.money(totalTips)}`;
    if (ovTgt) ovTgt.innerText = `${TJFormat.money(target)}`;
    if (ovBar) ovBar.style.width = `${pct}%`;
    if (ovPct) ovPct.innerText = `${pct}%`;
    if (ovSupp) ovSupp.innerText = `(จากผู้สนับสนุน ${supporters.length} ออเดอร์)`;

    // 2. Dedicated Goal View elements
    const gTitle = document.getElementById('dash-goal-page-title');
    const gRaised = document.getElementById('dash-goal-stat-raised');
    const gTgt = document.getElementById('dash-goal-stat-target');
    const gPct = document.getElementById('dash-goal-stat-percent');
    if (gTitle) gTitle.innerText = title;
    if (gRaised) gRaised.innerText = `${TJFormat.money(totalTips)}`;
    if (gTgt) gTgt.innerText = `${TJFormat.money(target)}`;
    if (gPct) gPct.innerText = `${pct}%`;

    // 2.1 Dedicated Support Progress Tube (หลอดแสดงการสนับสนุน)
    const tubeTitle = document.getElementById('dash-tube-goal-title');
    const tubePctBadge = document.getElementById('dash-tube-percent-badge');
    const tubeStatusText = document.getElementById('dash-tube-status-text');
    const tubeFill = document.getElementById('dash-support-tube-fill');
    const tubePin = document.getElementById('dash-tube-bubble-pin');
    const tubePinAmount = document.getElementById('dash-tube-pin-amount');

    const remaining = Math.max(0, target - totalTips);

    if (tubeTitle) tubeTitle.innerText = title;
    if (tubePctBadge) tubePctBadge.innerText = `${pct}%`;
    if (tubeStatusText) {
        if (remaining <= 0) {
            tubeStatusText.innerHTML = '<span style="color:var(--color-success); font-weight:800;">ยอดเยี่ยม! สำเร็จตามเป้าหมาย 100% แล้ว</span>';
        } else {
            tubeStatusText.innerText = `ขาดอีก ${TJFormat.money(remaining)} จะบรรลุเป้าหมาย`;
        }
    }
    if (tubeFill) tubeFill.style.width = `${pct}%`;
    if (tubePin) {
        const clampedPinPos = Math.max(3, Math.min(97, pct));
        tubePin.style.left = `${clampedPinPos}%`;
    }
    if (tubePinAmount) tubePinAmount.innerText = `${TJFormat.money(totalTips)}`;

    // Tube scale steps
    const step25 = document.getElementById('dash-tube-step-25');
    const step50 = document.getElementById('dash-tube-step-50');
    const step75 = document.getElementById('dash-tube-step-75');
    const step100 = document.getElementById('dash-tube-step-100');
    if (step25) step25.innerText = `${TJFormat.money(Math.round(target * 0.25))}`;
    if (step50) step50.innerText = `${TJFormat.money(Math.round(target * 0.50))}`;
    if (step75) step75.innerText = `${TJFormat.money(Math.round(target * 0.75))}`;
    if (step100) step100.innerText = `${TJFormat.money(Math.round(target))}`;

    // Tube footer summary
    const tubeRaised = document.getElementById('dash-tube-raised-amount');
    const tubeTarget = document.getElementById('dash-tube-target-amount');
    const tubeSupporters = document.getElementById('dash-tube-supporters-count');
    const tubeRate = document.getElementById('dash-tube-completion-rate');
    if (tubeRaised) tubeRaised.innerText = `${TJFormat.money(totalTips)}`;
    if (tubeTarget) tubeTarget.innerText = `${TJFormat.money(target)}`;
    if (tubeSupporters) tubeSupporters.innerText = `${supporters.length} คน (${supporters.length} ออเดอร์)`;
    if (tubeRate) tubeRate.innerText = `${pct}%`;

    // 3. Milestones tracker
    [25, 50, 75, 100].forEach(m => {
        const card = document.getElementById(`milestone-${m}`);
        if (card) card.classList.toggle('achieved', pct >= m);
    });

    // 4. Form inputs in dedicated goal view
    const inTitle = document.getElementById('store-goal-title-dedicated');
    const inTgt = document.getElementById('store-goal-target-dedicated');
    const inStory = document.getElementById('store-story-input-dedicated');
    if (inTitle && document.activeElement !== inTitle) inTitle.value = currentSellerStore.support_goal_title || '';
    if (inTgt && document.activeElement !== inTgt) inTgt.value = currentSellerStore.support_goal_target || 20000;
    if (inStory && document.activeElement !== inStory) inStory.value = currentSellerStore.story || '';

    // 5. Public store links
    const storeUrl = `/store-detail.html?id=${currentSellerStore.id || 1}`;
    const ovLink = document.getElementById('dash-preview-store-link');
    const gLink = document.getElementById('dash-store-public-link');
    if (ovLink) ovLink.href = storeUrl;
    if (gLink) gLink.href = storeUrl;

    // 6. Supporters list
    const listEl = document.getElementById('dash-goal-supporters-list');
    if (listEl) {
        if (supporters.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; padding:2.5rem 1rem; color:var(--dash-text-muted); font-size: 1rem;">ยังไม่มีรายการสมทบทุนจากคำสั่งซื้อ เมื่อมีลูกค้าช่วยสมทบทุน รายการจะปรากฏที่นี่</div>';
        } else {
            listEl.innerHTML = supporters.map(s => {
                const tipVal = parseFloat(s.tip_amount) || 0;
                const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
                return `
                    <div class="dash-supporter-item">
                        <div>
                            <div style="font-weight:700; color:var(--brand-dark); font-size: 1rem;">${s.shipping_name || 'ผู้สนับสนุนใจดี'}</div>
                            <div style="font-size: 1rem; color:var(--dash-text-muted); margin-top:2px;">คำสั่งซื้อ #ORD-${s.id} • ${dateStr}</div>
                        </div>
                        <div style="font-weight:800; color:var(--primary); font-size:1.05rem; font-family:var(--font-heading);">
                            +${TJFormat.money(tipVal)}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

async function handleSaveGoalForm(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('btn-save-dedicated-goal');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'กำลังบันทึก...';
    }

    try {
        const titleVal = document.getElementById('store-goal-title-dedicated').value.trim();
        const targetVal = parseFloat(document.getElementById('store-goal-target-dedicated').value) || 20000;
        const storyVal = document.getElementById('store-story-input-dedicated').value.trim();

        const body = {
            store_name: (currentSellerStore && currentSellerStore.store_name) || '',
            support_goal_title: titleVal,
            support_goal_target: targetVal,
            story: storyVal,
            craft_technique: (currentSellerStore && currentSellerStore.craft_technique) || ''
        };

        const res = await API.put('/stores/my-store', body);
        if (res.success && res.data) {
            currentSellerStore = res.data;
            Auth.saveSession(API.getToken(), Auth.getUser(), res.data);
            localStorage.setItem('store', JSON.stringify(res.data));

            // Sync with profile form inputs if they exist
            const pTitle = document.getElementById('store-goal-title');
            const pTgt = document.getElementById('store-goal-target');
            const pStory = document.getElementById('store-story-input');
            if (pTitle) pTitle.value = titleVal;
            if (pTgt) pTgt.value = targetVal;
            if (pStory) pStory.value = storyVal;

            renderSupportGoalMetrics();
            if (window.showToast) window.showToast('บันทึกเป้าหมายการสนับสนุนสำเร็จแล้ว', 'success');
        } else {
            throw new Error((res && res.message) || 'บันทึกไม่สำเร็จ');
        }
    } catch (err) {
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'บันทึกเป้าหมาย';
        }
    }
}

async function aiGenerateStoreStoryForGoal() {
    const storeName = (currentSellerStore && currentSellerStore.store_name) || 'ช่างฝีมือตลาดใจ';
    const goalTitle = document.getElementById('store-goal-title-dedicated').value.trim() || (currentSellerStore && currentSellerStore.support_goal_title) || 'สนับสนุนอาชีพ';
    const currentNotes = document.getElementById('store-story-input-dedicated').value.trim();

    if (window.showToast) window.showToast('น้องใจดีกำลังร้อยเรียงเรื่องราวร้านค้า...', 'info');

    try {
        const res = await API.post('/ai/generate-story', {
            artisanName: storeName,
            disabilityType: (currentSellerStore && currentSellerStore.disability_type) || 'ผู้สร้างสรรค์งานฝีมือ',
            craftName: (currentSellerStore && currentSellerStore.craft_technique) || 'งานหัตถกรรมคนพิการ',
            rawNotes: currentNotes,
            goalTitle: goalTitle
        });

        if (res.success && res.data) {
            const d = res.data;
            let fullStory = `${d.quote ? d.quote + '\n\n' : ''}${d.story_paragraph_1 || ''}\n\n${d.story_paragraph_2 || ''}`.trim();
            const dedicatedInput = document.getElementById('store-story-input-dedicated');
            if (dedicatedInput) dedicatedInput.value = fullStory;
            const profileInput = document.getElementById('store-story-input');
            if (profileInput) profileInput.value = fullStory;

            if (window.showToast) window.showToast('สร้างเรื่องราวด้วยน้องใจดีสำเร็จเรียบร้อย', 'success');
        }
    } catch (err) {
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

function showAddProductModal() {
    window.location.href = '/product-add.html';
}

function editProduct(productId) {
    if (productId) {
        window.location.href = `/product-add.html?id=${productId}`;
    } else {
        window.location.href = '/product-add.html';
    }
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.remove('active');
    hide3DPreview();
    clearProductImage();
}


async function handleSaveProduct(e) {
    e.preventDefault();
    const editId = document.getElementById('edit-product-id').value;

    const payload = {
        name: document.getElementById('p-name').value.trim(),
        category_id: parseInt(document.getElementById('p-category').value, 10),
        price: parseFloat(document.getElementById('p-price').value),
        stock: parseInt(document.getElementById('p-stock').value, 10),
        dimensions: document.getElementById('p-dimensions').value.trim(),
        image_url: document.getElementById('p-image').value.trim(),
        model_3d_url: document.getElementById('p-3d').value.trim() || null,
        story: document.getElementById('p-story').value.trim(),
        description: document.getElementById('p-desc').value.trim()
    };

    try {
        let res;
        if (editId) {
            res = await API.put(`/products/${editId}`, payload);
        } else {
            res = await API.post('/products', payload);
        }

        if (res.success) {
            window.showToast(editId ? 'แก้ไขสินค้าเรียบร้อยแล้ว' : 'เพิ่มสินค้าใหม่เรียบร้อยแล้ว', 'success');
            closeProductModal();
            loadSellerProducts();
        }
    } catch (err) {
        window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('คุณต้องการลบสินค้านี้ใช่หรือไม่?')) return;

    try {
        const res = await API.delete(`/products/${productId}`);
        if (res.success) {
            window.showToast('ลบสินค้าเรียบร้อยแล้ว', 'success');
            loadSellerProducts();
        }
    } catch (err) {
        window.showToast(`ลบไม่สำเร็จ: ${err.message}`, 'error');
    }
}

// ==============================================================================
// GEMINI FLASH AI STORYTELLING INTEGRATION
// ==============================================================================

async function aiGenerateStoreStory() {
    const storeName = document.getElementById('store-name-input').value.trim() || 'ช่างฝีมือตลาดใจ';
    const goalTitle = document.getElementById('store-goal-title').value.trim();
    const currentNotes = document.getElementById('store-story-input').value.trim();

    if (window.showToast) window.showToast('น้องใจดีกำลังร้อยเรียงเรื่องราวร้านค้า...', 'info');

    try {
        const res = await API.post('/ai/generate-story', {
            artisanName: storeName,
            disabilityType: currentSellerStore ? currentSellerStore.disability_type : 'ผู้สร้างสรรค์งานฝีมือ',
            craftName: 'งานหัตถกรรมคนพิการ',
            rawNotes: currentNotes,
            goalTitle: goalTitle
        });

        if (res.success && res.data) {
            const d = res.data;
            let fullStory = `${d.quote ? d.quote + '\n\n' : ''}${d.story_paragraph_1 || ''}\n\n${d.story_paragraph_2 || ''}`.trim();
            document.getElementById('store-story-input').value = fullStory;
            if (d.recommended_craft_technique) {
                document.getElementById('store-craft-input').value = d.recommended_craft_technique;
            }
            if (window.showToast) window.showToast('สร้างเรื่องราวด้วยน้องใจดีสำเร็จเรียบร้อย', 'success');
        }
    } catch (err) {
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

async function aiGenerateProductStory() {
    const prodName = document.getElementById('p-name').value.trim();
    if (!prodName) {
        alert('กรุณากรอกชื่อสินค้าก่อนให้ AI แต่งเรื่องราวครับ');
        document.getElementById('p-name').focus();
        return;
    }

    const catSelect = document.getElementById('p-category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text || '';
    const currentNotes = document.getElementById('p-story').value.trim();

    if (window.showToast) window.showToast('น้องใจดีกำลังเขียนเรื่องราวชิ้นงาน...', 'info');

    try {
        const res = await API.post('/ai/generate-story', {
            artisanName: currentSellerStore ? currentSellerStore.store_name : 'ช่างฝีมือ',
            disabilityType: currentSellerStore ? currentSellerStore.disability_type : 'ช่างฝีมือ',
            craftName: `${prodName} (${catName})`,
            rawNotes: currentNotes || `ผลิตด้วยมือทุกขั้นตอน ประณีต แข็งแรง ทนทาน`,
            goalTitle: currentSellerStore ? currentSellerStore.support_goal_title : 'สนับสนุนอาชีพ'
        });

        if (res.success && res.data) {
            const d = res.data;
            document.getElementById('p-story').value = `${d.quote ? d.quote + ' ' : ''}${d.story_paragraph_1 || ''}`.trim();
            if (d.story_paragraph_2 && !document.getElementById('p-desc').value) {
                document.getElementById('p-desc').value = d.story_paragraph_2;
            }
            if (window.showToast) window.showToast('สร้างเรื่องราวสินค้าด้วยน้องใจดีเรียบร้อยแล้ว', 'success');
        }
    } catch (err) {
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

// ==============================================================================
// MICROSOFT TRELLIS.2 3D GENERATOR & LIVE PREVIEW
// ==============================================================================

async function aiGenerate3DModelTrellis() {
    const imageUrl = document.getElementById('p-image').value.trim();
    if (!imageUrl) {
        alert('กรุณากรอกหรือวาง URL รูปภาพสินค้าก่อนเริ่มสร้างโมเดล 3 มิติครับ');
        document.getElementById('p-image').focus();
        return;
    }

    const prodName = document.getElementById('p-name').value.trim() || 'ชิ้นงานหัตถศิลป์';
    const catSelect = document.getElementById('p-category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text || '';
    const btn = document.getElementById('btn-trellis-generate');
    const statusMsg = document.getElementById('trellis-status-msg');

    const originalBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; vertical-align:middle; margin-right:4px;"></span> กำลังประมวลผล 3D...`;

    if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.innerHTML = `<strong>TRELLIS.2:</strong> กำลังวิเคราะห์โครงสร้างภาพ (Structured Latents) และสังเคราะห์โมเดล 3D (.glb)...`;
    }

    if (window.showToast) window.showToast('TRELLIS.2 กำลังแปลงภาพ 2D เป็นโมเดล 3D...', 'info');

    try {
        const res = await API.post('/ai/generate-3d', {
            imageUrl,
            prompt: prodName,
            artisanName: currentSellerStore ? currentSellerStore.store_name : '',
            craftCategory: catName
        });

        if (res.success && res.data && res.data.modelUrl) {
            const modelUrl = res.data.modelUrl;
            document.getElementById('p-3d').value = modelUrl;

            if (statusMsg) {
                statusMsg.innerHTML = `<strong>สร้างโมเดลสำเร็จ!</strong> ผลิตไฟล์ GLB พร้อมพื้นผิว (Texture & PBR) เรียบร้อยแล้ว`;
            }

            // Render live preview in modal
            show3DPreview(modelUrl, imageUrl);

            if (window.showToast) {
                window.showToast('สร้างโมเดล 3 มิติด้วย TRELLIS.2 สำเร็จแล้ว! หมุนดูรอบทิศทางได้ทันที', 'success');
            }
        } else {
            throw new Error(res.message || 'ไม่สามารถสร้างโมเดลได้');
        }
    } catch (err) {
        console.error('TRELLIS.2 Error:', err);
        if (statusMsg) {
            statusMsg.innerHTML = `ขออภัย ไม่สามารถสร้างโมเดลได้: ${err.message}`;
        }
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    }
}

// ==============================================================================
// PRODUCT IMAGE UPLOAD & PREVIEW HANDLER
// ==============================================================================

async function handleProductImageUpload(inputElement) {
    if (!inputElement || !inputElement.files || !inputElement.files[0]) {
        return;
    }

    const file = inputElement.files[0];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        alert('กรุณาเลือกไฟล์รูปภาพที่รองรับ (JPG, PNG, WebP, GIF)');
        inputElement.value = '';
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('ขนาดไฟล์ต้องไม่เกิน 10MB');
        inputElement.value = '';
        return;
    }

    const uploadText = document.getElementById('btn-upload-text');
    const statusMsg = document.getElementById('p-upload-status');
    const prevText = uploadText ? uploadText.innerText : 'อัปโหลดรูป';

    try {
        if (uploadText) uploadText.innerText = 'กำลังอัปโหลด...';
        if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = 'var(--color-info-soft)';
            statusMsg.style.color = 'var(--color-info)';
            statusMsg.innerHTML = `กำลังอัปโหลดรูปภาพ <strong>${file.name}</strong> เข้าสู่ระบบ...`;
        }

        const formData = new FormData();
        formData.append('image', file);

        const res = await API.request('/products/upload', {
            method: 'POST',
            body: formData
        });

        if (res.success && res.imageUrl) {
            const imageUrl = res.imageUrl;
            document.getElementById('p-image').value = imageUrl;
            syncProductImagePreview(imageUrl, file.name);

            if (statusMsg) {
                statusMsg.style.background = 'var(--color-success-soft)';
                statusMsg.style.color = 'var(--color-success)';
                statusMsg.innerHTML = `<strong>อัปโหลดสำเร็จ!</strong> รูปภาพพร้อมใช้งานและพร้อมส่งต่อไปยัง TRELLIS.2`;
            }

            if (window.showToast) {
                window.showToast('อัปโหลดรูปภาพสินค้าเรียบร้อยแล้ว', 'success');
            }

            // If 3D preview is active, update poster
            const glb = document.getElementById('p-3d').value.trim();
            if (glb) show3DPreview(glb, imageUrl);
        } else {
            throw new Error(res.message || 'ไม่สามารถอัปโหลดรูปภาพได้');
        }
    } catch (err) {
        console.error('Image Upload Error:', err);
        if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = 'var(--color-error-soft)';
            statusMsg.style.color = 'var(--color-error)';
            statusMsg.innerHTML = `อัปโหลดไม่สำเร็จ: ${err.message}`;
        }
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาดในการอัปโหลด: ${err.message}`, 'error');
    } finally {
        if (uploadText) uploadText.innerText = prevText;
        inputElement.value = '';
    }
}

function handleProductImageInputChanged() {
    const url = document.getElementById('p-image').value.trim();
    if (url) {
        syncProductImagePreview(url);
    } else {
        clearProductImage();
    }
}

function syncProductImagePreview(url, customTitle = '') {
    const wrapper = document.getElementById('p-image-preview-wrapper');
    const img = document.getElementById('p-image-preview-img');
    const titleEl = document.getElementById('p-image-preview-title');
    const subEl = document.getElementById('p-image-preview-sub');
    if (!wrapper || !img) return;

    if (url) {
        img.src = url;
        img.onerror = () => {
            img.src = 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&auto=format&fit=crop&q=80';
        };
        if (titleEl) titleEl.innerText = customTitle || (url.startsWith('/uploads/') ? 'รูปภาพอัปโหลดจากเครื่อง' : 'รูปภาพจาก URL');
        if (subEl) subEl.innerText = 'พร้อมนำไปสร้างโมเดล 3D ด้วย TRELLIS.2';
        wrapper.style.display = 'flex';
    } else {
        wrapper.style.display = 'none';
    }
}

function clearProductImage() {
    const input = document.getElementById('p-image');
    const fileInput = document.getElementById('p-image-file');
    const wrapper = document.getElementById('p-image-preview-wrapper');
    const statusMsg = document.getElementById('p-upload-status');

    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    if (wrapper) wrapper.style.display = 'none';
    if (statusMsg) statusMsg.style.display = 'none';
}

function update3DPreviewFromInput() {
    const url = document.getElementById('p-3d').value.trim();
    const poster = document.getElementById('p-image').value.trim();
    if (url && (url.endsWith('.glb') || url.endsWith('.gltf') || url.includes('modelviewer.dev'))) {
        show3DPreview(url, poster);
    } else if (!url) {
        hide3DPreview();
    }
}


function show3DPreview(glbUrl, posterUrl = '') {
    const container = document.getElementById('modal-3d-preview-container');
    const wrapper = document.getElementById('modal-model-viewer-wrapper');
    if (!container || !wrapper) return;

    container.style.display = 'block';
    wrapper.innerHTML = `
        <model-viewer loading="lazy"
            src="${glbUrl}"
            ${posterUrl ? `poster="${posterUrl}"` : ''}
            alt="พรีวิวโมเดล 3 มิติ"
            auto-rotate
            camera-controls
            shadow-intensity="1"
            style="width:100%; height:100%; background:var(--color-surface-alt);">
        </model-viewer>
    `;
}

function hide3DPreview() {
    const container = document.getElementById('modal-3d-preview-container');
    const wrapper = document.getElementById('modal-model-viewer-wrapper');
    const statusMsg = document.getElementById('trellis-status-msg');
    if (container) container.style.display = 'none';
    if (wrapper) wrapper.innerHTML = '';
    if (statusMsg) statusMsg.style.display = 'none';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSellerDashboard);
} else {
    initSellerDashboard();
}

function filterSellerOrders() {
    const query = (document.getElementById('seller-order-search')?.value || '').trim().toLocaleLowerCase();
    const status = document.getElementById('seller-order-status')?.value || 'all';
    const rows = document.querySelectorAll('#seller-orders-container tr[data-seller-order-status]');
    let visible = 0;
    rows.forEach(row => {
        const actual = row.dataset.sellerOrderStatus;
        const matches = status === 'all' || actual === status || (status === 'preparing' && actual === 'processing') || (status === 'completed' && actual === 'delivered');
        row.hidden = !matches || !row.textContent.toLocaleLowerCase().includes(query);
        if (!row.hidden) visible++;
    });
    const result = document.getElementById('seller-order-filter-result');
    if (result) result.textContent = visible ? `แสดง ${visible} จาก ${rows.length} คำสั่งซื้อ` : 'ไม่พบคำสั่งซื้อที่ตรงกับการค้นหา';
}
