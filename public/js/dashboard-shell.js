// ==============================================================================
// DASHBOARD SHELL (admin + seller)
// Sidebar collapse button, high-contrast toggle and notification bell in the topbar.
// Works on any page with .admin-sidebar or .dash-sidebar.
// ==============================================================================
const DashShell = {
    storageKey: 'tj-dash-sidebar-collapsed',

    init() {
        const sidebar = document.querySelector('.admin-sidebar, .dash-sidebar');
        if (sidebar) this.initSidebar(sidebar);
        this.initContrastToggle();
        this.initNotifications();
        this.fillAccountChip();
    },

    // Seller pages without their own script for the topbar: store name and photo from the saved session
    fillAccountChip() {
        const chip = document.querySelector('[data-dash-account="seller"]');
        if (!chip || typeof Auth === 'undefined') return;
        const store = Auth.getStore?.();
        const user = Auth.getUser?.();
        const name = store?.store_name || user?.full_name || 'ร้านค้าของฉัน';
        const imageUrl = user?.avatar_url || store?.avatar_image;
        const initial = chip.querySelector('[data-dash-account-initial]');
        const avatar = chip.querySelector('[data-dash-account-avatar]');
        chip.querySelector('[data-dash-account-name]').textContent = name;
        initial.textContent = Array.from(name.trim())[0] || '?';
        if (imageUrl) {
            avatar.onerror = () => { avatar.hidden = true; initial.hidden = false; };
            avatar.src = imageUrl;
            avatar.hidden = false;
            initial.hidden = true;
        }
    },

    readCollapsed() {
        try { return localStorage.getItem(this.storageKey) === '1'; } catch { return false; }
    },

    saveCollapsed(value) {
        try { localStorage.setItem(this.storageKey, value ? '1' : '0'); } catch { /* storage blocked: state lasts until reload */ }
    },

    initSidebar(sidebar) {
        if (!sidebar.id) sidebar.id = 'dashboard-sidebar';
        // Plain text inside menu links gets a span, so the collapsed bar can hide it visually
        // and screen readers still read the link name.
        sidebar.querySelectorAll('.admin-menu-link, .dash-menu-link, .admin-sidebar-action .btn').forEach(link => {
            for (const node of [...link.childNodes]) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                    const span = document.createElement('span');
                    span.className = 'dash-nav-label';
                    span.textContent = node.textContent.trim().replace(/^[＋+]\s*/, '');
                    // "＋ สร้างแคมเปญใหม่": the plus becomes an icon that stays visible when collapsed
                    if (span.textContent !== node.textContent.trim()) {
                        node.before(Object.assign(document.createElement('span'), {
                            className: 'dash-nav-plus',
                            innerHTML: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>'
                        }));
                    }
                    node.replaceWith(span);
                }
            }
            link.querySelectorAll(':scope > span:not(.dash-menu-count):not(.arrow-icon):not(.dash-nav-plus)').forEach(span => span.classList.add('dash-nav-label'));
            const label = link.querySelector('.dash-nav-label')?.textContent.trim();
            if (label && !link.title) link.dataset.collapsedTitle = label;
        });

        // The pages carry the button in their HTML (no jump on load); older markup gets one added here
        let button = sidebar.querySelector('.dash-collapse-btn');
        const brand = sidebar.querySelector('.admin-sidebar-brand, .dash-sidebar-brand');
        if (!button && brand) {
            const row = document.createElement('div');
            row.className = 'dash-sidebar-top';
            brand.replaceWith(row);
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'dash-collapse-btn';
            button.setAttribute('aria-controls', sidebar.id);
            button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 10l-2 2 2 2"/></svg>';
            row.append(brand, button);
        }
        if (!button) return;

        const apply = collapsed => {
            document.documentElement.classList.toggle('dash-sidebar-collapsed', collapsed);
            button.setAttribute('aria-expanded', String(!collapsed));
            button.setAttribute('aria-label', collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู');
            button.title = collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู';
            // Mouse users see the menu name as a tooltip while only icons are shown
            sidebar.querySelectorAll('[data-collapsed-title]').forEach(link => {
                if (collapsed) link.title = link.dataset.collapsedTitle;
                else link.removeAttribute('title');
            });
        };
        apply(this.readCollapsed());
        button.addEventListener('click', () => {
            const collapsed = !document.documentElement.classList.contains('dash-sidebar-collapsed');
            apply(collapsed);
            this.saveCollapsed(collapsed);
        });
    },

    initContrastToggle() {
        const buttons = document.querySelectorAll('[data-dash-contrast]');
        if (!buttons.length) return;
        const sync = () => {
            const on = document.documentElement.classList.contains('a11y-contrast-high');
            buttons.forEach(button => button.setAttribute('aria-pressed', String(on)));
        };
        buttons.forEach(button => button.addEventListener('click', () => {
            const on = !document.documentElement.classList.contains('a11y-contrast-high');
            if (window.A11y?.setContrast) window.A11y.setContrast(on ? 'high' : 'normal');
            else document.documentElement.classList.toggle('a11y-contrast-high', on);
            sync();
        }));
        // The accessibility menu can change the mode too
        new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        sync();
    },

    initNotifications() {
        const notif = document.querySelector('.dash-topbar-tools .nav-notif');
        if (!notif || typeof Notifications === 'undefined' || !Auth.isLoggedIn()) return;
        notif.addEventListener('toggle', () => { if (notif.open) Notifications.refresh(); });
        notif.addEventListener('keydown', event => {
            if (event.key === 'Escape' && notif.open) {
                event.preventDefault();
                notif.open = false;
                notif.querySelector('summary').focus();
            }
        });
        document.addEventListener('click', event => { if (notif.open && !notif.contains(event.target)) notif.open = false; });
        Notifications.start();
    }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => DashShell.init());
else DashShell.init();
