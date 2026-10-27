// ==============================================================================
// CAMPAIGN DETAIL PAGE (/campaign-detail.html?id=...)
// ==============================================================================

const campaignEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

let currentCampaign = null;

function campaignDay(value) {
    // DATE columns arrive as ISO strings; compare by local calendar day
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatCampaignDay(value) {
    return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

function campaignStatus(campaign) {
    const today = campaignDay(new Date());
    const start = campaignDay(campaign.start_date);
    const end = campaignDay(campaign.end_date);
    const dayMs = 24 * 60 * 60 * 1000;
    if (today < start) {
        const days = Math.round((start - today) / dayMs);
        return { key: 'upcoming', label: days === 1 ? 'เริ่มพรุ่งนี้' : `อีก ${days} วันเริ่มงาน` };
    }
    if (today > end) return { key: 'ended', label: 'จบกิจกรรมแล้ว' };
    const left = Math.round((end - today) / dayMs);
    return { key: 'live', label: left === 0 ? 'กำลังจัดงาน · วันสุดท้าย' : `กำลังจัดงาน · เหลืออีก ${left} วัน` };
}

function campaignDuration(campaign) {
    const days = Math.round((campaignDay(campaign.end_date) - campaignDay(campaign.start_date)) / 86400000) + 1;
    return `${days.toLocaleString('th-TH')} วัน`;
}

function renderCampaignJoin(campaign) {
    const box = document.getElementById('campaign-join');
    const user = window.Auth && Auth.getUser();
    if (!user || !['seller', 'admin'].includes(user.role)) { box.hidden = true; return; }
    const store = Auth.getStore && Auth.getStore();
    const joined = store && campaign.participants.find(p => Number(p.id) === Number(store.id));
    box.hidden = false;
    if (joined) {
        box.innerHTML = `<p class="cd-join-done">ร้านของคุณเข้าร่วมแล้ว · บูธ <strong>${campaignEsc(joined.booth_number || '-')}</strong></p>`;
    } else if (campaignStatus(campaign).key === 'ended') {
        box.innerHTML = '<p class="cd-join-note">กิจกรรมนี้จบแล้ว ไม่เปิดรับสมัครบูธ</p>';
    } else {
        box.innerHTML = `<button type="button" class="btn btn-primary cd-join-btn" id="campaign-join-btn">สมัครเข้าร่วมบูธ</button>
            <p class="cd-join-note">ร้านของคุณจะได้รับหมายเลขบูธทันทีหลังสมัคร</p>`;
        document.getElementById('campaign-join-btn').addEventListener('click', joinThisCampaign);
    }
}

async function joinThisCampaign() {
    const btn = document.getElementById('campaign-join-btn');
    btn.disabled = true;
    try {
        const res = await API.post(`/campaigns/${currentCampaign.id}/join`);
        window.showToast?.(res.message, 'success');
        await loadCampaignDetail();
    } catch (err) {
        window.showToast?.(`สมัครไม่สำเร็จ: ${err.message}`, 'error');
        btn.disabled = false;
    }
}

async function shareCampaign() {
    const data = { title: currentCampaign.title, url: window.location.href };
    try {
        if (navigator.share) await navigator.share(data);
        else {
            await navigator.clipboard.writeText(window.location.href);
            window.showToast?.('คัดลอกลิงก์แคมเปญแล้ว', 'success');
        }
    } catch (err) {
        if (err.name !== 'AbortError') window.showToast?.('แชร์ไม่สำเร็จ', 'error');
    }
}

function renderCampaignDetail(c) {
    const status = campaignStatus(c);
    document.title = `${c.title} | ตลาดใจ`;
    document.getElementById('cd-breadcrumb-title').textContent = c.title;

    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.location)}`;
    const participants = c.participants || [];
    const products = c.products || [];

    document.getElementById('campaign-detail').innerHTML = `
        <section class="cd-hero" aria-labelledby="cd-title">
            <div class="cd-hero-media">
                ${c.image_url ? `<img src="${campaignEsc(c.image_url)}" alt="" fetchpriority="high">` : ''}
            </div>
            <div class="cd-hero-body">
                <span class="cd-status cd-status--${status.key}">${campaignEsc(status.label)}</span>
                <h1 id="cd-title">${campaignEsc(c.title)}</h1>
                <p class="cd-hero-meta">${campaignEsc(formatCampaignDay(c.start_date))} – ${campaignEsc(formatCampaignDay(c.end_date))} · ${campaignEsc(c.location)}</p>
            </div>
        </section>

        <div class="cd-layout">
            <div class="cd-main">
                <section class="cd-card" aria-labelledby="cd-about-title">
                    <h2 id="cd-about-title">รายละเอียดกิจกรรม</h2>
                    <p class="cd-description">${campaignEsc(c.description)}</p>
                </section>

                <section class="cd-card" aria-labelledby="cd-stores-title">
                    <div class="cd-card-head">
                        <h2 id="cd-stores-title">ร้านค้าที่ร่วมออกบูธ</h2>
                        <span class="cd-count">${participants.length.toLocaleString('th-TH')} ร้าน</span>
                    </div>
                    ${participants.length ? `<ul class="cd-store-list">${participants.map(p => `
                        <li>
                            <a class="cd-store" href="/store-detail.html?id=${Number(p.id)}">
                                <img loading="lazy" decoding="async" src="${campaignEsc(p.owner_avatar_url || p.avatar_image || p.cover_image || '')}" alt="" data-image-store-id="${Number(p.id)}">
                                <span class="cd-store-info">
                                    <strong>${campaignEsc(p.store_name)}</strong>
                                    <span>${campaignEsc(p.disability_name ? p.disability_name : (p.craft_technique || 'ช่างฝีมือตลาดใจ'))} · ${campaignEsc(p.province || '')}</span>
                                    <span>${p.product_count.toLocaleString('th-TH')} สินค้าในร้าน</span>
                                </span>
                                <span class="cd-booth" aria-label="หมายเลขบูธ ${campaignEsc(p.booth_number || '-')}">บูธ<b>${campaignEsc(p.booth_number || '-')}</b></span>
                            </a>
                        </li>`).join('')}</ul>`
                        : '<p class="cd-empty">ยังไม่มีร้านค้าสมัครเข้าร่วม</p>'}
                </section>

                <section class="cd-card" aria-labelledby="cd-products-title">
                    <div class="cd-card-head">
                        <h2 id="cd-products-title">สินค้าจากร้านที่ร่วมงาน</h2>
                        <a href="/products.html" class="cd-link">ดูสินค้าทั้งหมด →</a>
                    </div>
                    ${products.length ? `<div class="cd-products">${products.map(p => `
                        <a class="cd-product" href="/product-detail.html?id=${Number(p.id)}">
                            <span class="cd-product-img"><img loading="lazy" decoding="async" src="${campaignEsc(p.image_url)}" alt="" data-image-store-id="${Number(p.store_id)}"></span>
                            <span class="cd-product-name">${campaignEsc(p.name)}</span>
                            <span class="cd-product-store">${campaignEsc(p.store_name)}</span>
                            <strong class="cd-product-price">${TJFormat.money(p.price)}</strong>
                        </a>`).join('')}</div>`
                        : '<p class="cd-empty">ยังไม่มีสินค้าจากร้านที่ร่วมงาน</p>'}
                </section>
            </div>

            <aside class="cd-side" aria-label="ข้อมูลงาน">
                <div class="cd-card cd-facts">
                    <h2>ข้อมูลงาน</h2>
                    <dl>
                        <div><dt>วันที่จัดงาน</dt><dd>${campaignEsc(formatCampaignDay(c.start_date))}<br>ถึง ${campaignEsc(formatCampaignDay(c.end_date))}</dd></div>
                        <div><dt>ระยะเวลา</dt><dd>${campaignDuration(c)}</dd></div>
                        <div><dt>สถานที่ / ช่องทาง</dt><dd>${campaignEsc(c.location)}<br><a href="${mapUrl}" target="_blank" rel="noopener" class="cd-link">เปิดในแผนที่ ↗<span class="sr-only"> (เปิดแท็บใหม่)</span></a></dd></div>
                        <div><dt>ร้านค้าที่ร่วมงาน</dt><dd>${participants.length.toLocaleString('th-TH')} ร้าน</dd></div>
                    </dl>
                    <div id="campaign-join" class="cd-join" hidden></div>
                    <button type="button" class="btn btn-outline cd-share" onclick="shareCampaign()">แชร์แคมเปญนี้</button>
                </div>
                <a href="/campaigns.html" class="cd-back">← กลับไปหน้ากิจกรรมทั้งหมด</a>
            </aside>
        </div>`;
    renderCampaignJoin(c);
}

async function loadCampaignDetail() {
    const container = document.getElementById('campaign-detail');
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    if (!Number.isInteger(id) || id < 1) {
        container.innerHTML = '<p class="cd-error">ไม่พบแคมเปญ <a href="/campaigns.html">กลับไปหน้ากิจกรรม</a></p>';
        return;
    }
    try {
        const res = await API.get(`/campaigns/${id}`);
        currentCampaign = res.data;
        renderCampaignDetail(currentCampaign);
    } catch (err) {
        container.innerHTML = `<p class="cd-error">${campaignEsc(err.message || 'โหลดแคมเปญไม่สำเร็จ')} · <a href="/campaigns.html">กลับไปหน้ากิจกรรม</a></p>`;
    }
}

document.addEventListener('DOMContentLoaded', loadCampaignDetail);
