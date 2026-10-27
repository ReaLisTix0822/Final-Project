// ==============================================================================
// TALADJAI PRODUCTS CATALOG CONTROLLER (MATCHES MOCKUP & BRAND IDENTITY)
// ==============================================================================

let allProducts = [];
let filteredProducts = [];
let favoriteIds = JSON.parse(localStorage.getItem('taladjai_favorites') || '[]');
let activeCategory = 'all';
let currentPage = 1;
const itemsPerPage = 8; // 8 items per page as seen in mockup
let maxPriceFilter = Infinity;   // slider at its maximum = no price limit
let priceSliderMax = 1200;       // set from the most expensive product (setupPriceSlider)
let activeStoreId = null;   // ?store_id=… shows only that store's products

async function initProductsPage() {
    setupEventListeners();
    readUrlParams();
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
        try {
            const favRes = await API.get('/favorites/ids');
            if (favRes.success && Array.isArray(favRes.data)) {
                favoriteIds = favRes.data;
                localStorage.setItem('taladjai_favorites', JSON.stringify(favoriteIds));
            }
        } catch (e) {
            console.warn('Could not sync favorites from server:', e);
        }
    }
    await Promise.all([loadProducts(), loadDisabilityFilters()]);
}


function setupEventListeners() {
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            applyFilters();
        });
    }
}

function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category') || params.get('cat');
    activeStoreId = parseInt(params.get('store_id'), 10) || null;
    if (cat) {
        activeCategory = cat;
    }
    const search = params.get('search') || params.get('q');
    if (search) {
        const searchInput = document.getElementById('catalog-search-input');
        if (searchInput) searchInput.value = search;
    }
    if (params.get('favorites') === 'true') {
        // Liked products now have their own page
        window.location.replace('/favorites.html');
        return;
    }
}

// Disability-group checkboxes come from the disability_types table
async function loadDisabilityFilters() {
    const list = document.getElementById('disability-filter-list');
    if (!list) return;
    try {
        const res = await API.get('/disability-types');
        list.innerHTML = res.data.map(t => `
            <label class="filter-check-item">
                <span>
                    <input type="checkbox" name="disability_filter" value="${t.code}" onchange="handleFilterChange()">
                    ${t.label}
                </span>
                <span class="filter-check-count" data-group-count="${t.code}">(0)</span>
            </label>`).join('');
        updateSidebarCounts();
    } catch (err) {
        list.innerHTML = '<p class="filter-check-count">โหลดกลุ่มไม่สำเร็จ</p>';
    }
}

async function loadProducts() {
    const grid = document.getElementById('products-catalog-grid');
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:4rem; color:var(--text-muted); font-size:1rem;">กำลังโหลดชิ้นงานหัตถกรรมตลาดใจ...</div>';

    try {
        const res = await API.get('/products');
        if (res.success && res.data) {
            allProducts = res.data;

            // Update Total Metrics
            const totalCount = allProducts.length;
            const heroTotalEl = document.getElementById('metric-total-prods');
            const chipTotalEl = document.getElementById('chip-count-all');
            if (heroTotalEl) heroTotalEl.innerText = totalCount;
            if (chipTotalEl) chipTotalEl.innerText = totalCount;

            // Calculate & Update Sidebar Counts
            updateSidebarCounts();
            setupPriceSlider();

            // Sync Active Chip in UI
            syncCategoryChipUI();

            applyFilters();
        } else {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:4rem;">ไม่พบข้อมูลสินค้า</div>';
        }
    } catch (err) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--danger); text-align:center; padding:4rem;">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err.message}</div>`;
    }
}

