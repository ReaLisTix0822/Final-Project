// ==============================================================================
// SHIPPING CONTROLLER (Step 2: Shipping Information & Interactive Map Pin)
// Handles address pre-filling, map pinning with Leaflet, and geocoding
// ==============================================================================

let currentTip = 100;
const shippingCost = 50;

// Map & Geolocation State
let leafletMap = null;
let pinMarker = null;
let currentPinCoords = { lat: 13.7563, lng: 100.5018 }; // Default: Bangkok
let currentResolvedAddress = '';
let hasPinned = false;

function initShippingPage() {
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
        if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนระบุข้อมูลจัดส่ง', 'warning');
        setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent('/shipping.html')}`, 800);
        return;
    }

    // 3. Render items preview
    renderItemsPreview(items);

    // 4. Prefill Form
    prefillShippingForm();

    // 5. Setup custom tip input listener
    const customTipInput = document.getElementById('custom-tip-input');
    if (customTipInput) {
        customTipInput.addEventListener('input', () => {
            const val = parseFloat(customTipInput.value) || 0;
            setTip(val, true);
        });
    }

    updateTotals();

    // Close map modal when clicking outside content
    const mapModal = document.getElementById('map-modal');
    if (mapModal) {
        mapModal.addEventListener('click', (e) => {
            if (e.target === mapModal) closeMapModal();
        });
    }
}

function renderItemsPreview(items) {
    const previewContainer = document.getElementById('shipping-items-preview');
    if (!previewContainer) return;

    previewContainer.innerHTML = items.map(item => `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
            <img src="${item.image_url}" alt="${item.name}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; flex-shrink:0;">
            <div style="flex-grow:1; min-width:0;">
                <div style="font-size:0.9rem; font-weight:700; color:var(--brand-dark); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${item.name}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted);">
                    จำนวน: ${item.quantity} ชิ้น × ฿${(item.price || 0).toLocaleString()}
                </div>
            </div>
            <div style="font-weight:700; font-size:0.9rem; color:var(--brand-dark); flex-shrink:0;">
                ฿${((item.price || 0) * (item.quantity || 1)).toLocaleString()}
            </div>
        </div>
    `).join('');
}

function prefillShippingForm() {
    // Check if previously entered in this session
    try {
        const saved = JSON.parse(sessionStorage.getItem('taladjai_shipping_data') || '{}');
        if (saved.shipping_name) document.getElementById('shipping-name').value = saved.shipping_name;
        if (saved.shipping_phone) document.getElementById('shipping-phone').value = saved.shipping_phone;
        if (saved.shipping_address) document.getElementById('shipping-address').value = saved.shipping_address;
        if (saved.shipping_notes) document.getElementById('shipping-notes').value = saved.shipping_notes;
        if (saved.shipping_coords) {
            currentPinCoords = saved.shipping_coords;
            hasPinned = true;
            updatePinnedBadge();
        }
        if (typeof saved.tip_amount === 'number') {
            setTip(saved.tip_amount);
            return;
        }
    } catch (e) {
        // ignore
    }

    // Otherwise prefill from current logged-in user
    if (window.Auth && Auth.getUser) {
        const user = Auth.getUser();
        if (user) {
            const nameEl = document.getElementById('shipping-name');
            const phoneEl = document.getElementById('shipping-phone');
            const addressEl = document.getElementById('shipping-address');

            if (nameEl && !nameEl.value) nameEl.value = user.full_name || '';
            if (phoneEl && !phoneEl.value) phoneEl.value = user.phone || '';
            if (addressEl && !addressEl.value && user.bio) addressEl.value = user.bio;
        }
    }
}

function setTip(amount, isCustom = false) {
    currentTip = Math.max(0, amount);
    
    document.querySelectorAll('.tip-btn').forEach(btn => {
        const val = parseFloat(btn.getAttribute('data-tip'));
        if (!isCustom && val === amount) {
            btn.classList.add('btn-primary', 'active');
            btn.classList.remove('btn-outline');
        } else {
            btn.classList.remove('btn-primary', 'active');
            btn.classList.add('btn-outline');
        }
    });

    if (!isCustom) {
        const customInput = document.getElementById('custom-tip-input');
        if (customInput) customInput.value = '';
    }

    updateTotals();
}

function updateTotals() {
    const subtotal = Cart.getSubtotal();
    const grandTotal = subtotal + currentTip + shippingCost;

    const subtotalEl = document.getElementById('summary-subtotal');
    const tipEl = document.getElementById('summary-tip');
    const grandTotalEl = document.getElementById('summary-grand-total');

    if (subtotalEl) subtotalEl.innerText = `฿${subtotal.toLocaleString()}`;
    if (tipEl) tipEl.innerText = `฿${currentTip.toLocaleString()}`;
    if (grandTotalEl) grandTotalEl.innerText = `฿${grandTotal.toLocaleString()}`;
}

// ==============================================================================
// MAP & PINNING LOGIC
// ==============================================================================

function openMapModal() {
    const modal = document.getElementById('map-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    setTimeout(() => {
        if (!leafletMap && typeof L !== 'undefined') {
            initLeafletMap();
        } else if (leafletMap) {
            leafletMap.invalidateSize();
            if (currentPinCoords) {
                leafletMap.setView([currentPinCoords.lat, currentPinCoords.lng], 15);
                if (pinMarker) pinMarker.setLatLng([currentPinCoords.lat, currentPinCoords.lng]);
            }
        }
    }, 150);
}

function closeMapModal() {
    const modal = document.getElementById('map-modal');
    if (modal) modal.style.display = 'none';
}

function initLeafletMap() {
    const mapContainer = document.getElementById('map-view');
    if (!mapContainer || typeof L === 'undefined') return;

    // Create Map
    leafletMap = L.map('map-view').setView([currentPinCoords.lat, currentPinCoords.lng], 14);

    // OpenStreetMap Tile Layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    }).addTo(leafletMap);

    // Custom Crisp HTML Pin Icon
    const customPinIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="transform:translate(-50%, -100%); cursor:grab;"><svg width="34" height="34" viewBox="0 0 24 24" fill="#c25e38" stroke="#ffffff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#ffffff"></circle></svg></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38]
    });

    // Create Draggable Pin Marker
    pinMarker = L.marker([currentPinCoords.lat, currentPinCoords.lng], {
        icon: customPinIcon,
        draggable: true
    }).addTo(leafletMap);

    // Marker Drag Event
    pinMarker.on('dragend', function (e) {
        const latlng = e.target.getLatLng();
        handlePinChange(latlng.lat, latlng.lng);
    });

    // Map Click Event to Move Pin
    leafletMap.on('click', function (e) {
        movePinTo(e.latlng.lat, e.latlng.lng);
    });

    // Initial Reverse Geocode
    handlePinChange(currentPinCoords.lat, currentPinCoords.lng);

    // Try detecting user location if first time
    if (!hasPinned && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                movePinTo(pos.coords.latitude, pos.coords.longitude, 16);
            },
            () => {
                // If denied or error, keep default coordinates
            },
            { timeout: 8000 }
        );
    }
}

function movePinTo(lat, lng, zoom = null) {
    if (!leafletMap || !pinMarker) return;
    pinMarker.setLatLng([lat, lng]);
    if (zoom) {
        leafletMap.setView([lat, lng], zoom);
    } else {
        leafletMap.panTo([lat, lng]);
    }
    handlePinChange(lat, lng);
}

function handlePinChange(lat, lng) {
    currentPinCoords = { lat, lng };

    const coordsDisplay = document.getElementById('map-resolved-coords');
    if (coordsDisplay) {
        coordsDisplay.innerText = `พิกัด: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    reverseGeocode(lat, lng);
}

