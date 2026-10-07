let addressDraftPin = null;
let addressPinSnapshot = null;
let addressModalTrigger = null;
const addressField = id => document.getElementById(id);
function addressStorageKey() { return `taladjai_addresses_${Auth.getUser()?.id || 'guest'}`; }
function readSavedAddresses() {
    try { const data = JSON.parse(localStorage.getItem(addressStorageKey()) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; }
}
function renderSavedAddresses() {
    const select = addressField('saved-addresses');
    select.replaceChildren(new Option('กรอกที่อยู่เองในฟอร์มด้านล่าง', ''));
    const addresses = readSavedAddresses();
    addresses.forEach((address, index) => select.add(new Option(`${index + 1}. ${address.label} ของ ${address.name} — ${address.province}${address.isDefault ? ' (ที่อยู่เริ่มต้น)' : ''}`, address.id)));
    addressField('saved-address-status').textContent = addresses.length ? '' : 'ยังไม่มีที่อยู่ที่บันทึกไว้ กรอกในฟอร์มด้านล่าง หรือกดเพิ่มที่อยู่ใหม่';
}
function useSavedAddress(address) {
    addressField('shipping-name').value = address.name;
    addressField('shipping-phone').value = address.phone;
    addressField('shipping-address').value = `${address.detail} ${address.subdistrict} ${address.district} ${address.province} ${address.postcode}`;
    addressField('saved-address-preview').hidden = false;
    addressField('saved-address-label').textContent = `ที่อยู่จัดส่ง: ${address.label}`;
    addressField('saved-address-default').hidden = !address.isDefault;
    addressField('saved-address-name').textContent = address.name;
    addressField('saved-address-phone').textContent = address.phone;
    addressField('saved-address-detail').textContent = addressField('shipping-address').value;
    addressField('saved-address-status').textContent = `เลือกที่อยู่${address.label} ของ ${address.name} แล้ว เติมข้อมูลจัดส่งเรียบร้อย คุณแก้ไขในฟอร์มด้านล่างได้`;
    hasPinned = !!address.coords;
    if (address.coords) { currentPinCoords = {...address.coords}; updatePinnedBadge(); }
    else {
        addressField('pinned-location-badge').style.display = 'none';
        document.querySelector('.shipping-map-preview').classList.remove('has-pin');
        addressField('shipping-map-preview-label').textContent = 'เลือกตำแหน่งจัดส่งบนแผนที่';
    }
}
async function openAddressModal() {
    addressModalTrigger = document.activeElement;
    addressField('new-address-form').reset(); addressDraftPin = null;
    addressField('address-error').textContent = '';
    addressField('address-pin-label').textContent = 'เลือกปักหมุดตำแหน่งจัดส่ง (ไม่บังคับ)';
    addressField('address-name').value = addressField('shipping-name').value;
    addressField('address-phone').value = addressField('shipping-phone').value;
    addressField('address-modal').showModal(); addressField('address-name').focus();
    addressOptions('province', [], 'กำลังโหลดจังหวัด…');
    refreshDistricts();
    const mapButton = document.querySelector('.address-map-button');
    mapButton.disabled = true;
    try {
        await loadThaiAddresses();
        addressOptions('province', thaiAddressData, 'เลือกจังหวัด');
        refreshDistricts();
        mapButton.disabled = false;
    } catch (error) {
        addressField('address-error').textContent = 'โหลดรายการที่อยู่ไม่สำเร็จ กรุณาปิดแล้วเปิดหน้าต่างนี้อีกครั้ง';
    }
}
function closeAddressModal() { addressField('address-modal').close(); }
function openAddressPin() {
    addressPinSnapshot = { coords: {...currentPinCoords}, resolved: currentResolvedAddress, parts: currentResolvedAddressParts, pinned: hasPinned };
    if (addressDraftPin) currentPinCoords = {...addressDraftPin};
    const map = addressField('map-modal'); addressField('address-modal').append(map);
    addressField('new-address-form').inert = true;
    openMapModal(); addressField('map-search-input').focus();
}
function finishAddressPin() {
    if (!addressPinSnapshot) return;
    currentPinCoords = addressPinSnapshot.coords;
    currentResolvedAddress = addressPinSnapshot.resolved;
    currentResolvedAddressParts = addressPinSnapshot.parts;
    hasPinned = addressPinSnapshot.pinned; addressPinSnapshot = null;
    document.body.append(addressField('map-modal'));
    addressField('new-address-form').inert = false;
    document.querySelector('.address-map-button').focus();
}
addressField('address-modal').addEventListener('cancel', event => {
    if (addressPinSnapshot) { event.preventDefault(); closeMapModal(); }
});
addressField('address-modal').addEventListener('close', () => {
    if (addressPinSnapshot) closeMapModal();
    addressModalTrigger?.focus();
});
addressField('new-address-form').addEventListener('submit', event => {
    event.preventDefault();
    const value = id => addressField(`address-${id}`).value.trim();
    const fields = ['name','phone','province','district','subdistrict','postcode','detail'];
    if (fields.some(field => !value(field))) { addressField('address-error').textContent = 'กรุณากรอกข้อมูลให้ครบถ้วน'; return; }
    const address = Object.fromEntries(fields.map(field => [field, value(field)]));
    address.id = crypto.randomUUID(); address.coords = addressDraftPin;
    address.label = document.querySelector('input[name="address-label"]:checked').value;
    address.isDefault = addressField('address-default').checked;
    const addresses = readSavedAddresses();
    if (address.isDefault) addresses.forEach(item => { item.isDefault = false; });
    addresses.push(address);
    try { localStorage.setItem(addressStorageKey(), JSON.stringify(addresses)); }
    catch { addressField('address-error').textContent = 'บันทึกที่อยู่ไม่สำเร็จ กรุณาตรวจพื้นที่จัดเก็บของเบราว์เซอร์'; return; }
    renderSavedAddresses(); addressField('saved-addresses').value = address.id;
    useSavedAddress(address); closeAddressModal();
    window.showToast?.('เพิ่มที่อยู่และเลือกใช้สำหรับจัดส่งแล้ว', 'success');
});
addressField('saved-addresses').addEventListener('change', event => {
    const address = readSavedAddresses().find(item => item.id === event.target.value);
    if (address) useSavedAddress(address);
    else {
        addressField('saved-address-preview').hidden = true;
        addressField('saved-address-status').textContent = 'แก้ไขข้อมูลในฟอร์มด้านล่างได้ ข้อมูลเดิมยังอยู่จนกว่าคุณจะแก้ไข';
    }
});
addressField('read-saved-address').addEventListener('click', () => {
    if (window.A11y?.speak) A11y.speak(`ที่อยู่จัดส่ง ผู้รับ ${addressField('saved-address-name').textContent} โทรศัพท์ ${addressField('saved-address-phone').textContent} ที่อยู่ ${addressField('saved-address-detail').textContent}`);
});
['shipping-name', 'shipping-phone', 'shipping-address'].forEach(id => {
    addressField(id).addEventListener('input', () => {
        addressField('saved-addresses').value = '';
        addressField('saved-address-preview').hidden = true;
        addressField('saved-address-status').textContent = 'กำลังใช้ข้อมูลที่คุณแก้ไขในฟอร์มด้านล่าง';
    });
});
document.addEventListener('DOMContentLoaded', () => {
    renderSavedAddresses();
    const address = readSavedAddresses().find(item => item.isDefault);
    if (address && !sessionStorage.getItem('taladjai_shipping_data')) { useSavedAddress(address); addressField('saved-addresses').value = address.id; }
});

function fillAddressFromMap(parts) {
    if (!parts) {
        addressField('address-error').textContent = 'บันทึกพิกัดแล้ว แต่ดึงชื่อที่อยู่ไม่ได้ กรุณากรอกข้อมูลที่อยู่ด้วยตนเอง';
        return;
    }
    const clean = (value, prefix) => String(value || '').replace(prefix, '').trim();
    const values = {
        province: clean(parts.province || parts.state || (parts.city === 'กรุงเทพมหานคร' ? parts.city : ''), /^จังหวัด\s*/),
        district: clean(parts.district || parts.city_district || parts.county, /^(อำเภอ|เขต)\s*/),
        subdistrict: clean(parts.subdistrict || parts.suburb || parts.quarter, /^(ตำบล|แขวง)\s*/),
        postcode: /^\d{5}$/.test(parts.postcode || '') ? parts.postcode : ''
    };
    const matched = selectMappedAddress(values);
    const detail = [parts.building || parts.amenity, parts.house_number ? `เลขที่ ${parts.house_number}` : '', parts.road, parts.hamlet].filter(Boolean).join(' ');
    // Preserve house / room details the user has already entered.
    if (detail && !addressField('address-detail').value.trim()) addressField('address-detail').value = detail;
    const missing = !matched || !addressField('address-postcode').value || !addressField('address-detail').value.trim();
    addressField('address-error').textContent = missing ? 'เติมข้อมูลที่แผนที่พบแล้ว กรุณาเติมช่องที่ว่างและตรวจสอบบ้านเลขที่ก่อนยืนยัน' : '';
}