function updateSidebarCounts() {
    let countR5 = 0;
    let countR4 = 0;

    const groupCounts = {};
    allProducts.forEach(p => {
        groupCounts[p.disability_type] = (groupCounts[p.disability_type] || 0) + 1;

        // Products without reviews have no rating (the API reports 5.0 as a placeholder)
        const rating = Number(p.review_count) > 0 ? parseFloat(p.average_rating) : 0;
        if (rating >= 4.9) countR5++;
        if (rating >= 4.0) countR4++;
    });

    document.querySelectorAll('[data-group-count]').forEach(el => {
        el.textContent = `(${groupCounts[el.dataset.groupCount] || 0})`;
    });
    const elR5 = document.getElementById('count-rating-5');
    const elR4 = document.getElementById('count-rating-4');
    if (elR5) elR5.innerText = `(${countR5})`;
    if (elR4) elR4.innerText = `(${countR4})`;

    // Banner: average of real reviews (same format as the homepage: 5/5, 4.9/5 ...)
    const avgEl = document.getElementById('metric-avg-rating');
    if (avgEl) {
        let total = 0, count = 0;
        allProducts.forEach(p => {
            const n = Number(p.review_count) || 0;
            if (n > 0) { total += parseFloat(p.average_rating) * n; count += n; }
        });
        if (!count) avgEl.textContent = '—';
        else {
            const avg = total / count;
            const shown = avg >= 5 ? 5 : Math.min(Math.round(avg * 10) / 10, 4.9);
            avgEl.textContent = `${Number.isInteger(shown) ? shown : shown.toFixed(1)}/5`;
        }
    }
}

function selectCategoryChip(catVal) {
    activeCategory = catVal;
    currentPage = 1;
    syncCategoryChipUI();
    applyFilters();
}

function syncCategoryChipUI() {
    document.querySelectorAll('.category-chip-btn').forEach(btn => {
        const cat = btn.getAttribute('data-cat');
        btn.classList.toggle('active', cat === String(activeCategory));
        btn.setAttribute('aria-pressed', String(cat === String(activeCategory)));
    });
}

// Slider range follows the real prices: 0 .. most expensive product (rounded up to 50)
function setupPriceSlider() {
    const slider = document.getElementById('price-range-slider');
    if (!slider) return;
    const highest = Math.max(0, ...allProducts.map(p => Number(p.price) || 0));
    priceSliderMax = Math.max(100, Math.ceil(highest / 50) * 50);
    slider.min = 0;
    slider.max = priceSliderMax;
    slider.value = priceSliderMax;
    const setLabel = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = TJFormat.money(value); };
    setLabel('price-scale-min', 0);
    setLabel('price-scale-mid', Math.round(priceSliderMax / 2 / 50) * 50);
    setLabel('price-scale-max', priceSliderMax);
    handlePriceSlider(priceSliderMax, false);
}

function handlePriceSlider(val, refresh = true) {
    const value = parseFloat(val);
    maxPriceFilter = value >= priceSliderMax ? Infinity : value;
    const text = maxPriceFilter === Infinity ? `ทุกราคา (สูงสุด ${TJFormat.money(priceSliderMax)})` : `ไม่เกิน ${TJFormat.money(value)}`;
    const displayEl = document.getElementById('price-range-display');
    if (displayEl) displayEl.innerText = text;
    const slider = document.getElementById('price-range-slider');
    if (slider) slider.setAttribute('aria-valuetext', maxPriceFilter === Infinity ? 'ทุกราคา' : `ราคาไม่เกิน ${TJFormat.number(value)} บาท`);
    if (!refresh) return;
    currentPage = 1;
    applyFilters();
}

function handleFilterChange() {
    currentPage = 1;
    applyFilters();
}

function handleSortChange() {
    handleSort();
    renderPage(currentPage);
}

function clearAllFilters() {
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) searchInput.value = '';

    activeCategory = 'all';
    syncCategoryChipUI();
    clearStoreFilter(false);

    document.querySelectorAll('input[name="disability_filter"]').forEach(cb => cb.checked = false);

    const radioGoal = document.querySelector('input[name="goal_filter"][value="all"]');
    if (radioGoal) radioGoal.checked = true;

    const radioRating = document.querySelector('input[name="rating_filter"]:checked');
    if (radioRating) radioRating.checked = false;

    const slider = document.getElementById('price-range-slider');
    if (slider) {
        slider.value = priceSliderMax;
        handlePriceSlider(priceSliderMax);
    }

    currentPage = 1;
    applyFilters();
}

// Leave "this store only" and show products from every store again
function clearStoreFilter(refresh = true) {
    if (!activeStoreId) return;
    activeStoreId = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('store_id');
    history.replaceState(null, '', url);
    if (refresh) {
        currentPage = 1;
        applyFilters();
    }
}

