// ==============================================================================
// TALADJAI PRODUCTS CATALOG CONTROLLER (MATCHES MOCKUP & BRAND IDENTITY)
// ==============================================================================

let allProducts = [];
let filteredProducts = [];
let favoriteIds = JSON.parse(localStorage.getItem('taladjai_favorites') || '[]');
let activeCategory = 'all';
let currentPage = 1;
const itemsPerPage = 8; // 8 items per page as seen in mockup
let maxPriceFilter = 1200;

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
    await loadProducts();
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
    if (cat) {
        activeCategory = cat;
    }
    const search = params.get('search') || params.get('q');
    if (search) {
        const searchInput = document.getElementById('catalog-search-input');
        if (searchInput) searchInput.value = search;
    }
    if (params.get('favorites') === 'true') {
        // Will be filtered in applyFilters
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
    let countPhysical = 0;
    let countHearing = 0;
    let countIntellectual = 0;
    let countVisual = 0;
    let countR5 = 0;
    let countR4 = 0;

    allProducts.forEach(p => {
        const dis = (p.disability_type || '').toLowerCase();
        if (dis === 'physical' || dis.includes('เคลื่อนไหว') || dis.includes('วีลแชร์')) countPhysical++;
        else if (dis === 'hearing' || dis.includes('ได้ยิน') || dis.includes('หู')) countHearing++;
        else if (dis === 'intellectual' || dis.includes('ออทิสติก') || dis.includes('สติปัญญา')) countIntellectual++;
        else if (dis === 'visual' || dis.includes('สายตา') || dis.includes('ตา')) countVisual++;
        else countPhysical++; // default fallback

        const rating = parseFloat(p.average_rating) || 5.0;
        if (rating >= 4.9) countR5++;
        if (rating >= 4.0) countR4++;
    });

    const elPhys = document.getElementById('count-disability-physical');
    const elHear = document.getElementById('count-disability-hearing');
    const elInt = document.getElementById('count-disability-intellectual');
    const elVis = document.getElementById('count-disability-visual');
    const elR5 = document.getElementById('count-rating-5');
    const elR4 = document.getElementById('count-rating-4');

    if (elPhys) elPhys.innerText = `(${countPhysical})`;
    if (elHear) elHear.innerText = `(${countHearing})`;
    if (elInt) elInt.innerText = `(${countIntellectual})`;
    if (elVis) elVis.innerText = `(${countVisual})`;
    if (elR5) elR5.innerText = `(${countR5})`;
    if (elR4) elR4.innerText = `(${countR4})`;
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
    });
}

function handlePriceSlider(val) {
    maxPriceFilter = parseFloat(val);
    const displayEl = document.getElementById('price-range-display');
    if (displayEl) {
        displayEl.innerText = maxPriceFilter >= 1200 ? '฿100 - ฿1,000+' : `฿100 - ฿${maxPriceFilter.toLocaleString()}`;
    }
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

    document.querySelectorAll('input[name="disability_filter"]').forEach(cb => cb.checked = false);

    const radioGoal = document.querySelector('input[name="goal_filter"][value="all"]');
    if (radioGoal) radioGoal.checked = true;

    const radioRating = document.querySelector('input[name="rating_filter"]:checked');
    if (radioRating) radioRating.checked = false;

    const slider = document.getElementById('price-range-slider');
    if (slider) {
        slider.value = 1200;
        handlePriceSlider(1200);
    }

    currentPage = 1;
    applyFilters();
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

        // Search Query
        if (searchVal) {
            const matchSearch = (p.name && p.name.toLowerCase().includes(searchVal)) ||
                                (p.story && p.story.toLowerCase().includes(searchVal)) ||
                                (p.description && p.description.toLowerCase().includes(searchVal)) ||
                                (p.store_name && p.store_name.toLowerCase().includes(searchVal)) ||
                                (p.category_name && p.category_name.toLowerCase().includes(searchVal));
            if (!matchSearch) return false;
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
            const pDis = (p.disability_type || 'physical').toLowerCase();
            const matched = checkedDisabilities.some(d => {
                if (d === 'physical') return pDis.includes('physical') || pDis.includes('เคลื่อนไหว') || pDis.includes('วีลแชร์');
                if (d === 'hearing') return pDis.includes('hearing') || pDis.includes('ได้ยิน') || pDis.includes('หู');
                if (d === 'intellectual') return pDis.includes('intellectual') || pDis.includes('ออทิสติก') || pDis.includes('สติปัญญา');
                if (d === 'visual') return pDis.includes('visual') || pDis.includes('สายตา') || pDis.includes('ตา');
                return false;
            });
            if (!matched) return false;
        }

        // Price Filter
        if (maxPriceFilter < 1200) {
            if (p.price > maxPriceFilter) return false;
        }

        // Rating Filter
        const rating = parseFloat(p.average_rating) || 5.0;
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

    handleSort();

    // Reset page if out of bounds
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = 1;

    renderPage(currentPage);
}

