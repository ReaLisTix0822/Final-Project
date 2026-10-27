// ==============================================================================
// TALADJAI MATCHING WIZARD CONTROLLER
// Handles 5-Question Pill-Based Interactive Questionnaire & Content Matching
// ==============================================================================

const matchingImageAttribute = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
let currentStep = 1;
const totalSteps = 5;

const selectedState = {
    productTypes: [],
    purpose: 'self',
    budget: 1500,
    storePreference: 'all',
    disabilityTypes: []
};

// Answers, current question and the last results survive a page refresh (per browser tab)
const MATCHING_STORAGE_KEY = 'taladjai_matching_state';
let lastMatchingResults = null;

function saveMatchingState() {
    try {
        sessionStorage.setItem(MATCHING_STORAGE_KEY, JSON.stringify({ step: currentStep, answers: selectedState, results: lastMatchingResults }));
    } catch (e) { /* storage unavailable: the wizard still works, it just won't survive a refresh */ }
}

function restoreMatchingState() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(MATCHING_STORAGE_KEY) || 'null');
        if (!saved) return null;
        if (saved.answers) {
            ['productTypes', 'disabilityTypes'].forEach(k => { if (Array.isArray(saved.answers[k])) selectedState[k] = saved.answers[k].map(String); });
            ['purpose', 'storePreference'].forEach(k => { if (typeof saved.answers[k] === 'string') selectedState[k] = saved.answers[k]; });
            if (Number.isFinite(Number(saved.answers.budget))) selectedState.budget = Number(saved.answers.budget);
        }
        const step = Number(saved.step);
        if (step >= 1 && step <= totalSteps) currentStep = step;
        return saved;
    } catch (e) {
        return null;
    }
}

// Reflect selectedState on every pill (after a restore the HTML still shows the defaults)
function syncPillsFromState() {
    document.querySelectorAll('.option-pill-btn[onclick]').forEach(button => {
        const m = button.getAttribute('onclick').match(/(togglePill|selectSinglePill)\(this, '([^']+)', '([^']+)'\)/);
        if (!m) return;
        const [, kind, group, value] = m;
        const state = selectedState[group];
        const active = kind === 'togglePill'
            ? (value === 'all' ? !state.length : state.includes(value))
            : String(state) === value;
        button.classList.toggle('selected', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function initMatchingWizard() {
    // Opened from the chatbot (?fresh=1): start a new questionnaire instead of showing old results
    const params = new URLSearchParams(location.search);
    if (params.get('fresh') === '1') {
        try { sessionStorage.removeItem(MATCHING_STORAGE_KEY); } catch (e) { /* storage unavailable */ }
        params.delete('fresh');
        history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : '') + location.hash);
    }
    const saved = restoreMatchingState();
    syncPillsFromState();
    updateWizardUI();
    loadDisabilityTypeOptions();
    if (saved?.results) {
        lastMatchingResults = saved.results;
        renderMatchingResults(saved.results);
    }
}

// Build the disability question from the disability_types table (static pills stay as fallback)
async function loadDisabilityTypeOptions() {
    const wrap = document.getElementById('disability-type-options');
    if (!wrap) return;
    try {
        const res = await API.get('/disability-types');
        if (!res.success || res.data.length === 0) return;
        selectedState.disabilityTypes = selectedState.disabilityTypes.filter(code => res.data.some(t => t.code === code));
        const pill = (code, label) => {
            const active = code === 'all' ? !selectedState.disabilityTypes.length : selectedState.disabilityTypes.includes(code);
            return `<button type="button" class="option-pill-btn${active ? ' selected' : ''}" aria-pressed="${active}" onclick="togglePill(this, 'disabilityTypes', '${matchingImageAttribute(code)}')">${matchingImageAttribute(label)}</button>`;
        };
        wrap.innerHTML = res.data
            .map(t => pill(t.code, t.label))
            .join('') + pill('all', 'ทุกกลุ่ม');
    } catch (err) {
        console.warn('Unable to load disability types:', err.message);
    }
}

function togglePill(buttonEl, group, value) {
    const values = selectedState[group];
    if (value === 'all') values.splice(0);
    else {
        const index = values.indexOf(value);
        if (index < 0) values.push(value); else values.splice(index, 1);
    }
    buttonEl.parentElement.querySelectorAll('.option-pill-btn').forEach(button => {
        const option = button.getAttribute('onclick').match(/'([^']+)'\)$/)?.[1];
        const active = option === 'all' ? !values.length : values.includes(option);
        button.classList.toggle('selected', active);
        button.setAttribute('aria-pressed', String(active));
    });
    saveMatchingState();
}

function selectSinglePill(buttonEl, group, value) {
    const parent = buttonEl.parentElement;
    parent.querySelectorAll('.option-pill-btn').forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
    buttonEl.classList.add('selected');
    buttonEl.setAttribute('aria-pressed', 'true');

    if (group === 'budget') {
        selectedState.budget = parseInt(value, 10);
    } else {
        selectedState[group] = value;
    }
    saveMatchingState();
}

function updateWizardUI() {
    // 1. Update Step Panels
    for (let i = 1; i <= totalSteps; i++) {
        const panel = document.getElementById(`step-panel-${i}`);
        if (panel) panel.style.display = i === currentStep ? 'block' : 'none';
    }

    // 2. Update Dots
    for (let i = 1; i <= totalSteps; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) {
            dot.className = 'step-dot';
            if (i === currentStep) dot.classList.add('active');
            if (i < currentStep) dot.classList.add('completed');
        }
    }

    // 3. Update Buttons
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');

    if (prevBtn) {
        prevBtn.disabled = currentStep === 1;
        prevBtn.style.opacity = currentStep === 1 ? '0.4' : '1';
        prevBtn.style.cursor = currentStep === 1 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        if (currentStep === totalSteps) {
            nextBtn.innerText = 'ดูผลการจับคู่';
        } else {
            nextBtn.innerText = 'ถัดไป →';
        }
    }

    if (window.A11y) {
        const titleEl = document.querySelector(`#step-panel-${currentStep} .step-question-text`);
        if (titleEl) {
            A11y.announceToScreenReader(`คำถามที่ ${currentStep} จาก ${totalSteps}: ${titleEl.innerText}`);
        }
    }
}