function applyFilters() {
    const searchVal = (document.getElementById('catalog-search-input')?.value || '').toLowerCase().trim();
    const checkedDisabilities = Array.from(document.querySelectorAll('input[name="disability_filter"]:checked')).map(cb => cb.value);
    const selectedGoal = document.querySelector('input[name="goal_filter"]:checked')?.value || 'all';
    const selectedRatingEl = document.querySelector('input[name="rating_filter"]:checked');
    const minRating = selectedRatingEl ? parseFloat(selectedRatingEl.value) : 0;
    const isFavsOnly = new URLSearchParams(window.location.search).get('favorites') === 'true';

    filteredProducts = allProducts.filter(p => {
        // Favorites filter
        if (isFavsOnly && !favoriteIds.includes(p.id)) return false;

        // Store filter (from "ชมผลงานทั้งหมดของร้านนี้")
        if (activeStoreId && Number(p.store_id) !== activeStoreId) return false;

        // Search Query: name first, then related keywords / synonyms / small typos
        if (searchVal) {
            p._searchScore = window.SmartSearch ? SmartSearch.score(p, searchVal)
                : ((p.name || '').toLowerCase().includes(searchVal) ? 1 : 0);
            if (!p._searchScore) return false;
        }

        // Category Chip Filter
        if (activeCategory !== 'all') {
            if (activeCategory === 'goal') {
                // Must have goal
                if (!p.support_goal_title) return false;
            } else {
                if (String(p.category_id) !== String(activeCategory)) return false;
            }
        }

        // Disability Group Filter
        if (checkedDisabilities.length > 0) {
            const matched = checkedDisabilities.includes(p.disability_type);
            if (!matched) return false;
        }

        // Price Filter
        if (maxPriceFilter !== Infinity && Number(p.price) > maxPriceFilter) return false;

        // Rating Filter
        const rating = Number(p.review_count) > 0 ? parseFloat(p.average_rating) : 0;
        if (rating < minRating) return false;

        // Goal Status Filter
        if (selectedGoal !== 'all') {
            const goalData = getProductGoalData(p);
            if (selectedGoal === 'near' && goalData.percent <= 70) return false;
            if (selectedGoal === 'funding' && (goalData.percent < 20 || goalData.percent >= 90)) return false;
            if (selectedGoal === 'completed' && goalData.percent < 90) return false;
        }

        return true;
    });

    handleSort(searchVal);

    // Reset page if out of bounds
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = 1;

    renderPage(currentPage);

    if (window.SearchLog) {
        const fromNavbar = searchVal && searchVal === (new URLSearchParams(location.search).get('search') || '').toLowerCase().trim();
        // Filters in use when the search was made (Search_History.filters)
        const filters = {};
        if (activeCategory !== 'all') filters.category = activeCategory;
        if (checkedDisabilities.length) filters.disability_types = checkedDisabilities;
        if (maxPriceFilter !== Infinity) filters.max_price = maxPriceFilter;
        if (minRating) filters.min_rating = minRating;
        if (selectedGoal !== 'all') filters.goal = selectedGoal;
        SearchLog.record(searchVal, fromNavbar ? 'navbar' : 'products', filteredProducts.length, fromNavbar ? 0 : 1200, filters);
    }
}

function handleSort(searchVal = (document.getElementById('catalog-search-input')?.value || '').trim()) {
    const sortVal = document.getElementById('catalog-sort-select')?.value || 'popular';

    // While searching, the default order is "most relevant first"
    if (searchVal && sortVal === 'popular') {
        filteredProducts.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0) || (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
        return;
    }

    if (sortVal === 'price_asc') {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sortVal === 'price_desc') {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sortVal === 'rating') {
        const realRating = p => (Number(p.review_count) > 0 ? parseFloat(p.average_rating) : 0);
        filteredProducts.sort((a, b) => realRating(b) - realRating(a) || Number(b.review_count) - Number(a.review_count));
    } else if (sortVal === 'newest') {
        filteredProducts.sort((a, b) => b.id - a.id);
    } else {
        // Popular / Recommended
        filteredProducts.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
    }
}

