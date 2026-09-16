// ==============================================================================
// USER PROFILE CONTROLLER
// Dedicated user profile: Active Tracking, Order History & Account Settings
// ==============================================================================

let userOrders = [];
let currentHistoryFilter = 'all';

async function initProfilePage() {
    if (!Auth.isLoggedIn()) {
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    const user = Auth.getUser();
    populateUserData(user);

    // Read tab from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get('tab') || 'tracking';
    switchProfileTab(activeTab);

    // Load orders data
    await loadProfileOrders();

    // Update favorites stat
    try {
        const favs = JSON.parse(localStorage.getItem('taladjai_favorites') || '[]');
        const favEl = document.getElementById('stat-favorites');
        if (favEl) favEl.innerText = favs.length;
    } catch (e) {}
}

function populateUserData(user) {
    if (!user) return;

    // Header Hero elements
    const avatarEl = document.getElementById('profile-hero-avatar');
    const nameEl = document.getElementById('profile-hero-name');
    const roleBadgeEl = document.getElementById('profile-hero-role-badge');
    const emailEl = document.getElementById('profile-hero-email');
    const bioEl = document.getElementById('profile-hero-bio');
    const sellerWrap = document.getElementById('profile-seller-link-wrap');

    if (avatarEl) avatarEl.src = user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80';
    if (nameEl) nameEl.innerText = user.full_name || 'ผู้ใช้งาน';
    if (emailEl) emailEl.innerText = user.email;
    if (bioEl) bioEl.innerText = user.bio || 'ร่วมสนับสนุนผลงานช่างฝีมือผู้พิการบนแพลตฟอร์มตลาดใจ';

    if (roleBadgeEl) {
        if (user.role === 'seller') {
            roleBadgeEl.innerText = 'ช่างฝีมือ / ร้านค้า';
            roleBadgeEl.style.background = '#254a3b';
            roleBadgeEl.style.color = '#fef08a';
            if (sellerWrap) sellerWrap.style.display = 'inline-block';
        } else if (user.role === 'admin') {
            roleBadgeEl.innerText = 'ผู้ดูแลระบบ';
            roleBadgeEl.style.background = '#7c3aed';
            roleBadgeEl.style.color = '#ffffff';
        } else {
            roleBadgeEl.innerText = 'ผู้สนับสนุน';
            roleBadgeEl.style.background = '#1e3a8a';
            roleBadgeEl.style.color = '#dbeafe';
        }
    }

    // Form inputs
    const editFullName = document.getElementById('edit-fullname');
    const editEmail = document.getElementById('edit-email');
    const editPhone = document.getElementById('edit-phone');
    const editAvatar = document.getElementById('edit-avatar');
    const editAvatarPreview = document.getElementById('edit-avatar-preview');
    const editBio = document.getElementById('edit-bio');

    if (editFullName) editFullName.value = user.full_name || '';
    if (editEmail) editEmail.value = user.email || '';
    if (editPhone) editPhone.value = user.phone || '';
    if (editAvatar) editAvatar.value = user.avatar_url || '';
    if (editAvatarPreview && user.avatar_url) editAvatarPreview.src = user.avatar_url;
    if (editBio) editBio.value = user.bio || '';
}

function switchProfileTab(tabName) {
    const tabs = ['tracking', 'history', 'account'];
    if (!tabs.includes(tabName)) tabName = 'tracking';

    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const panel = document.getElementById(`tab-content-${t}`);
        if (btn) {
            btn.classList.toggle('active', t === tabName);
            btn.setAttribute('aria-selected', t === tabName ? 'true' : 'false');
        }
        if (panel) {
            panel.style.display = t === tabName ? 'block' : 'none';
        }
    });

    // Update URL query param without reload
    const url = new URL(window.location);
    url.searchParams.set('tab', tabName);
    window.history.replaceState({}, '', url);
}

