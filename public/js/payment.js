// ==============================================================================
// PAYMENT CONTROLLER (Step 3: Standout Payment Methods & Order Confirmation)
// ==============================================================================

let currentShippingData = null;
let selectedPaymentMethod = 'promptpay';

function initPaymentPage() {
    // 1. Verify Cart
    const items = Cart.getItems();
    if (!items || items.length === 0) {
        if (window.showToast) window.showToast('ไม่มีรายการสินค้าในตะกร้า กำลังนำท่านกลับ...', 'warning');
        setTimeout(() => window.location.href = '/cart.html', 1000);
        return;
    }

    // 2. Verify Auth
    const isLoggedIn = (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));
    if (!isLoggedIn) {
        if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนชำระเงิน', 'warning');
        setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent('/payment.html')}`, 800);
        return;
    }

    // 3. Load Shipping Data from Session
    try {
        currentShippingData = JSON.parse(sessionStorage.getItem('taladjai_shipping_data') || 'null');
    } catch (e) {
        currentShippingData = null;
    }

    if (!currentShippingData || !currentShippingData.shipping_name || !currentShippingData.shipping_address) {
        if (window.showToast) window.showToast('กรุณาระบุข้อมูลการจัดส่งก่อนดำเนินการชำระเงิน', 'warning');
        setTimeout(() => window.location.href = '/shipping.html', 800);
        return;
    }

    // 4. Populate Shipping Details Recap
    const nameEl = document.getElementById('display-shipping-name');
    const phoneEl = document.getElementById('display-shipping-phone');
    const addressEl = document.getElementById('display-shipping-address');

    if (nameEl) nameEl.innerText = currentShippingData.shipping_name;
    if (phoneEl) phoneEl.innerText = `(${currentShippingData.shipping_phone})`;
    if (addressEl) addressEl.innerText = currentShippingData.shipping_address;

    if (currentShippingData.shipping_coords) {
        const coordsBadge = document.getElementById('coords-row');
        if (coordsBadge) {
            coordsBadge.style.display = 'inline-flex';
            coordsBadge.innerText = `พิกัดตำแหน่ง (${currentShippingData.shipping_coords.lat.toFixed(4)}, ${currentShippingData.shipping_coords.lng.toFixed(4)})`;
        }
    }

    if (currentShippingData.shipping_notes) {
        const notesRow = document.getElementById('notes-row');
        if (notesRow) {
            notesRow.style.display = 'block';
            document.getElementById('display-shipping-notes').innerText = currentShippingData.shipping_notes;
        }
    }

    // 5. Render Mini Preview & Totals
    renderItemsPreview(items);
    updateTotals();

    // Set initial payment selection
    selectPaymentMethod('promptpay');
}

function renderItemsPreview(items) {
    const previewContainer = document.getElementById('payment-items-preview');
    if (!previewContainer) return;

    previewContainer.innerHTML = items.map(item => `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
            <img src="${item.image_url}" alt="${item.name}" style="width:44px; height:44px; object-fit:cover; border-radius:6px; flex-shrink:0;">
            <div style="flex-grow:1; min-width:0;">
                <div style="font-size:0.9rem; font-weight:700; color:var(--brand-dark); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${item.name}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted);">
                    ${item.quantity} ชิ้น × ฿${(item.price || 0).toLocaleString()}
                </div>
            </div>
            <div style="font-weight:700; font-size:0.9rem; color:var(--brand-dark); flex-shrink:0;">
                ฿${((item.price || 0) * (item.quantity || 1)).toLocaleString()}
            </div>
        </div>
    `).join('');
}

function updateTotals() {
    const subtotal = Cart.getSubtotal();
    const tip = (currentShippingData && typeof currentShippingData.tip_amount === 'number') ? currentShippingData.tip_amount : 0;
    const shippingCost = (currentShippingData && typeof currentShippingData.shipping_cost === 'number') ? currentShippingData.shipping_cost : 50;
    const grandTotal = subtotal + tip + shippingCost;

    const subtotalEl = document.getElementById('summary-subtotal');
    const tipEl = document.getElementById('summary-tip');
    const grandTotalEl = document.getElementById('summary-grand-total');
    const qrAmountEl = document.getElementById('qr-amount-text');

    if (subtotalEl) subtotalEl.innerText = `฿${subtotal.toLocaleString()}`;
    if (tipEl) tipEl.innerText = `฿${tip.toLocaleString()}`;
    if (grandTotalEl) grandTotalEl.innerText = `฿${grandTotal.toLocaleString()}`;
    if (qrAmountEl) qrAmountEl.innerText = `฿${grandTotal.toLocaleString()}`;

    // Update dynamic button text
    updateConfirmButtonText(grandTotal);
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;

    // 1. Radio check
    const radio = document.querySelector(`input[name="payment_method"][value="${method}"]`);
    if (radio) radio.checked = true;

    // 2. Toggle Cards Visual State
    const methods = ['promptpay', 'credit_card', 'cod'];
    methods.forEach(m => {
        const card = document.getElementById(`pay-card-${m}`);
        if (!card) return;
        const checkIcon = card.querySelector('.check-icon');

        if (m === method) {
            card.style.border = '2.5px solid var(--primary)';
            card.style.background = '#fff9f6';
            card.style.boxShadow = '0 4px 14px rgba(194, 94, 56, 0.14)';
            if (checkIcon) checkIcon.style.display = 'block';
        } else {
            card.style.border = '1.5px solid var(--border-color)';
            card.style.background = 'var(--bg-main)';
            card.style.boxShadow = 'none';
            if (checkIcon) checkIcon.style.display = 'none';
        }
    });

    // 3. Toggle Details Panels
    const panelPromptpay = document.getElementById('panel-promptpay');
    const panelCard = document.getElementById('panel-credit_card');
    const panelCod = document.getElementById('panel-cod');

    if (panelPromptpay) panelPromptpay.style.display = (method === 'promptpay') ? 'block' : 'none';
    if (panelCard) panelCard.style.display = (method === 'credit_card') ? 'block' : 'none';
    if (panelCod) panelCod.style.display = (method === 'cod') ? 'block' : 'none';

    // 4. Update Button text
    const subtotal = Cart.getSubtotal();
    const tip = (currentShippingData && typeof currentShippingData.tip_amount === 'number') ? currentShippingData.tip_amount : 0;
    const shippingCost = (currentShippingData && typeof currentShippingData.shipping_cost === 'number') ? currentShippingData.shipping_cost : 50;
    const grandTotal = subtotal + tip + shippingCost;
    updateConfirmButtonText(grandTotal);
}

function updateConfirmButtonText(grandTotal) {
    const btn = document.getElementById('confirm-order-btn');
    if (!btn) return;

    if (selectedPaymentMethod === 'promptpay') {
        btn.innerHTML = `ยืนยันการชำระเงิน (พร้อมเพย์) • ฿${grandTotal.toLocaleString()}`;
    } else if (selectedPaymentMethod === 'credit_card') {
        btn.innerHTML = `ชำระเงินผ่านบัตรเครดิต • ฿${grandTotal.toLocaleString()}`;
    } else if (selectedPaymentMethod === 'cod') {
        btn.innerHTML = `ยืนยันการสั่งซื้อ (เก็บเงินปลายทาง) • ฿${grandTotal.toLocaleString()}`;
    }
}

// Download PromptPay QR Code
function downloadQrCode() {
    const qrImg = document.getElementById('qr-image');
    if (!qrImg || !qrImg.src) return;

    const a = document.createElement('a');
    a.href = qrImg.src;
    a.download = 'taladjai-promptpay-qr.png';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (window.showToast) {
        window.showToast('เริ่มดาวน์โหลดภาพ QR Code สำหรับชำระเงินแล้ว', 'success');
    }
}

// Copy amount to clipboard
function copyAmountToClipboard() {
    const subtotal = Cart.getSubtotal();
    const tip = (currentShippingData && typeof currentShippingData.tip_amount === 'number') ? currentShippingData.tip_amount : 0;
    const shippingCost = (currentShippingData && typeof currentShippingData.shipping_cost === 'number') ? currentShippingData.shipping_cost : 50;
    const grandTotal = subtotal + tip + shippingCost;

    navigator.clipboard.writeText(grandTotal.toString()).then(() => {
        if (window.showToast) {
            window.showToast(`คัดลอกยอดเงิน ฿${grandTotal.toLocaleString()} เรียบร้อยแล้ว`, 'info');
        }
    }).catch(() => {
        if (window.showToast) {
            window.showToast(`ยอดเงิน: ฿${grandTotal.toLocaleString()}`, 'info');
        }
    });
}

// Submit final order to API
async function submitFinalOrder() {
    const items = Cart.getItems();
    if (!items || items.length === 0) {
        if (window.showToast) window.showToast('ไม่มีรายการสินค้าในตะกร้า', 'error');
        return;
    }

    if (!currentShippingData) {
        if (window.showToast) window.showToast('ไม่พบข้อมูลการจัดส่ง กรุณากรอกใหม่อีกครั้ง', 'error');
        setTimeout(() => window.location.href = '/shipping.html', 800);
        return;
    }

    const confirmBtn = document.getElementById('confirm-order-btn');
    confirmBtn.innerText = 'กำลังประมวลผลคำสั่งซื้อ...';
    confirmBtn.disabled = true;

    try {
        const payload = {
            items: items.map(i => ({ product_id: i.id, quantity: i.quantity })),
            tip_amount: currentShippingData.tip_amount || 0,
            shipping_name: currentShippingData.shipping_name,
            shipping_phone: currentShippingData.shipping_phone,
            shipping_address: currentShippingData.shipping_address,
            payment_method: selectedPaymentMethod,
            notes: currentShippingData.shipping_notes || ''
        };

        const res = await API.post('/orders', payload);

        if (res.success) {
            // Clean up cart & session
            Cart.clear();
            sessionStorage.removeItem('taladjai_shipping_data');

            if (window.showToast) {
                window.showToast('สร้างคำสั่งซื้อและยืนยันการชำระเงินเรียบร้อยแล้ว ขอขอบพระคุณสำหรับทุกการสนับสนุน', 'success', 4000);
            }

            setTimeout(() => {
                window.location.href = `/orders.html?id=${res.order_id}`;
            }, 1000);
        } else {
            throw new Error(res.message || 'ไม่สามารถสร้างคำสั่งซื้อได้');
        }
    } catch (err) {
        confirmBtn.disabled = false;
        const subtotal = Cart.getSubtotal();
        const tip = (currentShippingData && typeof currentShippingData.tip_amount === 'number') ? currentShippingData.tip_amount : 0;
        const shippingCost = (currentShippingData && typeof currentShippingData.shipping_cost === 'number') ? currentShippingData.shipping_cost : 50;
        updateConfirmButtonText(subtotal + tip + shippingCost);

        if (window.showToast) {
            window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
        } else {
            alert(`เกิดข้อผิดพลาด: ${err.message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', initPaymentPage);
