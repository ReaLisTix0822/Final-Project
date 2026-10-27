// ==============================================================================
// TALADJAI STORES DIRECTORY CONTROLLER (MATCHING MOCKUP & WCAG AA)
// ==============================================================================

let allStoresData = [];
let displayedStores = [];
let currentQuickFilter = 'all';
let followedStores = new Set();
// Disability group chosen on the homepage (?disability_type=visual|hearing|physical)
const storeTypeFilter = new URLSearchParams(window.location.search).get('disability_type') || '';

const storeEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

// Initialize Page
async function initStoresPage() {
    setupStoreEventListeners();
    await Promise.all([loadFollowedStores(), loadStoreCategoryOptions()]);
    await fetchStoresList();
}

async function loadFollowedStores() {
    if (!(window.Auth && Auth.isLoggedIn())) return;
    try {
        const res = await API.get('/follows/ids');
        if (res.success) followedStores = new Set(res.data);
    } catch (err) {
        console.warn('Unable to load followed stores:', err.message);
    }
}

function setupStoreEventListeners() {
    const searchInput = document.getElementById('stores-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyStoresFilter();
        });
    }

    const regionSelect = document.getElementById('stores-region-select');
    if (regionSelect) {
        regionSelect.addEventListener('change', () => {
            applyStoresFilter();
        });
    }

    const catSelect = document.getElementById('stores-category-select');
    if (catSelect) {
        catSelect.addEventListener('change', () => {
            applyStoresFilter();
        });
    }
}

async function fetchStoresList() {
    const grid = document.getElementById('stores-directory-grid');
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3.5rem; color:var(--text-muted);">กำลังโหลดข้อมูลร้านค้าช่างฝีมือ...</div>';

    try {
        const res = await API.get('/stores');
        allStoresData = (res.data || []).map(s => {
            const reviews = Number(s.total_reviews) || 0;
            const target = Number(s.support_goal_target) || 0;
            return {
                id: Number(s.id),
                store_name: s.store_name,
                province: s.province || 'ไม่ระบุจังหวัด',
                region: getRegionFromProvince(s.province),
                category_ids: s.category_ids || [],
                disability_type: s.disability_type,
                craft_tag: s.craft_technique || 'งานฝีมือแฮนด์เมด',
                disability_label: s.disability_name || 'ช่างฝีมือตลาดใจ',
                rating: reviews > 0 ? Number(s.average_rating) : 0,
                reviews_count: reviews,
                support_goal_title: s.support_goal_title || 'เป้าหมายพัฒนาอาชีพ',
                support_goal_percent: TJFormat.goalPercent(s.support_goal_current, s.support_goal_target),
                cover_image: s.cover_image || '',
                sample_products: s.sample_products || []
            };
        });
    } catch (err) {
        console.warn('API error loading stores:', err);
        allStoresData = [];
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3.5rem; color:var(--text-muted);">โหลดข้อมูลร้านค้าไม่สำเร็จ กรุณาลองรีเฟรชหน้า</div>`;
        return;
    }

    const quickAllEl = document.getElementById('quick-count-all');
    if (quickAllEl) quickAllEl.textContent = allStoresData.filter(s => !storeTypeFilter || s.disability_type === storeTypeFilter).length;

    if (storeTypeFilter) {
        // Name of the group from disability_types (works even when it has no stores yet)
        let label = '';
        try {
            const types = await API.get('/disability-types');
            label = (types.data.find(t => t.code === storeTypeFilter) || {}).label || '';
        } catch {}
        const title = document.getElementById('stores-heading-title');
        if (title && label) title.textContent = `ร้านค้าของ${label}`;
        if (label) document.title = `ร้านค้าของ${label} | ตลาดใจ`;
        const clear = document.getElementById('stores-type-clear');
        if (clear) clear.hidden = false;
    }

    applyStoresFilter();
}

// Fill the craft-category filter with the real product categories
async function loadStoreCategoryOptions() {
    const select = document.getElementById('stores-category-select');
    if (!select) return;
    try {
        const res = await API.get('/categories');
        const categories = res.data || [];
        select.replaceChildren(new Option('ทุกหมวดหมู่ช่าง', 'all'), ...categories.map(c => new Option(c.name, String(c.id))));
    } catch (err) {
        console.warn('Unable to load categories:', err.message);
    }
}

function getRegionFromProvince(province) {
    if (!province) return 'central';
    const north = ['เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน', 'น่าน', 'พะเยา', 'แพร่'];
    const northeast = ['ขอนแก่น', 'สกลนคร', 'นครราชสีมา', 'อุดรธานี', 'อุบลราชธานี', 'บุรีรัมย์', 'สุรินทร์', 'ร้อยเอ็ด'];
    const south = ['สงขลา', 'ภูเก็ต', 'กระบี่', 'สุราษฎร์ธานี', 'นครศรีธรรมราช', 'ตรัง'];
    if (north.some(p => province.includes(p))) return 'north';
    if (northeast.some(p => province.includes(p))) return 'northeast';
    if (south.some(p => province.includes(p))) return 'south';
    return 'central';
}