function renderPage(page) {
    currentPage = page;
    const grid = document.getElementById('products-catalog-grid');
    const summaryEl = document.getElementById('grid-results-summary');
    const paginationInfoEl = document.getElementById('pagination-info');
    const paginationControlsEl = document.getElementById('pagination-controls');

    const totalItems = filteredProducts.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const pageItems = filteredProducts.slice(startIdx, startIdx + itemsPerPage);

    // Update Results Summary Text
    if (summaryEl) {
        const storeName = activeStoreId && allProducts.find(p => Number(p.store_id) === activeStoreId)?.store_name;
        if (activeStoreId) {
            const safeStore = String(storeName || 'ร้านนี้').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
            summaryEl.innerHTML = `กำลังแสดง: ผลงานของ<a class="grid-results-store" href="/store-detail.html?id=${activeStoreId}">${safeStore}</a> (${totalItems} ชิ้น)
                <button type="button" class="grid-results-clear" onclick="clearStoreFilter()">ดูสินค้าทุกร้าน</button>`;
        } else {
            summaryEl.innerText = `กำลังแสดง: สินค้าทั้งหมด (${totalItems} ชิ้นจากผลลัพธ์)`;
        }
    }

    if (paginationInfoEl) {
        const fromNum = totalItems > 0 ? startIdx + 1 : 0;
        const toNum = Math.min(startIdx + itemsPerPage, totalItems);
        paginationInfoEl.innerText = `แสดง ${fromNum} – ${toNum} จาก ${totalItems} รายการ`;
    }

    if (pageItems.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:4rem 2rem; background:var(--color-surface); border-radius:16px; border:1.5px solid var(--border-color);">
                <h3 style="font-size:1.3rem; margin:0 0 0.5rem; color:var(--brand-dark);">ไม่พบชิ้นงานที่ตรงกับเงื่อนไขการค้นหา</h3>
                <p style="color:var(--text-muted); margin-bottom:1.5rem; max-width:420px; margin-left:auto; margin-right:auto;">
                    ลองปรับเปลี่ยนตัวกรองกลุ่มช่างฝีมือ ขยายช่วงราคา หรือล้างตัวกรองทั้งหมดเพื่อค้นหาชิ้นงานใหม่อีกครั้ง
                </p>
                <button type="button" onclick="clearAllFilters()" class="btn btn-primary" style="padding:0.6rem 1.8rem;">
                    ล้างตัวกรองทั้งหมด
                </button>
            </div>
        `;
        if (paginationControlsEl) paginationControlsEl.innerHTML = '';
        return;
    }

    // Render Cards
    grid.innerHTML = pageItems.map((p, idx) => {
        const isFav = favoriteIds.includes(p.id);
        const reviewCount = Number(p.review_count) || 0;
        const rating = reviewCount > 0 ? parseFloat(p.average_rating).toFixed(1) : '';
        const goalData = getProductGoalData(p);
        const storeName = p.store_name || 'กลุ่มช่างฝีมือชุมชนตลาดใจ';
        const storyExcerpt = p.story || p.description || 'ผลงานหัตถศิลป์ประณีตที่สืบทอดภูมิปัญญาท้องถิ่น สร้างรายได้และเสริมคุณค่าแก่ช่างฝีมือผู้ที่มีความพิการ';

        return `
            <article class="artisan-card" onclick="goToProductDetail(event, ${p.id})" aria-label="${p.name}">
                <!-- Thumbnail Wrap -->
                <div class="artisan-thumb-wrap">
                    <img data-image-store-id="${p.store_id || ''}" src="${p.image_url}" alt="${p.name}" class="artisan-thumb-img" loading="lazy">
                    
                    <!-- Favorite Button -->
                    <button type="button" class="artisan-fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, ${p.id})" title="${isFav ? 'นำออกจากรายการโปรด' : 'บันทึกในรายการโปรด'}" aria-label="รายการโปรด">
                        <svg width="16" height="16" viewBox="0 0 24 24" style="fill:${isFav ? 'var(--color-error)' : 'none'}; stroke:${isFav ? 'var(--color-error)' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>

                    <!-- Badges: 3D model on top, rating underneath -->
                    <div class="artisan-badge-stack">
                        ${p.model_3d_url ? `
                        <div class="artisan-3d-pill">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                            โมเดล 3D 360°
                        </div>` : ''}
                        <div class="artisan-rating-pill">
                            ${reviewCount > 0 ? `<span class="star-icon" aria-hidden="true">★</span>
                            <span>${rating}</span>
                            <span style="color:var(--color-text-muted); font-weight:normal;">(${reviewCount} รีวิว)</span>` : '<span style="font-weight:600;">ยังไม่มีรีวิว</span>'}
                        </div>
                    </div>
                </div>


                <!-- Product Title -->
                <h3 class="artisan-card-title" title="${p.name}">
                    ${p.name}
                </h3>

                <!-- Price right under the name -->
                <div class="card-price-block card-price-first">
                    <span class="sr-only">ราคา</span>
                    <span class="card-price-num">${TJFormat.money(p.price)}</span>
                </div>

                <!-- Store Info Line -->
                <div class="artisan-store-line">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--color-success)"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>${storeName}</span>
                </div>

                <!-- Short Story / Description -->
                <p class="artisan-card-desc card-story-clamp">
                    ${storyExcerpt}
                </p>

                <!-- Support Goal Progress Bar Box (only when the store has a goal) -->
                ${goalData.title ? `<div class="support-goal-bar-box">
                    <div class="goal-bar-header">
                        <span class="goal-title-txt" title="${goalData.title}">${goalData.title}</span>
                        <span>${goalData.percent}%</span>
                    </div>
                    <div class="goal-track">
                        <div class="goal-fill" style="width:${goalData.percent}%;"></div>
                    </div>
                </div>` : ''}

                <!-- Card Footer -->
                <div class="artisan-card-footer">
                    <button type="button" class="product-purchase-btn" onclick="quickAddToCart(event, ${p.id})" title="เพิ่มชิ้นงานนี้ลงในตะกร้า">
                        ใส่ตะกร้า
                    </button>
                </div>
            </article>
        `;
    }).join('');

    // Render Pagination Controls
    renderPaginationControls(totalPages);
}

// Real goal of the product's store only (no made-up goals or default percentages)
function getProductGoalData(p) {
    return {
        title: p.support_goal_title || '',
        percent: TJFormat.goalPercent(p.support_goal_current, p.support_goal_target)
    };
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById('pagination-controls');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // Prev Button
    if (currentPage > 1) {
        html += `<button type="button" class="page-num-btn" onclick="renderPage(${currentPage - 1})" aria-label="หน้าก่อนหน้า">&lt;</button>`;
    }

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button type="button" class="page-num-btn ${i === currentPage ? 'active' : ''}" onclick="renderPage(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span style="padding:0 4px; color:var(--color-text-muted); font-weight:bold;">...</span>`;
        }
    }

    // Next Button
    if (currentPage < totalPages) {
        html += `<button type="button" class="page-num-btn" onclick="renderPage(${currentPage + 1})" aria-label="หน้าถัดไป">&gt;</button>`;
    }

    container.innerHTML = html;
}

