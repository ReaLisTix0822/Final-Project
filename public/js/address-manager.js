const addressField = id => document.getElementById(id);
let editingAddress = null;
let addressModalTrigger = null;
function readSavedAddresses() { return AddressBook.read(); }
function saveManagedAddresses(rows) {
    if (AddressBook.save(rows)) return true;
    addressField('address-manager-status').textContent = 'บันทึกไม่สำเร็จ กรุณาตรวจพื้นที่จัดเก็บของเบราว์เซอร์'; return false;
}
const addressIcons = {
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    listen: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    delete: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'
};
const addressIcon = name => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${addressIcons[name]}</svg>`;
// Decorative map thumbnail (the real pin is chosen in the address form)
const addressMapThumb = () => `<svg viewBox="0 0 190 150" aria-hidden="true" focusable="false"><rect width="190" height="150" fill="#e8f0dc"/><path d="M0 38h190M0 76h190M0 114h190M38 0v150M76 0v150M114 0v150M152 0v150" stroke="#d6e4c4" stroke-width="1"/><path d="M-10 120 200 70" stroke="#fff" stroke-width="12"/><path d="M95 -10 70 160" stroke="#fff" stroke-width="10"/><path d="M92 38c-9 0-16 7-16 16 0 12 16 28 16 28s16-16 16-28c0-9-7-16-16-16Z" style="fill:var(--color-primary)"/><circle cx="92" cy="54" r="6" fill="#e8f0dc"/></svg>`;
const formatAddressLine = address => [address.detail, address.subdistrict, address.district, address.province, address.postcode].filter(Boolean).join(' ');

function renderAddressSummary(rows) {
    addressField('address-summary-count').textContent = rows.length.toLocaleString('th-TH');
    addressField('address-summary-default').textContent = rows.find(item => item.isDefault)?.label || '—';
}

async function loadActiveOrderCount() {
    try {
        const res = await API.get('/orders/my-orders');
        const active = ['pending', 'paid', 'preparing', 'processing', 'shipped'];
        addressField('address-summary-orders').textContent = (res.data || []).filter(order => active.includes(order.status)).length.toLocaleString('th-TH');
    } catch {
        addressField('address-summary-orders').textContent = '—';
    }
}

function renderManagedAddresses() {
    const list = addressField('managed-address-list');
    list.replaceChildren();
    const rows = readSavedAddresses();
    renderAddressSummary(rows);
    if (!rows.length) {
        const empty = document.createElement('p'); empty.className = 'address-empty';
        empty.textContent = 'ยังไม่มีที่อยู่จัดส่ง กด “เพิ่มที่อยู่ใหม่” เพื่อบันทึกที่อยู่ของคุณ'; list.append(empty); return;
    }
    rows.forEach(address => {
        const card = document.createElement('article'); card.className = `managed-address-card${address.isDefault ? ' is-default' : ''}`;
        const header = document.createElement('header'); header.className = 'managed-address-header';
        const heading = document.createElement('h2'); heading.textContent = address.label || 'ที่อยู่จัดส่ง'; header.append(heading);
        if (address.isDefault) { const badge = document.createElement('span'); badge.className = 'address-default-badge'; badge.textContent = '✓ ที่อยู่เริ่มต้น'; header.append(badge); }
        card.append(header);
        const body = document.createElement('div'); body.className = 'managed-address-body';
        const map = document.createElement('div'); map.className = 'address-map-thumb'; map.innerHTML = addressMapThumb(); body.append(map);
        const details = document.createElement('dl');
        [['ผู้รับ', address.name], ['โทรศัพท์', address.phone], ['ที่อยู่', formatAddressLine(address)]].forEach(([label, value]) => {
            const dt = document.createElement('dt'); dt.textContent = label;
            const dd = document.createElement('dd'); dd.textContent = value || '—'; details.append(dt, dd);
        }); body.append(details); card.append(body);
        const actions = document.createElement('div'); actions.className = 'managed-address-actions';
        const action = (label, callback, icon, extraClass = '') => { const button = document.createElement('button'); button.type = 'button'; button.className = `address-action-btn ${extraClass}`.trim(); button.innerHTML = `${addressIcon(icon)}<span></span>`; button.querySelector('span').textContent = label; button.setAttribute('aria-label', `${label} ${address.label} ของ ${address.name}`); button.addEventListener('click', callback); actions.append(button); };
        action('แก้ไข', () => openAddressModal(address), 'edit');
        if (!address.isDefault) action('ใช้เป็นที่อยู่เริ่มต้น', () => {
            const next = readSavedAddresses().map(item => ({...item, isDefault: item.id === address.id}));
            if (saveManagedAddresses(next)) { renderManagedAddresses(); addressField('address-manager-status').textContent = `ตั้งที่อยู่ ${address.label} ของ ${address.name} เป็นที่อยู่เริ่มต้นแล้ว`; addressField('add-managed-address').focus(); }
        }, 'star');
        action('ฟังที่อยู่', () => window.A11y?.speak(`${address.name} โทรศัพท์ ${address.phone} ${formatAddressLine(address)}`), 'listen');
        action('ลบ', () => {
            if (!window.confirm(`ลบที่อยู่ ${address.label} ของ ${address.name} ใช่หรือไม่?`)) return;
            const next = readSavedAddresses().filter(item => item.id !== address.id);
            if (saveManagedAddresses(next)) { renderManagedAddresses(); addressField('address-manager-status').textContent = 'ลบที่อยู่แล้ว'; addressField('add-managed-address').focus(); }
        }, 'delete', 'is-danger');
        card.append(actions); list.append(card);
    });
}
async function openAddressModal(address = null) {
    addressModalTrigger = document.activeElement; editingAddress = address;
    const form = addressField('new-address-form'); form.reset();
    addressField('address-modal-title').textContent = address ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่';
    addressField('address-error').textContent = '';
    addressField('address-name').value = address?.name || Auth.getUser()?.full_name || '';
    addressField('address-phone').value = address?.phone || Auth.getUser()?.phone || '';
    addressField('address-detail').value = address?.detail || '';
    addressField('address-default').checked = address ? !!address.isDefault : !readSavedAddresses().length;
    form.querySelectorAll('[name="address-label"]').forEach(input => { input.checked = input.value === (address?.label || 'บ้าน'); });
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    addressOptions('province', [], 'กำลังโหลดจังหวัด…'); refreshDistricts();
    addressField('address-modal').showModal(); addressField('address-name').focus();
    try {
        await loadThaiAddresses(); addressOptions('province', thaiAddressData, 'เลือกจังหวัด'); refreshDistricts();
        if (address) { selectMappedAddress(address); addressField('address-postcode').value = address.postcode || ''; }
        submit.disabled = false;
    } catch { addressField('address-error').textContent = 'โหลดจังหวัดไม่สำเร็จ กรุณาปิดแล้วเปิดหน้าต่างอีกครั้ง'; }
}
function closeAddressModal() { addressField('address-modal').close(); }
addressField('address-modal').addEventListener('close', () => { (addressModalTrigger?.isConnected ? addressModalTrigger : addressField('add-managed-address')).focus(); });
addressField('add-managed-address').addEventListener('click', () => openAddressModal());
addressField('add-managed-address-card').addEventListener('click', () => openAddressModal());
addressField('new-address-form').addEventListener('submit', event => {
    event.preventDefault();
    const fields = ['name','phone','province','district','subdistrict','postcode','detail'];
    const entry = Object.fromEntries(fields.map(field => [field, addressField(`address-${field}`).value.trim()]));
    if (fields.some(field => !entry[field])) { addressField('address-error').textContent = 'กรุณากรอกข้อมูลให้ครบถ้วน'; return; }
    const rows = readSavedAddresses();
    entry.id = editingAddress?.id || crypto.randomUUID();
    entry.coords = editingAddress?.coords || null;
    // An edited physical address must not retain a pin for the previous location.
    if (editingAddress && ['province','district','subdistrict','postcode','detail'].some(field => entry[field] !== editingAddress[field])) entry.coords = null;
    entry.label = document.querySelector('[name="address-label"]:checked').value;
    entry.isDefault = addressField('address-default').checked;
    const next = rows.filter(item => item.id !== entry.id).map(item => entry.isDefault ? {...item, isDefault: false} : item);
    next.push(entry);
    if (!saveManagedAddresses(next)) { addressField('address-error').textContent = 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'; return; }
    renderManagedAddresses(); closeAddressModal();
    addressField('address-manager-status').textContent = editingAddress ? 'บันทึกการแก้ไขที่อยู่แล้ว' : 'เพิ่มที่อยู่แล้ว สามารถเลือกใช้ในหน้าข้อมูลจัดส่งได้';
});
window.addEventListener('storage', event => { if (event.key === AddressBook.key()) renderManagedAddresses(); });
renderManagedAddresses();
AddressBook.load().then(renderManagedAddresses);
loadActiveOrderCount();
