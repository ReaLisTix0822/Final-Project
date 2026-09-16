// ==============================================================================
// TALADJAI STORES DIRECTORY CONTROLLER (MATCHING MOCKUP & WCAG AA)
// ==============================================================================

let allStoresData = [];
let displayedStores = [];
let currentQuickFilter = 'all';
let followedStores = new Set();

// Curated 6 Exemplary Stores matching Mockup perfectly
const CURATED_MOCKUP_STORES = [
    {
        id: 1,
        store_name: 'ร้านตะกร้าไม้ไผ่พี่มล',
        province: 'เชียงใหม่',
        region: 'north',
        craft_category: 'basketry',
        disability_type: 'physical',
        craft_tag: 'งานสานไม้ไผ่และหวาย',
        member_tag: 'สมาชิก 4 คน',
        is_community: true,
        rating: 4.9,
        reviews_count: 128,
        is_verified: true,
        support_goal_title: 'ซื้อเครื่องตัดไม้ไผ่ไฟฟ้า',
        support_goal_percent: 68,
        cover_image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop&q=80',
        sample_products: [
            { name: 'ตะกร้าหวายสานละเอียด', price: 450, image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&auto=format&fit=crop&q=80' },
            { name: 'กระเป๋าถือไม้ไผ่ทรงคลาสสิก', price: 759, image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&auto=format&fit=crop&q=80' },
            { name: 'ถาดเสิร์ฟไม้ไผ่ขอบมน', price: 820, image_url: 'https://images.unsplash.com/photo-1615865417491-9941019fbc00?w=400&auto=format&fit=crop&q=80' }
        ]
    },
    {
        id: 2,
        store_name: 'ทอศิลป์ถิ่นภูไท',
        province: 'สกลนคร',
        region: 'northeast',
        craft_category: 'textile',
        disability_type: 'hearing',
        craft_tag: 'ผ้าย้อมครามธรรมชาติและกระเป๋าคราม',
        member_tag: 'สมาชิก 12 คน',
        is_community: true,
        rating: 5.0,
        reviews_count: 84,
        is_verified: true,
        support_goal_title: 'ทุนซื้อเส้นฝ้ายฟอกย้อมล็อตใหม่',
        support_goal_percent: 82,
        cover_image: '/images/products/indigo_silk_scarf.jpg',
        sample_products: [
            { name: 'ผ้าคลุมไหล่ย้อมครามลายโบราณ', price: 390, image_url: '/images/products/indigo_silk_scarf.jpg' },
            { name: 'กระเป๋าผ้าครามเดินเส้นมือ', price: 650, image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&auto=format&fit=crop&q=80' },
            { name: 'ผ้าซิ่นมัดหมี่ภูไท 6 ตะกอ', price: 1200, image_url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&auto=format&fit=crop&q=80' }
        ]
    },
    {
        id: 3,
        store_name: 'ปั้นฝันดินเผา สตูดิโอ',
        province: 'นนทบุรี',
        region: 'central',
        craft_category: 'pottery',
        disability_type: 'intellectual',
        craft_tag: 'เซรามิกแก้วและจานเคลือบศิลาดล',
        member_tag: 'ช่างฝีมือกลุ่มออทิสติก',
        is_community: false,
        rating: 4.8,
        reviews_count: 96,
        is_verified: true,
        support_goal_title: 'เตาอบเซรามิกประหยัดพลังงานสำหรับกลุ่ม',
        support_goal_percent: 45,
        cover_image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&auto=format&fit=crop&q=80',
        sample_products: [
            { name: 'แก้วกาแฟเซรามิกดินเผาเคลือบด้าน', price: 260, image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80' },
            { name: 'จานรองลายใบไม้ปั้นมือ', price: 350, image_url: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=400&auto=format&fit=crop&q=80' },
            { name: 'โหลเซรามิกมินิมอล', price: 420, image_url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=400&auto=format&fit=crop&q=80' }
        ]
    },
    {
        id: 4,
        store_name: 'กลิ่นหอมอารมณ์ดี',
        province: 'ลำปาง',
        region: 'north',
        craft_category: 'aroma',
        disability_type: 'hearing',
        craft_tag: 'เทียนหอมไขถั่วเหลืองและสบู่',
        member_tag: 'ผู้พิการทางการได้ยิน',
        is_community: false,
        rating: 4.9,
        reviews_count: 72,
        is_verified: true,
        support_goal_title: 'ห้องผลิตสินค้าปลอดสารเคมี',
        support_goal_percent: 53,
        cover_image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&auto=format&fit=crop&q=80',
        sample_products: [
            { name: 'เทียนหอมไขถั่วเหลืองกลิ่นดอกโมก', price: 350, image_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=400&auto=format&fit=crop&q=80' },
            { name: 'สบู่สมุนไพรน้ำผึ้งชันโรง', price: 149, image_url: 'https://images.unsplash.com/photo-1607006314644-88cb077d853b?w=400&auto=format&fit=crop&q=80' },
            { name: 'ก้านไม้หอมปรับอากาศอโรมา', price: 490, image_url: 'https://images.unsplash.com/photo-1508759073847-9ca702cec7d2?w=400&auto=format&fit=crop&q=80' }
        ]
    },
    {
        id: 5,
        store_name: 'กระเป๋าผ้าร่มชูใจ',
        province: 'นครราชสีมา',
        region: 'northeast',
        craft_category: 'wood_leather',
        disability_type: 'physical',
        craft_tag: 'กระเป๋าผ้าแคนวาสรีไซเคิลและหนัง',
        member_tag: 'สมาชิก 5 คน',
        is_community: true,
        rating: 4.7,
        reviews_count: 64,
        is_verified: true,
        support_goal_title: 'ซื้อจักรเย็บผ้าอุตสาหกรรม',
        support_goal_percent: 90,
        cover_image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
        sample_products: [
            { name: 'กระเป๋าโท้ทผ้าแคนวาสพรีเมียม', price: 420, image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&auto=format&fit=crop&q=80' },
            { name: 'กระเป๋าสะพายข้างวินเทจ', price: 550, image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80' },
            { name: 'ซองใส่เอกสารผ้าทนทาน', price: 890, image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&auto=format&fit=crop&q=80' }
        ]
    },
    {
        id: 6,
        store_name: 'ลูกปัดร้อยสุข',
        province: 'สงขลา',
        region: 'south',
        craft_category: 'jewelry',
        disability_type: 'visual',
        craft_tag: 'เครื่องประดับลูกปัดแก้วโบราณประยุกต์',
        member_tag: 'สมาชิก 3 คน',
        is_community: true,
        rating: 4.8,
        reviews_count: 51,
        is_verified: true,
        support_goal_title: 'โต๊ะออกแบบเครื่องประดับพร้อมไฟส่องสว่างเฉพาะ',
        support_goal_percent: 35,
        cover_image: 'https://images.unsplash.com/photo-1535295972055-1c762f4483e5?w=800&auto=format&fit=crop&q=80',
        sample_products: [
            { name: 'สร้อยคอลูกปัดโนราประยุกต์', price: 580, image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&auto=format&fit=crop&q=80' },
            { name: 'กำไลข้อมือลูกปัดแก้วหลากสี', price: 650, image_url: 'https://images.unsplash.com/photo-1611591475880-9285703f83bc?w=400&auto=format&fit=crop&q=80' },
            { name: 'ต่างหูระย้าลูกปัดแฮนด์เมด', price: 690, image_url: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=400&auto=format&fit=crop&q=80' }
        ]
    }
];

// Initialize Page
async function initStoresPage() {
    setupStoreEventListeners();
    await fetchStoresList();
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
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
            // Map and enrich with mockup details for missing properties
            const dbStores = res.data;
            const merged = CURATED_MOCKUP_STORES.map((curated, idx) => {
                const match = dbStores.find(s => s.id === curated.id || s.store_name === curated.store_name);
                if (match) {
                    return {
                        ...curated,
                        ...match,
                        rating: match.average_rating || curated.rating,
                        reviews_count: match.total_reviews || curated.reviews_count,
                        sample_products: (match.sample_products && match.sample_products.length > 0) ? match.sample_products : curated.sample_products
                    };
                }
                return curated;
            });

            // Append any other newly created stores from database that aren't in curated
            dbStores.forEach(s => {
                if (!merged.find(m => m.id === s.id)) {
                    merged.push({
                        id: s.id,
                        store_name: s.store_name,
                        province: s.province || 'ขอนแก่น',
                        region: getRegionFromProvince(s.province),
                        craft_category: 'basketry',
                        disability_type: s.disability_type || 'physical',
                        craft_tag: s.craft_technique || 'งานฝีมือประณีต',
                        member_tag: 'สมาชิกชุมชน',
                        is_community: false,
                        rating: s.average_rating || 5.0,
                        reviews_count: s.total_reviews || 12,
                        is_verified: true,
                        support_goal_title: s.support_goal_title || 'เป้าหมายพัฒนาอาชีพ',
                        support_goal_percent: s.support_goal_target ? Math.min(100, Math.round(((s.support_goal_current || 0) / s.support_goal_target) * 100)) : 65,
                        cover_image: s.cover_image || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
                        sample_products: s.sample_products || []
                    });
                }
            });

            allStoresData = merged;
        } else {
            allStoresData = CURATED_MOCKUP_STORES;
        }
    } catch (err) {
        console.warn('API error loading stores, using curated fallback:', err);
        allStoresData = CURATED_MOCKUP_STORES;
    }

    const quickAllEl = document.getElementById('quick-count-all');
    if (quickAllEl) quickAllEl.textContent = allStoresData.length;

    applyStoresFilter();
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
        // 1. Region Filter
        if (region !== 'all' && s.region !== region) {
            return false;
        }

        // 2. Category Filter
        if (category !== 'all' && s.craft_category !== category) {
            return false;
        }

        // 3. Quick Chips Filter
        if (currentQuickFilter === 'goal_near' && s.support_goal_percent < 70) {
            return false;
        }
        if (currentQuickFilter === 'rating_high' && s.rating < 4.8) {
            return false;
        }
        if (currentQuickFilter === 'community' && !s.is_community) {
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
}

function renderStoresGrid(stores) {
    const grid = document.getElementById('stores-directory-grid');
    if (!grid) return;

    if (!stores || stores.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:4rem 2rem; background:#ffffff; border-radius:20px; border:1.5px solid var(--border-color);">
                <div style="font-size:2rem; margin-bottom:1rem; color:var(--primary);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <h3 style="font-size:1.3rem; font-weight:800; margin:0 0 0.5rem; color:var(--brand-dark);">ไม่พบร้านค้าที่ตรงกับเงื่อนไข</h3>
                <p style="color:var(--text-muted); margin-bottom:1.5rem;">ลองปรับคำค้นหา หรือเลือกดูทุกภูมิภาคและหมวดหมู่</p>
                <button type="button" onclick="resetStoresFilter()" class="btn btn-primary" style="background:#8B4513; color:#fff; border:none; border-radius:var(--radius-full); padding:8px 24px;">ล้างตัวกรองทั้งหมด</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = stores.map(s => {
        const regionLabel = getRegionThaiLabel(s.region);
        const percent = s.support_goal_percent || 60;
        const isFollowed = followedStores.has(s.id);

        const sampleProductsHtml = (s.sample_products || []).slice(0, 3).map(p => `
            <div class="work-thumb-box">
                <img src="${p.image_url}" alt="${p.name}" loading="lazy">
                <span class="work-price-badge">฿${p.price.toLocaleString()}</span>
            </div>
        `).join('');

        return `
            <article class="artisan-store-card" aria-label="${s.store_name}">
                <!-- Cover Image & Overlays -->
                <div class="store-cover-media">
                    <img src="${s.cover_image}" alt="ภาพหน้าร้าน ${s.store_name}" class="cover-img" loading="lazy">
                    <div class="store-media-gradient"></div>

                    <!-- Top-left Verified Badge -->
                    <span class="store-verified-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>ยืนยันตัวตนแล้ว</span>
                    </span>

                    <!-- Bottom-left Store Name & Location -->
                    <div class="store-cover-info-left">
                        <div class="store-province-loc">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>${s.province} • ${regionLabel}</span>
                        </div>
                        <h3 class="store-card-name" title="${s.store_name}">${s.store_name}</h3>
                    </div>

                    <!-- Bottom-right Rating -->
                    <span class="store-rating-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <span>${parseFloat(s.rating).toFixed(1)} (${s.reviews_count})</span>
                    </span>
                </div>

                <!-- Card Body -->
                <div class="store-card-body">
                    <!-- Tags Row -->
                    <div class="store-tag-pills-row">
                        <span class="craft-type-tag" title="${s.craft_tag}">${s.craft_tag}</span>
                        <span class="team-member-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            <span>${s.member_tag}</span>
                        </span>
                    </div>

                    <!-- Support Goal Progress -->
                    <div class="store-goal-meta">
                        <span class="goal-title-txt" title="${s.support_goal_title}">เป้าหมาย: ${s.support_goal_title}</span>
                        <span class="goal-percent-txt">${percent}%</span>
                    </div>
                    <div class="store-goal-track">
                        <div class="store-goal-fill" style="width: ${percent}%;"></div>
                    </div>

                    <!-- Featured Works Preview -->
                    <div class="featured-works-header">ผลงานเด่นของร้าน (3 รายการ):</div>
                    <div class="featured-works-grid">
                        ${sampleProductsHtml}
                    </div>

                    <!-- Secondary Action Buttons -->
                    <div class="store-secondary-actions">
                        <button type="button" class="btn-store-sub ${isFollowed ? 'followed' : ''}" onclick="toggleFollowStore(${s.id}, this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFollowed ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            <span>${isFollowed ? 'กำลังติดตาม' : 'ติดตาม'}</span>
                        </button>
                        <button type="button" class="btn-store-sub" onclick="openStoreChat('${s.store_name}')">
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

function toggleFollowStore(storeId, btnEl) {
    if (followedStores.has(storeId)) {
        followedStores.delete(storeId);
        btnEl.classList.remove('followed');
        btnEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span>ติดตาม</span>
        `;
    } else {
        followedStores.add(storeId);
        btnEl.classList.add('followed');
        btnEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span>กำลังติดตาม</span>
        `;
    }
}

function openStoreChat(storeName) {
    // If Chatbot exists, activate it or show direct communication prompt
    if (window.Chatbot && typeof window.Chatbot.open === 'function') {
        window.Chatbot.open();
        const chatInput = document.getElementById('chat-input-field');
        if (chatInput) {
            chatInput.value = `สวัสดีครับ ต้องการสอบถามข้อมูลเพิ่มเติมเกี่ยวกับร้าน "${storeName}"`;
        }
    } else {
        alert(`เปิดหน้าต่างติดต่อร้าน "${storeName}" โดยตรงเรียบร้อยแล้ว ทีมงานและช่างฝีมือจะติดต่อกลับโดยเร็วที่สุดครับ`);
    }
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
