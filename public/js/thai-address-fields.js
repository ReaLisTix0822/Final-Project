let thaiAddressData = null;
let thaiAddressLoading = null;
function loadThaiAddresses() {
    if (!thaiAddressLoading) thaiAddressLoading = fetch('/data/thai-addresses.json')
        .then(response => { if (!response.ok) throw new Error('โหลดข้อมูลที่อยู่ไม่สำเร็จ'); return response.json(); })
        .then(data => { thaiAddressData = data; return data; })
        .catch(error => { thaiAddressLoading = null; throw error; });
    return thaiAddressLoading;
}
function addressOptions(field, rows, placeholder) {
    const select = addressField(`address-${field}`);
    select.replaceChildren(new Option(placeholder, ''));
    [...rows].sort((a, b) => a.name.localeCompare(b.name, 'th')).forEach(row => select.add(new Option(row.name, row.name)));
    select.disabled = !rows.length;
}
function selectedProvince() { return thaiAddressData?.find(row => row.name === addressField('address-province').value); }
function selectedDistrict() { return selectedProvince()?.districts.find(row => row.name === addressField('address-district').value); }
function refreshDistricts() {
    addressOptions('district', selectedProvince()?.districts || [], 'เลือกเขต / อำเภอ');
    refreshSubdistricts();
}
function refreshSubdistricts() {
    addressOptions('subdistrict', selectedDistrict()?.subdistricts || [], 'เลือกแขวง / ตำบล');
    addressField('address-postcode').value = '';
}
function refreshPostcode() {
    addressField('address-postcode').value = selectedDistrict()?.subdistricts.find(row => row.name === addressField('address-subdistrict').value)?.postcode || '';
}
addressField('address-province').addEventListener('change', refreshDistricts);
addressField('address-district').addEventListener('change', refreshSubdistricts);
addressField('address-subdistrict').addEventListener('change', refreshPostcode);
function selectMappedAddress(values) {
    const normalize = value => String(value || '').replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง)\s*/, '').replace(/\s/g, '').replace(/^(กรุงเทพฯ|กรุงเทพ|Bangkok)$/i, 'กรุงเทพมหานคร');
    const match = (rows, name) => rows?.find(row => normalize(row.name) === normalize(name));
    const province = match(thaiAddressData, values.province);
    addressField('address-province').value = province?.name || '';
    refreshDistricts();
    const district = match(province?.districts, values.district);
    addressField('address-district').value = district?.name || '';
    refreshSubdistricts();
    const subdistrict = match(district?.subdistricts, values.subdistrict);
    addressField('address-subdistrict').value = subdistrict?.name || '';
    refreshPostcode();
    return !!(province && district && subdistrict);
}
