// ==============================================================================
// PRODUCT DETAIL & 3D CONTROLLER
// Handles 3D model-viewer, Storytelling TTS, Reviews & Tipping checkout
// ==============================================================================

let currentProduct = null;

async function loadProductDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id') || 1;
    const container = document.getElementById('product-detail-container');

    try {
        const res = await API.get(`/products/${productId}`);
        if (!res.success || !res.data) {
            container.innerHTML = `
                <div style="text-align:center; padding:4rem;">
                    <h2>ไม่พบข้อมูลสินค้านี้</h2>
                    <a href="/products.html" class="btn btn-primary" style="margin-top:1rem;">กลับไปหน้ารวมสินค้า</a>
                </div>
            `;
            return;
        }

        // Uses the model stored for this product only (no hard-coded sample model)
        currentProduct = res.data;
        renderProductDetail(currentProduct);
        if (Auth.isLoggedIn()) API.get('/favorites/ids').then(result => {
            setDetailFavorite((result.data || []).some(id => Number(id) === Number(currentProduct.id)));
        }).catch(() => {});
    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger); text-align:center; padding:3rem;">เกิดข้อผิดพลาด: ${err.message}</div>`;
    }
}

function renderProductDetail(p) {
    const container = document.getElementById('product-detail-container');
    const target = p.support_goal_target || 20000;
    const current = p.support_goal_current || 0;
    const percent = TJFormat.goalPercent(p.support_goal_current, p.support_goal_target);

    // Media Column: Check if 3D model exists and create toggleable view
    let mediaHtml = '';
    if (p.model_3d_url) {
        mediaHtml = `
            <div class="detail-media-card" style="background:var(--color-surface); border:1.5px solid var(--border-color); border-radius:var(--radius-lg); overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.04);">
                <!-- View Mode Switcher Pills -->
                <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--color-surface-alt); border-bottom:1px solid var(--color-divider);">
                    <div style="display:inline-flex; background:var(--color-surface-alt); padding:3px; border-radius:9999px; gap:4px;">
                        <button type="button" id="media-btn-image" onclick="switchMediaMode('image')" style="border:none; padding:6px 14px; border-radius:9999px; font-size: 1rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; background:var(--color-surface); color:var(--color-primary); box-shadow:0 1px 3px rgba(0,0,0,0.1); transition:all 0.2s ease;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
                            <span>รูปภาพสินค้า</span>
                        </button>
                        <button type="button" id="media-btn-3d" onclick="switchMediaMode('3d')" style="border:none; padding:6px 14px; border-radius:9999px; font-size: 1rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; background:transparent; color:var(--color-text-muted); transition:all 0.2s ease;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            <span>โมเดล 3D 360°</span>
                        </button>
                    </div>

                    <div style="font-size: 1rem; color:var(--color-text-muted); display:flex; align-items:center; gap:4px;">
                        <span id="media-indicator-tag" style="background:var(--color-surface-alt); padding:2px 8px; border-radius:9999px; border:1px solid var(--color-divider);">มุมมองภาพถ่าย</span>
                    </div>
                </div>

                <!-- 1. Photo View Box -->
                <div id="media-panel-image" style="position:relative; width:100%; aspect-ratio:4/3; background:var(--color-surface-alt); overflow:hidden; display:flex; align-items:center; justify-content:center;">
                    <img fetchpriority="high" data-image-store-id="${p.store_id || ''}" src="${p.image_url}" alt="${p.name}" id="main-product-image" style="width:100%; height:100%; object-fit:cover; transition:transform 0.3s ease;">
                </div>

                <!-- 2. 3D Model View Box -->
                <div id="media-panel-3d" style="position:relative; width:100%; aspect-ratio:4/3; background:var(--color-surface-alt); overflow:hidden; display:none;">
                    <model-viewer loading="lazy" 
                        src="${p.model_3d_url}" 
                        poster="${p.image_url}"
                        alt="${p.name} โมเดล 3 มิติ" 
                        auto-rotate 
                        camera-controls 
                        shadow-intensity="1"
                        style="width:100%; height:100%; min-height:380px;">
                    </model-viewer>
                    <div style="position:absolute; top:12px; left:12px; background:rgba(15,23,42,0.8); color:var(--color-on-primary-muted); padding:4px 10px; border-radius:var(--radius-full); font-size: 1rem; font-weight:600; z-index:5; display:flex; align-items:center; gap:5px; backdrop-filter:blur(4px);">
                        <span>🔄 หมุนดูรอบทิศทาง 360° / ซูมเข้า-ออก</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        mediaHtml = `
            <div class="detail-media-card detail-photo-only" style="border-radius:var(--radius-lg); overflow:hidden; border:1px solid var(--border-color); background:var(--color-surface-alt); position:relative; aspect-ratio:4/3;">
                <img fetchpriority="high" data-image-store-id="${p.store_id || ''}" src="${p.image_url}" alt="${p.name}" id="main-product-image" style="width:100%; height:100%; object-fit:cover;">
            </div>
        `;
    }

    const breadcrumb = document.getElementById('breadcrumb-product-name');
    if (breadcrumb) breadcrumb.textContent = p.name;
    container.innerHTML = `


        <!-- Product Hero Grid -->
        <div style="display:grid; grid-template-columns: 1.1fr 1fr; gap:2.5rem; margin-bottom:3rem;" id="product-detail-grid">
            <!-- Left: Media -->
            <div>
                ${mediaHtml}
                <div class="detail-thumbnails" role="group" aria-label="เลือกมุมมองสินค้า">
                    <button type="button" class="detail-thumb" data-media-thumb="image" aria-pressed="true" aria-label="ดูรูปภาพสินค้า" onclick="switchMediaMode('image')"><img loading="lazy" decoding="async" src="${p.image_url}" alt="" data-image-store-id="${p.store_id}"></button>
                    ${p.model_3d_url ? '<button type="button" class="detail-thumb detail-model-thumb" data-media-thumb="3d" aria-pressed="false" onclick="switchMediaMode(&quot;3d&quot;)" aria-label="3D ดูโมเดลสามมิติ"><span aria-hidden="true">◇</span> 3D</button>' : ''}
                    <a class="detail-reviews-link" href="#reviews-heading"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>อ่านรีวิวจากผู้ซื้อ</a>
                </div>
                <div style="margin-top:1rem; display:flex; gap:8px; align-items:center; color:var(--text-muted); font-size: 1rem;">
                    <span class="nowrap">ผู้ผลิต:</span> <b>${p.store_name}</b> | 
                    <span class="nowrap">จังหวัด:</span> <b>${p.province || 'ขอนแก่น'}</b>
                </div>
            </div>

            <!-- Right: Details, Price & Actions -->
            <div class="detail-info" style="display:flex; flex-direction:column;">
                <div class="detail-category" style="display:flex; align-items:center; gap:8px; margin-bottom:0.75rem;">
                    <span class="disability-badge" style="background:var(--color-text); color:var(--color-on-primary-muted);">
                        ${getDisabilityIcon(p.disability_type)} ${getDisabilityLabel(p.disability_type)}
                    </span>
                    <span style="font-size: 1rem; color:var(--text-muted);">หมวดหมู่: ${p.category_name}</span>
                </div>

                <h1 style="font-size:1.8rem; margin-bottom:0.75rem;">${p.name}</h1>

                <div class="detail-rating" style="display:flex; align-items:center; gap:12px; margin-bottom:1.25rem;">
                    <div style="font-size:1.1rem; color:var(--color-accent); font-weight:700;">
                        ${Number(p.review_count) > 0 ? `คะแนน ${parseFloat(p.average_rating).toFixed(1)} <span style="font-size: 1rem; color:var(--text-muted); font-weight:normal;">(${p.review_count} รีวิวจากผู้ซื้อจริง)</span>` : '<span style="color:var(--text-muted); font-weight:600;">ยังไม่มีรีวิว</span>'}
                    </div>
                    <button onclick="A11y.speak('${p.name}. ราคา ${TJFormat.number(p.price)} บาท. ' + document.getElementById('story-content').innerText)" class="btn btn-tts" title="อ่านออกเสียงข้อมูลทั้งหมด">
                        ฟังเรื่องราวและรายละเอียด
                    </button>
                </div>

                <!-- Price Box -->
                <div class="detail-price" style="background:var(--color-success-soft); border:1px solid var(--color-divider); padding:1.25rem; border-radius:var(--radius-lg); margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size: 1rem; color:var(--color-success); font-weight:600;">ราคาจำหน่าย</div>
                        <div style="font-family:var(--font-heading); font-size:2.2rem; font-weight:700; color:var(--color-success);">
                            ${TJFormat.money(p.price)}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size: 1rem; color:${p.stock > 0 ? 'var(--color-success)' : 'var(--color-error)'}; font-weight:600;">
                            ${p.stock > 0 ? `คงเหลือ ${p.stock} ชิ้น` : 'สินค้าหมดชั่วคราว'}
                        </span>
                    </div>
                </div>

                <div class="detail-specs-card">
                    <dl class="detail-specs">
                        <dt>ขนาด</dt><dd>${p.dimensions || 'ไม่ระบุ'}</dd>
                        <dt>น้ำหนัก</dt><dd>${p.weight || 'ไม่ระบุ'}</dd>
                        ${p.material ? `<dt>วัสดุ</dt><dd>${p.material}</dd>` : ''}
                        ${p.pattern ? `<dt>ลวดลาย</dt><dd>${p.pattern}</dd>` : ''}
                        <dt>เทคนิคช่าง</dt><dd>${p.craft_technique || 'งานฝีมือแฮนด์เมด'}</dd>
                        <dt>ผู้ผลิต</dt><dd><a href="/store-detail.html?id=${p.store_id}">${p.store_name}</a></dd>
                        <dt>จังหวัด</dt><dd>${p.province || 'ไม่ระบุ'}</dd>
                        <dt>คงเหลือ</dt><dd>${p.stock} ชิ้น</dd>
                    </dl>

                    <section class="detail-colors" id="detail-colors" aria-labelledby="detail-colors-title" hidden></section>
                </div>

                <!-- Quantity & Action buttons -->
                <div id="product-actions-wrapper" style="margin-top:auto; display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:4px;">
                        <label for="buy-qty-input" style="font-weight:700; font-size: 1rem; color:var(--text-main);">จำนวน:</label>
                        <div style="display:inline-flex; align-items:center; border:1.5px solid var(--border-color); border-radius:var(--radius-md); background:var(--color-surface); overflow:hidden;">
                            <button type="button" onclick="adjustQty(-1)" style="border:none; background:transparent; padding:6px 14px; font-weight:700; font-size:1.1rem; cursor:pointer;" aria-label="ลดจำนวน">-</button>
                            <input type="number" id="buy-qty-input" value="1" min="1" max="${p.stock || 99}" readonly style="width:48px; border:none; text-align:center; font-weight:700; font-size:1rem; background:transparent;">
                            <button type="button" onclick="adjustQty(1)" style="border:none; background:transparent; padding:6px 14px; font-weight:700; font-size:1.1rem; cursor:pointer;" aria-label="เพิ่มจำนวน">+</button>
                        </div>
                        <span style="font-size: 1rem; color:var(--text-muted);">สูงสุด ${p.stock} ชิ้น</span>
                    </div>
                    ${((typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || (window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn()) || (!!localStorage.getItem('token') && !!localStorage.getItem('user'))) ? `
                    <div style="display:flex; gap:1rem;">
                        <button onclick="handleAddToCart(${p.id}, false)" class="btn btn-lg btn-outline-primary" style="flex:1; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                            เพิ่มลงตะกร้า
                        </button>
                        <button onclick="handleAddToCart(${p.id}, true)" class="btn btn-lg btn-primary" style="flex:1.2; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                            สั่งซื้อทันที
                        </button>
                    </div>
                    ` : `
                    <a href="/login.html?redirect=${encodeURIComponent(window.location.href)}" class="btn btn-lg btn-primary" style="width:100%; text-align:center; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
                        เข้าสู่ระบบเพื่อสั่งซื้อและเพิ่มลงตะกร้า
                    </a>
                    `}
                    <div class="detail-secondary-actions">
                        <button type="button" class="btn-report-link" onclick="ReportDialog.open('product', ${p.id}, currentProduct && currentProduct.name)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 22V4M4 4h13l-2 4 2 4H4"/></svg>รายงานสินค้านี้</button>
                        ${window.Auth && Auth.getUser()?.role === 'admin' ? (Number(p.removed_by_admin)
                            ? `<a class="btn-admin-remove" href="/admin-products.html?status=removed">ถูกนำออกแล้ว: ${String(p.removal_reason || '').replace(/[&<>"']/g, '')}</a>`
                            : `<a class="btn-admin-remove" href="/admin-products.html?remove=${p.id}">นำสินค้าออก (ผู้ดูแลระบบ)</a>`) : ''}
                        <button type="button" class="detail-favorite" id="detail-favorite" aria-label="เพิ่มสินค้าในรายการโปรด" aria-pressed="false" onclick="toggleDetailFavorite()">♡</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Artisan Storytelling Section (Key Focus of the Project) -->
        <section style="background:var(--bg-card); border:2px solid var(--border-color); border-radius:var(--radius-lg); padding:2rem; margin-bottom:3rem;" aria-labelledby="story-heading">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                <h2 id="story-heading" class="section-title" style="display:flex; align-items:center; gap:8px;">
                    เรื่องราวความเป็นมาและคุณค่าของผลงาน
                </h2>
                <button onclick="A11y.speak(document.getElementById('story-content').innerText)" class="btn-tts">
                    ฟังเรื่องราว
                </button>
            </div>

            <div id="story-content" style="line-height:1.8; font-size:1.05rem; color:var(--text-main); margin-bottom:1.75rem;">
                <p style="margin-bottom:1rem;">
                    <b>แรงบันดาลใจและกระบวนการสร้างสรรค์:</b><br>
                    ${p.story || p.description}
                </p>
                <p style="background:var(--color-surface-alt); border-left:4px solid var(--primary); padding:1rem; border-radius:0 8px 8px 0; margin-bottom:1rem;">
                    <a class="btn btn-outline-dark" href="/messages.html?store_id=${encodeURIComponent(p.store_id)}">แชทกับผู้ขาย</a><br><b>เรื่องราวจากร้านค้า (${p.store_name}):</b><br>
                    ${p.store_story || 'ร้านค้ามุ่งมั่นผลิตสินค้าที่มีคุณภาพและถ่ายทอดคุณค่าทางวัฒนธรรมและจิตวิญญาณของช่างฝีมือ'}
                </p>
            </div>

            <!-- Support Goal of this Maker -->
            <div style="background:var(--color-info-soft); border:1px solid var(--color-divider); border-radius:var(--radius-lg); padding:1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <span style="font-size: 1rem; font-weight:700; color:var(--color-info); text-transform:uppercase;">เป้าหมายพัฒนาอาชีพของช่างฝีมือท่านนี้</span>
                        <h3 style="font-size:1.1rem; color:var(--color-info); margin-top:2px;">${p.support_goal_title || 'ระดมทุนสนับสนุนอุปกรณ์'}</h3>
                    </div>
                    <span style="font-size:1.1rem; font-weight:700; color:var(--color-info);">${percent}%</span>
                </div>
                <div class="goal-progress-bar" style="height:14px; background:var(--color-info-soft);">
                    <div class="goal-progress-fill" style="width:${percent}%;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size: 1rem; color:var(--text-muted); margin-top:6px;">
                    <span>ระดมทุนได้แล้ว <b>${TJFormat.money(current)}</b></span>
                    <span>เป้าหมาย <b>${TJFormat.money(target)}</b></span>
                </div>
            </div>
        </section>

        <!-- Customer Reviews & Seller Responses -->
        <section style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:2rem;" aria-labelledby="reviews-heading">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
                <h2 id="reviews-heading" class="section-title">รีวิวและความคิดเห็น (${p.reviews ? p.reviews.length : 0})</h2>
                <button onclick="showReviewModal()" class="btn btn-sm btn-outline-primary">เขียนรีวิวสินค้า</button>
            </div>

            <!-- Review list -->
            <div id="reviews-list" style="display:flex; flex-direction:column; gap:1.25rem;">
                ${p.reviews && p.reviews.length > 0 ? p.reviews.map(r => `
                    <div style="border-bottom:1px solid var(--border-color); padding-bottom:1.25rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <img loading="lazy" decoding="async" src="${r.buyer_avatar || '/images/default-avatar.svg'}" alt="${r.buyer_name}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                                <b style="font-size: 1rem;">${r.buyer_name}</b>
                                <span style="color:var(--color-accent);">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                            </div>
                            <span style="font-size: 1rem; color:var(--text-muted);">${new Date(r.created_at).toLocaleDateString('th-TH')}</span>
                        </div>
                        <p style="font-size: 1rem; line-height:1.6; color:var(--text-main); margin-bottom:8px;">
                            ${r.comment}
                        </p>
                        ${r.seller_reply ? `
                            <div style="background:var(--color-surface-alt); border-left:3px solid var(--primary); padding:10px 14px; border-radius:0 8px 8px 0; margin-top:8px; font-size: 1rem;">
                                <b style="color:var(--primary-dark);">คำตอบกลับจากช่างฝีมือ (${p.store_name}):</b>
                                <div style="margin-top:2px;">${r.seller_reply}</div>
                            </div>
                        ` : ''}
                    </div>
                `).join('') : '<div style="color:var(--text-muted); text-align:center; padding:1.5rem;">ยังไม่มีรีวิวสำหรับสินค้านี้ ร่วมเป็นคนแรกที่ส่งกำลังใจให้ผู้ผลิต!</div>'}
            </div>
        </section>

        <!-- Review Modal -->
        <div id="review-modal" class="modal-backdrop" role="dialog" aria-modal="true" aria-label="เขียนรีวิวสินค้า">
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3 style="margin:0;">เขียนรีวิวสินค้า "${p.name}"</h3>
                    <button onclick="closeReviewModal()" class="btn btn-sm btn-outline" style="padding:2px 8px;">✕</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:1rem;">
                        <label for="review-rating-select" style="display:block; font-weight:600; margin-bottom:6px;">ให้คะแนนความพึงพอใจ</label>
                        <select id="review-rating-select" style="width:100%; padding:8px 12px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:1rem;">
                            <option value="5">⭐⭐⭐⭐⭐ 5 ดาว - ประทับใจมากที่สุด</option>
                            <option value="4">⭐⭐⭐⭐ 4 ดาว - ดีมาก</option>
                            <option value="3">⭐⭐⭐ 3 ดาว - ปานกลาง</option>
                            <option value="2">⭐⭐ 2 ดาว - พอใช้</option>
                            <option value="1">⭐ 1 ดาว - ต้องปรับปรุง</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-weight:600; margin-bottom:6px;">ข้อความรีวิวและกำลังใจแก่ช่างฝีมือ</label>
                        <textarea id="review-comment-input" rows="4" placeholder="บอกเล่าความรู้สึก ความประณีตของชิ้นงาน หรือส่งกำลังใจ..." style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size: 1rem; font-family:inherit;"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeReviewModal()" class="btn btn-outline">ยกเลิก</button>
                    <button onclick="submitReview(${p.id})" class="btn btn-primary">ส่งรีวิว</button>
                </div>
            </div>
        </div>
    `;
    if (window.ProductColors) ProductColors.render(document.getElementById('detail-colors'), p.image_url, p.name);
}

function adjustQty(delta) {
    const input = document.getElementById('buy-qty-input');
    if (!input) return;
    let val = parseInt(input.value, 10) || 1;
    const max = currentProduct ? (currentProduct.stock || 99) : 99;
    val = Math.max(1, Math.min(max, val + delta));
    input.value = val;
}

function updateProductDetailAuthUI() {
    if (!currentProduct) return;
    const actionsWrapper = document.getElementById('product-actions-wrapper');
    if (!actionsWrapper) return;

    const isLoggedIn = (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));

    if (isLoggedIn) {
        actionsWrapper.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:4px;">
                <label for="buy-qty-input" style="font-weight:700; font-size: 1rem; color:var(--text-main);">จำนวน:</label>
                <div style="display:inline-flex; align-items:center; border:1.5px solid var(--border-color); border-radius:var(--radius-md); background:var(--color-surface); overflow:hidden;">
                    <button type="button" onclick="adjustQty(-1)" style="border:none; background:transparent; padding:6px 14px; font-weight:700; font-size:1.1rem; cursor:pointer;" aria-label="ลดจำนวน">-</button>
                    <input type="number" id="buy-qty-input" value="1" min="1" max="${currentProduct.stock || 99}" readonly style="width:48px; border:none; text-align:center; font-weight:700; font-size:1rem; background:transparent;">
                    <button type="button" onclick="adjustQty(1)" style="border:none; background:transparent; padding:6px 14px; font-weight:700; font-size:1.1rem; cursor:pointer;" aria-label="เพิ่มจำนวน">+</button>
                </div>
                <span style="font-size: 1rem; color:var(--text-muted);">ชิ้น</span>
            </div>
            <div style="display:flex; gap:1rem;">
                <button onclick="handleAddToCart(${currentProduct.id}, false)" class="btn btn-lg btn-outline-primary" style="flex:1; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                    เพิ่มลงตะกร้า
                </button>
                <button onclick="handleAddToCart(${currentProduct.id}, true)" class="btn btn-lg btn-primary" style="flex:1.2; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                    สั่งซื้อทันที
                </button>
            </div>
        `;
    } else {
        actionsWrapper.innerHTML = `
            <a href="/login.html?redirect=${encodeURIComponent(window.location.href)}" class="btn btn-lg btn-primary" style="width:100%; text-align:center; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
                เข้าสู่ระบบเพื่อสั่งซื้อและเพิ่มลงตะกร้า
            </a>
        `;
    }
}

function handleAddToCart(productId, redirectNow = false) {
    const isLoggedIn = (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));

    if (!isLoggedIn) {
        if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนสั่งซื้อสินค้า', 'warning');
        setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`, 800);
        return;
    }
    if (!currentProduct) return;

    if (Number(currentProduct.stock) <= 0) { window.showToast?.('สินค้าหมดชั่วคราว', 'warning'); return; }
    const qtyInput = document.getElementById('buy-qty-input');
    const quantity = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

    Cart.addItem({
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        image_url: currentProduct.image_url,
        store_id: currentProduct.store_id,
        store_name: currentProduct.store_name,
        disability_type: currentProduct.disability_type,
        stock: Number(currentProduct.stock)
    }, quantity);

    if (redirectNow) {
        window.location.href = '/cart.html';
    }
}

function showReviewModal() {
    const isLoggedIn = (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));

    if (!isLoggedIn) {
        window.showToast('กรุณาเข้าสู่ระบบก่อนเขียนรีวิว', 'warning');
        setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`, 1000);
        return;
    }
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.add('active');
}

