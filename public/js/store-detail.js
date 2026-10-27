// ==============================================================================
// TALADJAI SINGLE STORE PROFILE CONTROLLER (MATCHES media_1788146358977.png)
// ==============================================================================

let currentStore = null;
let currentStoreProducts = [];
let selectedTip = 100;

async function initStoreDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('id');
    if (!storeId) {
        showStoreNotFound();
        return;
    }

    await loadStoreData(storeId);
    await loadStoreFollowState();
    scrollToProductsIfLinked();
}

// Links ending in #store-products (e.g. "ชมผลงานทั้งหมดของร้านนี้") open at the products.
// Products load after the page, so the browser's own jump lands too high; scroll again once they are in.
function scrollToProductsIfLinked() {
    if (location.hash !== '#store-products') return;
    const section = document.getElementById('store-products-section');
    const heading = document.getElementById('store-products-title');
    if (!section) return;
    section.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (heading) heading.focus({ preventScroll: true });
}

// No such store (API 404): show a message instead of someone else's store
function showStoreNotFound() {
    currentStore = null;
    document.title = 'ไม่พบร้านค้า | ตลาดใจ';
    const bc = document.getElementById('breadcrumb-store-name');
    if (bc) bc.innerText = 'ไม่พบร้านค้า';
    document.getElementById('store-page-content').hidden = true;
    document.getElementById('store-not-found').hidden = false;
}

