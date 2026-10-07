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
        API.setToken(token);
        localStorage.setItem('user', JSON.stringify(user));
        if (store) {
            localStorage.setItem('store', JSON.stringify(store));
        } else {
            localStorage.removeItem('store');
        }
        this.renderNavbarUserMenu();
        this.updateAuthUI();
    },

    logout() {
        API.setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('store');
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
                roleBadge = '<span class="disability-badge" style="background:#254a3b; color:#fef08a; font-size:0.7rem; padding:2px 8px; white-space:nowrap;">ผู้ขาย/ช่าง</span>';
            } else if (user.role === 'admin') {
                roleBadge = '<span class="disability-badge" style="background:#7c3aed; color:white; font-size:0.7rem; padding:2px 8px; white-space:nowrap;">ผู้ดูแลระบบ</span>';
            } else {
                roleBadge = '<span class="disability-badge" style="background:#e0f2fe; color:#0369a1; font-size:0.7rem; padding:2px 8px; white-space:nowrap;">ผู้สนับสนุน</span>';
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
            const avatar = escapeAttribute(user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80');

            let roleSubtitle = 'ผู้สนับสนุน · บัญชีผู้ซื้อ';
            let roleMenuLinks = `
                <a href="/profile.html">โปรไฟล์และบัญชีของฉัน</a>
                <a href="/profile.html?tab=tracking">คำสั่งซื้อของฉัน</a>
            `;
            if (user.role === 'seller') {
                roleSubtitle = 'ผู้ขาย · ร้านค้าช่างฝีมือ';
                roleMenuLinks = `
                    <a href="/seller-dashboard.html">แดชบอร์ดร้านค้า</a>
                    <a href="/seller-dashboard.html?tab=profile">จัดการข้อมูลร้านค้า</a>
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
                        <button type="button" onclick="Auth.logout()">ออกจากระบบ</button>
                    </div>
                </details>
            ` : `
                    <a href="${pillHref}" ${pillOnClick} class="nav-user-pill" title="${isSellerOrAdmin ? 'จัดการโปรไฟล์ร้านค้าใน Dashboard' : 'ดูโปรไฟล์และจัดการบัญชีของฉัน'}">
                        <img src="${user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'}" alt="โปรไฟล์" style="width:26px; height:26px; border-radius:50%; object-fit:cover; flex-shrink:0;">
                        <span style="font-size:0.875rem; font-weight:700; color:var(--brand-dark);">${shortName}</span>
                        ${roleBadge}
                    </a>
                    <button onclick="Auth.logout()" class="btn btn-sm btn-outline-dark" title="ออกจากระบบ" style="padding:0.35rem 0.75rem; font-size:0.85rem; min-height:36px; white-space:nowrap; display:inline-flex; align-items:center; gap:6px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        <span class="btn-logout-text">ออกจากระบบ</span>
                    </button>
            `;

            userContainer.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; white-space:nowrap;">
                    <a href="/products.html?favorites=true" class="icon-circle-btn nav-fav-btn" title="รายการโปรดและชิ้นงานที่ถูกใจ" aria-label="รายการโปรด">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        ${favBadge}
                    </a>
                    <a href="/cart.html" class="icon-circle-btn nav-cart-btn" title="ตะกร้าสินค้า" aria-label="ตะกร้าสินค้า">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        ${cartBadge}
                    </a>
                    <a href="/profile.html?tab=tracking" class="icon-circle-btn" title="ติดตามพัสดุและคำสั่งซื้อ" aria-label="ติดตามพัสดุและคำสั่งซื้อ">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    </a>
                    ${accountControls}
                </div>
            `;
        } else {
            userContainer.innerHTML = `
                <a href="/login.html" class="btn btn-outline-dark" style="font-size:0.9rem; padding:0.45rem 1.25rem; min-height:40px; white-space:nowrap;">เข้าสู่ระบบ</a>
            `;
        }

        const account = userContainer.querySelector('.nav-account');
        account?.addEventListener('keydown', event => {
            if (event.key === 'Escape' && account.open) {
                event.preventDefault();
                account.open = false;
                account.querySelector('summary').focus();
            }
        });
        this.updateAuthUI();
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
        const navAuthElements = document.querySelectorAll('.nav-fav-btn, .nav-cart-btn, a[href*="cart.html"].icon-circle-btn, a[href*="favorites=true"].icon-circle-btn');
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

// Immediately render navbar and sync state without waiting if DOM elements already exist
if (typeof document !== 'undefined') {
    document.addEventListener('click', event => {
        const account = document.querySelector('.site-header--buyer .nav-account[open]');
        if (account && !account.contains(event.target)) account.open = false;
    });
    document.addEventListener('focusin', event => {
        const account = document.querySelector('.site-header--buyer .nav-account[open]');
        if (account && !account.contains(event.target)) account.open = false;
    });
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
