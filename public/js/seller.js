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
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.95rem;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:2px solid var(--border-color);">
                                <th style="padding:12px 16px;">สินค้า</th>
                                <th style="padding:12px 16px;">หมวดหมู่</th>
                                <th style="padding:12px 16px;">ราคา</th>
                                <th style="padding:12px 16px;">สต็อก</th>
                                <th style="padding:12px 16px;">3D / AR</th>
                                <th style="padding:12px 16px; text-align:right;">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentProducts.map(p => `
                                <tr style="border-bottom:1px solid var(--border-color);">
                                    <td style="padding:12px 16px; display:flex; align-items:center; gap:10px;">
                                        <img src="${p.image_url}" alt="${p.name}" style="width:48px; height:48px; object-fit:cover; border-radius:var(--radius-sm);">
                                        <div>
                                            <b>${p.name}</b>
                                            <div style="font-size:0.8rem; color:var(--text-muted);">${(p.story || '').substring(0, 50)}...</div>
                                        </div>
                                    </td>
                                    <td style="padding:12px 16px;">${p.category_name || '-'}</td>
                                    <td style="padding:12px 16px; font-weight:700; color:#0284c7;">฿${(parseFloat(p.price) || 0).toLocaleString()}</td>
                                    <td style="padding:12px 16px;">${p.stock} ชิ้น</td>
                                    <td style="padding:12px 16px;">
                                        ${p.model_3d_url ? '<span class="badge-3d" style="font-size:0.75rem;">มี 3D</span>' : '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>'}
                                    </td>
                                    <td style="padding:12px 16px; text-align:right;">
                                        <button onclick="editProduct(${p.id})" class="btn btn-sm btn-outline" style="padding:4px 8px; margin-right:4px;">แก้ไข</button>
                                        <button onclick="deleteProduct(${p.id})" class="btn btn-sm btn-outline" style="color:var(--danger); padding:4px 8px;">ลบ</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger); padding:1rem;">โหลดสินค้าไม่สำเร็จ: ${err.message}</div>`;
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
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.95rem;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:2px solid var(--border-color);">
                                <th style="padding:12px 16px;">หมายเลขคำสั่งซื้อ</th>
                                <th style="padding:12px 16px;">ลูกค้า & ที่อยู่จัดส่ง</th>
                                <th style="padding:12px 16px;">ยอดสินค้า</th>
                                <th style="padding:12px 16px;">ทิปสนับสนุน</th>
                                <th style="padding:12px 16px;">สถานะจัดส่ง</th>
                                <th style="padding:12px 16px; text-align:right;">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentOrders.map(o => `
                                <tr style="border-bottom:1px solid var(--border-color);">
                                    <td style="padding:12px 16px;">
                                        <b>#ORD-${o.id}</b>
                                        <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(o.created_at).toLocaleDateString('th-TH')}</div>
                                    </td>
                                    <td style="padding:12px 16px;">
                                        <b>${o.shipping_name}</b> (${o.shipping_phone})
                                        <div style="font-size:0.8rem; color:var(--text-muted); max-width:240px;">${o.shipping_address}</div>
                                    </td>
                                    <td style="padding:12px 16px; font-weight:700;">฿${(parseFloat(o.subtotal) || 0).toLocaleString()}</td>
                                    <td style="padding:12px 16px; font-weight:700; color:#0d9488;">฿${(parseFloat(o.tip_amount) || 0).toLocaleString()}</td>
                                    <td style="padding:12px 16px;">
                                        <span class="disability-badge" style="background:#e0f2fe; color:#0369a1; font-size:0.8rem;">
                                            ${o.status}
                                        </span>
                                        ${o.tracking_number ? `<div style="font-size:0.8rem; margin-top:2px;">เลข: ${o.tracking_number}</div>` : ''}
                                    </td>
                                    <td style="padding:12px 16px; text-align:right;">
                                        <button onclick="openShipModal(${o.id}, '${o.status}', '${o.tracking_number || ''}', '${o.courier_name || ''}')" class="btn btn-sm btn-primary">
                                            จัดส่ง
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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

    document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSellerDashboard);
} else {
    initSellerDashboard();
}