function wizardNext() {
    if (currentStep < totalSteps) {
        currentStep++;
        updateWizardUI();
        saveMatchingState();
    } else {
        submitMatching();
    }
}

function wizardPrev() {
    if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
        saveMatchingState();
    }
}

function resetWizard() {
    document.body.classList.remove('matching-results-active');
    currentStep = 1;
    lastMatchingResults = null;
    saveMatchingState();
    updateWizardUI();
    document.getElementById('matching-wizard-card').style.display = 'block';
    document.getElementById('matching-results-section').style.display = 'none';
    window.scrollTo({ top: 150, behavior: 'smooth' });
}

async function submitMatching() {
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.innerText = '⏳ กำลังประมวลผล...';
    nextBtn.disabled = true;

    try {
        const payload = {
            product_types: selectedState.productTypes,
            purpose: selectedState.purpose,
            budget_max: selectedState.budget === 99999 ? null : selectedState.budget,
            store_preference: selectedState.storePreference,
            disability_types: selectedState.disabilityTypes
        };

        const res = await API.post('/matching/recommend', payload);

        nextBtn.innerText = 'ดูผลการจับคู่';
        nextBtn.disabled = false;

        if (res.success) {
            // Use the shop's own cover and product photographs for recommendations.
            const shopResponse = await API.get('/stores').catch(() => ({ data: [] }));
            const shops = new Map((shopResponse.data || []).map(shop => [String(shop.id), shop]));
            (res.recommended_stores || []).forEach(store => {
                const shop = shops.get(String(store.store_id));
                store.matching_image = shop?.cover_image || shop?.sample_products?.find(item => item.image_url)?.image_url
                    || (res.recommended_products || []).find(item => String(item.store_id) === String(store.store_id) && item.image_url)?.image_url;
            });
            (res.recommended_products || []).forEach(product => {
                if (!product.image_url) product.image_url = shops.get(String(product.store_id))?.cover_image || '/images/fallbacks/product.svg';
            });
            lastMatchingResults = res;
            saveMatchingState();
            renderMatchingResults(res);
        }
    } catch (err) {
        nextBtn.innerText = 'ดูผลการจับคู่';
        nextBtn.disabled = false;
        window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

function renderMatchingResults(res) {
    document.body.classList.add('matching-results-active');
    document.getElementById('matching-wizard-card').style.display = 'none';
    const resultsSection = document.getElementById('matching-results-section');
    resultsSection.style.display = 'block';

    const prodGrid = document.getElementById('matched-products-grid');
    const storeGrid = document.getElementById('matched-stores-grid');
    const countEl = document.getElementById('matched-products-count');

    const products = res.recommended_products || [];
    const stores = res.recommended_stores || [];

    if (countEl) {
        countEl.innerText = `พบทั้งหมด ${products.length} ชิ้นงานที่ตรงกับความสนใจ`;
    }

    // 1. Render Matched Products First & Foremost
    if (products.length > 0) {
        prodGrid.innerHTML = products.map(p => {
            const safeName = (p.name || '').replace(/'/g, "\\'");
            const safeStore = (p.store_name || '').replace(/'/g, "\\'");
            const reviewCount = Number(p.review_count) || 0;
            const rating = reviewCount > 0 ? parseFloat(p.average_rating).toFixed(1) : '';

            // Goal progress for product's store
            const target = p.support_goal_target || 20000;
            const current = p.support_goal_current || 0;
            const percent = TJFormat.goalPercent(p.support_goal_current, p.support_goal_target);

            return `
                <article class="product-card" style="border:1.5px solid var(--border-color); border-radius:var(--radius-xl); overflow:hidden; display:flex; flex-direction:column;">
                    <div class="product-image-wrap" style="position:relative; aspect-ratio:4/3; overflow:hidden; background:var(--color-surface-alt);">
                        <img loading="lazy" decoding="async" data-image-store-id="${p.store_id || ''}" src="${matchingImageAttribute(p.image_url)}" alt="${matchingImageAttribute(p.name)}" class="product-image" style="width:100%;height:100%;object-fit:cover;">
                        
                        <div class="product-badge-group" style="position:absolute; top:12px; left:12px; display:flex; flex-direction:column; gap:6px; z-index:2;">
                            <span class="disability-badge" style="background:var(--color-primary); color:var(--color-on-primary); font-size: 0.875rem; font-weight:800; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                                ★ ตรงใจ ${p.matchPercentage}%
                            </span>
                            ${p.model_3d_url ? '<span class="badge-3d">โมเดล 3D 360°</span>' : ''}
                        </div>

                        <div style="position:absolute; top:12px; right:12px; z-index:2; background:color-mix(in srgb, var(--color-surface) 92%, transparent); backdrop-filter:blur(4px); padding:3px 8px; border-radius:9999px; font-size: 1rem; font-weight:700; color:var(--color-text); display:flex; align-items:center; gap:3px;">
                            ${reviewCount > 0 ? `<span style="color:var(--color-accent);">★</span>
                            <span>${rating} (${reviewCount})</span>` : '<span>ยังไม่มีรีวิว</span>'}
                        </div>
                    </div>

                    <div class="product-content" style="padding:1.25rem; display:flex; flex-direction:column; flex-grow:1;">
                        <h3 class="product-title" style="font-size:1.15rem; margin:0 0 8px 0; color:var(--brand-dark); line-height:1.35;" title="${p.name}">
                            <a href="/product-detail.html?id=${p.id}">${p.name}</a>
                        </h3>

                        <div class="card-price-first" style="font-family:var(--font-heading); font-size:1.35rem; font-weight:800; color:var(--color-accent); margin:0 0 6px;">
                            <span class="sr-only">ราคาจำหน่าย </span>${TJFormat.money((parseFloat(p.price) || 0))}
                        </div>
                        <div class="product-store" style="font-size: 1rem; color:var(--accent-red); font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:5px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ${p.store_name}
                        </div>

                        <!-- Why this matches -->
                        <div style="background:var(--color-bg); border:1px solid var(--color-divider); border-radius:10px; padding:8px 12px; margin-bottom:12px; font-size: 1rem; color:var(--color-text-muted);">
                            <div style="font-weight:700; color:var(--brand-dark); margin-bottom:2px; display:flex; align-items:center; gap:5px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2.5" style="stroke:var(--color-primary)"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                                เหตุผลที่แนะนำ:
                            </div>
                            <ul style="margin:2px 0 0 16px; padding:0; line-height:1.45;">
                                ${p.matchReasons.map(r => `<li>${r}</li>`).join('')}
                            </ul>
                        </div>

                        <!-- Store Support Goal Progress -->
                        ${p.support_goal_title ? `
                            <div style="margin-top:auto; margin-bottom:12px; padding:8px 10px; background:var(--color-surface-alt); border-radius:8px; border:1px solid var(--color-divider);">
                                <div style="display:flex; justify-content:space-between; font-size: 1rem; font-weight:600; color:var(--color-text-muted); margin-bottom:4px;">
                                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;" title="${p.support_goal_title}">${p.support_goal_title}</span>
                                    <b style="color:var(--primary);">${percent}%</b>
                                </div>
                                <div style="width:100%; height:5px; background:var(--color-surface-alt); border-radius:9999px; overflow:hidden;">
                                    <div style="width:${percent}%; height:100%; background:var(--primary); border-radius:9999px;"></div>
                                </div>
                            </div>
                        ` : '<div style="margin-top:auto;"></div>'}

                        <div class="product-footer" style="padding-top:10px; border-top:1px solid var(--border-color); display:flex; align-items:center; justify-content:flex-end; margin-top:auto;">
                            <div style="display:flex; gap:6px;">
                                <a href="/product-detail.html?id=${p.id}" class="btn btn-sm btn-outline" style="border-radius:9999px; padding:5px 12px;">
                                    ดูรายละเอียด
                                </a>
                                <button onclick="if(window.Cart) Cart.addItem({ id: ${p.id}, name: '${safeName}', price: ${p.price}, image_url: '${p.image_url}', store_id: ${p.store_id}, store_name: '${safeStore}' }); else window.location.href='/product-detail.html?id=${p.id}';" class="btn btn-sm btn-primary" style="border-radius:9999px; padding:5px 14px; font-weight:700;">
                                    สั่งซื้อ
                                </button>
                            </div>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    } else {
        prodGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:3rem; background:var(--color-surface); border-radius:16px; border:1px solid var(--border-color);">
                ไม่พบสินค้าที่ตรงกับเงื่อนไข ลองทำแบบสอบถามใหม่อีกครั้ง
            </div>
        `;
    }

    storeGrid.replaceChildren();
    // 2. Render Matched Stores (Contextual Support)
    if (stores.length > 0) {
        storeGrid.innerHTML = stores.map(s => {
            const esc = matchingImageAttribute;
            const target = Number(s.support_goal_target) || 20000;
            const current = Number(s.support_goal_current) || 0;
            const percent = TJFormat.goalPercent(s.support_goal_current, s.support_goal_target);
            const baht = n => `${TJFormat.money(Math.round(n))}`;
            const storeUrl = `/store-detail.html?id=${encodeURIComponent(s.store_id)}`;
            return `
                <article class="support-goal-card match-store-card" aria-labelledby="match-store-${esc(s.store_id)}">
                    <a href="${storeUrl}" class="matching-store-photo" tabindex="-1" aria-hidden="true">
                        <img data-image-store-id="${esc(s.store_id)}" src="${esc(s.matching_image || '/images/fallbacks/product.svg')}" alt="" loading="lazy" width="640" height="360">
                        <span class="match-store-score">ตรงใจ ${esc(s.matchPercentage)}%</span>
                    </a>
                    <p class="match-store-province">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>
                        จังหวัด${esc(s.province || 'ขอนแก่น')}
                    </p>
                    <h4 class="match-store-name" id="match-store-${esc(s.store_id)}">
                        <a href="${storeUrl}">${esc(s.store_name)}</a>
                        <span class="sr-only">, ตรงใจ ${esc(s.matchPercentage)} เปอร์เซ็นต์</span>
                    </h4>
                    <p class="match-store-story">${esc(s.store_story || 'ร้านค้าช่างฝีมือผู้ที่มีความพิการ')}</p>

                    ${s.support_goal_title ? `
                    <div class="match-store-goal">
                        <p class="match-store-goal-label">เป้าหมายที่ร้านกำลังระดมทุน</p>
                        <p class="match-store-goal-title">${esc(s.support_goal_title)}</p>
                        <div class="goal-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="ความคืบหน้าเป้าหมาย">
                            <div class="goal-progress-fill" style="width:${percent}%;"></div>
                        </div>
                        <p class="match-store-goal-meta">
                            <span>ได้แล้ว <b>${baht(current)}</b> จาก ${baht(target)}</span>
                            <b class="match-store-goal-percent">${percent}%</b>
                        </p>
                    </div>` : ''}

                    <a href="${storeUrl}#store-products" class="btn btn-outline-dark match-store-cta">ชมผลงานทั้งหมดของร้านนี้</a>
                </article>
            `;
        }).join('');
    }

    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', initMatchingWizard);