let geocodeTimeout = null;
async function reverseGeocode(lat, lng) {
    const addressDisplay = document.getElementById('map-resolved-address');
    const confirmBtn = document.getElementById('btn-confirm-pinned-address');

    if (addressDisplay) {
        addressDisplay.innerText = 'กำลังดึงข้อมูลชื่อสถานที่และที่อยู่จากแผนที่...';
        addressDisplay.style.color = 'var(--text-muted)';
    }
    if (confirmBtn) confirmBtn.disabled = true;

    clearTimeout(geocodeTimeout);
    geocodeTimeout = setTimeout(async () => {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=th`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error('Geocoding request failed');
            const data = await res.json();

            let formatted = formatThaiAddress(data);
            if (!formatted) {
                formatted = data.display_name || `พิกัดตำแหน่ง: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            }

            currentResolvedAddress = formatted;

            if (addressDisplay) {
                addressDisplay.innerText = formatted;
                addressDisplay.style.color = 'var(--brand-dark)';
            }
            if (confirmBtn) confirmBtn.disabled = false;
        } catch (err) {
            console.warn('Reverse geocode error:', err);
            currentResolvedAddress = `พิกัดตำแหน่งจัดส่ง (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
            if (addressDisplay) {
                addressDisplay.innerText = currentResolvedAddress;
                addressDisplay.style.color = 'var(--brand-dark)';
            }
            if (confirmBtn) confirmBtn.disabled = false;
        }
    }, 350);
}

function formatThaiAddress(data) {
    if (!data || !data.address) return null;
    const a = data.address;

    const parts = [];
    if (a.building || a.amenity) parts.push(a.building || a.amenity);
    if (a.house_number) parts.push(`เลขที่ ${a.house_number}`);
    if (a.road) parts.push(`ถนน${a.road.replace(/^ถนน/, '')}`);
    if (a.suburb || a.subdistrict) parts.push(`ตำบล/แขวง${(a.suburb || a.subdistrict).replace(/^(ตำบล|แขวง)/, '')}`);
    if (a.district || a.city_district || a.county) parts.push(`อำเภอ/เขต${(a.district || a.city_district || a.county).replace(/^(อำเภอ|เขต)/, '')}`);
    if (a.province || a.state) parts.push(`จังหวัด${(a.province || a.state).replace(/^จังหวัด/, '')}`);
    if (a.postcode) parts.push(a.postcode);

    if (parts.length >= 2) {
        return parts.join(' ');
    }
    return data.display_name;
}

// Search address on map input
async function searchLocationOnMap() {
    const input = document.getElementById('map-search-input');
    if (!input || !input.value.trim()) return;

    const query = input.value.trim();
    const addressDisplay = document.getElementById('map-resolved-address');
    if (addressDisplay) addressDisplay.innerText = 'กำลังค้นหาตำแหน่ง...';

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=th&accept-language=th&limit=1`;
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.length > 0) {
            const first = data[0];
            const lat = parseFloat(first.lat);
            const lon = parseFloat(first.lon);
            movePinTo(lat, lon, 16);
            if (window.showToast) window.showToast(`พบสถานที่: ${first.display_name.split(',')[0]}`, 'success');
        } else {
            if (window.showToast) window.showToast('ไม่พบสถานที่ที่ระบุ กรุณาลองค้นหาด้วยชื่อตำบล อำเภอ หรือจังหวัด', 'warning');
            if (addressDisplay) addressDisplay.innerText = 'ไม่พบสถานที่ ค้นหาใหม่อีกครั้ง';
        }
    } catch (err) {
        if (window.showToast) window.showToast('เกิดข้อผิดพลาดในการค้นหา', 'error');
    }
}

