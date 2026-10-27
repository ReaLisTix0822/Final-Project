// ==============================================================================
// AUTHENTICATION & USER SESSION MODULE (TALADJAI THEME)
// ==============================================================================

const Auth = {
    getUser() {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    },

    getStore() {
        try {
            const storeStr = localStorage.getItem('store');
            return storeStr ? JSON.parse(storeStr) : null;
        } catch (e) {
            return null;
        }
    },

    isLoggedIn() {
        const token = (typeof API !== 'undefined' && API.getToken) ? API.getToken() : localStorage.getItem('token');
        return !!token && !!this.getUser();
    },

    saveSession(token, user, store = null) {
        // A new token = someone just logged in (other calls only refresh the saved user)
        const isNewLogin = !!token && token !== API.getToken();
        API.setToken(token);
        localStorage.setItem('user', JSON.stringify(user));
        if (store) {
            localStorage.setItem('store', JSON.stringify(store));
        } else {
            localStorage.removeItem('store');
        }
        this.renderNavbarUserMenu();
        this.updateAuthUI();
        // e.g. the accessibility menu loads this account's settings (accessibility.js)
        if (isNewLogin) document.dispatchEvent(new CustomEvent('auth:login', { detail: { user } }));
    },

    logout() {
        window.A11y?.flushServerSave?.();
        API.setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('store');
        localStorage.removeItem('marketplace_cart'); // kept in cart_items, restored on next login
        this.renderNavbarUserMenu();
        this.updateAuthUI();
        if (window.showToast) {
            window.showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
        }
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 300);
    },

    async checkCurrentUser() {
        if (!API.getToken()) return null;
        try {
            const res = await API.get('/auth/me');
            if (res.success && res.user) {
                this.saveSession(API.getToken(), res.user, res.store);
                return res.user;
            }
        } catch (e) {
            console.warn('[Auth] Session validation note:', e.message);
            // Only clear credentials if server explicitly reports 401 / expired / invalid token
            if (e.message && (e.message.includes('401') || e.message.includes('เซสชันหมดอายุ') || e.message.includes('โทเคนไม่ถูกต้อง') || e.message.includes('ไม่พบบัญชี'))) {
                API.setToken(null);
                localStorage.removeItem('user');
                localStorage.removeItem('store');
                this.renderNavbarUserMenu();
                this.updateAuthUI();
            }
        }
        return null;
    },

    renderSidebarProfile() {
        const user = this.getUser();
        document.querySelectorAll('.dashboard-sidebar-profile').forEach(profile => {
            const name = profile.querySelector('[data-sidebar-name]');
            const initial = profile.querySelector('[data-sidebar-initial]');
            const avatar = profile.querySelector('[data-sidebar-avatar]');
            const store = profile.hasAttribute('data-sidebar-store') ? this.getStore() : null;
            const storeProfile = profile.hasAttribute('data-sidebar-store');
            const displayName = storeProfile ? (store?.store_name || 'ร้านค้าของฉัน') : (user?.full_name || 'ผู้ใช้งาน');
            const imageUrl = user?.avatar_url || (storeProfile ? store?.avatar_image : null);
            name.textContent = displayName;
            initial.textContent = Array.from(displayName.trim())[0] || '?';
            avatar.onerror = () => { avatar.hidden = true; initial.hidden = false; };
            avatar.hidden = !imageUrl;
            initial.hidden = !!imageUrl;
            if (imageUrl) avatar.src = imageUrl;
            else avatar.removeAttribute('src');
        });
    },

    renderNavbarUserMenu() {
        this.renderSidebarProfile();
        const userContainer = document.getElementById('nav-user-container');
        if (!userContainer) return;

        const user = this.getUser();
        const loggedIn = this.isLoggedIn();
        const searchHeader = userContainer.closest('.site-header--search');
        const compactUser = Boolean(searchHeader && loggedIn && user);
        searchHeader?.classList.toggle('site-header--buyer', compactUser);

        // Dynamically update the role link in main nav menu (Dashboard vs Become a seller)
        const roleLinks = document.querySelectorAll('.nav-menu a[href*="role=seller"], .nav-menu #nav-role-link, .nav-menu .nav-role-link');
        roleLinks.forEach(roleLink => {
            // In the storefront search header the dashboard link already lives in the account menu,
            // so the pill navigation keeps the same 5 links for every role.
            const inAccountMenu = Boolean(roleLink.closest('.site-header--search'));
            const showDashboard = loggedIn && user && ['admin', 'seller'].includes(user.role) && !inAccountMenu;
            roleLink.hidden = !showDashboard;
            roleLink.style.display = showDashboard ? '' : 'none';
            if (!showDashboard) return;
            if (loggedIn && user) {
                if (user.role === 'admin') {
                    roleLink.href = '/admin-dashboard.html';
                    roleLink.innerHTML = 'แดชบอร์ดผู้ดูแล';
                    roleLink.style.color = '#7c3aed';
                    roleLink.style.fontWeight = '700';
                    if (window.location.pathname.includes('admin-dashboard')) {
                        roleLink.classList.add('active');
                    }
                } else if (user.role === 'seller') {
                    roleLink.href = '/seller-dashboard.html';
                    roleLink.innerHTML = 'แดชบอร์ดร้านค้า';
                    roleLink.style.color = 'var(--primary)';
                    roleLink.style.fontWeight = '700';
                    if (window.location.pathname.includes('seller-dashboard')) {
                        roleLink.classList.add('active');
                    }
                } else {
                    roleLink.href = '/login.html?tab=register&role=seller';
                    roleLink.innerHTML = 'เป็นผู้ขาย';
                    roleLink.style.color = '';
                    roleLink.style.fontWeight = '';
                }
            } else {
                roleLink.href = '/login.html?tab=register&role=seller';
                roleLink.innerHTML = 'เป็นผู้ขาย';
                roleLink.style.color = '';
                roleLink.style.fontWeight = '';
            }
        });

        if (loggedIn && user) {
            let roleBadge = '';

            if (user.role === 'seller') {
                roleBadge = '<span class="disability-badge" style="background:var(--color-primary); color:var(--color-on-primary-muted); font-size: 0.875rem; padding:2px 8px; white-space:nowrap;">ผู้ขาย/ช่าง</span>';
            } else if (user.role === 'admin') {
                roleBadge = '<span class="disability-badge" style="background:#7c3aed; color:var(--color-on-primary); font-size: 0.875rem; padding:2px 8px; white-space:nowrap;">ผู้ดูแลระบบ</span>';
            } else {
                roleBadge = '<span class="disability-badge" style="background:var(--color-info-soft); color:var(--color-info); font-size: 0.875rem; padding:2px 8px; white-space:nowrap;">ผู้สนับสนุน</span>';
            }

            const cartCount = (window.Cart && Cart.getCount) ? Cart.getCount() : 0;
            const cartBadge = cartCount > 0 
                ? `<span class="icon-badge cart-count-badge" style="display:inline-flex;">${cartCount}</span>` 
                : `<span class="icon-badge cart-count-badge" style="display:none;">0</span>`;

            let favCount = 0;
            try {
                favCount = JSON.parse(localStorage.getItem('taladjai_favorites') || '[]').length;
            } catch (e) {}
            const favBadge = favCount > 0 
                ? `<span class="icon-badge fav-count-badge" style="display:inline-flex;">${favCount}</span>` 
                : `<span class="icon-badge fav-count-badge" style="display:none;">0</span>`;

            const rawName = user.full_name || user.email || 'ผู้ใช้';
            const shortName = rawName.split(' ')[0] || rawName;

            const isSellerOrAdmin = (user.role === 'seller' || user.role === 'admin');
            const profileUrl = user.role === 'admin' ? '/admin-profile.html' : user.role === 'seller' ? '/seller-dashboard.html?tab=profile' : '/profile.html';
            const onSellerDash = window.location.pathname.includes('seller-dashboard');
            const pillHref = onSellerDash ? 'javascript:void(0)' : profileUrl;
            const pillOnClick = onSellerDash ? 'onclick="if(window.switchDashView){switchDashView(\'profile\');}"' : '';

            // The homepage buyer controls stay in one row; secondary actions live in a disclosure.
            const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[char]));
            const safeName = escapeAttribute(rawName);
            const safeShortName = escapeAttribute(shortName);
            const avatar = escapeAttribute(user.avatar_url || '/images/default-avatar.svg');

            let roleSubtitle = 'ผู้สนับสนุน · บัญชีผู้ซื้อ';
            let roleMenuLinks = `
                <a href="/profile.html">โปรไฟล์และบัญชีของฉัน</a>
                <a href="/profile.html?tab=tracking">คำสั่งซื้อของฉัน</a>
            `;
            if (user.role === 'seller') {
                roleSubtitle = 'ผู้ขาย · ร้านค้าช่างฝีมือ';
                roleMenuLinks = `
                    <a href="/seller-dashboard.html">แดชบอร์ดร้านค้า</a>
                    <a href="/seller-dashboard.html?tab=store">จัดการข้อมูลร้านค้า</a>
                    <a href="/profile.html?tab=history">ประวัติคำสั่งซื้อ</a>
                `;
            } else if (user.role === 'admin') {
                roleSubtitle = 'ผู้ดูแลระบบตลาดใจ';
                roleMenuLinks = `
                    <a href="/admin-dashboard.html">แดชบอร์ดผู้ดูแล</a>
                    <a href="/admin-profile.html">จัดการบัญชี</a>
                `;
            }

            const accountControls = compactUser ? `
                <details class="nav-account">
                    <summary class="nav-account-trigger" aria-label="เมนูบัญชี ${safeName}" title="เมนูบัญชีผู้ใช้">
                        <img src="${avatar}" alt="" width="28" height="28">
                        <span class="nav-account-name">${safeShortName}</span>
                        <svg class="nav-account-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
                    </summary>
                    <div class="nav-account-panel">
                        <div class="nav-account-heading">
                            <strong>${safeName}</strong>
                            <span>${roleSubtitle}</span>
                        </div>
                        ${roleMenuLinks}
                        <a href="/messages.html">ข้อความของฉัน</a>
                        ${user.role === 'admin' ? '<a href="/admin-complaints.html">เรื่องร้องเรียน</a>' : '<a href="/complaints.html">แจ้งเรื่องร้องเรียน</a>'}
                        <button type="button" onclick="Auth.logout()">ออกจากระบบ</button>
                    </div>
                </details>
            ` : `
                    <a href="${pillHref}" ${pillOnClick} class="nav-user-pill" title="${isSellerOrAdmin ? 'จัดการโปรไฟล์ร้านค้าใน Dashboard' : 'ดูโปรไฟล์และจัดการบัญชีของฉัน'}">
                        <img src="${user.avatar_url || '/images/default-avatar.svg'}" alt="โปรไฟล์" style="width:26px; height:26px; border-radius:50%; object-fit:cover; flex-shrink:0;">
                        <span style="font-size: 1rem; font-weight:700; color:var(--brand-dark);">${shortName}</span>
                        ${roleBadge}
                    </a>
                    <button onclick="Auth.logout()" class="btn btn-sm btn-outline-dark" title="ออกจากระบบ" style="padding:0.35rem 0.75rem; font-size: 1rem; min-height:36px; white-space:nowrap; display:inline-flex; align-items:center; gap:6px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        <span class="btn-logout-text">ออกจากระบบ</span>
                    </button>
            `;

            userContainer.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; white-space:nowrap;">
                    <a href="/favorites.html" class="icon-circle-btn nav-fav-btn" title="รายการโปรดและชิ้นงานที่ถูกใจ" aria-label="รายการโปรด">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        ${favBadge}
                    </a>
                    <a href="/cart.html" class="icon-circle-btn nav-cart-btn" title="ตะกร้าสินค้า" aria-label="ตะกร้าสินค้า">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        ${cartBadge}
                    </a>
                    <details class="nav-notif">
                        <summary class="icon-circle-btn nav-notif-btn" title="การแจ้งเตือน" aria-label="การแจ้งเตือน">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                            <span class="icon-badge notif-count-badge" style="display:none;">0</span>
                        </summary>
                        <div class="nav-notif-panel" role="region" aria-label="รายการแจ้งเตือน">
                            <div class="nav-notif-header">
                                <strong>การแจ้งเตือน</strong>
                                <button type="button" class="nav-notif-readall" onclick="Notifications.markAllRead()">อ่านทั้งหมด</button>
                            </div>
                            <div class="nav-notif-list" aria-live="polite">
                                <p class="nav-notif-empty">กำลังโหลด...</p>
                            </div>
                        </div>
                    </details>
                    ${accountControls}
                </div>
            `;
        } else {
            userContainer.innerHTML = `
                <a href="/login.html" class="btn btn-outline-dark" style="font-size: 1rem; padding:0.45rem 1.25rem; min-height:40px; white-space:nowrap;">เข้าสู่ระบบ</a>
            `;
        }

        userContainer.querySelectorAll('.nav-account, .nav-notif').forEach(dropdown => {
            dropdown.addEventListener('keydown', event => {
                if (event.key === 'Escape' && dropdown.open) {
                    event.preventDefault();
                    dropdown.open = false;
                    dropdown.querySelector('summary').focus();
                }
            });
        });
        const notif = userContainer.querySelector('.nav-notif');
        notif?.addEventListener('toggle', () => {
            if (notif.open) Notifications.refresh();
        });
        this.updateAuthUI();
        if (notif) Notifications.start();
    },

    updateAuthUI() {
        const loggedIn = this.isLoggedIn();
        if (document.body) {
            document.body.classList.toggle('is-logged-in', loggedIn);
        }
        if (document.documentElement) {
            document.documentElement.classList.toggle('is-logged-in', loggedIn);
        }

        // Toggle nav buttons
        const navAuthElements = document.querySelectorAll('.nav-fav-btn, .nav-cart-btn, a[href*="cart.html"].icon-circle-btn, a[href*="favorites=true"].icon-circle-btn, a[href*="favorites.html"].icon-circle-btn');
        navAuthElements.forEach(el => {
            el.style.display = loggedIn ? 'inline-flex' : 'none';
        });

        // Toggle card favorite buttons
        const cardFavBtns = document.querySelectorAll('.card-fav-btn');
        cardFavBtns.forEach(el => {
            el.style.display = loggedIn ? 'inline-flex' : 'none';
        });

        // Toggle cart action buttons
        const cartActionBtns = document.querySelectorAll('.cart-action-btn');
        cartActionBtns.forEach(el => {
            el.style.display = loggedIn ? '' : 'none';
        });

        // Sync product detail page if open
        if (typeof updateProductDetailAuthUI === 'function') {
            updateProductDetailAuthUI();
        }
    }
};

// Navbar notification bell (data from /api/notifications)
const Notifications = {
    pollTimer: null,
    startTimer: null,
    items: [],
    unreadCount: 0,
    loaded: false,

    start() {
        // The navbar re-renders several times on page load: show cached data, fetch once
        if (this.loaded) this.render(this.unreadCount);
        clearTimeout(this.startTimer);
        this.startTimer = setTimeout(() => this.refresh(), 50);
        if (!this.pollTimer) {
            this.pollTimer = setInterval(() => {
                if (document.visibilityState === 'visible') this.refresh();
            }, 60000);
        }
    },

    async refresh() {
        if (!Auth.isLoggedIn()) return;
        try {
            const res = await API.get('/notifications');
            if (!res.success) return;
            this.items = res.data;
            this.unreadCount = res.unread_count;
            this.loaded = true;
            this.render(this.unreadCount);
        } catch (e) {
            console.warn('[Notifications] Load failed:', e.message);
        }
    },

    render(unreadCount) {
        document.querySelectorAll('.notif-count-badge').forEach(b => {
            b.innerText = unreadCount > 99 ? '99+' : unreadCount;
            b.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
        });
        document.querySelectorAll('.nav-notif-btn').forEach(btn => {
            btn.setAttribute('aria-label', unreadCount > 0 ? `การแจ้งเตือน (${unreadCount} รายการยังไม่อ่าน)` : 'การแจ้งเตือน');
        });
        document.querySelectorAll('.nav-notif-readall').forEach(btn => {
            btn.hidden = unreadCount === 0;
        });

        const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
        const html = this.items.length === 0
            ? '<p class="nav-notif-empty">ยังไม่มีการแจ้งเตือน</p>'
            : this.items.map(n => `
                <a href="${esc(n.link || '#')}" class="nav-notif-item${n.is_read ? '' : ' is-unread'}" onclick="Notifications.markRead(${Number(n.id)})">
                    <span class="nav-notif-title">${esc(n.title)}</span>
                    ${n.message ? `<span class="nav-notif-message">${esc(n.message)}</span>` : ''}
                    <span class="nav-notif-time">${this.timeAgo(n.created_at)}</span>
                </a>
            `).join('');
        document.querySelectorAll('.nav-notif-list').forEach(list => { list.innerHTML = html; });
    },

    markRead(id) {
        const item = this.items.find(n => n.id === id);
        if (!item || item.is_read) return;
        // keepalive: the request must finish even though the link navigates away
        fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: API.getHeaders(), keepalive: true })
            .catch(err => console.warn('[Notifications] Mark read failed:', err.message));
    },

    async markAllRead() {
        try {
            await API.post('/notifications/read-all');
            this.items.forEach(n => { n.is_read = true; });
            this.unreadCount = 0;
            this.render(0);
        } catch (e) {
            if (window.showToast) window.showToast('ไม่สามารถอัปเดตการแจ้งเตือนได้', 'error');
        }
    },

    timeAgo(value) {
        // SQLite returns "YYYY-MM-DD HH:MM:SS" in UTC without a timezone marker
        const raw = String(value || '');
        const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
        const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
        if (Number.isNaN(seconds)) return '';
        if (seconds < 60) return 'เมื่อสักครู่';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
        if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    }
};

// Saved shipping addresses: cached in localStorage, stored in the addresses table
const AddressBook = {
    key() {
        return `taladjai_addresses_${Auth.getUser()?.id || 'guest'}`;
    },

    read() {
        try {
            const rows = JSON.parse(localStorage.getItem(this.key()) || '[]');
            return Array.isArray(rows) ? rows : [];
        } catch {
            return [];
        }
    },

    // Returns false when the browser cannot store the list
    save(rows) {
        try {
            localStorage.setItem(this.key(), JSON.stringify(rows));
        } catch {
            return false;
        }
        this.upload(rows);
        return true;
    },

    // Send the list to the addresses table; tell the user when it did not reach the server
    async upload(rows) {
        if (!Auth.isLoggedIn()) return false;
        try {
            const response = await fetch('/api/addresses', {
                method: 'PUT',
                headers: API.getHeaders(),
                body: JSON.stringify({ addresses: rows }),
                keepalive: true
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.message || `HTTP ${response.status}`);
            return true;
        } catch (err) {
            console.warn('[AddressBook] Sync failed:', err.message);
            if (window.showToast) window.showToast('บันทึกที่อยู่ไปยังบัญชีไม่สำเร็จ ระบบจะลองใหม่เมื่อเปิดหน้านี้อีกครั้ง', 'error');
            return false;
        }
    },

    // Merge this browser's list with the server's by id, so an address that never
    // reached the server is uploaded instead of being dropped
    async load() {
        if (!Auth.isLoggedIn()) return this.read();
        try {
            const res = await API.get('/addresses');
            if (!res.success) return this.read();
            const server = res.data;
            const serverIds = new Set(server.map(a => String(a.id)));
            const localOnly = this.read().filter(a => !serverIds.has(String(a.id)));
            let merged = [...server, ...localOnly];
            if (merged.filter(a => a.isDefault).length > 1) {
                const keep = merged.find(a => a.isDefault);
                merged = merged.map(a => ({ ...a, isDefault: a === keep }));
            }
            localStorage.setItem(this.key(), JSON.stringify(merged));
            if (localOnly.length > 0) await this.upload(merged);
        } catch (e) {
            console.warn('[AddressBook] Load failed:', e.message);
        }
        return this.read();
    }
};

if (typeof window !== 'undefined') {
    window.Notifications = Notifications;
    window.AddressBook = AddressBook;
}

// Immediately render navbar and sync state without waiting if DOM elements already exist
if (typeof document !== 'undefined') {
    const closeOpenDropdowns = event => {
        document.querySelectorAll('.site-header--buyer .nav-account[open], .nav-notif[open]').forEach(dropdown => {
            if (!dropdown.contains(event.target)) dropdown.open = false;
        });
    };
    document.addEventListener('click', closeOpenDropdowns);
    document.addEventListener('focusin', closeOpenDropdowns);
    const initAuth = () => {
        Auth.renderNavbarUserMenu();
        Auth.updateAuthUI();
    };

    // Run right now if container exists in DOM
    if (document.getElementById('nav-user-container')) {
        initAuth();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }
}

if (typeof window !== 'undefined') {
    window.Auth = Auth;
}
