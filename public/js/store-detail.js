// ==============================================================================
// TALADJAI SINGLE STORE PROFILE CONTROLLER (MATCHES media_1788146358977.png)
// ==============================================================================

let currentStore = null;
let currentStoreProducts = [];
let selectedTip = 100;

async function initStoreDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('id') || '1';

    await loadStoreData(storeId);
}

async function loadStoreData(storeId) {
    try {
        const storeRes = await API.get(`/stores/${storeId}`);
        if (storeRes.success && storeRes.data) {
            currentStore = storeRes.data;
            renderStoreProfile(currentStore);
        } else {
            // Fallback to fetch from all stores if single endpoint not configured
            const allRes = await API.get('/stores');
            if (allRes.success && allRes.data) {
                currentStore = allRes.data.find(s => String(s.id) === String(storeId)) || allRes.data[0];
                renderStoreProfile(currentStore);
            }
        }

        // Load Products of this Store
        const prodRes = await API.get('/products', { store_id: currentStore ? currentStore.id : storeId });
        if (prodRes.success && prodRes.data) {
            currentStoreProducts = prodRes.data;
            renderStoreProducts(currentStoreProducts);
        }
    } catch (err) {
        console.error('Failed to load store data:', err);
    }
}

function renderStoreProfile(store) {
    if (!store) return;

    document.title = `${store.store_name} | ตลาดใจ`;

    // Breadcrumb
    const bc = document.getElementById('breadcrumb-store-name');
    if (bc) bc.innerText = store.store_name;

    // Header & Avatar
    const nameEl = document.getElementById('store-name');
    if (nameEl) nameEl.innerText = store.store_name;

    const avatarEl = document.getElementById('store-avatar');
    if (avatarEl && store.avatar_image) avatarEl.src = store.avatar_image;

    const taglineEl = document.getElementById('store-tagline');
    if (taglineEl) {
        taglineEl.innerText = store.story ? store.story.substring(0, 100) + '...' : `สินค้าหัตถกรรมประณีต โดย ${store.store_name} • สร้างสรรค์ด้วยความตั้งใจ`;
    }

    // Modal name
    const tipStoreName = document.getElementById('tip-modal-store-name');
    if (tipStoreName) tipStoreName.innerText = store.store_name;

    // Headline Quote & Story
    const quoteEl = document.getElementById('store-headline-quote');
    if (quoteEl) {
        if (store.id === 1 || store.disability_type === 'visual') {
            quoteEl.innerText = '“ผมมองไม่เห็น แต่มือผมจำลายผ้าได้ทุกเส้น”';
        } else if (store.disability_type === 'hearing') {
            quoteEl.innerText = '“ภาษามืออาจเงียบงัน แต่ลายผ้าไหมของเราบอกเล่าเรื่องราวได้ดังก้อง”';
        } else if (store.disability_type === 'physical') {
            quoteEl.innerText = '“เก้าอี้รถเข็นจำกัดแค่การเดิน แต่ไม่เคยจำกัดจินตนาการงานไม้ของผม”';
        } else {
            quoteEl.innerText = '“ภาพวาดและเซรามิกคือสะพานใจที่เชื่อมความรู้สึกของผมสู่ทุกคน”';
        }
    }

    const storyP1 = document.getElementById('store-story-text-1');
    if (storyP1 && store.story) {
        storyP1.innerText = store.story;
    }

    const storyP2 = document.getElementById('store-story-text-2');
    if (storyP2) {
        storyP2.innerText = `รายได้จากทุกคำสั่งซื้อและทิปที่ได้รับ ถูกนำไปต่อยอดซื้ออุปกรณ์และพัฒนาอาชีพ: "${store.support_goal_title || 'ระดมทุนสนับสนุนอุปกรณ์ช่าง'}" เพื่อสร้างความยั่งยืนให้แก่ครอบครัว`;
    }

    // Goal Card
    const target = store.support_goal_target || 20000;
    const current = store.support_goal_current || 0;
    const percent = Math.min(100, Math.round((current / target) * 100));

    const goalTitle = document.getElementById('goal-card-title');
    if (goalTitle) goalTitle.innerText = `เป้าหมาย: ${store.support_goal_title || 'พัฒนาอาชีพช่างฝีมือ'}`;

    const goalPercent = document.getElementById('goal-card-percent');
    if (goalPercent) goalPercent.innerText = `${percent}%`;

    const goalBar = document.getElementById('goal-card-bar');
    if (goalBar) goalBar.style.width = `${percent}%`;

    const goalCurrent = document.getElementById('goal-card-current');
    if (goalCurrent) goalCurrent.innerText = `ได้รับแล้ว ฿${current.toLocaleString()}`;

    const goalTarget = document.getElementById('goal-card-target');
    if (goalTarget) goalTarget.innerText = `จากเป้าหมาย ฿${target.toLocaleString()}`;
}

function renderStoreProducts(products) {
    const grid = document.getElementById('store-products-grid');
    const statProds = document.getElementById('stat-products-count');
    if (statProds) statProds.innerText = products.length || 12;

    if (!products || products.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">ร้านนี้กำลังเตรียมลงสินค้าเพิ่มเติม</div>';
        return;
    }

    grid.innerHTML = products.map((p, idx) => {
        const rating = (parseFloat(p.average_rating) || 4.8).toFixed(1);
        const matchPercent = 90 + (idx % 8);

        return `
            <div class="taladjai-product-card" onclick="window.location.href='/product-detail.html?id=${p.id}'">
                <div class="card-top-pin" aria-hidden="true"></div>
                <div class="card-thumb-wrap">
                    <img src="${p.image_url}" alt="${p.name}" class="card-thumb-img" loading="lazy">
                    <div style="position:absolute; bottom:10px; left:10px; background:#1b3329; color:white; font-size:0.75rem; font-weight:700; padding:3px 9px; border-radius:9999px; display:inline-flex; align-items:center; gap:4px;">
                        <span style="width:6px; height:6px; border-radius:50%; background:#df8a28; display:inline-block;"></span> ตรงใจ ${matchPercent}%
                    </div>
                </div>
                <h3 style="font-size:1.05rem; font-weight:800; color:var(--brand-dark); line-height:1.35; margin-bottom:6px; min-height:42px;">
                    ${p.name}
                </h3>
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:auto; border-top:1px dashed #ede5d8; padding-top:10px;">
                    <div style="font-family:var(--font-heading); font-size:1.25rem; font-weight:800; color:var(--brand-dark);">
                        ฿${p.price.toLocaleString()}
                    </div>
                    <div style="font-size:0.88rem; font-weight:700; color:var(--text-main);">
                        คะแนน ${rating}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Tip Modal Functions
function openTipModal() {
    document.getElementById('tip-modal').classList.add('active');
}

function closeTipModal() {
    document.getElementById('tip-modal').classList.remove('active');
}

function selectTipValue(val, btnEl) {
    selectedTip = val;
    document.querySelectorAll('.tip-choice-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
    });
    btnEl.classList.remove('btn-outline');
    btnEl.classList.add('btn-primary', 'active');
    document.getElementById('custom-tip-amount').value = val;
}

function confirmSendTip() {
    const amount = parseFloat(document.getElementById('custom-tip-amount').value) || selectedTip;
    closeTipModal();
    if (window.showToast) {
        window.showToast(`ขอบพระคุณที่ร่วมให้ทิปสนับสนุน ฿${amount.toLocaleString()} บาท แก่ ${currentStore ? currentStore.store_name : 'ช่างฝีมือ'} `, 'success');
    }
}

document.addEventListener('DOMContentLoaded', initStoreDetailPage);
