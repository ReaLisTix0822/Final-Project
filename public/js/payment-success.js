const confirmationField = id => document.getElementById(`confirmation-${id}`);
const confirmationMoney = value => new Intl.NumberFormat('th-TH', {style:'currency', currency:'THB'}).format(Number(value) || 0);
let confirmationSpeech = '';
async function loadConfirmation() {
    if (!Auth.isLoggedIn()) {
        window.location.replace(`/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
    }
    confirmationField('status').textContent = 'กำลังตรวจสอบข้อมูลคำสั่งซื้อ…';
    confirmationField('result').hidden = true;
    confirmationField('error').hidden = true;
    try {
        const id = new URLSearchParams(window.location.search).get('id');
        if (!id || !/^\d+$/.test(id)) throw new Error('ไม่พบหมายเลขคำสั่งซื้อ กรุณาเลือกจากหน้าคำสั่งซื้อของฉัน');
        const response = await API.get(`/orders/${encodeURIComponent(id)}`);
        if (!response.success || !response.data) throw new Error('ไม่พบข้อมูลคำสั่งซื้อ');
        const order = response.data;
        const cod = order.payment_method === 'cod';
        const paid = !cod && ['paid','preparing','processing','shipped','delivered','completed'].includes(order.status);
        const cancelled = order.status === 'cancelled';
        const title = cancelled ? 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว' : paid ? 'ชำระเงินสำเร็จแล้ว' : cod ? 'สั่งซื้อสำเร็จแล้ว' : 'รอยืนยันการชำระเงิน';
        const message = cancelled ? 'ดูรายละเอียดเพิ่มเติมได้ในหน้าคำสั่งซื้อของฉัน' : paid ? 'ระบบบันทึกการชำระเงินของคุณแล้ว สามารถติดตามสถานะคำสั่งซื้อได้ด้านล่าง' : cod ? 'ชำระเงินกับเจ้าหน้าที่เมื่อได้รับสินค้า' : 'ระบบยังไม่ยืนยันว่าชำระเงินสำเร็จ กรุณาตรวจสอบสถานะในหน้าคำสั่งซื้อ';
        confirmationField('title').textContent = title;
        document.title = `${title} | ตลาดใจ`;
        confirmationField('message').textContent = message;
        document.querySelector('.confirmation-icon').hidden = cancelled || (!paid && !cod);
        confirmationField('id').textContent = `#${order.id}`;
        for (const [field,value] of Object.entries({subtotal:order.subtotal, shipping:order.shipping_cost, tip:order.tip_amount, total:order.grand_total})) confirmationField(field).textContent = confirmationMoney(value);
        for (const [field,value] of Object.entries({name:order.shipping_name,phone:order.shipping_phone,address:order.shipping_address,carrier:order.courier_name})) confirmationField(field).textContent = value || '—';
        const method = {promptpay:'พร้อมเพย์ (PromptPay)',credit_card:'บัตรเครดิต / บัตรเดบิต',cod:'เก็บเงินปลายทาง'}[order.payment_method] || 'ไม่ระบุ';
        confirmationField('method').textContent = method;
        confirmationField('next').textContent = cancelled ? 'ตรวจสอบรายการอื่นได้จากหน้าคำสั่งซื้อของฉัน' : 'ติดตามการเตรียมสินค้า การจัดส่ง และหมายเลขพัสดุได้ที่ “ติดตามคำสั่งซื้อ”';
        confirmationField('track').href = `/profile.html?tab=${cancelled ? 'history' : 'tracking'}&id=${encodeURIComponent(order.id)}`;
        const list = confirmationField('items'); list.replaceChildren();
        (order.items || []).forEach(item => {
            const row = document.createElement('div'); row.className = 'confirmation-item';
            const name = document.createElement('strong'); name.textContent = item.product_name;
            const detail = document.createElement('span'); detail.textContent = `${item.quantity} ชิ้น × ${confirmationMoney(item.unit_price)}`;
            const amount = document.createElement('span'); amount.textContent = confirmationMoney(item.subtotal);
            row.append(name, detail, amount); list.append(row);
        });
        confirmationSpeech = `${title} หมายเลขคำสั่งซื้อ ${order.id} ยอดรวม ${confirmationMoney(order.grand_total)} ${method} ${message} จัดส่งถึง ${order.shipping_name} ${order.shipping_address}`;
        confirmationField('result').hidden = false;
        confirmationField('status').textContent = '';
        confirmationField('title').focus();
    } catch (error) {
        confirmationField('status').textContent = '';
        confirmationField('error').hidden = false;
        confirmationField('error-message').textContent = error.message || 'โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง';
    }
}
confirmationField('retry').addEventListener('click', loadConfirmation);
confirmationField('read').addEventListener('click', () => window.A11y?.speak(confirmationSpeech));
document.addEventListener('DOMContentLoaded', loadConfirmation);
