// ==============================================================================
// ADMIN DASHBOARD CONTROLLER
// Platform stats, verification approvals, store moderation & campaigns
// ==============================================================================

async function initAdminDashboard() {
    if (!Auth.isLoggedIn()) {
        window.location.href = '/login.html?redirect=/admin-dashboard.html';
        return;
    }

    const user = Auth.getUser();
    if (user.role !== 'admin') {
        alert('หน้านี้สำหรับบัญชีผู้ดูแลระบบ (Admin) เท่านั้น');
        window.location.href = '/index.html';
        return;
    }

    await loadAdminStats();
    await loadAdminStores();
    await loadAdminUsers();
    await loadAiStatus();
}

async function loadAdminStats() {
    try {
        const res = await API.get('/admin/stats');
        if (res.success && res.data) {
            const d = res.data;
            document.getElementById('admin-total-revenue').innerText = `฿${(d.total_revenue || 0).toLocaleString()}`;
            document.getElementById('admin-total-tips').innerText = `฿${(d.total_tips || 0).toLocaleString()}`;
            document.getElementById('admin-total-orders').innerText = d.total_orders || 0;
            document.getElementById('admin-total-stores').innerText = `${d.verified_stores} / ${d.total_stores}`;
            document.getElementById('admin-products-3d').innerText = `${d.products_with_3d} / ${d.total_products}`;
        }
    } catch (err) {
        console.error('Failed to load admin stats:', err);
    }
}

async function loadAdminStores() {
    const container = document.getElementById('admin-stores-table-container');
    try {
        const res = await API.get('/admin/stores');
        if (res.success) {
            container.innerHTML = `
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.95rem;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:2px solid var(--border-color);">
                                <th style="padding:10px 14px;">ร้านค้า</th>
                                <th style="padding:10px 14px;">เจ้าของร้าน</th>
                                <th style="padding:10px 14px;">กลุ่มความพิการ</th>
                                <th style="padding:10px 14px;">เป้าหมายระดมทุน (สะสม/เป้า)</th>
                                <th style="padding:10px 14px;">สถานะ</th>
                                <th style="padding:10px 14px; text-align:right;">การอนุมัติ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${res.data.map(s => `
                                <tr style="border-bottom:1px solid var(--border-color);">
                                    <td style="padding:10px 14px;">
                                        <b>${s.store_name}</b>
                                        <div style="font-size:0.8rem; color:var(--text-muted);">${s.province}</div>
                                    </td>
                                    <td style="padding:10px 14px;">${s.owner_name}<br><small style="color:var(--text-muted);">${s.owner_email}</small></td>
                                    <td style="padding:10px 14px;">${s.disability_type}</td>
                                    <td style="padding:10px 14px;">
                                        ฿${s.support_goal_current.toLocaleString()} / ฿${s.support_goal_target.toLocaleString()}
                                    </td>
                                    <td style="padding:10px 14px;">
                                        <span class="disability-badge" style="background:${s.verification_status === 'approved' ? '#dcfce7' : '#fee2e2'}; color:${s.verification_status === 'approved' ? '#15803d' : '#b91c1c'}; font-size:0.8rem;">
                                            ${s.verification_status}
                                        </span>
                                    </td>
                                    <td style="padding:10px 14px; text-align:right;">
                                        ${s.verification_status === 'approved' ? `
                                            <button onclick="setStoreStatus(${s.id}, 'rejected')" class="btn btn-sm btn-outline" style="color:var(--danger); padding:2px 8px; font-size:0.8rem;">ระงับ</button>
                                        ` : `
                                            <button onclick="setStoreStatus(${s.id}, 'approved')" class="btn btn-sm btn-primary" style="padding:2px 8px; font-size:0.8rem;">อนุมัติ</button>
                                        `}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger); padding:1rem;">${err.message}</div>`;
    }
}

async function loadAdminUsers() {
    const container = document.getElementById('admin-users-table-container');
    try {
        const res = await API.get('/admin/users');
        if (res.success) {
            container.innerHTML = `
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.95rem;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:2px solid var(--border-color);">
                                <th style="padding:10px 14px;">ชื่อ-นามสกุล</th>
                                <th style="padding:10px 14px;">อีเมล</th>
                                <th style="padding:10px 14px;">เบอร์โทรศัพท์</th>
                                <th style="padding:10px 14px;">บทบาท</th>
                                <th style="padding:10px 14px;">วันที่ลงทะเบียน</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${res.data.map(u => `
                                <tr style="border-bottom:1px solid var(--border-color);">
                                    <td style="padding:10px 14px; font-weight:600;">${u.full_name}</td>
                                    <td style="padding:10px 14px;">${u.email}</td>
                                    <td style="padding:10px 14px;">${u.phone || '-'}</td>
                                    <td style="padding:10px 14px;">
                                        <span class="disability-badge" style="background:#f1f5f9; color:#0f172a; font-size:0.8rem;">
                                            ${u.role}
                                        </span>
                                    </td>
                                    <td style="padding:10px 14px; color:var(--text-muted); font-size:0.85rem;">
                                        ${new Date(u.created_at).toLocaleDateString('th-TH')}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger); padding:1rem;">${err.message}</div>`;
    }
}

async function setStoreStatus(storeId, status) {
    try {
        const res = await API.put(`/admin/stores/${storeId}/verify`, { status });
        if (res.success) {
            window.showToast(res.message, 'success');
            loadAdminStores();
            loadAdminStats();
        }
    } catch (err) {
        window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

function showCreateCampaignModal() {
    document.getElementById('campaign-form').reset();
    document.getElementById('campaign-modal').classList.add('active');
}

function closeCampaignModal() {
    document.getElementById('campaign-modal').classList.remove('active');
}

async function handleCreateCampaign(e) {
    e.preventDefault();
    const payload = {
        title: document.getElementById('camp-title').value.trim(),
        location: document.getElementById('camp-location').value.trim(),
        start_date: document.getElementById('camp-start').value,
        end_date: document.getElementById('camp-end').value,
        image_url: document.getElementById('camp-image').value.trim(),
        description: document.getElementById('camp-desc').value.trim()
    };

    try {
        const res = await API.post('/campaigns', payload);
        if (res.success) {
            window.showToast('สร้างแคมเปญเรียบร้อยแล้ว', 'success');
            closeCampaignModal();
        }
}

async function loadAiStatus() {
    const pill = document.getElementById('ai-status-pill');
    if (!pill) return;

    try {
        const res = await API.get('/ai/status');
        if (res.success) {
            if (res.configured) {
                pill.style.background = '#e8f5ee';
                pill.style.borderColor = '#a3d9b4';
                pill.style.color = '#166534';
                pill.innerHTML = `ใช้งาน ${res.model} (Free Tier พร้อมใช้งาน)`;
            } else {
                pill.style.background = '#fef3e7';
                pill.style.borderColor = '#fad29a';
                pill.style.color = '#b4532a';
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

document.addEventListener('DOMContentLoaded', initAdminDashboard);