async function loadProfileOrders() {
    const activeContainer = document.getElementById('active-orders-container');
    const historyContainer = document.getElementById('history-orders-container');

    try {
        const res = await API.get('/orders/my-orders');
        if (res.success && res.data) {
            userOrders = res.data;

            // Calculate metrics
            const totalOrders = userOrders.length;
            let activeCount = 0;
            let totalTips = 0;

            const activeStatuses = ['pending', 'paid', 'processing', 'shipped'];
            const activeOrders = [];
            const historyOrders = [];

            userOrders.forEach(o => {
                totalTips += parseFloat(o.tip_amount) || 0;
                if (activeStatuses.includes(o.status)) {
                    activeCount++;
                    activeOrders.push(o);
                } else {
                    historyOrders.push(o);
                }
            });

            // Update stats
            const totalOrdersEl = document.getElementById('stat-total-orders');
            const activeOrdersEl = document.getElementById('stat-active-orders');
            const totalTipsEl = document.getElementById('stat-total-tips');
            const trackingBadge = document.getElementById('badge-tracking-count');

            if (totalOrdersEl) totalOrdersEl.innerText = totalOrders;
            if (activeOrdersEl) activeOrdersEl.innerText = activeCount;
            if (totalTipsEl) totalTipsEl.innerText = `฿${totalTips.toLocaleString()}`;

            if (trackingBadge) {
                if (activeCount > 0) {
                    trackingBadge.innerText = activeCount;
                    trackingBadge.style.display = 'inline-block';
                } else {
                    trackingBadge.style.display = 'none';
                }
            }

            renderActiveTrackingOrders(activeOrders);
            renderHistoryOrders(historyOrders);
        }
    } catch (err) {
        console.error('Failed to load orders:', err);
        if (activeContainer) {
            activeContainer.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--danger);">เกิดข้อผิดพลาดในการโหลดคำสั่งซื้อ: ${err.message}</div>`;
        }
    }
}

