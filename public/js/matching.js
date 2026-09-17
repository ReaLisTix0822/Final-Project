// ==============================================================================
// TALADJAI MATCHING WIZARD CONTROLLER
// Handles 4-Question Pill-Based Interactive Questionnaire & Content Matching
// ==============================================================================

let currentStep = 1;
const totalSteps = 4;

const selectedState = {
    disability: ['visual'],  // Default pre-selected
    category: ['1'],
    purpose: 'self',
    budget: 1500
};

function initMatchingWizard() {
    updateWizardUI();
}

function togglePill(buttonEl, group, value) {
    if (value === 'all') {
        // Clear others and select all or vice versa
        const parent = buttonEl.parentElement;
        const allButtons = parent.querySelectorAll('.option-pill-btn');
        const isCurrentlySelected = buttonEl.classList.contains('selected');

        allButtons.forEach(b => b.classList.remove('selected'));
        if (!isCurrentlySelected) {
            buttonEl.classList.add('selected');
            selectedState[group] = [];
        } else {
            selectedState[group] = [];
        }
        return;
    }

    // Deselect 'all' button if active
    const allBtn = buttonEl.parentElement.querySelector('.option-pill-btn[onclick*="all"]');
    if (allBtn) allBtn.classList.remove('selected');

    buttonEl.classList.toggle('selected');

    // Update state array
    if (!selectedState[group]) selectedState[group] = [];

    const index = selectedState[group].indexOf(value);
    if (buttonEl.classList.contains('selected')) {
        if (index === -1) selectedState[group].push(value);
    } else {
        if (index > -1) selectedState[group].splice(index, 1);
    }
}

function selectSinglePill(buttonEl, group, value) {
    const parent = buttonEl.parentElement;
    parent.querySelectorAll('.option-pill-btn').forEach(b => b.classList.remove('selected'));
    buttonEl.classList.add('selected');

    if (group === 'budget') {
        selectedState.budget = parseInt(value, 10);
    } else {
        selectedState[group] = value;
    }
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
    } else {
        submitMatching();
    }
}

function wizardPrev() {
    if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
    }
}

