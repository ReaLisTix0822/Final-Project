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
        container.setAttribute('role', 'alert');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    if (type === 'success') iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    if (type === 'error') iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    if (type === 'warning') iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

    toast.innerHTML = `
        <span style="display:inline-flex; align-items:center; flex-shrink:0;">${iconSvg}</span>
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
        if (existing) {
            existing.quantity += quantity;
        } else {
            items.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                store_id: product.store_id,
                store_name: product.store_name,
                disability_type: product.disability_type,
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
            item.quantity = Math.max(1, qty);
            this.saveItems(items);
        }
    },

    clear() {
        localStorage.removeItem('marketplace_cart');
        this.updateBadge();
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

// Global Page Initializer
document.addEventListener('DOMContentLoaded', () => {
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
