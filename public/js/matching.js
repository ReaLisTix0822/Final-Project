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

    // 1. Render Top Matched Stores
    if (res.recommended_stores && res.recommended_stores.length > 0) {
        storeGrid.innerHTML = res.recommended_stores.map(s => {
            const target = s.support_goal_target || 20000;
            const current = s.support_goal_current || 0;
            const percent = Math.min(100, Math.round((current / target) * 100));
            return `
                <div class="support-goal-card" style="border:1.5px solid var(--border-color); border-radius:var(--radius-xl); box-shadow:var(--shadow-md);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                        <div>
                            <div style="font-size:0.8rem; font-weight:700; color:var(--accent-red); margin-bottom:2px;">
                                ${s.province || 'ขอนแก่น'}
                            </div>
                            <h3 style="font-size:1.2rem; color:var(--brand-dark); margin:0;">${s.store_name}</h3>
                        </div>
                        <span class="disability-badge" style="background:#1b3329; color:#fef08a; font-weight:800; font-size:0.8rem;">
                            MATCHING ${s.matchPercentage}%
                        </span>
                    </div>

                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1.25rem; line-height:1.6;">
                        ${s.store_story.substring(0, 110)}...
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

                    <a href="/products.html?store_id=${s.store_id}" class="btn btn-outline-dark" style="width:100%; font-size:0.9rem;">
                        ชมผลงานทั้งหมดของร้านนี้
                    </a>
                </div>
            `;
        }).join('');
    }

    // 2. Render Matched Products
    if (res.recommended_products && res.recommended_products.length > 0) {
        prodGrid.innerHTML = res.recommended_products.map(p => `
            <article class="product-card" style="border:1.5px solid var(--border-color);">
                <div class="product-image-wrap">
                    <img src="${p.image_url}" alt="${p.name}" class="product-image">
                    <div class="product-badge-group">
                        <span class="disability-badge" style="background:#df8a28; color:white; font-size:0.8rem; font-weight:800;">
                            ความตรงใจ ${p.matchPercentage}%
                        </span>
                        ${p.model_3d_url ? '<span class="badge-3d">3D / AR</span>' : ''}
                    </div>
                </div>
                <div class="product-content">
                    <div class="product-store">${p.store_name}</div>
                    <h3 class="product-title">${p.name}</h3>

                    <!-- Reasons -->
                    <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:8px 10px; margin-bottom:0.75rem; font-size:0.8rem; color:var(--text-muted);">
                        <b style="color:var(--brand-dark);">เหตุผลที่แนะนำ:</b>
                        <ul style="margin-left:14px; margin-top:2px; line-height:1.4;">
                            ${p.matchReasons.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="product-footer">
                        <div class="product-footer-row">
                            <span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">ราคาจำหน่าย</span>
                            <div class="product-price">฿${p.price.toLocaleString()}</div>
                        </div>
                        <div class="product-action-btns">
                            <a href="/product-detail.html?id=${p.id}" class="btn btn-sm btn-outline">ดูชิ้นงาน</a>
                            ${((window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || (!!localStorage.getItem('token') && !!localStorage.getItem('user'))) ? `
                            <button onclick="Cart.addItem({ id: ${p.id}, name: '${p.name.replace(/'/g, "\\'")}', price: ${p.price}, image_url: '${p.image_url}', store_id: ${p.store_id}, store_name: '${p.store_name.replace(/'/g, "\\'")}' })" class="btn btn-sm btn-primary">
                                สั่งซื้อ
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </article>
        `).join('');
    }

    resultsSection.scrollIntoView({ behavior: 'smooth' });
    if (window.A11y) {
        A11y.speak('ระบบจับคู่ร้านค้าและผลงานเสร็จสิ้น พบร้านค้าและสินค้าที่ตรงกับความตั้งใจของคุณ');
    }
}

document.addEventListener('DOMContentLoaded', initMatchingWizard);