// Locate User on Map
function locateUserOnMap() {
    if (!navigator.geolocation) {
        if (window.showToast) window.showToast('เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด GPS', 'warning');
        return;
    }

    if (window.showToast) window.showToast('กำลังดึงตำแหน่งพิกัด GPS ของคุณ...', 'info');

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            movePinTo(lat, lng, 17);
            if (window.showToast) window.showToast('เลื่อนไปยังตำแหน่งปัจจุบันของคุณแล้ว', 'success');
        },
        (err) => {
            if (window.showToast) window.showToast('ไม่สามารถดึงตำแหน่งได้ กรุณาอนุญาตการเข้าถึง Location ในเบราว์เซอร์', 'warning');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// One-click Get Current Location from Form
function getCurrentLocationDirect() {
    if (!navigator.geolocation) {
        if (window.showToast) window.showToast('เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด GPS', 'warning');
        return;
    }

    if (window.showToast) window.showToast('กำลังดึงที่อยู่จากตำแหน่งปัจจุบันของคุณ...', 'info');

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            currentPinCoords = { lat, lng };

            try {
                const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=th`;
                const res = await fetch(url);
                const data = await res.json();
                let formatted = formatThaiAddress(data) || data.display_name;

                const addressEl = document.getElementById('shipping-address');
                if (addressEl) addressEl.value = formatted;

                hasPinned = true;
                updatePinnedBadge();

                if (window.showToast) {
                    window.showToast('ดึงที่อยู่จากตำแหน่งปัจจุบันเรียบร้อยแล้ว', 'success');
                }
            } catch (err) {
                const addressEl = document.getElementById('shipping-address');
                if (addressEl) addressEl.value = `พิกัดตำแหน่ง (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
                hasPinned = true;
                updatePinnedBadge();
            }
        },
        (err) => {
            if (window.showToast) window.showToast('กรุณาอนุญาตการเข้าถึง Location เพื่อดึงตำแหน่งอัตโนมัติ', 'warning');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// Confirm Address from Map Modal
function confirmPinnedAddress() {
    if (!currentResolvedAddress) {
        if (window.showToast) window.showToast('กรุณารอโหลดข้อมูลที่อยู่สักครู่', 'warning');
        return;
    }

    const addressEl = document.getElementById('shipping-address');
    if (addressEl) {
        addressEl.value = currentResolvedAddress;
    }

    hasPinned = true;
    updatePinnedBadge();
    closeMapModal();

    if (window.showToast) {
        window.showToast('ปักหมุดที่อยู่จัดส่งสำเร็จแล้ว คุณสามารถพิมพ์รายละเอียดบ้านเลขที่หรือห้องเพิ่มเติมได้', 'success', 4000);
    }
}

function updatePinnedBadge() {
    const badge = document.getElementById('pinned-location-badge');
    const coordsDisplay = document.getElementById('pinned-coords-display');
    if (badge && coordsDisplay && hasPinned && currentPinCoords) {
        badge.style.display = 'inline-flex';
        coordsDisplay.innerText = `${currentPinCoords.lat.toFixed(4)}, ${currentPinCoords.lng.toFixed(4)}`;
    }
}

// Submit Shipping
function handleShippingSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('shipping-name').value.trim();
    const phone = document.getElementById('shipping-phone').value.trim();
    const address = document.getElementById('shipping-address').value.trim();
    const notes = document.getElementById('shipping-notes').value.trim();

    if (!name || !phone || !address) {
        if (window.showToast) window.showToast('กรุณากรอกข้อมูลผู้รับและที่อยู่จัดส่งให้ครบถ้วน', 'warning');
        return;
    }

    const shippingData = {
        shipping_name: name,
        shipping_phone: phone,
        shipping_address: address,
        shipping_notes: notes,
        shipping_cost: shippingCost,
        tip_amount: currentTip,
        shipping_coords: hasPinned ? currentPinCoords : null
    };

    sessionStorage.setItem('taladjai_shipping_data', JSON.stringify(shippingData));
    window.location.href = '/payment.html';
}

document.addEventListener('DOMContentLoaded', initShippingPage);