function resetWizard() {
    currentStep = 1;
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
            disability_types: selectedState.disability,
            category_ids: selectedState.category.filter(c => c !== 'all').map(c => parseInt(c, 10)),
            purpose: selectedState.purpose,
            budget_max: selectedState.budget,
            sort_by_goal: selectedState.purpose === 'goal'
        };

        const res = await API.post('/matching/recommend', payload);

        nextBtn.innerText = 'ดูผลการจับคู่';
        nextBtn.disabled = false;

        if (res.success) {
            renderMatchingResults(res);
        }
    } catch (err) {
        nextBtn.innerText = 'ดูผลการจับคู่';
        nextBtn.disabled = false;
        window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

function renderMatchingResults(res) {
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
            const rating = (parseFloat(p.average_rating) || 5.0).toFixed(1);
            const reviewCount = p.review_count || 12;

            // Goal progress for product's store
            const target = p.support_goal_target || 20000;
            const current = p.support_goal_current || 0;
            const percent = Math.min(100, Math.round((current / target) * 100));

            return `
                <article class="product-card" style="border:1.5px solid var(--border-color); border-radius:var(--radius-xl); overflow:hidden; display:flex; flex-direction:column;">
                    <div class="product-image-wrap" style="position:relative; aspect-ratio:4/3; overflow:hidden; background:#f1f5f9;">
                        <img src="${p.image_url}" alt="${p.name}" class="product-image" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&auto=format&fit=crop&q=80';">
                        
                        <div class="product-badge-group" style="position:absolute; top:12px; left:12px; display:flex; flex-direction:column; gap:6px; z-index:2;">
                            <span class="disability-badge" style="background:#df8a28; color:white; font-size:0.8rem; font-weight:800; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                                ★ ตรงใจ ${p.matchPercentage}%
                            </span>
                            ${p.model_3d_url ? '<span class="badge-3d">3D / AR</span>' : ''}
                        </div>

                        <div style="position:absolute; top:12px; right:12px; z-index:2; background:rgba(255,255,255,0.92); backdrop-filter:blur(4px); padding:3px 8px; border-radius:9999px; font-size:0.75rem; font-weight:700; color:#1e293b; display:flex; align-items:center; gap:3px;">
                            <span style="color:#eab308;">★</span>
                            <span>${rating}</span>
                        </div>
                    </div>

                    <div class="product-content" style="padding:1.25rem; display:flex; flex-direction:column; flex-grow:1;">
                        <div class="product-store" style="font-size:0.85rem; color:var(--accent-red); font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:5px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ${p.store_name}
                        </div>

                        <h3 class="product-title" style="font-size:1.15rem; margin:0 0 8px 0; color:var(--brand-dark); line-height:1.35;" title="${p.name}">
                            <a href="/product-detail.html?id=${p.id}">${p.name}</a>
                        </h3>

                        <!-- Why this matches -->
                        <div style="background:#fbf8f2; border:1px solid #ede5d8; border-radius:10px; padding:8px 12px; margin-bottom:12px; font-size:0.8rem; color:#475569;">
                            <div style="font-weight:700; color:var(--brand-dark); margin-bottom:2px; display:flex; align-items:center; gap:5px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#df8a28" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                                เหตุผลที่แนะนำ:
                            </div>
                            <ul style="margin:2px 0 0 16px; padding:0; line-height:1.45;">
                                ${p.matchReasons.map(r => `<li>${r}</li>`).join('')}
                            </ul>
                        </div>

                        <!-- Store Support Goal Progress -->
                        ${p.support_goal_title ? `
                            <div style="margin-top:auto; margin-bottom:12px; padding:8px 10px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                                <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:600; color:#475569; margin-bottom:4px;">
                                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;" title="${p.support_goal_title}">${p.support_goal_title}</span>
                                    <b style="color:var(--primary);">${percent}%</b>
                                </div>
                                <div style="width:100%; height:5px; background:#e2e8f0; border-radius:9999px; overflow:hidden;">
                                    <div style="width:${percent}%; height:100%; background:var(--primary); border-radius:9999px;"></div>
                                </div>
                            </div>
                        ` : '<div style="margin-top:auto;"></div>'}

                        <div class="product-footer" style="padding-top:10px; border-top:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; margin-top:auto;">
                            <div>
                                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">ราคาจำหน่าย</span>
                                <div style="font-family:var(--font-heading); font-size:1.35rem; font-weight:800; color:var(--brand-dark); line-height:1.1;">
                                    ฿${(parseFloat(p.price) || 0).toLocaleString()}
                                </div>
                            </div>
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
            <div style="grid-column: 1 / -1; text-align:center; padding:3rem; background:#fff; border-radius:16px; border:1px solid var(--border-color);">
                ไม่พบสินค้าที่ตรงกับเงื่อนไข ลองทำแบบสอบถามใหม่อีกครั้ง
            </div>
        `;
    }

    // 2. Render Matched Stores (Contextual Support)
    if (stores.length > 0) {
        storeGrid.innerHTML = stores.map(s => {
            const target = s.support_goal_target || 20000;
            const current = s.support_goal_current || 0;
            const percent = Math.min(100, Math.round((current / target) * 100));
            return `
                <div class="support-goal-card" style="border:1.5px solid var(--border-color); border-radius:var(--radius-xl); box-shadow:var(--shadow-sm); background:#fff; padding:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                        <div>
                            <div style="font-size:0.8rem; font-weight:700; color:var(--accent-red); margin-bottom:2px;">
                                จังหวัด${s.province || 'ขอนแก่น'}
                            </div>
                            <h4 style="font-size:1.2rem; color:var(--brand-dark); margin:0;">${s.store_name}</h4>
                        </div>
                        <span class="disability-badge" style="background:#1b3329; color:#fef08a; font-weight:800; font-size:0.8rem;">
                            ตรงใจ ${s.matchPercentage}%
                        </span>
                    </div>

                    <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:1.25rem; line-height:1.6;">
                        ${(s.store_story || 'ร้านค้าช่างฝีมือผู้พิการ').substring(0, 110)}...
                    </p>

                    <div class="goal-progress-wrap" style="background:var(--bg-main); padding:10px 14px; border-radius:var(--radius-md); margin-bottom:1.25rem;">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px; font-weight:600;">
                            <span>${s.support_goal_title}</span>
                            <b style="color:var(--primary);">${percent}%</b>
                        </div>
                        <div class="goal-progress-bar">
                            <div class="goal-progress-fill" style="width:${percent}%;"></div>
                        </div>
                    </div>

                    <a href="/products.html?store_id=${s.store_id}" class="btn btn-outline-dark" style="width:100%; font-size:0.9rem; border-radius:9999px;">
                        ชมผลงานทั้งหมดของร้านนี้
                    </a>
                </div>
            `;
        }).join('');
    }

    resultsSection.scrollIntoView({ behavior: 'smooth' });
    if (window.A11y) {
        A11y.speak(`ระบบจับคู่ผลงานเสร็จสิ้น พบสินค้าที่ตรงกับความสนใจของคุณ ${products.length} ชิ้นงาน`);
    }
}

document.addEventListener('DOMContentLoaded', initMatchingWizard);
