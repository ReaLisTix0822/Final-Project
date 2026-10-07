const addressField = id => document.getElementById(id);
const addressStorageKey = () => `taladjai_addresses_${Auth.getUser()?.id || 'guest'}`;
let editingAddress = null;
let addressModalTrigger = null;
function readSavedAddresses() {
    try { const rows = JSON.parse(localStorage.getItem(addressStorageKey()) || '[]'); return Array.isArray(rows) ? rows : []; }
    catch { return []; }
}
function saveManagedAddresses(rows) {
    try { localStorage.setItem(addressStorageKey(), JSON.stringify(rows)); return true; }
    catch { addressField('address-manager-status').textContent = 'บันทึกไม่สำเร็จ กรุณาตรวจพื้นที่จัดเก็บของเบราว์เซอร์'; return false; }
}
function renderManagedAddresses() {
    const list = addressField('managed-address-list');
    list.replaceChildren();
    const rows = readSavedAddresses();
    if (!rows.length) {
        const empty = document.createElement('p'); empty.className = 'address-empty';
        empty.textContent = 'ยังไม่มีที่อยู่จัดส่ง กด “เพิ่มที่อยู่ใหม่” เพื่อบันทึกที่อยู่ของคุณ'; list.append(empty); return;
    }
    rows.forEach(address => {
        const card = document.createElement('article'); card.className = 'managed-address-card';
        const heading = document.createElement('h2'); heading.textContent = address.label || 'ที่อยู่จัดส่ง'; card.append(heading);
        if (address.isDefault) { const badge = document.createElement('span'); badge.className = 'address-default-badge'; badge.textContent = '✓ ที่อยู่เริ่มต้น'; card.append(badge); }
        const details = document.createElement('dl');
        [['ผู้รับ', address.name], ['โทรศัพท์', address.phone], ['ที่อยู่', `${address.detail} ${address.subdistrict} ${address.district} ${address.province} ${address.postcode}`]].forEach(([label, value]) => {
            const dt = document.createElement('dt'); dt.textContent = label;
            const dd = document.createElement('dd'); dd.textContent = value; details.append(dt, dd);
        }); card.append(details);
        const actions = document.createElement('div'); actions.className = 'managed-address-actions';
        const action = (label, callback) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-outline'; button.textContent = label; button.setAttribute('aria-label', `${label} ${address.label} ของ ${address.name}`); button.addEventListener('click', callback); actions.append(button); };
        action('แก้ไข', () => openAddressModal(address));
        if (!address.isDefault) action('ใช้เป็นที่อยู่เริ่มต้น', () => {
            const next = readSavedAddresses().map(item => ({...item, isDefault: item.id === address.id}));
            if (saveManagedAddresses(next)) { renderManagedAddresses(); addressField('address-manager-status').textContent = `ตั้งที่อยู่ ${address.label} ของ ${address.name} เป็นที่อยู่เริ่มต้นแล้ว`; addressField('add-managed-address').focus(); }
        });
        action('ฟังที่อยู่', () => window.A11y?.speak(`${address.name} โทรศัพท์ ${address.phone} ${address.detail} ${address.subdistrict} ${address.district} ${address.province} ${address.postcode}`));
        action('ลบ', () => {
            if (!window.confirm(`ลบที่อยู่ ${address.label} ของ ${address.name} ใช่หรือไม่?`)) return;
            const next = readSavedAddresses().filter(item => item.id !== address.id);
            if (saveManagedAddresses(next)) { renderManagedAddresses(); addressField('address-manager-status').textContent = 'ลบที่อยู่แล้ว'; addressField('add-managed-address').focus(); }
        });
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
window.addEventListener('storage', event => { if (event.key === addressStorageKey()) renderManagedAddresses(); });
renderManagedAddresses();