function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.remove('active');
}

async function submitReview(productId) {
    const rating = document.getElementById('review-rating-select').value;
    const comment = document.getElementById('review-comment-input').value.trim();

    if (!comment) {
        window.showToast('กรุณากรอกข้อความรีวิว', 'warning');
        return;
    }

    try {
        const res = await API.post('/reviews', {
            product_id: productId,
            rating: parseInt(rating, 10),
            comment: comment
        });

        if (res.success) {
            window.showToast('บันทึกรีวิวสำเร็จ ขอขอบพระคุณเป็นอย่างยิ่ง', 'success');
            closeReviewModal();
            loadProductDetail();
        }
    } catch (err) {
        window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

function getDisabilityIcon(type) {
    if (type === 'visual') return 'สายตา';
    if (type === 'hearing') return 'การได้ยิน';
    if (type === 'physical') return 'การเคลื่อนไหว';
    if (type === 'intellectual') return 'ศิลปินพิเศษ';
    if (type === 'organization') return 'องค์กร';
    return 'ช่างฝีมือ';
}

function getDisabilityLabel(type) {
    if (type === 'visual') return 'ช่างฝีมือสายตา';
    if (type === 'hearing') return 'ช่างทอ & ขนม (การได้ยิน)';
    if (type === 'physical') return 'งานไม้ & หนัง (วีลแชร์)';
    if (type === 'intellectual') return 'ผู้ที่มีความบกพร่องทางสติปัญญาและการเรียนรู้';
    if (type === 'organization') return 'องค์กรสำหรับผู้ที่มีความพิการ';
    return 'ผู้ที่มีความพิการ';
}

function switchMediaMode(mode) {
    const imgPanel = document.getElementById('media-panel-image');
    const d3Panel = document.getElementById('media-panel-3d');
    const btnImg = document.getElementById('media-btn-image');
    const btn3d = document.getElementById('media-btn-3d');
    const indicator = document.getElementById('media-indicator-tag');

    if (!imgPanel || !d3Panel || !btnImg || !btn3d) return;
    // Selected thumbnail: thick brand-colour border (aria-pressed), the others stay at full opacity
    document.querySelectorAll('[data-media-thumb]').forEach(thumb => thumb.setAttribute('aria-pressed', String(thumb.dataset.mediaThumb === mode)));

    if (mode === '3d') {
        imgPanel.style.display = 'none';
        d3Panel.style.display = 'block';

        // Update button states
        btn3d.style.background = 'var(--color-primary)';
        btn3d.style.color = 'var(--color-on-primary)';
        btn3d.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';

        btnImg.style.background = 'transparent';
        btnImg.style.color = 'var(--color-text-muted)';
        btnImg.style.boxShadow = 'none';

        if (indicator) {
            indicator.innerText = 'มุมมอง 3D Interactive';
            indicator.style.background = 'var(--color-primary-soft)';
            indicator.style.color = 'var(--color-accent)';
            indicator.style.borderColor = 'var(--color-accent)';
        }

        if (window.showToast) {
            window.showToast('เปิดโหมดโมเดล 3D 360° (คลิกลากเพื่อหมุน และซูมเข้า-ออก)', 'info', 2500);
        }
    } else {
        d3Panel.style.display = 'none';
        imgPanel.style.display = 'flex';

        // Update button states
        btnImg.style.background = 'var(--color-surface)';
        btnImg.style.color = 'var(--color-primary)';
        btnImg.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

        btn3d.style.background = 'transparent';
        btn3d.style.color = 'var(--color-text-muted)';
        btn3d.style.boxShadow = 'none';

        if (indicator) {
            indicator.innerText = 'มุมมองภาพถ่าย';
            indicator.style.background = 'var(--color-surface-alt)';
            indicator.style.color = 'var(--color-text-muted)';
            indicator.style.borderColor = 'var(--color-divider)';
        }
    }
}

window.switchMediaMode = switchMediaMode;

document.addEventListener('DOMContentLoaded', loadProductDetail);

function setDetailFavorite(active) {
    const button = document.getElementById('detail-favorite');
    if (!button) return;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'นำสินค้าออกจากรายการโปรด' : 'เพิ่มสินค้าในรายการโปรด');
    button.textContent = active ? '♥' : '♡';
}
async function toggleDetailFavorite() {
    if (!Auth.isLoggedIn()) { location.href = `/login.html?redirect=${encodeURIComponent(location.href)}`; return; }
    const button = document.getElementById('detail-favorite');
    button.disabled = true;
    try {
        const result = await API.post('/favorites/toggle', { product_id: currentProduct.id });
        if (!result.success) throw new Error(result.message || 'บันทึกรายการโปรดไม่สำเร็จ');
        setDetailFavorite(result.is_favorited);
    } catch (error) { window.showToast?.(error.message, 'error'); }
    finally { button.disabled = false; }
}
