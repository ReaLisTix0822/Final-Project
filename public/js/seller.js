// ==============================================================================
// SELLER DASHBOARD CONTROLLER
// Products CRUD, Support Goal setup, Order fulfillment & Sales metrics
// ==============================================================================

let currentSellerStore = null;
let currentProducts = [];
let currentOrders = [];

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
        populateStoreProfileForm(currentSellerStore);
    }

    await loadSellerProducts();
    await loadSellerOrders();
}


function switchTab(tabName) {
    document.querySelectorAll('.dashboard-tab').forEach(t => t.style.display = 'none');
    document.querySelectorAll('[id^="tab-btn-"]').forEach(b => b.classList.remove('active', 'btn-primary'));

    const activeTab = document.getElementById(`tab-${tabName}`);
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeTab) activeTab.style.display = 'block';
    if (activeBtn) activeBtn.classList.add('active');
}

async function loadSellerProducts() {
    const container = document.getElementById('seller-products-table-container');
    try {
        const storeId = currentSellerStore ? currentSellerStore.id : 1;
        const res = await API.get(`/stores/${storeId}`);
        if (res.success && res.data) {
            currentProducts = res.data.products || [];
            document.getElementById('metric-products').innerText = currentProducts.length;

            if (currentProducts.length === 0) {
                container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted);">ยังไม่มีสินค้าในร้าน คลิกปุ่ม "เพิ่มสินค้าใหม่" เพื่อเริ่มต้น</div>';
                return;
            }

            container.innerHTML = `
                <div class="dashboard-table-card">
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
                                ${currentProducts.map(p => `
                                    <tr>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:14px;">
                                                <div class="prod-thumb-container">
                                                    <img src="${p.image_url}" alt="${p.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&auto=format&fit=crop&q=80';">
                                                </div>
                                                <div style="min-width:0;">
                                                    <div style="font-weight:700; color:var(--brand-dark); font-size:0.98rem; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;" title="${p.name}">
                                                        ${p.name}
                                                    </div>
                                                    <div style="font-size:0.8rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">
                                                        ${(p.story || p.description || 'หัตถกรรมฝีมือประณีต').substring(0, 45)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style="background:#f1f5f9; color:#334155; font-size:0.8rem; font-weight:600; padding:4px 10px; border-radius:9999px; display:inline-block;">
                                                ${p.category_name || 'ทั่วไป'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style="font-family:var(--font-heading); font-weight:800; color:#0284c7; font-size:1.05rem;">
                                                ฿${(parseFloat(p.price) || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td>
                                            <span style="font-weight:600; color:${p.stock > 0 ? '#15803d' : '#dc2626'};">
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
                                                <button onclick="editProduct(${p.id})" class="btn-action-edit" title="แก้ไขข้อมูลสินค้า">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    แก้ไข
                                                </button>
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
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger); padding:1.5rem; text-align:center;">โหลดสินค้าไม่สำเร็จ: ${err.message}</div>`;
    }
}

async function loadSellerOrders() {
    const container = document.getElementById('seller-orders-container');
    try {
        const res = await API.get('/orders/seller-orders');
        if (res.success) {
            currentOrders = res.data;
            document.getElementById('metric-orders').innerText = currentOrders.length;

            let totalSales = 0;
            let totalTips = 0;
            currentOrders.forEach(o => {
                totalSales += (parseFloat(o.subtotal) || 0);
                totalTips += (parseFloat(o.tip_amount) || 0);
            });

            document.getElementById('metric-sales').innerText = `฿${totalSales.toLocaleString()}`;
            document.getElementById('metric-tips').innerText = `฿${totalTips.toLocaleString()}`;

            if (currentOrders.length === 0) {
                container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted); background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--border-color);">ยังไม่มีคำสั่งซื้อเข้ามาในร้าน</div>';
                return;
            }

            container.innerHTML = `
                <div class="dashboard-table-card">
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
                                                <div style="font-family:var(--font-heading); font-weight:800; color:var(--brand-dark);">
                                                    #ORD-${o.id}
                                                </div>
                                                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                                                    ${new Date(o.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </div>
                                            </td>
                                            <td>
                                                <div style="font-weight:700; color:#1e293b;">
                                                    ${o.shipping_name || 'ผู้สนับสนุนใจดี'} 
                                                    <span style="font-weight:400; color:var(--text-muted); font-size:0.85rem;">(${o.shipping_phone || '-'})</span>
                                                </div>
                                                <div style="font-size:0.8rem; color:var(--text-muted); max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${o.shipping_address}">
                                                    ${o.shipping_address || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <span style="font-family:var(--font-heading); font-weight:800; color:var(--brand-dark); font-size:1.05rem;">
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
                </div>
            `;
        }

    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger); padding:1rem;">โหลดคำสั่งซื้อไม่สำเร็จ: ${err.message}</div>`;
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
        }
    } catch (err) {
        window.showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
    }
}

function showAddProductModal() {
    document.getElementById('product-modal-title').innerText = 'เพิ่มสินค้าใหม่';
    document.getElementById('edit-product-id').value = '';
    document.getElementById('product-form').reset();
    clearProductImage();
    hide3DPreview();
    document.getElementById('product-modal').classList.add('active');
}

function editProduct(productId) {
    const p = currentProducts.find(item => item.id === productId);
    if (!p) return;

    document.getElementById('product-modal-title').innerText = 'แก้ไขข้อมูลสินค้า';
    document.getElementById('edit-product-id').value = p.id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-category').value = p.category_id;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-stock').value = p.stock;
    document.getElementById('p-dimensions').value = p.dimensions || '';
    document.getElementById('p-image').value = p.image_url;
    document.getElementById('p-3d').value = p.model_3d_url || '';
    document.getElementById('p-story').value = p.story || '';
    document.getElementById('p-desc').value = p.description || '';

    // Show image preview
    syncProductImagePreview(p.image_url);

    if (p.model_3d_url) {
        show3DPreview(p.model_3d_url, p.image_url);
    } else {
        hide3DPreview();
    }

    document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
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