async function loadStoreData(storeId) {
    try {
        let storeRes;
        try {
            storeRes = await API.get(`/stores/${encodeURIComponent(storeId)}`);
        } catch (err) {
            showStoreNotFound();
            return;
        }
        if (!storeRes.success || !storeRes.data) {
            showStoreNotFound();
            return;
        }
        currentStore = storeRes.data;
        document.getElementById('store-page-content').hidden = false;
        renderStoreProfile(currentStore);

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

// First sentence of a story. Thai has no full stop, so it ends at a line break, a sentence mark,
// or the first space after ~40 characters (and never runs longer than ~120 characters).
function firstStorySentence(story) {
    const text = String(story || '').trim();
    if (!text) return '';
    const marked = text.split(/\n|(?<=[.!?。])\s/)[0].trim();
    if (marked.length <= 120 && marked.length < text.length) return marked;
    const words = text.split(/\s+/);
    let sentence = '';
    for (const word of words) {
        if (sentence && (sentence.length >= 40 || sentence.length + word.length > 120)) break;
        sentence = sentence ? `${sentence} ${word}` : word;
    }
    return sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
}

function renderStoreProfile(store) {
    if (!store) return;

    document.title = `${store.store_name} | ตลาดใจ`;

    // Breadcrumb
    const bc = document.getElementById('breadcrumb-store-name');
    if (bc) bc.innerText = store.store_name;

    // Stats strip: real values only
    const setStat = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    const reviews = Number(store.total_reviews) || 0;
    if (reviews > 0) {
        const avg = Number(store.average_rating);
        const shown = avg >= 5 ? 5 : Math.min(Math.round(avg * 10) / 10, 4.9);
        setStat('stat-rating', Number.isInteger(shown) ? String(shown) : shown.toFixed(1));
    } else {
        setStat('stat-rating', 'ยังไม่มีรีวิว');
    }
    setStat('stat-orders-count', (Number(store.completed_orders) || 0).toLocaleString('th-TH'));
    setStat('stat-followers', (Number(store.follower_count) || 0).toLocaleString('th-TH'));

    document.getElementById("store-chat-link").href = `/messages.html?store_id=${encodeURIComponent(store.id)}`;

    // Header & Avatar
    const nameEl = document.getElementById('store-name');
    if (nameEl) nameEl.innerText = store.store_name;

    const avatarEl = document.getElementById('store-avatar');
    const ownerInitial = document.getElementById('store-owner-initial');
    if (ownerInitial) {
        ownerInitial.textContent = Array.from((store.owner_name || '').trim())[0] || '?';
        ownerInitial.hidden = false;
    }
    if (avatarEl) {
        avatarEl.hidden = true;
        avatarEl.alt = `รูปโปรไฟล์เจ้าของร้าน ${store.owner_name || ''}`;
        avatarEl.onload = () => {
            avatarEl.hidden = false;
            if (ownerInitial) ownerInitial.hidden = true;
        };
        avatarEl.onerror = () => {
            avatarEl.hidden = true;
            if (ownerInitial) ownerInitial.hidden = false;
        };
        if (store.owner_avatar_url) avatarEl.src = store.owner_avatar_url;
        else avatarEl.removeAttribute('src');
    }

    const coverEl = document.getElementById('store-hero-cover');
    if (coverEl) {
        const banner = coverEl.closest('.store-hero-banner');
        coverEl.hidden = true;
        banner.classList.remove('has-cover');
        coverEl.onload = () => {
            coverEl.hidden = false;
            banner.classList.add('has-cover');
        };
        coverEl.onerror = () => {
            coverEl.hidden = true;
            banner.classList.remove('has-cover');
        };
        if (store.cover_image) coverEl.src = store.cover_image;
        else coverEl.removeAttribute('src');
    }

    const taglineEl = document.getElementById('store-tagline');
    if (taglineEl) {
        taglineEl.innerText = store.story ? store.story.substring(0, 100) + '...' : `สินค้าหัตถกรรมประณีต โดย ${store.store_name} • สร้างสรรค์ด้วยความตั้งใจ`;
    }

    // Modal name
    const tipStoreName = document.getElementById('tip-modal-store-name');
    if (tipStoreName) tipStoreName.innerText = store.store_name;

    const verifiedBadge = document.getElementById('store-verified-badge');
    if (verifiedBadge) verifiedBadge.hidden = store.verification_status !== 'approved';

    // Headline quote: the first sentence of this store's own story (hidden when there is no story)
    const quoteEl = document.getElementById('store-headline-quote');
    if (quoteEl) {
        const quote = firstStorySentence(store.story);
        quoteEl.textContent = quote ? `“${quote}”` : '';
        quoteEl.hidden = !quote;
    }

    const storyP1 = document.getElementById('store-story-text-1');
    if (storyP1 && store.story) {
        storyP1.innerText = store.story;
    }

    renderStoreStoryVideo(store);

    const storyP2 = document.getElementById('store-story-text-2');
    if (storyP2) {
        storyP2.innerText = `รายได้จากทุกคำสั่งซื้อและทิปที่ได้รับ ถูกนำไปต่อยอดซื้ออุปกรณ์และพัฒนาอาชีพ: "${store.support_goal_title || 'ระดมทุนสนับสนุนอุปกรณ์ช่าง'}" เพื่อสร้างความยั่งยืนให้แก่ครอบครัว`;
    }

    // Goal Card
    const target = Number(store.support_goal_target) || 20000;
    const current = Number(store.support_goal_current) || 0;
    const percent = TJFormat.goalPercent(store.support_goal_current, store.support_goal_target);

    const goalTitle = document.getElementById('goal-card-title');
    if (goalTitle) goalTitle.innerText = `เป้าหมาย: ${store.support_goal_title || 'พัฒนาอาชีพช่างฝีมือ'}`;

    const goalPercent = document.getElementById('goal-card-percent');
    if (goalPercent) goalPercent.innerText = `${percent}%`;

    const goalBar = document.getElementById('goal-card-bar');
    if (goalBar) goalBar.style.width = `${percent}%`;

    const goalCurrent = document.getElementById('goal-card-current');
    if (goalCurrent) goalCurrent.innerText = `ได้รับแล้ว ${TJFormat.money(current)}`;

    const goalTarget = document.getElementById('goal-card-target');
    if (goalTarget) goalTarget.innerText = `จากเป้าหมาย ${TJFormat.money(target)}`;
}

function renderStoreProducts(products) {
    const grid = document.getElementById('store-products-grid');
    const statProds = document.getElementById('stat-products-count');
    if (statProds) statProds.innerText = products.length.toLocaleString('th-TH');

    if (!products || products.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">ร้านนี้กำลังเตรียมลงสินค้าเพิ่มเติม</div>';
        return;
    }

    grid.innerHTML = products.map((p, idx) => {
        const reviewCount = Number(p.review_count) || 0;
        const rating = reviewCount > 0 ? `คะแนน ${parseFloat(p.average_rating).toFixed(1)} (${reviewCount})` : 'ยังไม่มีรีวิว';
        const matchPercent = 90 + (idx % 8);

        return `
            <div class="taladjai-product-card" onclick="window.location.href='/product-detail.html?id=${p.id}'">
                <div class="card-top-pin" aria-hidden="true"></div>
                <div class="card-thumb-wrap">
                    <img data-image-store-id="${p.store_id || ''}" src="${p.image_url}" alt="${p.name}" class="card-thumb-img" loading="lazy">
                    <div style="position:absolute; bottom:10px; left:10px; background:var(--color-primary); color:var(--color-on-primary); font-size: 1rem; font-weight:700; padding:3px 9px; border-radius:9999px; display:inline-flex; align-items:center; gap:4px;">
                        <span style="width:6px; height:6px; border-radius:50%; background:var(--color-primary); display:inline-block;"></span> ตรงใจ ${matchPercent}%
                    </div>
                </div>
                <h3 style="font-size:1.05rem; font-weight:800; color:var(--brand-dark); line-height:1.35; margin-bottom:6px; min-height:42px;">
                    ${p.name}
                </h3>
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:auto; border-top:1px dashed var(--color-divider); padding-top:10px;">
                    <div style="font-family:var(--font-heading); font-size:1.25rem; font-weight:800; color:var(--brand-dark);">
                        ${TJFormat.money(p.price)}
                    </div>
                    <div style="font-size: 1rem; font-weight:700; color:var(--text-main);">
                        ${rating}
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

function requireLoginFor(message) {
    if (window.Auth && Auth.isLoggedIn()) return true;
    if (window.showToast) window.showToast(message, 'warning');
    setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`, 800);
    return false;
}

async function confirmSendTip() {
    const amount = parseFloat(document.getElementById('custom-tip-amount').value) || selectedTip;
    if (!currentStore || !requireLoginFor('กรุณาเข้าสู่ระบบก่อนให้ทิปสนับสนุน')) return;
    try {
        const res = await API.post('/tips', { store_id: currentStore.id, amount });
        closeTipModal();
        currentStore.support_goal_current = res.data.support_goal_current;
        renderStoreProfile(currentStore);
        if (window.showToast) window.showToast(res.message, 'success');
    } catch (err) {
        if (window.showToast) window.showToast(err.message || 'ส่งทิปไม่สำเร็จ', 'error');
    }
}

function renderStoreFollowButton(isFollowing) {
    const btn = document.getElementById('store-follow-btn');
    if (!btn) return;
    btn.textContent = isFollowing ? 'กำลังติดตาม' : 'ติดตามร้าน';
    btn.setAttribute('aria-pressed', String(isFollowing));
    btn.classList.toggle('btn-primary', isFollowing);
    btn.classList.toggle('btn-outline', !isFollowing);
}

async function loadStoreFollowState() {
    if (!currentStore || !(window.Auth && Auth.isLoggedIn())) return;
    try {
        const res = await API.get('/follows/ids');
        renderStoreFollowButton(res.data.includes(Number(currentStore.id)));
    } catch (err) {
        console.warn('Unable to load follow state:', err.message);
    }
}

async function toggleStoreFollow() {
    if (!currentStore || !requireLoginFor('กรุณาเข้าสู่ระบบก่อนติดตามร้านค้า')) return;
    const btn = document.getElementById('store-follow-btn');
    btn.disabled = true;
    try {
        const res = await API.post('/follows/toggle', { store_id: currentStore.id });
        renderStoreFollowButton(res.is_following);
        const followers = document.getElementById('stat-followers');
        if (followers && Number.isInteger(res.follower_count)) followers.textContent = res.follower_count.toLocaleString('th-TH');
        if (window.showToast) window.showToast(res.message, 'success');
    } catch (err) {
        if (window.showToast) window.showToast(err.message || 'ไม่สามารถติดตามร้านค้าได้', 'error');
    } finally {
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', initStoreDetailPage);


// Seller's story video (uploaded file or YouTube). Uploaded videos get automatic Thai captions
// (WebVTT made by Gemini) shown in a caption bar directly under the player; YouTube uses its own captions.
function renderStoreStoryVideo(store) {
    const box = document.getElementById('store-story-video');
    if (!box) return;
    const url = String(store.story_video_url || '');
    if (!url) { box.hidden = true; box.innerHTML = ''; return; }
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const name = esc(store.store_name);
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
    const isLocal = /^\/(uploads\/store-videos|videos\/stories)\//.test(url);
    const captions = isLocal && store.story_video_captions_url ? esc(store.story_video_captions_url) : '';
    const player = yt
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&cc_load_policy=1&cc_lang_pref=th&hl=th" title="วิดีโอเรื่องราวของร้าน ${name}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`
        : isLocal
            ? `<video id="store-story-video-el" controls preload="metadata" playsinline aria-label="วิดีโอเรื่องราวของร้าน ${name}" ${store.cover_image ? `poster="${esc(store.cover_image)}"` : ''}>
                   <source src="${esc(url)}" type="${url.endsWith('.webm') ? 'video/webm' : 'video/mp4'}">
                   ${captions ? `<track kind="captions" srclang="th" label="ภาษาไทย (สร้างอัตโนมัติ)" src="${captions}" default>` : ''}
                   เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ
               </video>`
            : '';
    if (!player) { box.hidden = true; return; }
    const transcript = String(store.story_video_transcript || '').trim();
    const status = store.story_video_captions_status;
    box.innerHTML = `
        <h3 id="store-story-video-title" class="store-story-video-title">ชมวิดีโอเรื่องราวของร้าน</h3>
        <div class="store-story-video-player">${player}</div>
        ${captions ? `
        <div class="store-video-captionbar">
            <p class="store-video-caption" id="store-video-caption" aria-hidden="true">กดเล่นวิดีโอเพื่อดูคำบรรยาย</p>
            <button type="button" class="store-video-cc" id="store-video-cc" aria-pressed="true" aria-label="CC ซ่อนคำบรรยายใต้วิดีโอ">CC</button>
        </div>
        <p class="store-video-caption-note">คำบรรยายสร้างอัตโนมัติด้วย AI อาจคลาดเคลื่อนได้</p>`
        : isLocal && status === 'processing' ? '<p class="store-video-caption-note">กำลังสร้างคำบรรยายอัตโนมัติ...</p>' : ''}
        ${transcript ? `
        <details class="store-story-video-transcript">
            <summary>อ่านคำบรรยายวิดีโอทั้งหมด</summary>
            <p>${esc(transcript)}</p>
        </details>` : ''}`;
    box.hidden = false;
    if (captions) bindStoreVideoCaptions();
}

// Show the active caption cue in the bar under the video (the native overlay is hidden so it is not shown twice)
function bindStoreVideoCaptions() {
    const video = document.getElementById('store-story-video-el');
    const line = document.getElementById('store-video-caption');
    const toggle = document.getElementById('store-video-cc');
    if (!video || !line || !toggle) return;
    let enabled = true;
    const showCue = track => {
        const cue = track.activeCues && track.activeCues[0];
        line.textContent = cue ? cue.text : (video.currentTime > 0 && !video.ended ? '' : 'กดเล่นวิดีโอเพื่อดูคำบรรยาย');
    };
    const setup = () => {
        const track = video.textTracks[0];
        if (!track) return;
        track.mode = 'hidden';
        track.addEventListener('cuechange', () => showCue(track));
    };
    if (video.textTracks.length) setup(); else video.textTracks.addEventListener('addtrack', setup, { once: true });
    video.addEventListener('ended', () => { line.textContent = 'จบวิดีโอ'; });
    toggle.addEventListener('click', () => {
        enabled = !enabled;
        line.parentElement.classList.toggle('is-off', !enabled);
        toggle.setAttribute('aria-pressed', String(enabled));
        toggle.setAttribute('aria-label', enabled ? 'CC ซ่อนคำบรรยายใต้วิดีโอ' : 'CC แสดงคำบรรยายใต้วิดีโอ');
    });
}