function setQuickFilter(type, btnEl) {
    currentQuickFilter = type;
    document.querySelectorAll('.quick-chip').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    applyStoresFilter();
}

function resetStoresFilter() {
    const searchInput = document.getElementById('stores-search-input');
    const regionSelect = document.getElementById('stores-region-select');
    const catSelect = document.getElementById('stores-category-select');
    const sortSelect = document.getElementById('stores-sort-select');

    if (searchInput) searchInput.value = '';
    if (regionSelect) regionSelect.value = 'all';
    if (catSelect) catSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'featured';

    currentQuickFilter = 'all';
    document.querySelectorAll('.quick-chip').forEach(b => b.classList.remove('active'));
    const allChip = document.querySelector('.quick-chip');
    if (allChip) allChip.classList.add('active');

    applyStoresFilter();
}

function applyStoresFilter() {
    const query = (document.getElementById('stores-search-input')?.value || '').toLowerCase().trim();
    const region = document.getElementById('stores-region-select')?.value || 'all';
    const category = document.getElementById('stores-category-select')?.value || 'all';
    const sort = document.getElementById('stores-sort-select')?.value || 'featured';

    displayedStores = allStoresData.filter(s => {
        if (storeTypeFilter && s.disability_type !== storeTypeFilter) {
            return false;
        }

        // 1. Region Filter
        if (region !== 'all' && s.region !== region) {
            return false;
        }

        // 2. Category Filter
        if (category !== 'all' && !s.category_ids.includes(Number(category))) {
            return false;
        }

        // 3. Quick Chips Filter
        if (currentQuickFilter === 'goal_near' && s.support_goal_percent < 70) {
            return false;
        }
        if (currentQuickFilter === 'rating_high' && s.rating < 4.8) {
            return false;
        }

        // 4. Search Query
        if (query) {
            const nameMatch = s.store_name.toLowerCase().includes(query);
            const provMatch = (s.province || '').toLowerCase().includes(query);
            const tagMatch = (s.craft_tag || '').toLowerCase().includes(query);
            const goalMatch = (s.support_goal_title || '').toLowerCase().includes(query);
            if (!nameMatch && !provMatch && !tagMatch && !goalMatch) {
                return false;
            }
        }

        return true;
    });

    // Sorting
    if (sort === 'rating') {
        displayedStores.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'goal') {
        displayedStores.sort((a, b) => (b.support_goal_percent || 0) - (a.support_goal_percent || 0));
    } else if (sort === 'name') {
        displayedStores.sort((a, b) => a.store_name.localeCompare(b.store_name, 'th'));
    } else {
        // featured default
        displayedStores.sort((a, b) => a.id - b.id);
    }

    // Update Counter Badge
    const countBadge = document.getElementById('stores-count-badge');
    if (countBadge) {
        countBadge.textContent = `${displayedStores.length} ร้านค้า`;
    }

    renderStoresGrid(displayedStores);
    if (window.SearchLog) SearchLog.record(query, 'stores', displayedStores.length);
}

