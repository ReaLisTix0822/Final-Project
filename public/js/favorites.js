// ==============================================================================
// FAVORITES PAGE (/favorites.html) — products the signed-in user has liked
// ==============================================================================

const favEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

let favoriteItems = [];
let lastRemoved = null;

function favoriteDate(value) {
    const raw = String(value || '');
    const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function syncFavoriteBadge() {
    const ids = favoriteItems.map(p => Number(p.id));
    try { localStorage.setItem('taladjai_favorites', JSON.stringify(ids)); } catch {}
    document.querySelectorAll('.fav-count-badge').forEach(badge => {
        badge.textContent = ids.length;
        badge.style.display = ids.length ? 'inline-flex' : 'none';
    });
}

function sortedFavorites() {
    const sort = document.getElementById('fav-sort')?.value || 'recent';
    const list = [...favoriteItems];
    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    return list;
}

function renderFavorites() {
    const grid = document.getElementById('fav-grid');
    const toolbar = document.getElementById('fav-toolbar');
    const count = favoriteItems.length;
    const inStock = favoriteItems.filter(p => p.stock > 0);

    document.getElementById('fav-count').textContent = count.toLocaleString('th-TH');
    document.getElementById('fav-total').textContent = `${TJFormat.money(favoriteItems.reduce((sum, p) => sum + (Number(p.price) || 0), 0))}`;
    document.getElementById('fav-stores').textContent = new Set(favoriteItems.map(p => p.store_id)).size.toLocaleString('th-TH');
    toolbar.hidden = count === 0;
    document.getElementById('fav-add-all').disabled = inStock.length === 0;

    if (count === 0) {
        grid.innerHTML = `
            <div class="fav-empty">
                <span class="fav-empty-icon" aria-hidden="true">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                </span>
                <h2>ยังไม่มีสินค้าที่ถูกใจ</h2>
                <p>กดรูปหัวใจบนชิ้นงานที่ชอบ เพื่อเก็บไว้ดูภายหลังหรือสั่งซื้อพร้อมกันทีเดียว</p>
                <a href="/products.html" class="btn btn-primary">เลือกดูสินค้าทั้งหมด</a>
            </div>`;
        return;
    }

    grid.innerHTML = sortedFavorites().map(p => {
        const soldOut = p.stock <= 0;
        const name = favEsc(p.name);
        return `
        <article class="fav-card" data-id="${Number(p.id)}" aria-label="${name}">
            <a class="fav-media" href="/product-detail.html?id=${Number(p.id)}" tabindex="-1" aria-hidden="true">
                <img loading="lazy" decoding="async" src="${favEsc(p.image_url)}" alt="" data-image-store-id="${Number(p.store_id)}">
                ${p.model_3d_url ? '<span class="fav-badge">โมเดล 3D 360°</span>' : ''}
                ${soldOut ? '<span class="fav-badge fav-badge--out">สินค้าหมด</span>' : ''}
            </a>
            <button type="button" class="fav-heart" aria-label="นำ ${name} ออกจากรายการที่ถูกใจ" title="เลิกถูกใจ" onclick="removeFavorite(${Number(p.id)})">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
            </button>
            <div class="fav-body">
                <a class="fav-store" href="/store-detail.html?id=${Number(p.store_id)}">${favEsc(p.store_name)}</a>
                <h2 class="fav-name"><a href="/product-detail.html?id=${Number(p.id)}">${name}</a></h2>
                <p class="fav-meta">${favEsc(p.category_name || '')}${p.favorited_at ? ` · ถูกใจเมื่อ ${favoriteDate(p.favorited_at)}` : ''}</p>
                <div class="fav-foot">
                    <strong class="fav-price">${TJFormat.money(p.price)}</strong>
                    <button type="button" class="btn btn-primary fav-cart-btn" onclick="addFavoriteToCart(${Number(p.id)})" ${soldOut ? 'disabled' : ''}>
                        ${soldOut ? 'สินค้าหมด' : 'ใส่ตะกร้า'}
                    </button>
                </div>
            </div>
        </article>`;
    }).join('');
}

function setFavStatus(html) {
    const status = document.getElementById('fav-status');
    status.innerHTML = html;
    status.hidden = !html;
}

async function removeFavorite(productId) {
    const index = favoriteItems.findIndex(p => Number(p.id) === productId);
    if (index < 0) return;
    const [item] = favoriteItems.splice(index, 1);
    lastRemoved = { item, index };
    renderFavorites();
    syncFavoriteBadge();
    setFavStatus(`นำ <b>${favEsc(item.name)}</b> ออกจากรายการที่ถูกใจแล้ว <button type="button" class="fav-undo" onclick="undoRemoveFavorite()">เลิกทำ</button>`);
    try {
        await API.post('/favorites/toggle', { product_id: productId });
    } catch (err) {
        favoriteItems.splice(index, 0, item);
        renderFavorites();
        syncFavoriteBadge();
        setFavStatus(`นำออกไม่สำเร็จ: ${favEsc(err.message)}`);
    }
}

async function undoRemoveFavorite() {
    if (!lastRemoved) return;
    const { item, index } = lastRemoved;
    lastRemoved = null;
    try {
        await API.post('/favorites/toggle', { product_id: item.id });
        favoriteItems.splice(Math.min(index, favoriteItems.length), 0, item);
        renderFavorites();
        syncFavoriteBadge();
        setFavStatus(`นำ <b>${favEsc(item.name)}</b> กลับเข้ารายการที่ถูกใจแล้ว`);
    } catch (err) {
        setFavStatus(`เลิกทำไม่สำเร็จ: ${favEsc(err.message)}`);
    }
}

function cartItemFrom(p) {
    return { id: Number(p.id), name: p.name, price: p.price, image_url: p.image_url, store_id: p.store_id, store_name: p.store_name, disability_type: p.disability_type, stock: Number(p.stock) };
}

function addFavoriteToCart(productId) {
    const product = favoriteItems.find(p => Number(p.id) === productId);
    if (product && window.Cart) Cart.addItem(cartItemFrom(product), 1);
}

function addAllFavoritesToCart() {
    const available = favoriteItems.filter(p => p.stock > 0);
    if (!available.length || !window.Cart) return;
    const items = Cart.getItems();
    available.forEach(p => {
        const existing = items.find(i => Number(i.id) === Number(p.id));
        if (existing) { existing.stock = Number(p.stock); existing.quantity = Math.min(existing.quantity + 1, Number(p.stock)); }
        else items.push({ ...cartItemFrom(p), quantity: 1 });
    });
    Cart.saveItems(items);
    window.showToast?.(`เพิ่ม ${available.length} รายการลงตะกร้าแล้ว`, 'success');
}

async function loadFavorites() {
    if (!(window.Auth && Auth.isLoggedIn())) {
        window.location.href = `/login.html?redirect=${encodeURIComponent('/favorites.html')}`;
        return;
    }
    try {
        const res = await API.get('/favorites');
        favoriteItems = (res.data || []).map(p => ({ ...p, id: Number(p.id), price: Number(p.price), stock: Number(p.stock) }));
        renderFavorites();
        syncFavoriteBadge();
    } catch (err) {
        document.getElementById('fav-grid').innerHTML = `<p class="fav-error">โหลดรายการที่ถูกใจไม่สำเร็จ: ${favEsc(err.message)}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fav-sort').addEventListener('change', renderFavorites);
    document.getElementById('fav-add-all').addEventListener('click', addAllFavoritesToCart);
    loadFavorites();
});