function goToProductDetail(event, prodId) {
    // Navigate unless clicked on button
    if (event.target.closest('button')) return;
    window.location.href = `/product-detail.html?id=${prodId}`;
}

function quickAddToCart(event, prodId) {
    event.stopPropagation();
    event.preventDefault();

    const product = allProducts.find(p => p.id === prodId);
    if (!product) return;

    if (window.Cart && Cart.addItem) Cart.addItem(product, 1);
}

function toggleFavorite(event, prodId) {
    event.stopPropagation();
    event.preventDefault();

    const isLoggedIn = (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));

    if (!isLoggedIn) {
        if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนบันทึกรายการโปรด', 'warning');
        setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`, 800);
        return;
    }

    const idx = favoriteIds.indexOf(prodId);
    if (idx > -1) {
        favoriteIds.splice(idx, 1);
        if (window.showToast) window.showToast('นำออกจากรายการโปรดแล้ว', 'info');
    } else {
        favoriteIds.push(prodId);
        if (window.showToast) window.showToast('เพิ่มลงในรายการโปรดเรียบร้อยแล้ว', 'success');
    }

    localStorage.setItem('taladjai_favorites', JSON.stringify(favoriteIds));

    // Async persist to backend API
    API.post('/favorites/toggle', { product_id: prodId })
        .then(res => {
            if (res.success && Array.isArray(res.favorites)) {
                favoriteIds = res.favorites;
                localStorage.setItem('taladjai_favorites', JSON.stringify(favoriteIds));
                renderPage(currentPage);
            }
        })
        .catch(err => console.error('Failed to toggle favorite on server:', err));

    // Update Navbar favorite badge
    const favBadges = document.querySelectorAll('.fav-count-badge');
    favBadges.forEach(b => {
        b.innerText = favoriteIds.length;
        b.style.display = favoriteIds.length > 0 ? 'inline-flex' : 'none';
    });

    renderPage(currentPage);
}


document.addEventListener('DOMContentLoaded', initProductsPage);
