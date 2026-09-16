// ==============================================================================
// ORDERS CONTROLLER
// Handles order status tracking, items inspection, and courier details
// ==============================================================================

async function loadOrders() {
    const container = document.getElementById('orders-list-container');

    if (!Auth.isLoggedIn()) {
        container.innerHTML = `
            <div style="text-align:center; padding:4rem; background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--border-color);">
                <h2>กรุณาเข้าสู่ระบบเพื่อดูประวัติคำสั่งซื้อ</h2>
                <a href="/login.html?redirect=/orders.html" class="btn btn-primary" style="margin-top:1rem;">เข้าสู่ระบบ</a>
            </div>
        `;
        return;
    }

    try {
        const res = await API.get('/orders/my-orders');
        if (res.success) {
            if (res.data.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:4rem; background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--border-color);">
                        
                        <h3>ยังไม่มีรายการคำสั่งซื้อ</h3>
                        <p style="color:var(--text-muted); margin:0.5rem 0 1.5rem;">ร่วมสนับสนุนสินค้าจากช่างฝีมือผู้พิการเพื่อสร้างรายได้ที่ยั่งยืน</p>
                        <a href="/products.html" class="btn btn-primary">เลือกซื้อสินค้า</a>
                    </div>
                `;
                return;
            }

            container.innerHTML = res.data.map(o => {
                const statusInfo = getOrderStatusInfo(o.status);
                return `
                    <article class="support-goal-card" style="margin-bottom:1.75rem; border:2px solid var(--border-color);" aria-label="คำสั่งซื้อหมายเลข ${o.id}">
                        <!-- Header -->
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:1rem; margin-bottom:1rem; flex-wrap:wrap; gap:8px;">
                            <div>
                                <span style="font-size:0.85rem; color:var(--text-muted);">หมายเลขคำสั่งซื้อ:</span>
                                <b style="font-size:1.1rem; color:var(--primary-dark);">#ORD-${o.id}</b>
                                <span style="font-size:0.85rem; color:var(--text-muted); margin-left:8px;">
                                    (${new Date(o.created_at).toLocaleString('th-TH')})
                                </span>
                            </div>
                            <div>
                                <span class="disability-badge" style="background:${statusInfo.bg}; color:${statusInfo.color}; font-size:0.85rem; padding:4px 12px;">
                                    ${statusInfo.label}
                                </span>
                            </div>
                        </div>

                        <!-- Store & Tracking Banner -->
                        <div style="background:#f8fafc; padding:10px 14px; border-radius:var(--radius-md); margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div>
                                ร้านค้า: <b>${o.store_name}</b>
                            </div>
                            <div>
                                ${o.tracking_number ? `
                                    <span style="font-size:0.9rem;">
                                        <b>${o.courier_name || 'ขนส่ง'}:</b> 
                                        <code style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-weight:700;">${o.tracking_number}</code>
                                    </span>
                                ` : '<span style="font-size:0.85rem; color:var(--text-muted);">ร้านค้ากำลังเตรียมบรรจุภัณฑ์</span>'}
                            </div>
                        </div>

                        <!-- Items List -->
                        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:1rem;">
                            ${o.items ? o.items.map(item => `
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <img src="${item.product_image}" alt="${item.product_name}" style="width:52px; height:52px; object-fit:cover; border-radius:var(--radius-sm);">
                                    <div style="flex-grow:1;">
                                        <div style="font-weight:600; font-size:0.95rem;">${item.product_name}</div>
                                        <div style="font-size:0.85rem; color:var(--text-muted);">จำนวน: ${item.quantity} ชิ้น × ฿${item.unit_price.toLocaleString()}</div>
                                    </div>
                                    <div style="font-weight:700; font-size:0.95rem;">฿${item.subtotal.toLocaleString()}</div>
                                </div>
                            `).join('') : ''}
                        </div>

                        <!-- Financial Footer -->
                        <div style="border-top:1px solid var(--border-color); padding-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div style="font-size:0.85rem; color:var(--text-muted);">
                                จัดส่งถึง: ${o.shipping_name} (${o.shipping_phone})
                                ${o.tip_amount > 0 ? `<br><span style="color:#2563eb; font-weight:600;">ร่วมสมทบทุนสนับสนุน: ฿${o.tip_amount.toLocaleString()}</span>` : ''}
                            </div>
                            <div style="font-size:1.15rem; font-weight:700; color:var(--primary-dark);">
                                ยอดชำระรวม: ฿${o.grand_total.toLocaleString()}
                            </div>
                        </div>
                    </article>
                `;
            }).join('');
        }
    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger); text-align:center; padding:2rem;">เกิดข้อผิดพลาด: ${err.message}</div>`;
    }
}

function getOrderStatusInfo(status) {
    switch (status) {
        case 'paid':
            return { label: 'ชำระเงินแล้ว (เตรียมจัดส่ง)', icon: '', bg: '#e0f2fe', color: '#0369a1' };
        case 'preparing':
            return { label: 'ช่างฝีมือกำลังเตรียมสินค้า', icon: '', bg: '#fef3c7', color: '#b45309' };
        case 'shipped':
            return { label: 'จัดส่งแล้ว อยู่ระหว่างขนส่ง', icon: '', bg: '#ccfbf1', color: '#0f766e' };
        case 'completed':
            return { label: 'จัดส่งสำเร็จเรียบร้อย', icon: '', bg: '#dcfce7', color: '#15803d' };
        case 'cancelled':
            return { label: 'ยกเลิกคำสั่งซื้อ', icon: '', bg: '#fee2e2', color: '#b91c1c' };
        default:
            return { label: status, icon: '', bg: '#f1f5f9', color: '#475569' };
    }
}

document.addEventListener('DOMContentLoaded', loadOrders);
