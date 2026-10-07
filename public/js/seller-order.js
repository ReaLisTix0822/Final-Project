let managedOrder = null;
async function initSellerOrder() {
    if (!Auth.isLoggedIn()) {
        window.location.replace('/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
        return;
    }
    const status = document.getElementById('order-page-status');
    if (!['seller', 'admin'].includes(Auth.getUser().role)) {
        status.textContent = 'หน้านี้สำหรับผู้ขายและผู้ดูแลระบบเท่านั้น';
        return;
    }
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^\d+$/.test(id)) { status.textContent = 'ไม่พบหมายเลขคำสั่งซื้อที่ถูกต้อง'; return; }
    try {
        const result = await API.get('/orders/' + encodeURIComponent(id));
        if (!result.success || !result.data) throw new Error(result.message || 'ไม่พบคำสั่งซื้อ');
        managedOrder = result.data;
        renderOrderDetails(managedOrder);
        document.getElementById('order-page-content').hidden = false;
        status.textContent = '';
    } catch (error) { status.textContent = 'โหลดคำสั่งซื้อไม่สำเร็จ: ' + error.message; }
}
function renderOrderDetails(order) {
    const setText = (id, value) => { document.getElementById(id).textContent = value || '—'; };
    const money = value => Number(value || 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB' });
    setText('order-recipient-name', order.shipping_name || order.buyer_name);
    setText('order-recipient-phone', order.shipping_phone);
    setText('order-recipient-address', order.shipping_address);
    const items = document.getElementById('order-items');
    items.replaceChildren();
    (order.items || []).forEach(item => {
        const row = document.createElement('li');
        row.className = 'order-item';
        const name = document.createElement('div');
        name.className = 'order-item-name';
        const product = document.createElement('div');
        product.className = 'order-item-product';
        if (item.product_image) {
            const image = document.createElement('img');
            image.className = 'order-item-thumbnail';
            image.alt = '';
            image.width = 48;
            image.height = 48;
            image.loading = 'lazy';
            image.onerror = () => image.remove();
            image.src = item.product_image;
            product.append(image);
        }
        product.append(name);
        const title = document.createElement('strong');
        const parts = String(item.product_name || 'สินค้า').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        title.textContent = parts ? parts[1] : item.product_name || 'สินค้า';
        name.append(title);
        if (parts) {
            const subtitle = document.createElement('span');
            subtitle.textContent = parts[2];
            name.append(subtitle);
        }
        const quantity = document.createElement('span');
        quantity.className = 'order-item-quantity';
        quantity.textContent = `${Number(item.quantity) || 0} ชิ้น × ${money(item.unit_price)}`;
        const amount = document.createElement('strong');
        amount.className = 'order-item-amount';
        amount.textContent = money(item.subtotal);
        row.append(product, quantity, amount);
        items.append(row);
    });
    if (!items.children.length) {
        const empty = document.createElement('li');
        empty.textContent = 'ไม่มีรายการสินค้า';
        items.append(empty);
    }
    setText('order-subtotal', money(order.subtotal));
    setText('order-shipping-cost', money(order.shipping_cost));
    setText('order-tip', money(order.tip_amount));
    setText('order-grand-total', money(order.grand_total));
    document.getElementById('order-notes-section').hidden = !order.notes;
    setText('order-notes', order.notes);
    document.getElementById('order-breadcrumb').textContent = 'รายละเอียด #ORD-' + order.id;
    document.title = 'รายละเอียดคำสั่งซื้อ #ORD-' + order.id + ' | ตลาดใจ';
    document.getElementById('ship-order-id').value = order.id;
    document.getElementById('ship-status-select').value = order.status;
    document.getElementById('ship-tracking').value = order.tracking_number || '';
    document.getElementById('ship-courier').value = order.courier_name || '';
}
async function handleSaveShipping(event) {
    event.preventDefault();
    if (!managedOrder) return;
    const button = event.target.querySelector('button[type="submit"]');
    const message = document.getElementById('order-save-status');
    button.disabled = true;
    message.textContent = 'กำลังบันทึก...';
    try {
        const payload = {
            status: document.getElementById('ship-status-select').value,
            tracking_number: document.getElementById('ship-tracking').value.trim(),
            courier_name: document.getElementById('ship-courier').value.trim()
        };
        if (!payload.status) throw new Error('กรุณาเลือกสถานะคำสั่งซื้อ');
        const result = await API.put('/orders/' + encodeURIComponent(managedOrder.id) + '/status', payload);
        if (!result.success) throw new Error(result.message || 'บันทึกไม่สำเร็จ');
        managedOrder = { ...managedOrder, ...payload };
        message.textContent = 'บันทึกคำสั่งซื้อเรียบร้อยแล้ว';
    } catch (error) { message.textContent = 'บันทึกไม่สำเร็จ: ' + error.message; }
    finally { button.disabled = false; }
}
initSellerOrder();