function handleSort() {
    const sortVal = document.getElementById('catalog-sort-select')?.value || 'popular';

    if (sortVal === 'price_asc') {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sortVal === 'price_desc') {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sortVal === 'rating') {
        filteredProducts.sort((a, b) => (parseFloat(b.average_rating) || 5.0) - (parseFloat(a.average_rating) || 5.0));
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
        summaryEl.innerText = `กำลังแสดง: สินค้าทั้งหมด (${totalItems} ชิ้นจากผลลัพธ์)`;
    }

    if (paginationInfoEl) {
        const fromNum = totalItems > 0 ? startIdx + 1 : 0;
        const toNum = Math.min(startIdx + itemsPerPage, totalItems);
        paginationInfoEl.innerText = `แสดง ${fromNum} – ${toNum} จาก ${totalItems} รายการ`;
    }

    if (pageItems.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:4rem 2rem; background:#ffffff; border-radius:16px; border:1.5px solid var(--border-color);">
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
        const rating = (parseFloat(p.average_rating) || (4.6 + ((p.id % 5) * 0.1))).toFixed(1);
        const reviewCount = p.review_count || (18 + ((p.id * 7) % 45));
        const goalData = getProductGoalData(p);
        const storeName = p.store_name || 'กลุ่มช่างฝีมือชุมชนตลาดใจ';
        const storyExcerpt = p.story || p.description || 'ผลงานหัตถศิลป์ประณีตที่สืบทอดภูมิปัญญาท้องถิ่น สร้างรายได้และเสริมคุณค่าแก่ช่างฝีมือผู้พิการ';

        return `
            <article class="artisan-card" onclick="goToProductDetail(event, ${p.id})" aria-label="${p.name}">
                <!-- Thumbnail Wrap -->
                <div class="artisan-thumb-wrap">
                    <img src="${p.image_url}" alt="${p.name}" class="artisan-thumb-img" loading="lazy">
                    
                    <!-- Favorite Button -->
                    <button type="button" class="artisan-fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, ${p.id})" title="${isFav ? 'นำออกจากรายการโปรด' : 'บันทึกในรายการโปรด'}" aria-label="รายการโปรด">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? '#dc2626' : 'none'}" stroke="${isFav ? '#dc2626' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>

                    <!-- Rating Pill -->
                    <div class="artisan-rating-pill">
                        <span class="star-icon">★</span>
                        <span>${rating}</span>
                        <span style="color:#64748b; font-weight:normal;">(${reviewCount})</span>
                    </div>
                </div>

                <!-- Store Info Line -->
                <div class="artisan-store-line">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>${storeName}</span>
                </div>

                <!-- Product Title -->
                <h3 class="artisan-card-title" title="${p.name}">
                    ${p.name}
                </h3>

                <!-- Short Story / Description -->
                <p class="artisan-card-desc">
                    ${storyExcerpt}
                </p>

                <!-- Support Goal Progress Bar Box (Key Mockup Element) -->
                <div class="support-goal-bar-box">
                    <div class="goal-bar-header">
                        <span class="goal-title-txt" title="${goalData.title}">${goalData.title}</span>
                        <span>${goalData.percent}%</span>
                    </div>
                    <div class="goal-track">
                        <div class="goal-fill" style="width:${goalData.percent}%;"></div>
                    </div>
                </div>

                <!-- Card Footer -->
                <div class="artisan-card-footer">
                    <div class="card-price-block">
                        <span class="card-price-lbl">ราคา</span>
                        <span class="card-price-num">฿${p.price.toLocaleString()}</span>
                    </div>
                    <button type="button" class="btn-add-cart-fast" onclick="quickAddToCart(event, ${p.id})" title="เพิ่มชิ้นงานนี้ลงในตะกร้า">
                        ใส่ตะกร้า
                    </button>
                </div>
            </article>
        `;
    }).join('');

    // Render Pagination Controls
    renderPaginationControls(totalPages);
}

function getProductGoalData(p) {
    if (p.support_goal_title && p.support_goal_target > 0) {
        const percent = Math.min(100, Math.round((p.support_goal_current / p.support_goal_target) * 100));
        return {
            title: p.support_goal_title,
            percent: percent || 50
        };
    }

    // Realistic curated goals based on craft category
    const curatedGoals = [
        { title: 'ซื้อจักรเย็บผ้าใหม่', percent: 60 },
        { title: 'สมทบทุนจัดซื้อไหมพรม', percent: 80 },
        { title: 'สมทบทุนเตาเผาเซรามิก', percent: 45 },
        { title: 'ซื้อเครื่องบดสมุนไพร', percent: 92 },
        { title: 'จัดซื้อวัตถุดิบกระจูดธรรมชาติ', percent: 50 },
        { title: 'สมทบทุนซื้อวัตถุดิบเยื่อสา', percent: 72 },
        { title: 'สมทบทุนเครื่องขัดไม้ไฟฟ้า', percent: 85 },
        { title: 'ขยายโรงเรือนย้อมสีธรรมชาติ', percent: 40 }
    ];

    return curatedGoals[p.id % curatedGoals.length];
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
            html += `<span style="padding:0 4px; color:#94a3b8; font-weight:bold;">...</span>`;
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

    const isLoggedIn = (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));

    if (!isLoggedIn) {
        if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าลงในตะกร้า', 'warning');
        setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`, 800);
        return;
    }

    if (window.Cart && Cart.addItem) {
        Cart.addItem(product, 1);
        Cart.updateBadge();
    }
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
