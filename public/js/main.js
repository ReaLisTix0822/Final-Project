// ==============================================================================
// MAIN APP SCRIPTS
// Toast Notifications, Cart Helpers, Layout Initializations
// ==============================================================================

// Global Toast Notification Manager
window.showToast = function(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        // One live region only (role="status" = polite). role="alert" + aria-live made screen readers read twice.
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'false');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon + text for every type, in the palette's status colors (never color alone)
    const ICONS = {
        info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
        success: '<polyline points="20 6 9 17 4 12"></polyline>',
        error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
        warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
    };
    const COLORS = { info: 'var(--color-info)', success: 'var(--color-success)', error: 'var(--color-error)', warning: 'var(--color-accent)' };
    const kind = ICONS[type] ? type : 'info';
    const iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[kind]}</svg>`;

    toast.innerHTML = `
        <span style="display:inline-flex; align-items:center; flex-shrink:0; color:${COLORS[kind]};">${iconSvg}</span>
        <div style="flex-grow:1; line-height:1.4;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

// Cart State Manager (Stored in LocalStorage)
const Cart = {
    getItems() {
        try {
            return JSON.parse(localStorage.getItem('marketplace_cart') || '[]');
        } catch (e) {
            return [];
        }
    },

    saveItems(items) {
        localStorage.setItem('marketplace_cart', JSON.stringify(items));
        this.updateBadge();
        this.syncToServer(items);
    },

    // Mirror the local cart into the cart_items table (keepalive survives page navigation)
    syncToServer(items = this.getItems()) {
        const token = localStorage.getItem('token');
        if (!token) return;
        fetch('/api/cart', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ items: items.map(i => ({ product_id: i.id, qty: i.quantity })) }),
            keepalive: true
        }).catch(err => console.warn('[Cart] Sync failed:', err.message));
    },

    // Local cart wins; when it is empty (e.g. after login) restore it from the server
    async loadFromServer() {
        if (!localStorage.getItem('token') || !window.API) return;
        if (this.getItems().length > 0) {
            this.syncToServer();
            return;
        }
        try {
            const res = await API.get('/cart');
            if (res.success && res.data.length > 0) {
                localStorage.setItem('marketplace_cart', JSON.stringify(res.data));
                this.updateBadge();
                document.dispatchEvent(new CustomEvent('cart:loaded'));
            }
        } catch (e) {
            console.warn('[Cart] Load failed:', e.message);
        }
    },

    addItem(product, quantity = 1) {
        const isLoggedIn = (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                           (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                           (!!localStorage.getItem('token') && !!localStorage.getItem('user'));
        if (!isLoggedIn) {
            if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าลงในตะกร้า', 'warning');
            setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`, 800);
            return;
        }

        const items = this.getItems();
        const existing = items.find(i => i.id === product.id);
        const stock = Number.isFinite(Number(product.stock)) && product.stock !== null && product.stock !== undefined ? Number(product.stock) : null;
        if (stock !== null) {
            const inCart = existing ? existing.quantity : 0;
            if (stock <= 0 || inCart >= stock) {
                window.showToast?.(stock <= 0 ? `"${product.name}" หมดสต็อกแล้ว` : `ในตะกร้ามี "${product.name}" ครบจำนวนคงเหลือ ${stock} ชิ้นแล้ว`, 'warning');
                return;
            }
            if (inCart + quantity > stock) {
                quantity = stock - inCart;
                window.showToast?.(`เพิ่มได้อีกเพียง ${quantity} ชิ้น (คงเหลือ ${stock} ชิ้น)`, 'warning');
            }
        }
        if (existing) {
            existing.quantity += quantity;
            if (stock !== null) existing.stock = stock;
        } else {
            items.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                store_id: product.store_id,
                store_name: product.store_name,
                disability_type: product.disability_type,
                stock: stock,
                quantity: quantity
            });
        }
        this.saveItems(items);
        if (window.showToast) {
            window.showToast(`เพิ่ม "${product.name}" ลงในตะกร้าเรียบร้อยแล้ว`, 'success');
        }
    },

    removeItem(productId) {
        let items = this.getItems();
        items = items.filter(i => i.id !== productId);
        this.saveItems(items);
    },

    updateQuantity(productId, qty) {
        const items = this.getItems();
        const item = items.find(i => i.id === productId);
        if (item) {
            const max = Number.isFinite(item.stock) ? Math.max(1, item.stock) : Infinity;
            item.quantity = Math.min(max, Math.max(1, qty));
            this.saveItems(items);
        }
    },

    // Pull live stock for every cart line and clamp quantities to it.
    // Returns the lines that had to change: [{ name, from, to, stock }]
    async refreshStock() {
        const items = this.getItems();
        if (!items.length) return [];
        const res = await fetch(`/api/products/stock?ids=${items.map(i => i.id).join(',')}`).then(r => r.json());
        if (!res.success) return [];
        const changed = [];
        items.forEach(item => {
            const stock = Number(res.data[item.id] ?? 0);
            item.stock = stock;
            if (stock > 0 && item.quantity > stock) {
                changed.push({ name: item.name, from: item.quantity, to: stock, stock });
                item.quantity = stock;
            }
        });
        this.saveItems(items);
        return changed;
    },

    clear() {
        localStorage.removeItem('marketplace_cart');
        this.updateBadge();
        this.syncToServer([]);
    },

    getCount() {
        return this.getItems().reduce((acc, item) => acc + item.quantity, 0);
    },

    getSubtotal() {
        return this.getItems().reduce((acc, item) => acc + (item.price * item.quantity), 0);
    },

    updateBadge() {
        const badges = document.querySelectorAll('.cart-count-badge');
        const count = this.getCount();
        badges.forEach(b => {
            b.innerText = count;
            b.style.display = count > 0 ? 'inline-flex' : 'none';
        });
    }
};

// Top strip above the storefront header: tagline + quick text-size controls (DTH style)
function renderSiteTopbar() {
    const header = document.querySelector('.site-header');
    if (!header || document.querySelector('.site-topbar')) return;
    const bar = document.createElement('div');
    bar.className = 'site-topbar';
    // A landmark, so screen reader users can jump to the accessibility tools
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'เครื่องมือช่วยการเข้าถึง');
    bar.innerHTML = `
        <div class="container">
            <p class="site-topbar-tagline">ตลาดกลางออนไลน์เพื่อผู้ที่มีความพิการ</p>
            <div class="site-topbar-tools" role="group" aria-label="ขนาดตัวอักษร">
                <span aria-hidden="true">ขนาดตัวอักษร</span>
                <button type="button" data-size="font-size-md" aria-label="ขนาดตัวอักษรปกติ">ก</button>
                <button type="button" data-size="font-size-lg" aria-label="ขนาดตัวอักษรใหญ่">ก</button>
                <button type="button" data-size="font-size-xl" aria-label="ขนาดตัวอักษรใหญ่มาก">ก</button>
                <button type="button" class="site-topbar-a11y" data-a11y-open aria-expanded="false" aria-controls="a11y-panel" aria-label="เปิด เมนูช่วยการเข้าถึง (Alt+A)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="4" r="2"/><path d="M5 8h14M12 8v6M9 21l3-7 3 7"/></svg>
                    <span>เมนูช่วยการเข้าถึง</span>
                </button>
            </div>
        </div>`;
    header.before(bar);
    const sync = () => {
        const current = (window.A11y && A11y.settings && A11y.settings.fontSize) || 'font-size-md';
        bar.querySelectorAll('[data-size]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.size === current)));
    };
    bar.querySelectorAll('[data-size]').forEach(btn => btn.addEventListener('click', () => {
        if (window.A11y) A11y.setFontSize(btn.dataset.size);
        sync();
    }));
    sync();
    document.addEventListener('a11y:change', sync);
}

// Search history: send a search once the user stops typing (one row per finished search)
const SearchLog = {
    timers: {},
    last: {},
    sessionId() {
        try {
            let id = sessionStorage.getItem('taladjai_session');
            if (!id) {
                id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                sessionStorage.setItem('taladjai_session', id);
            }
            return id;
        } catch {
            return null;
        }
    },
    // A search that came from the microphone: the next record() of the same words is saved as 'voice'
    markVoice(text) {
        try { sessionStorage.setItem('taladjai_voice_query', String(text || '').trim().toLowerCase()); } catch {}
    },
    takeInputType(text) {
        try {
            if (sessionStorage.getItem('taladjai_voice_query') === text.toLowerCase()) {
                sessionStorage.removeItem('taladjai_voice_query');
                return 'voice';
            }
        } catch {}
        return 'text';
    },
    record(query, source, resultsCount, delay = 1200, filters = null) {
        const text = String(query || '').trim();
        clearTimeout(this.timers[source]);
        if (text.length < 2) return;
        this.timers[source] = setTimeout(() => {
            const key = text.toLowerCase();
            if (this.last[source] === key) return;
            this.last[source] = key;
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('token');
            if (token) headers.Authorization = `Bearer ${token}`;
            fetch('/api/search-history', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: text, source, results_count: Number.isInteger(resultsCount) ? resultsCount : null, session_id: this.sessionId(),
                    input_type: this.takeInputType(text), filters
                }),
                keepalive: true
            }).catch(() => {});
        }, delay);
    }
};
window.SearchLog = SearchLog;

// Global Page Initializer
// Phone fields: digits only, at most 10 (Thai numbers such as 0812345678)
document.addEventListener('input', e => {
    const field = e.target;
    if (!(field instanceof HTMLInputElement) || field.type !== 'tel') return;
    const digits = field.value.replace(/\D/g, '').slice(0, 10);
    if (field.value !== digits) field.value = digits;
});

// Mobile header (< 768px): one sticky row with the logo, a search button and a menu button.
// The main menu and the account area move into a drawer (on wider screens the drawer wrapper
// is display: contents, so the desktop layout does not change).
const MOBILE_HEADER_QUERY = window.matchMedia('(max-width: 767.98px)');
function initMobileHeader() {
    const header = document.querySelector('.site-header--search');
    const inner = header?.querySelector('.header-inner');
    const brand = inner?.querySelector('.brand-logo');
    const nav = inner?.querySelector('.nav-menu');
    const actions = inner?.querySelector('.nav-actions');
    const search = inner?.querySelector('.home-search');
    if (!inner || !brand || !nav || inner.querySelector('.site-drawer')) return;

    const drawer = document.createElement('div');
    drawer.className = 'site-drawer';
    drawer.id = 'site-drawer';
    nav.before(drawer);
    drawer.append(nav);
    if (actions) drawer.append(actions);

    const icon = path => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
    const tools = document.createElement('div');
    tools.className = 'mobile-header-tools';
    if (search) {
        if (!search.id) search.id = 'site-search-form';
        tools.innerHTML += `<button type="button" class="mobile-header-btn mobile-search-toggle" aria-expanded="false" aria-controls="${search.id}" aria-label="เปิดช่องค้นหา">${icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}</button>`;
    }
    tools.innerHTML += `<button type="button" class="mobile-header-btn mobile-menu-toggle" aria-expanded="false" aria-controls="site-drawer" aria-label="เปิดเมนูหลัก">${icon('<path d="M4 6h16M4 12h16M4 18h16"/>')}</button>`;
    brand.after(tools);
    const menuBtn = tools.querySelector('.mobile-menu-toggle');
    const searchBtn = tools.querySelector('.mobile-search-toggle');

    const focusables = () => [...drawer.querySelectorAll('a[href], button, input, select, summary, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.hidden && !el.disabled && el.getClientRects().length);
    function setMenu(open, { restoreFocus = true } = {}) {
        header.classList.toggle('is-menu-open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'ปิดเมนูหลัก' : 'เปิดเมนูหลัก');
        menuBtn.innerHTML = icon(open ? '<path d="M18 6 6 18M6 6l12 12"/>' : '<path d="M4 6h16M4 12h16M4 18h16"/>');
        document.body.classList.toggle('mobile-menu-open', open);
        if (open) {
            setSearch(false, { restoreFocus: false });
            header.style.setProperty('--mobile-header-bottom', `${Math.round(header.getBoundingClientRect().bottom)}px`);
            focusables()[0]?.focus();
        }
        else if (restoreFocus) menuBtn.focus();
    }
    function setSearch(open, { restoreFocus = true } = {}) {
        if (!searchBtn) return;
        header.classList.toggle('is-search-open', open);
        searchBtn.setAttribute('aria-expanded', String(open));
        searchBtn.setAttribute('aria-label', open ? 'ปิดช่องค้นหา' : 'เปิดช่องค้นหา');
        if (open) { setMenu(false, { restoreFocus: false }); search.querySelector('input')?.focus(); }
        else if (restoreFocus) searchBtn.focus();
    }
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    searchBtn?.addEventListener('click', () => setSearch(searchBtn.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && header.classList.contains('is-menu-open')) { event.preventDefault(); setMenu(false); }
        else if (event.key === 'Escape' && header.classList.contains('is-search-open') && MOBILE_HEADER_QUERY.matches) { event.preventDefault(); setSearch(false); }
        // Keep Tab inside the open drawer (it covers the page)
        if (event.key === 'Tab' && header.classList.contains('is-menu-open')) {
            const items = [menuBtn, ...focusables()];
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    document.addEventListener('click', event => {
        if (header.classList.contains('is-menu-open') && !header.contains(event.target)) setMenu(false, { restoreFocus: false });
    });
    drawer.addEventListener('click', event => { if (event.target.closest('.nav-link')) setMenu(false, { restoreFocus: false }); });
    MOBILE_HEADER_QUERY.addEventListener('change', () => { setMenu(false, { restoreFocus: false }); setSearch(false, { restoreFocus: false }); });
}

document.addEventListener('DOMContentLoaded', () => {
    renderSiteTopbar();
    initMobileHeader();

    // 1. Initialize Accessibility Engine
    if (window.A11y) {
        A11y.init();
    }

    // 2. Render Navbar user menu & cart badge
    if (window.Auth) {
        Auth.renderNavbarUserMenu();
        Auth.checkCurrentUser();
        Auth.updateAuthUI();
    }
    Cart.updateBadge();
    Cart.loadFromServer();

    // 3. Initialize AI Chatbot Widget
    if (window.ChatbotWidget) {
        ChatbotWidget.init();
    }

    // 4. Highlight active nav link
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href && currentPath.endsWith(href)) {
            link.classList.add('active');
        }
    });
});

if (typeof window !== 'undefined') {
    window.Cart = Cart;
}