function renderStoresGrid(stores) {
    const grid = document.getElementById('stores-directory-grid');
    if (!grid) return;

    if (!stores || stores.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:4rem 2rem; background:var(--color-surface); border-radius:20px; border:1.5px solid var(--border-color);">
                <div style="font-size:2rem; margin-bottom:1rem; color:var(--primary);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <h3 style="font-size:1.3rem; font-weight:800; margin:0 0 0.5rem; color:var(--brand-dark);">ไม่พบร้านค้าที่ตรงกับเงื่อนไข</h3>
                <p style="color:var(--text-muted); margin-bottom:1.5rem;">ลองปรับคำค้นหา หรือเลือกดูทุกภูมิภาคและหมวดหมู่</p>
                <button type="button" onclick="resetStoresFilter()" class="btn btn-primary" style="background:var(--color-primary); color:var(--color-on-primary); border:none; border-radius:var(--radius-full); padding:8px 24px;">ล้างตัวกรองทั้งหมด</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = stores.map(s => {
        const regionLabel = getRegionThaiLabel(s.region);
        const percent = s.support_goal_percent || 0;
        const isFollowed = followedStores.has(s.id);
        const name = storeEsc(s.store_name);

        const sampleProductsHtml = s.sample_products.length
            ? s.sample_products.slice(0, 3).map(p => `
            <a class="work-thumb-box" href="/product-detail.html?id=${Number(p.id)}" title="${storeEsc(p.name)}">
                <img src="${storeEsc(p.image_url)}" alt="${storeEsc(p.name)}" loading="lazy" data-image-store-id="${s.id}">
                <span class="work-price-badge">${TJFormat.money(Number(p.price))}</span>
            </a>
        `).join('')
            : '<p style="grid-column:1/-1; margin:0; color:var(--text-muted); font-size: 1rem;">ร้านนี้ยังไม่มีสินค้า</p>';

        return `
            <article class="artisan-store-card" aria-label="${name}">
                <!-- Cover Image & Overlays -->
                <div class="store-cover-media">
                    <img src="${storeEsc(s.cover_image)}" alt="ภาพหน้าร้าน ${name}" class="cover-img" loading="lazy" data-image-store-id="${s.id}">
                    <div class="store-media-gradient"></div>

                    <!-- Top-left Verified Badge -->
                    <span class="store-verified-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--color-success)"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>ยืนยันตัวตนแล้ว</span>
                    </span>

                    <!-- Bottom-left Store Name & Location -->
                    <div class="store-cover-info-left">
                        <div class="store-province-loc">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>${storeEsc(s.province)} • ${regionLabel}</span>
                        </div>
                        <h3 class="store-card-name" title="${name}">${name}</h3>
                    </div>

                    <!-- Bottom-right Rating -->
                    <span class="store-rating-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" stroke-width="2" style="fill:var(--color-accent);stroke:var(--color-accent)"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <span>${s.reviews_count ? `${s.rating.toFixed(1)} (${s.reviews_count})` : 'ยังไม่มีรีวิว'}</span>
                    </span>
                </div>

                <!-- Card Body -->
                <div class="store-card-body">
                    <!-- Tags Row -->
                    <div class="store-tag-pills-row">
                        <span class="craft-type-tag" title="${storeEsc(s.craft_tag)}">${storeEsc(s.craft_tag)}</span>
                        <span class="team-member-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            <span>${storeEsc(s.disability_label)}</span>
                        </span>
                    </div>

                    <!-- Support Goal Progress -->
                    <div class="store-goal-meta">
                        <span class="goal-title-txt" title="${storeEsc(s.support_goal_title)}">เป้าหมาย: ${storeEsc(s.support_goal_title)}</span>
                        <span class="goal-percent-txt">${percent}%</span>
                    </div>
                    <div class="store-goal-track">
                        <div class="store-goal-fill" style="width: ${percent}%;"></div>
                    </div>

                    <!-- Featured Works Preview -->
                    <div class="featured-works-header">ผลงานเด่นของร้าน (${Math.min(s.sample_products.length, 3)} รายการ):</div>
                    <div class="featured-works-grid">
                        ${sampleProductsHtml}
                    </div>

                    <!-- Secondary Action Buttons -->
                    <div class="store-secondary-actions">
                        <button type="button" class="btn-store-sub ${isFollowed ? 'followed' : ''}" onclick="toggleFollowStore(${s.id}, this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFollowed ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            <span>${isFollowed ? 'กำลังติดตาม' : 'ติดตาม'}</span>
                        </button>
                        <button type="button" class="btn-store-sub" onclick="openStoreChat(${Number(s.id)})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            <span>พูดคุย</span>
                        </button>
                    </div>

                    <!-- Primary Storefront Button -->
                    <a href="/store-detail.html?id=${s.id}" class="btn-visit-store">
                        <span>เยี่ยมชมหน้าร้าน</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </a>
                </div>
            </article>
        `;
    }).join('');
}

function getRegionThaiLabel(reg) {
    if (reg === 'north') return 'ภาคเหนือ';
    if (reg === 'northeast') return 'ภาคอีสาน';
    if (reg === 'central') return 'ภาคกลาง';
    if (reg === 'south') return 'ภาคใต้';
    return 'ทุกภาค';
}

function renderFollowButton(btnEl, isFollowed) {
    btnEl.classList.toggle('followed', isFollowed);
    btnEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFollowed ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        <span>${isFollowed ? 'กำลังติดตาม' : 'ติดตาม'}</span>
    `;
}

async function toggleFollowStore(storeId, btnEl) {
    if (!(window.Auth && Auth.isLoggedIn())) {
        if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนติดตามร้านค้า', 'warning');
        setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`, 800);
        return;
    }
    btnEl.disabled = true;
    try {
        const res = await API.post('/follows/toggle', { store_id: storeId });
        if (res.is_following) followedStores.add(storeId);
        else followedStores.delete(storeId);
        renderFollowButton(btnEl, res.is_following);
        if (window.showToast) window.showToast(res.message, 'success');
    } catch (err) {
        if (window.showToast) window.showToast(err.message || 'ไม่สามารถติดตามร้านค้าได้', 'error');
    } finally {
        btnEl.disabled = false;
    }
}

function openStoreChat(storeId) {
    location.href = `/messages.html?store_id=${encodeURIComponent(storeId)}`;
}

// Modal Functions
function openSuggestModal() {
    const modal = document.getElementById('suggest-modal');
    if (modal) modal.classList.add('open');
}

function closeSuggestModal() {
    const modal = document.getElementById('suggest-modal');
    if (modal) modal.classList.remove('open');
}

function handleSuggestStore(event) {
    event.preventDefault();
    const name = document.getElementById('suggest-name')?.value;
    alert(`ขอขอบคุณที่ร่วมแนะนำร้าน "${name}" ทีมงานตลาดใจจะประสานงานและลงพื้นที่ตรวจสอบเพื่อสนับสนุนช่างฝีมือต่อไปครับ`);
    closeSuggestModal();
    document.getElementById('suggest-store-form')?.reset();
}

document.addEventListener('DOMContentLoaded', initStoresPage);