function renderActiveTrackingOrders(orders) {
    const container = document.getElementById('active-orders-container');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:3.5rem 1.5rem; background:var(--bg-card); border-radius:var(--radius-xl); border:1.5px dashed var(--border-color);">
                
                <h3 style="font-size:1.3rem; margin:0 0 0.5rem; color:var(--brand-dark);">ไม่มีพัสดุที่อยู่ระหว่างจัดส่งในขณะนี้</h3>
                <p style="color:var(--text-muted); max-width:420px; margin:0 auto 1.5rem;">
                    ทุกคำสั่งซื้อของคุณช่วยสร้างรายได้ที่มั่นคงและสนับสนุนเป้าหมายของช่างฝีมือคนพิการ
                </p>
                <a href="/products.html" class="btn btn-primary" style="padding:0.55rem 1.6rem; font-weight:700;">เลือกชมสินค้าและงานฝีมือ</a>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(o => {
        const stepNum = getOrderStepIndex(o.status);
        const statusDetails = getOrderStatusDetails(o.status);

        return `
            <article class="support-goal-card" style="margin-bottom:2rem; border:2px solid var(--border-color); background:var(--bg-card); border-radius:var(--radius-xl); overflow:hidden;" aria-label="ติดตามพัสดุคำสั่งซื้อ ${o.id}">
                <!-- Order Header -->
                <div style="padding:1.25rem 1.5rem; background:linear-gradient(90deg, #fbf7ee, #f3ede2); border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <span style="font-size:0.85rem; color:var(--text-muted);">หมายเลขคำสั่งซื้อ:</span>
                        <b style="font-size:1.15rem; color:var(--brand-dark); margin-left:4px;">#ORD-${o.id}</b>
                        <span style="font-size:0.85rem; color:var(--text-muted); margin-left:8px;">
                            • สั่งเมื่อ: ${new Date(o.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div>
                        <span class="disability-badge" style="background:${statusDetails.bg}; color:${statusDetails.color}; padding:5px 14px; font-size:0.85rem; font-weight:700;">
                            ${statusDetails.label}
                        </span>
                    </div>
                </div>

                <div style="padding:1.5rem;">
                    <!-- 4-Step Progress Stepper -->
                    <div class="order-stepper" aria-label="สถานะขั้นตอนการจัดส่ง">
                        <div class="stepper-fill-line" style="position:absolute; top:20px; left:12.5%; width:${Math.min(75, Math.max(0, (stepNum - 1) * 25))}%; height:4px; background:linear-gradient(90deg, #10b981, var(--primary)); z-index:1; border-radius:4px; transition:width 0.4s ease;"></div>
                        <div class="step-item ${stepNum >= 1 ? (stepNum > 1 ? 'completed' : 'active') : ''}">
                            <div class="step-icon">${stepNum > 1 ? '✓' : '1'}</div>
                            <div class="step-title">ชำระเงินแล้ว</div>
                        </div>
                        <div class="step-item ${stepNum >= 2 ? (stepNum > 2 ? 'completed' : 'active') : ''}">
                            <div class="step-icon">${stepNum > 2 ? '✓' : '2'}</div>
                            <div class="step-title">กำลังเตรียมพัสดุ</div>
                        </div>
                        <div class="step-item ${stepNum >= 3 ? (stepNum > 3 ? 'completed' : 'active') : ''}">
                            <div class="step-icon">${stepNum > 3 ? '✓' : '3'}</div>
                            <div class="step-title">บริษัทขนส่งรับแล้ว</div>
                        </div>
                        <div class="step-item ${stepNum >= 4 ? 'completed' : ''}">
                            <div class="step-icon">${stepNum >= 4 ? '✓' : '4'}</div>
                            <div class="step-title">จัดส่งสำเร็จ</div>
                        </div>
                    </div>

                    <!-- Courier & Tracking Alert Box -->
                    <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:var(--radius-lg); padding:1rem 1.25rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            
                            <div>
                                <div style="font-weight:700; font-size:0.95rem; color:var(--brand-dark);">
                                    ผู้ให้บริการขนส่ง: <span>${o.courier_name || 'ไปรษณีย์ไทย (EMS) / Kerry'}</span>
                                </div>
                                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">
                                    ${o.tracking_number ? `เลขติดตามพัสดุ: <code style="background:#e2e8f0; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.95rem; color:#1e293b;">${o.tracking_number}</code>` : 'กำลังรอร้านค้าอัปเดตหมายเลขพัสดุ'}
                                </div>
                            </div>
                        </div>
                        ${o.tracking_number ? `
                        <button onclick="copyTrackingNumber('${o.tracking_number}')" class="btn btn-sm btn-outline-dark" style="display:inline-flex; align-items:center; gap:4px;">
                            คัดลอกเลขพัสดุ
                        </button>
                        ` : ''}
                    </div>

                    <!-- Store & Destination Info -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem; margin-bottom:1.5rem; font-size:0.9rem; background:#fff; padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                        <div>
                            <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:2px;">ร้านค้าผู้ผลิต:</div>
                            <div style="font-weight:700; color:var(--brand-dark);">${o.store_name}</div>
                        </div>
                        <div>
                            <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:2px;">จัดส่งถึง:</div>
                            <div style="font-weight:600;">${o.shipping_name} (${o.shipping_phone})</div>
                            <div style="color:var(--text-muted); font-size:0.85rem;">${o.shipping_address}</div>
                        </div>
                    </div>

                    <!-- Items Summary -->
                    <div style="border-top:1px solid var(--border-color); padding-top:1rem;">
                        <div style="font-weight:700; font-size:0.9rem; margin-bottom:10px; color:var(--text-muted);">รายการสินค้าในกล่องพัสดุ:</div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${(o.items || []).map(it => `
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <img src="${it.product_image}" alt="${it.product_name}" style="width:44px; height:44px; border-radius:6px; object-fit:cover; border:1px solid var(--border-color);">
                                        <div>
                                            <div style="font-weight:600; font-size:0.9rem;">${it.product_name}</div>
                                            <div style="font-size:0.8rem; color:var(--text-muted);">${it.quantity} ชิ้น × ฿${it.unit_price.toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div style="font-weight:700; font-size:0.95rem;">฿${it.subtotal.toLocaleString()}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Footer Totals -->
                    <div style="border-top:1px solid var(--border-color); margin-top:1.25rem; padding-top:0.85rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div style="font-size:0.85rem; color:#059669; font-weight:600;">
                            ${o.tip_amount > 0 ? `รวมเงินสมทบทุนสนับสนุนช่าง: ฿${o.tip_amount.toLocaleString()}` : ''}
                        </div>
                        <div style="font-size:1.15rem; font-weight:800; color:var(--primary-dark);">
                            ยอดรวมทั้งสิ้น: ฿${o.grand_total.toLocaleString()}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function renderHistoryOrders(orders) {
    const container = document.getElementById('history-orders-container');
    if (!container) return;

    let filtered = orders;
    if (currentHistoryFilter === 'delivered') {
        filtered = orders.filter(o => o.status === 'delivered' || o.status === 'completed');
    } else if (currentHistoryFilter === 'cancelled') {
        filtered = orders.filter(o => o.status === 'cancelled');
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:3.5rem 1.5rem; background:var(--bg-card); border-radius:var(--radius-xl); border:1.5px dashed var(--border-color);">
                
                <h3 style="font-size:1.3rem; margin:0 0 0.5rem; color:var(--brand-dark);">ไม่พบประวัติคำสั่งซื้อในหมวดนี้</h3>
                <p style="color:var(--text-muted); margin:0 auto 1.5rem;">เมื่อคำสั่งซื้อจัดส่งเสร็จสิ้นจะถูกบันทึกรวบรวมไว้ที่นี่</p>
                <a href="/products.html" class="btn btn-primary">เลือกซื้อสินค้า</a>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(o => {
        const statusDetails = getOrderStatusDetails(o.status);

        return `
            <article class="support-goal-card" style="margin-bottom:1.5rem; border:1.5px solid var(--border-color); background:var(--bg-card); border-radius:var(--radius-lg); padding:1.25rem 1.5rem;" aria-label="ประวัติคำสั่งซื้อ ${o.id}">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.85rem; margin-bottom:1rem; flex-wrap:wrap; gap:8px;">
                    <div>
                        <b style="font-size:1.1rem; color:var(--brand-dark);">#ORD-${o.id}</b>
                        <span style="font-size:0.85rem; color:var(--text-muted); margin-left:8px;">
                            • สั่งเมื่อ: ${new Date(o.created_at).toLocaleDateString('th-TH')}
                        </span>
                    </div>
                    <div>
                        <span class="disability-badge" style="background:${statusDetails.bg}; color:${statusDetails.color}; font-size:0.8rem; padding:3px 10px;">
                            ${statusDetails.label}
                        </span>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:10px;">
                    <div>
                        <span style="font-size:0.85rem; color:var(--text-muted);">ร้านค้า:</span>
                        <b style="font-size:0.95rem; margin-left:4px;">${o.store_name}</b>
                    </div>
                    ${o.tracking_number ? `
                    <div style="font-size:0.85rem; color:var(--text-muted);">
                        พัสดุ: <code>${o.tracking_number}</code> (${o.courier_name || 'ขนส่ง'})
                    </div>
                    ` : ''}
                </div>

                <!-- Items list -->
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:1rem;">
                    ${(o.items || []).map(it => `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <img src="${it.product_image}" alt="${it.product_name}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">
                                <div>
                                    <div style="font-weight:600; font-size:0.9rem;">${it.product_name}</div>
                                    <div style="font-size:0.8rem; color:var(--text-muted);">${it.quantity} ชิ้น × ฿${it.unit_price.toLocaleString()}</div>
                                </div>
                            </div>
                            <div style="font-weight:700; font-size:0.9rem;">฿${it.subtotal.toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>

                <div style="border-top:1px solid var(--border-color); padding-top:0.85rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="font-size:0.85rem; color:var(--text-muted);">
                        ${o.tip_amount > 0 ? `<span style="color:#059669; font-weight:600;">สมทบทุนสนับสนุนช่าง: ฿${o.tip_amount.toLocaleString()}</span> • ` : ''}
                        ยอดชำระ: <b style="font-size:1.05rem; color:var(--primary-dark);">฿${o.grand_total.toLocaleString()}</b>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <a href="/products.html?store_id=${o.store_id}" class="btn btn-sm btn-outline-dark">ดูหน้าร้านนี้</a>
                        <button onclick="reorderItems(${JSON.stringify(o.items).replace(/"/g, '&quot;')})" class="btn btn-sm btn-primary">สั่งซื้ออีกครั้ง</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function filterHistory(type) {
    currentHistoryFilter = type;
    ['all', 'delivered', 'cancelled'].forEach(f => {
        const btn = document.getElementById(`btn-filter-${f}`);
        if (btn) btn.classList.toggle('active', f === type);
    });

    const activeStatuses = ['pending', 'paid', 'processing', 'shipped'];
    const historyOrders = userOrders.filter(o => !activeStatuses.includes(o.status));
    renderHistoryOrders(historyOrders);
}

function getOrderStepIndex(status) {
    switch (status) {
        case 'pending':
        case 'paid':
            return 1;
        case 'processing':
            return 2;
        case 'shipped':
            return 3;
        case 'delivered':
        case 'completed':
            return 4;
        default:
            return 1;
    }
}

function getOrderStatusDetails(status) {
    switch (status) {
        case 'pending':
            return { label: 'รอการชำระเงิน', bg: '#fef3c7', color: '#92400e', icon: '' };
        case 'paid':
            return { label: 'ชำระเงินแล้ว / รอดำเนินการ', bg: '#e0f2fe', color: '#0369a1', icon: '' };
        case 'processing':
            return { label: 'ร้านค้ากำลังเตรียมสินค้า', bg: '#fef3c7', color: '#b45309', icon: '' };
        case 'shipped':
            return { label: 'กำลังจัดส่งโดยบริษัทขนส่ง', bg: '#e0e7ff', color: '#3730a3', icon: '' };
        case 'delivered':
        case 'completed':
            return { label: 'จัดส่งสำเร็จเรียบร้อย', bg: '#dcfce7', color: '#15803d', icon: '' };
        case 'cancelled':
            return { label: 'ยกเลิกคำสั่งซื้อ', bg: '#fee2e2', color: '#b91c1c', icon: '' };
        default:
            return { label: status, bg: '#f1f5f9', color: '#475569', icon: '' };
    }
}

function copyTrackingNumber(code) {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
        if (window.showToast) window.showToast(`คัดลอกเลขพัสดุ "${code}" เรียบร้อยแล้ว`, 'success');
    }).catch(() => {
        if (window.showToast) window.showToast(`เลขพัสดุ: ${code}`, 'info');
    });
}

function previewAvatar(url) {
    const avatarEl = document.getElementById('profile-hero-avatar');
    if (avatarEl && url) {
        avatarEl.src = url;
    }
}

function handleAvatarFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        if (window.showToast) window.showToast('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB', 'warning');
        e.target.value = '';
        return;
    }

    const nameLabel = document.getElementById('selected-file-name');
    if (nameLabel) {
        nameLabel.innerHTML = `✓ เลือก: <b>${file.name}</b> (${(file.size / 1024).toFixed(0)} KB)`;
        nameLabel.style.color = '#059669';
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
        const previewEl = document.getElementById('edit-avatar-preview');
        const heroEl = document.getElementById('profile-hero-avatar');
        if (previewEl) previewEl.src = evt.target.result;
        if (heroEl) heroEl.src = evt.target.result;
    };
    reader.readAsDataURL(file);
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-profile');
    btn.innerText = 'กำลังบันทึก...';
    btn.disabled = true;

    const full_name = document.getElementById('edit-fullname').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const fileInput = document.getElementById('edit-avatar-file');
    let avatar_url = document.getElementById('edit-avatar').value.trim();

    try {
        // If a new avatar file was chosen, upload it first
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
            Auth.saveSession(API.getToken(), res.user, res.store);
            populateUserData(res.user);

            // Update user avatar in navbar if present
            const navAvatars = document.querySelectorAll('.nav-user-pill img, #nav-avatar-img, .user-avatar');
            navAvatars.forEach(img => {
                if (res.user.avatar_url) img.src = res.user.avatar_url;
            });

            // Reset file input label
            const nameLabel = document.getElementById('selected-file-name');
            if (nameLabel) {
                nameLabel.innerHTML = 'รองรับ JPG, PNG, WebP (ไม่เกิน 5MB)';
                nameLabel.style.color = 'var(--text-muted)';
            }
            if (fileInput) fileInput.value = '';

            if (window.showToast) {
                window.showToast('บันทึกข้อมูลส่วนตัวและรูปภาพสำเร็จเรียบร้อยแล้ว', 'success');
            }
        }
    } catch (err) {
        if (window.showToast) {
            window.showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
        }
    } finally {
        btn.innerText = 'บันทึกข้อมูลส่วนตัว';
        btn.disabled = false;
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-pwd');
    const current_password = document.getElementById('pwd-current').value;
    const new_password = document.getElementById('pwd-new').value;
    const confirm_password = document.getElementById('pwd-confirm').value;

    if (new_password !== confirm_password) {
        if (window.showToast) window.showToast('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน', 'warning');
        return;
    }

    btn.innerText = 'กำลังเปลี่ยนรหัสผ่าน...';
    btn.disabled = true;

    try {
        const res = await API.put('/auth/password', {
            current_password,
            new_password
        });

        if (res.success) {
            document.getElementById('password-form').reset();
            if (window.showToast) {
                window.showToast('เปลี่ยนรหัสผ่านใหม่สำเร็จเรียบร้อยแล้ว', 'success');
            }
        }
    } catch (err) {
        if (window.showToast) {
            window.showToast(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${err.message}`, 'error');
        }
    } finally {
        btn.innerText = 'ยืนยันเปลี่ยนรหัสผ่าน';
        btn.disabled = false;
    }
}

function reorderItems(items) {
    if (!items || !Array.isArray(items) || items.length === 0) return;
    if (window.Cart) {
        items.forEach(it => {
            Cart.addItem({
                id: it.product_id,
                name: it.product_name,
                price: it.unit_price,
                image_url: it.product_image,
                store_id: 1,
                store_name: 'ช่างฝีมือคนพิการ'
            }, it.quantity);
        });
        if (window.showToast) {
            window.showToast('เพิ่มรายการเดิมลงในตะกร้าสินค้าเรียบร้อยแล้ว', 'success');
        }
        setTimeout(() => window.location.href = '/cart.html', 700);
    }
}

document.addEventListener('DOMContentLoaded', initProfilePage);
