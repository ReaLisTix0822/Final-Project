// ==============================================================================
// SELLER DASHBOARD CONTROLLER
// Products CRUD, Support Goal setup, Order fulfillment & Sales metrics
// ==============================================================================

let currentSellerStore = null;
let currentProducts = [];
let currentOrders = [];
let salesChartInstance = null;
let currentChartType = 'line';
let dashboardDate = null;

function getBangkokDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const value = type => parts.find(part => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
}

function getOrderDateKey(createdAt) {
    if (!createdAt) return null;
    const timestamp = typeof createdAt === 'string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(createdAt)
        ? `${createdAt.replace(' ', 'T')}Z`
        : createdAt;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : getBangkokDateKey(date);
}

function setDashboardDate(value) {
    const today = getBangkokDateKey(new Date());
    const valid = /^\d{4}-\d\d-\d\d$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    dashboardDate = valid && value <= today ? value : today;
    const input = document.getElementById('dashboard-date');
    if (input) {
        input.value = dashboardDate;
        input.max = today;
    }
    const nextButton = document.getElementById('dashboard-next-day');
    if (nextButton) nextButton.disabled = dashboardDate >= today;
    renderDashboardMetrics();
}

function stepDashboardDate(days) {
    const date = new Date(`${dashboardDate || getBangkokDateKey(new Date())}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    setDashboardDate(date.toISOString().slice(0, 10));
}

function renderDashboardMetrics() {
    const selectedOrders = currentOrders.filter(order => getOrderDateKey(order.created_at) === dashboardDate);
    const sales = selectedOrders.reduce((total, order) => total + (parseFloat(order.subtotal) || 0), 0);
    const shipped = selectedOrders.filter(order => ['shipped', 'completed', 'delivered'].includes(order.status)).length;
    document.getElementById('metric-orders').innerText = selectedOrders.length;
    document.getElementById('metric-sales').innerText = `฿ ${sales.toLocaleString('th-TH')}`;
    document.getElementById('metric-shipments').innerText = shipped;
}

async function initSellerDashboard() {
    if (!Auth.isLoggedIn()) {
        window.location.href = '/login.html?redirect=/seller-dashboard.html';
        return;
    }

    const user = Auth.getUser();
    if (user.role !== 'seller' && user.role !== 'admin') {
        alert('หน้านี้สำหรับบัญชีผู้ขาย/ผู้ผลิตเท่านั้น');
        window.location.href = '/index.html';
        return;
    }

    currentSellerStore = Auth.getStore();

    // If store is not cached in localStorage, fetch from /api/auth/me
    if (!currentSellerStore) {
        try {
            const meRes = await API.get('/auth/me');
            if (meRes.success && meRes.store) {
                currentSellerStore = meRes.store;
                localStorage.setItem('store', JSON.stringify(currentSellerStore));
            }
        } catch (e) {
            console.warn('Could not fetch store from /api/auth/me:', e);
        }
    }

    if (currentSellerStore) {
        const titleEl = document.getElementById('seller-store-title');
        if (titleEl) titleEl.innerText = currentSellerStore.store_name;
        if (currentSellerStore.avatar_image) {
            const avatarEl = document.getElementById('seller-top-avatar');
            if (avatarEl) avatarEl.src = currentSellerStore.avatar_image;
        }
        populateStoreProfileForm(currentSellerStore);
    }

    populateUserProfileData(user);

    setDashboardDate(getBangkokDateKey(new Date()));
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
        switchDashView('profile');
        switchProfileSubTab('store');
        return;
    }

    // 1. Hide all dash panels
    document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));

    // 2. Remove active state from all sidebar items
    document.querySelectorAll('.dash-menu-link').forEach(link => link.classList.remove('active'));

    // 3. Activate target panel
    const targetPanel = document.getElementById(`view-${viewName}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // 4. Activate sidebar item
    const navItem = document.getElementById(`nav-item-${viewName}`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // 5. Update topbar breadcrumb & title
    const titles = {
        overview: 'ภาพรวมระบบ',
        products: 'จัดการสินค้า',
        orders: 'คำสั่งซื้อและการจัดส่ง',
        goal: 'เป้าหมายการสนับสนุน',
        profile: 'โปรไฟล์และบัญชีผู้ขาย',
        settings: 'ตั้งค่าร้านค้า & เป้าหมาย'
    };
    const titleText = titles[viewName] || 'ภาพรวมระบบ';
    const titleEl = document.getElementById('page-current-title');
    const subBreadcrumb = document.getElementById('breadcrumb-sub');
    if (titleEl) titleEl.innerText = titleText;
    if (subBreadcrumb) subBreadcrumb.innerText = titleText;

    if (viewName === 'profile') {
        populateUserProfileData(Auth.getUser());
        updateProfileHeroStats();
    } else if (viewName === 'goal' || viewName === 'overview') {
        renderSupportGoalMetrics();
    }

    // Update browser URL query params without reloading
    try {
        const url = new URL(window.location);
        url.searchParams.set('tab', viewName);
        window.history.replaceState({}, '', url);
    } catch (e) {}

    // Trigger chart resize if returning to overview
    if (viewName === 'overview' && salesChartInstance) {
        setTimeout(() => salesChartInstance.resize(), 100);
    }
}

function switchTab(tabName) {
    switchDashView(tabName);
}

// ==============================================================================
// PROFILE & ACCOUNT MANAGEMENT CONTROLLER (TALADJAI THEME)
// ==============================================================================

function switchProfileSubTab(subTabName) {
    const subTabs = ['info', 'security', 'store'];
    if (!subTabs.includes(subTabName)) subTabName = 'info';

    subTabs.forEach(st => {
        const btn = document.getElementById(`btn-subtab-${st}`);
        const content = document.getElementById(`subtab-content-${st}`);
        if (btn) btn.classList.toggle('active', st === subTabName);
        if (content) content.classList.toggle('active', st === subTabName);
    });

    try {
        const url = new URL(window.location);
        url.searchParams.set('subtab', subTabName);
        window.history.replaceState({}, '', url);
    } catch (e) {}
}

function populateUserProfileData(user) {
    if (!user) user = Auth.getUser();
    if (!user) return;

    const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
    const userAvatar = user.avatar_url || (currentSellerStore && currentSellerStore.avatar_image) || defaultAvatar;

    // Hero elements
    const heroAvatar = document.getElementById('dash-profile-hero-avatar');
    const heroName = document.getElementById('dash-profile-hero-name');
    const heroEmail = document.getElementById('dash-profile-hero-email');
    const heroBio = document.getElementById('dash-profile-hero-bio');
    const heroRole = document.getElementById('dash-profile-hero-role');

    if (heroAvatar) heroAvatar.src = userAvatar;
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
    if (avatarPreview) avatarPreview.src = userAvatar;
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
        tipsAmountEl.innerText = `฿${totalTips.toLocaleString('th-TH')}`;
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
        nameLabel.style.color = '#1b834b';
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
            const topAvatar = document.getElementById('seller-top-avatar');
            if (topAvatar && res.user.avatar_url) topAvatar.src = res.user.avatar_url;

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

// ==============================================================================
// CHART.JS SALES OVERVIEW
// ==============================================================================

function initSalesChart() {
    const canvas = document.getElementById('salesOverviewChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');

    // Create warm ochre gradient for spline area fill matching Taladjai brand
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(223, 138, 40, 0.35)');
    gradient.addColorStop(1, 'rgba(223, 138, 40, 0.02)');

    const labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'];
    const dataValues = [18000, 24000, 60000, 22000, 31810, 20500, 32000];

    salesChartInstance = new Chart(ctx, {
        type: currentChartType,
        data: {
            labels: labels,
            datasets: [{
                label: 'ยอดขายทั้งหมด',
                data: dataValues,
                borderColor: '#df8a28',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.45,
                pointRadius: 5,
                pointBackgroundColor: '#df8a28',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1b3329',
                    titleFont: { size: 13, family: 'inherit' },
                    bodyFont: { size: 14, family: 'inherit', weight: 'bold' },
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return ' ยอดขาย: ฿' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 65000,
                    ticks: {
                        stepSize: 10000,
                        callback: function(val) {
                            return (val / 1000) + 'K';
                        },
                        font: { size: 11, family: 'inherit' },
                        color: '#5c6861'
                    },
                    grid: {
                        color: '#ede5d8'
                    },
                    border: {
                        dash: [5, 5]
                    }
                },
                x: {
                    ticks: {
                        font: { size: 11, family: 'inherit' },
                        color: '#5c6861'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function setChartType(type) {
    currentChartType = type;
    document.getElementById('btn-chart-line')?.classList.toggle('active', type === 'line');
    document.getElementById('btn-chart-bar')?.classList.toggle('active', type === 'bar');

    if (salesChartInstance) {
        salesChartInstance.config.type = type;
        if (type === 'bar') {
            salesChartInstance.data.datasets[0].backgroundColor = '#df8a28';
            salesChartInstance.data.datasets[0].borderRadius = 6;
        } else {
            const ctx = salesChartInstance.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 250);
            gradient.addColorStop(0, 'rgba(223, 138, 40, 0.35)');
            gradient.addColorStop(1, 'rgba(223, 138, 40, 0.02)');
            salesChartInstance.data.datasets[0].backgroundColor = gradient;
        }
        salesChartInstance.update();
    }
}

function renderProductsTableHtml(products) {
    if (!products || products.length === 0) {
        return `
            <div style="padding:3rem 2rem; text-align:center; background:#ffffff; border:1.5px dashed var(--dash-border, #ede5d8); border-radius:12px;">
                <div style="font-size:1.1rem; font-weight:700; color:var(--brand-dark, #1b3329); margin-bottom:8px;">ยังไม่มีสินค้าในร้านของคุณ</div>
                <p style="color:#5c6861; font-size:0.9rem; margin-bottom:1.25rem;">เริ่มต้นสร้างรายได้ด้วยการลงชิ้นงานหัตถกรรม พร้อมสร้างโมเดล 3D ได้ทันที</p>
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
                        <th style="text-align:center;">3D / AR</th>
                        <th style="text-align:right; min-width:160px;">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td>
                                <div style="display:flex; align-items:center; gap:14px;">
                                    <div class="prod-thumb-container">
                                        <img src="${p.image_url}" alt="${p.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&auto=format&fit=crop&q=80';">
                                    </div>
                                    <div style="min-width:0;">
                                        <div style="font-weight:700; color:var(--brand-dark, #1b3329); font-size:0.98rem; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;" title="${p.name}">
                                            ${p.name}
                                        </div>
                                        <div style="font-size:0.8rem; color:#5c6861; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">
                                            ${(p.story || p.description || 'หัตถกรรมฝีมือประณีต').substring(0, 45)}...
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span style="background:#f4eee3; color:#1b3329; font-size:0.8rem; font-weight:600; padding:4px 10px; border-radius:9999px; display:inline-block;">
                                    ${p.category_name || 'ทั่วไป'}
                                </span>
                            </td>
                            <td>
                                <span style="font-family:var(--font-heading); font-weight:800; color:#df8a28; font-size:1.05rem;">
                                    ฿${(parseFloat(p.price) || 0).toLocaleString()}
                                </span>
                            </td>
                            <td>
                                <span style="font-weight:600; color:${p.stock > 0 ? '#1b834b' : '#d13d3d'};">
                                    ${p.stock} ชิ้น
                                </span>
                            </td>
                            <td style="text-align:center;">
                                ${p.model_3d_url ? `
                                    <span class="badge-3d-active" title="มีโมเดล 3 มิติรองรับมุมมอง 360° และ AR">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                                        3D / AR
                                    </span>
                                ` : '<span style="color:#94a3b8; font-size:0.85rem;">-</span>'}
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

async function loadSellerOrders() {
    const container = document.getElementById('seller-orders-container');
    try {
        const res = await API.get('/orders/seller-orders');
        if (res.success) {
            currentOrders = res.data || [];
            renderDashboardMetrics();
            updateProfileHeroStats();
            renderSupportGoalMetrics();
            const totalTips = currentOrders.reduce((total, order) => total + (parseFloat(order.tip_amount) || 0), 0);
            const tipsEl = document.getElementById('metric-tips');
            if (tipsEl) tipsEl.innerText = `฿${totalTips.toLocaleString('th-TH')}`;

            if (currentOrders.length === 0) {
                if (container) container.innerHTML = '<div style="padding:2rem; text-align:center; color:#64748b; background:#ffffff; border-radius:12px; border:1px dashed #cbd5e1;">ยังไม่มีคำสั่งซื้อเข้ามาในร้าน</div>';
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
                                    let statusBg = '#f1f5f9';
                                    let statusColor = '#475569';
                                    let statusText = o.status;
                                    if (o.status === 'pending' || o.status === 'preparing') {
                                        statusBg = '#fef3c7'; statusColor = '#b45309'; statusText = 'รอจัดส่ง';
                                    } else if (o.status === 'shipped') {
                                        statusBg = '#e0f2fe'; statusColor = '#0369a1'; statusText = 'กำลังขนส่ง';
                                    } else if (o.status === 'completed' || o.status === 'delivered') {
                                        statusBg = '#dcfce7'; statusColor = '#15803d'; statusText = 'จัดส่งสำเร็จ';
                                    }
                                    return `
                                        <tr>
                                            <td>
                                                <div style="font-family:var(--font-heading); font-weight:800; color:#1e293b;">
                                                    #ORD-${o.id}
                                                </div>
                                                <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                                                    ${new Date(o.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </div>
                                            </td>
                                            <td>
                                                <div style="font-weight:700; color:#1e293b;">
                                                    ${o.shipping_name || 'ผู้สนับสนุนใจดี'} 
                                                    <span style="font-weight:400; color:#64748b; font-size:0.85rem;">(${o.shipping_phone || '-'})</span>
                                                </div>
                                                <div style="font-size:0.8rem; color:#64748b; max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${o.shipping_address}">
                                                    ${o.shipping_address || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <span style="font-family:var(--font-heading); font-weight:800; color:#1e293b; font-size:1.05rem;">
                                                    ฿${(parseFloat(o.subtotal) || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td>
                                                <span style="font-family:var(--font-heading); font-weight:800; color:#df8a28; font-size:1.05rem;">
                                                    +฿${(parseFloat(o.tip_amount) || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td>
                                                <span style="background:${statusBg}; color:${statusColor}; font-size:0.8rem; font-weight:700; padding:4px 12px; border-radius:9999px; display:inline-block;">
                                                    ${statusText}
                                                </span>
                                                ${o.tracking_number ? `
                                                    <div style="font-size:0.75rem; color:#64748b; margin-top:4px; font-family:monospace;">
                                                        ${o.courier_name ? o.courier_name + ': ' : ''}${o.tracking_number}
                                                    </div>
                                                ` : ''}
                                            </td>
                                            <td style="text-align:right;">
                                                <button onclick="openShipModal(${o.id}, '${o.status}', '${o.tracking_number || ''}', '${o.courier_name || ''}')" class="btn-action-edit" style="background:#1b3329; color:#fef08a; border-color:#1b3329;" title="อัปเดตสถานะและเลขพัสดุ">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                                                    จัดการจัดส่ง
                                                </button>
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
    } catch (err) {
        if (container) container.innerHTML = `<div style="color:var(--danger); padding:1rem;">โหลดคำสั่งซื้อไม่สำเร็จ: ${err.message}</div>`;
    }
}

function populateStoreProfileForm(store) {
    document.getElementById('store-name-input').value = store.store_name || '';
    document.getElementById('store-goal-title').value = store.support_goal_title || '';
    document.getElementById('store-goal-target').value = store.support_goal_target || 20000;
    document.getElementById('store-story-input').value = store.story || '';
    document.getElementById('store-craft-input').value = store.craft_technique || '';
}

async function handleSaveStoreProfile(e) {
    e.preventDefault();
    try {
        const body = {
            store_name: document.getElementById('store-name-input').value.trim(),
            support_goal_title: document.getElementById('store-goal-title').value.trim(),
            support_goal_target: parseFloat(document.getElementById('store-goal-target').value),
            story: document.getElementById('store-story-input').value.trim(),
            craft_technique: document.getElementById('store-craft-input').value.trim()
        };

        const res = await API.put('/stores/my-store', body);
        if (res.success) {
            window.showToast('บันทึกข้อมูลร้านค้าและเป้าหมายเรียบร้อยแล้ว', 'success');
            Auth.saveSession(API.getToken(), Auth.getUser(), res.data);
            currentSellerStore = res.data;
            renderSupportGoalMetrics();
        }
    } catch (err) {
        window.showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
    }
}

// ==============================================================================
// SUPPORT GOAL & CAMPAIGN CONTROLLER
// ==============================================================================

function renderSupportGoalMetrics() {
    if (!currentSellerStore) return;

    const totalTips = currentOrders.reduce((sum, o) => sum + (parseFloat(o.tip_amount) || 0), 0);
    const target = parseFloat(currentSellerStore.support_goal_target) || 20000;
    const title = currentSellerStore.support_goal_title || 'ระดมทุนสนับสนุนพัฒนาอาชีพช่างฝีมือ';
    const pct = Math.min(100, Math.round((totalTips / target) * 100));
    const supporters = currentOrders.filter(o => (parseFloat(o.tip_amount) || 0) > 0);

    // 1. Overview Banner elements
    const ovTitle = document.getElementById('dash-overview-goal-title');
    const ovCurr = document.getElementById('dash-overview-goal-current');
    const ovTgt = document.getElementById('dash-overview-goal-target');
    const ovBar = document.getElementById('dash-overview-goal-bar');
    const ovPct = document.getElementById('dash-overview-goal-percent');
    const ovSupp = document.getElementById('dash-overview-goal-supporters');
    if (ovTitle) ovTitle.innerText = title;
    if (ovCurr) ovCurr.innerText = `฿${totalTips.toLocaleString('th-TH')}`;
    if (ovTgt) ovTgt.innerText = `฿${target.toLocaleString('th-TH')}`;
    if (ovBar) ovBar.style.width = `${pct}%`;
    if (ovPct) ovPct.innerText = `${pct}%`;
    if (ovSupp) ovSupp.innerText = `(จากผู้สนับสนุน ${supporters.length} ออเดอร์)`;

    // 2. Dedicated Goal View elements
    const gTitle = document.getElementById('dash-goal-page-title');
    const gRaised = document.getElementById('dash-goal-stat-raised');
    const gTgt = document.getElementById('dash-goal-stat-target');
    const gPct = document.getElementById('dash-goal-stat-percent');
    if (gTitle) gTitle.innerText = title;
    if (gRaised) gRaised.innerText = `฿${totalTips.toLocaleString('th-TH')}`;
    if (gTgt) gTgt.innerText = `฿${target.toLocaleString('th-TH')}`;
    if (gPct) gPct.innerText = `${pct}%`;

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
            listEl.innerHTML = '<div style="text-align:center; padding:2.5rem 1rem; color:var(--dash-text-muted); font-size:0.88rem;">ยังไม่มีรายการสมทบทุนจากคำสั่งซื้อ เมื่อมีลูกค้าช่วยสมทบทุน รายการจะปรากฏที่นี่</div>';
        } else {
            listEl.innerHTML = supporters.map(s => {
                const tipVal = parseFloat(s.tip_amount) || 0;
                const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
                return `
                    <div class="dash-supporter-item">
                        <div>
                            <div style="font-weight:700; color:var(--brand-dark); font-size:0.92rem;">${s.shipping_name || 'ผู้สนับสนุนใจดี'}</div>
                            <div style="font-size:0.75rem; color:var(--dash-text-muted); margin-top:2px;">คำสั่งซื้อ #ORD-${s.id} • ${dateStr}</div>
                        </div>
                        <div style="font-weight:800; color:var(--primary); font-size:1.05rem; font-family:var(--font-heading);">
                            +฿${tipVal.toLocaleString('th-TH')}
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
            if (window.showToast) window.showToast('บันทึกเป้าหมายการสนับสนุนสำเร็จแล้ว 🎉', 'success');
        } else {
            throw new Error((res && res.message) || 'บันทึกไม่สำเร็จ');
        }
    } catch (err) {
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '💾 บันทึกเป้าหมาย';
        }
    }
}

async function aiGenerateStoreStoryForGoal() {
    const storeName = (currentSellerStore && currentSellerStore.store_name) || 'ช่างฝีมือตลาดใจ';
    const goalTitle = document.getElementById('store-goal-title-dedicated').value.trim() || (currentSellerStore && currentSellerStore.support_goal_title) || 'สนับสนุนอาชีพ';
    const currentNotes = document.getElementById('store-story-input-dedicated').value.trim();

    if (window.showToast) window.showToast('Gemini Flash กำลังร้อยเรียงเรื่องราวร้านค้า...', 'info');

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

            if (window.showToast) window.showToast('สร้างเรื่องราวด้วย Gemini Flash สำเร็จเรียบร้อย ✨', 'success');
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

function openShipModal(orderId, status, tracking, courier) {
    document.getElementById('ship-order-id').value = orderId;
    document.getElementById('ship-status-select').value = status === 'paid' ? 'preparing' : status;
    document.getElementById('ship-tracking').value = tracking || '';
    document.getElementById('ship-courier').value = courier || 'ไปรษณีย์ไทย (EMS)';
    document.getElementById('ship-modal').classList.add('active');
}

function closeShipModal() {
    document.getElementById('ship-modal').classList.remove('active');
}

async function handleSaveShipping(e) {
    e.preventDefault();
    const orderId = document.getElementById('ship-order-id').value;
    const status = document.getElementById('ship-status-select').value;
    const tracking_number = document.getElementById('ship-tracking').value.trim();
    const courier_name = document.getElementById('ship-courier').value.trim();

    try {
        const res = await API.put(`/orders/${orderId}/status`, {
            status,
            tracking_number,
            courier_name
        });

        if (res.success) {
            window.showToast('อัปเดตสถานะจัดส่งเรียบร้อยแล้ว', 'success');
            closeShipModal();
            loadSellerOrders();
        }
    } catch (err) {
        window.showToast(`อัปเดตไม่สำเร็จ: ${err.message}`, 'error');
    }
}


// ==============================================================================
// GEMINI FLASH AI STORYTELLING INTEGRATION
// ==============================================================================

async function aiGenerateStoreStory() {
    const storeName = document.getElementById('store-name-input').value.trim() || 'ช่างฝีมือตลาดใจ';
    const goalTitle = document.getElementById('store-goal-title').value.trim();
    const currentNotes = document.getElementById('store-story-input').value.trim();

    if (window.showToast) window.showToast('Gemini Flash กำลังร้อยเรียงเรื่องราวร้านค้า...', 'info');

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
            if (window.showToast) window.showToast('สร้างเรื่องราวด้วย Gemini Flash สำเร็จเรียบร้อย', 'success');
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

    if (window.showToast) window.showToast('Gemini Flash กำลังเขียนเรื่องราวชิ้นงาน...', 'info');

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
            if (window.showToast) window.showToast('สร้างเรื่องราวสินค้าด้วย Gemini Flash เรียบร้อยแล้ว', 'success');
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
    btn.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> กำลังประมวลผล 3D...`;

    if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.innerHTML = `⚙️ <strong>TRELLIS.2:</strong> กำลังวิเคราะห์โครงสร้างภาพ (Structured Latents) และสังเคราะห์โมเดล 3D (.glb)...`;
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
                statusMsg.innerHTML = `✅ <strong>สร้างโมเดลสำเร็จ!</strong> ผลิตไฟล์ GLB พร้อมพื้นผิว (Texture & PBR) เรียบร้อยแล้ว`;
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
            statusMsg.innerHTML = `❌ ขออภัย ไม่สามารถสร้างโมเดลได้: ${err.message}`;
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
            statusMsg.style.background = '#e0f2fe';
            statusMsg.style.color = '#0369a1';
            statusMsg.innerHTML = `⏳ กำลังอัปโหลดรูปภาพ <strong>${file.name}</strong> เข้าสู่ระบบ...`;
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
                statusMsg.style.background = '#dcfce7';
                statusMsg.style.color = '#15803d';
                statusMsg.innerHTML = `✅ <strong>อัปโหลดสำเร็จ!</strong> รูปภาพพร้อมใช้งานและพร้อมส่งต่อไปยัง TRELLIS.2`;
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
            statusMsg.style.background = '#fee2e2';
            statusMsg.style.color = '#b91c1c';
            statusMsg.innerHTML = `❌ อัปโหลดไม่สำเร็จ: ${err.message}`;
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
        <model-viewer
            src="${glbUrl}"
            ${posterUrl ? `poster="${posterUrl}"` : ''}
            alt="พรีวิวโมเดล 3 มิติ"
            auto-rotate
            camera-controls
            shadow-intensity="1"
            style="width:100%; height:100%; background:#f8fafc;">
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
