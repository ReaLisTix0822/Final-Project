// ==============================================================================
// CART CONTROLLER (Step 1: Order Items Only)
// Handles rendering items in cart, quantity adjustments, and routing to shipping
// ==============================================================================

function initCartPage() {
    renderCart();
}

function renderCart() {
    const items = Cart.getItems();
    const emptyView = document.getElementById('cart-empty-view');
    const contentView = document.getElementById('cart-content-view');
    const itemsList = document.getElementById('cart-items-list');

    if (!items || items.length === 0) {
        if (emptyView) emptyView.style.display = 'block';
        if (contentView) contentView.style.display = 'none';
        const countText = document.getElementById('cart-item-count-text');
        if (countText) countText.innerText = '';
        return;
    }

    if (emptyView) emptyView.style.display = 'none';
    if (contentView) contentView.style.display = 'grid';

    const countText = document.getElementById('cart-item-count-text');
    const totalPieces = Cart.getCount();
    if (countText) countText.innerText = `(${items.length} รายการ | รวม ${totalPieces} ชิ้น)`;

    itemsList.innerHTML = items.map(item => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        return `
            <div style="display:flex; align-items:center; gap:16px; border-bottom:1px solid var(--border-color); padding-bottom:1.25rem;">
                <a href="/product-detail.html?id=${item.id}" style="flex-shrink:0;">
                    <img src="${item.image_url}" alt="${item.name}" style="width:84px; height:84px; object-fit:cover; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                </a>
                <div style="flex-grow:1; min-width:0;">
                    <div style="font-size:0.8rem; color:var(--primary); font-weight:700; margin-bottom:2px;">
                        ${item.store_name || 'ช่างฝีมือตลาดใจ'}
                    </div>
                    <h3 style="font-size:1.05rem; margin:0 0 4px; line-height:1.4;">
                        <a href="/product-detail.html?id=${item.id}" style="color:var(--brand-dark); text-decoration:none;">
                            ${item.name}
                        </a>
                    </h3>
                    <div style="font-size:0.9rem; color:var(--text-muted);">
                        ราคา: ฿${(item.price || 0).toLocaleString()} / ชิ้น
                    </div>
                </div>

                <!-- Quantity Control -->
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
                    <div style="display:flex; align-items:center; border:1px solid var(--border-color); border-radius:var(--radius-full); overflow:hidden; background:white;">
                        <button type="button" onclick="changeQty(${item.id}, -1)" class="btn btn-sm" style="padding:4px 10px; min-height:32px; border-radius:0; border:none; background:var(--bg-secondary); color:var(--brand-dark);" aria-label="ลดจำนวน">
                            -
                        </button>
                        <span style="font-weight:700; min-width:32px; text-align:center; font-size:0.95rem;">${item.quantity}</span>
                        <button type="button" onclick="changeQty(${item.id}, 1)" class="btn btn-sm" style="padding:4px 10px; min-height:32px; border-radius:0; border:none; background:var(--bg-secondary); color:var(--brand-dark);" aria-label="เพิ่มจำนวน">
                            +
                        </button>
                    </div>
                    <div style="font-size:1rem; font-weight:800; color:var(--brand-dark);">
                        ฿${itemTotal.toLocaleString()}
                    </div>
                </div>

                <!-- Delete button -->
                <button type="button" onclick="removeItem(${item.id})" class="btn btn-sm" style="color:#ef4444; background:transparent; border:none; padding:6px; cursor:pointer; flex-shrink:0;" title="ลบสินค้านี้ออกจากตะกร้า" aria-label="ลบสินค้านี้">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
    }).join('');

    updateTotals();
}

function changeQty(id, delta) {
    const items = Cart.getItems();
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
        if (confirm(`คุณต้องการนำ "${item.name}" ออกจากตะกร้าหรือไม่?`)) {
            Cart.removeItem(id);
        }
    } else {
        Cart.updateQuantity(id, newQty);
    }
    renderCart();
}

function removeItem(id) {
    Cart.removeItem(id);
    renderCart();
    if (window.showToast) {
        window.showToast('นำสินค้าออกจากตะกร้าแล้ว', 'info');
    }
}

function clearCart() {
    if (confirm('คุณต้องการลบสินค้าทั้งหมดออกจากตะกร้าหรือไม่?')) {
        Cart.clear();
        renderCart();
        if (window.showToast) {
            window.showToast('ล้างตะกร้าสินค้าเรียบร้อยแล้ว', 'info');
        }
    }
}

function updateTotals() {
    const items = Cart.getItems();
    const subtotal = Cart.getSubtotal();
    const pieces = Cart.getCount();

    const subtotalEl = document.getElementById('summary-subtotal');
    const itemsCountEl = document.getElementById('summary-items-count');
    const piecesCountEl = document.getElementById('summary-pieces-count');

    if (subtotalEl) subtotalEl.innerText = `฿${subtotal.toLocaleString()}`;
    if (itemsCountEl) itemsCountEl.innerText = `${items.length} รายการ`;
    if (piecesCountEl) piecesCountEl.innerText = `${pieces} ชิ้น`;
}

function goToShipping() {
    const items = Cart.getItems();
    if (!items || items.length === 0) {
        if (window.showToast) window.showToast('ไม่มีรายการสินค้าในตะกร้า', 'warning');
        return;
    }

    const isLoggedIn = (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));

    if (!isLoggedIn) {
        if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนระบุข้อมูลจัดส่งและชำระเงิน', 'warning');
        setTimeout(() => {
            window.location.href = `/login.html?redirect=${encodeURIComponent('/shipping.html')}`;
        }, 800);
        return;
    }

    window.location.href = '/shipping.html';
}

document.addEventListener('DOMContentLoaded', initCartPage);
