// Prefer another image belonging to the same shop; never borrow another owner's portrait.
(() => {
    const defaults = ['/images/fallbacks/profile.svg', '/images/fallbacks/product.svg'];
    const states = new WeakMap();
    let storesRequest;
    const absolute = value => { try { return new URL(value, location.href).href; } catch { return ''; } };
    function stores() {
        return storesRequest ||= fetch('/api/stores').then(response => {
            if (!response.ok) throw new Error('Store images unavailable');
            return response.json();
        }).then(result => Array.isArray(result.data) ? result.data : []).catch(() => []);
    }
    async function replaceBrokenImage(image) {
        if (!(image instanceof HTMLImageElement) || image.matches('#qr-image, [data-no-image-fallback], #p-image-preview-img')) return;
        const original = image.getAttribute('src');
        if (!original?.trim() || defaults.some(path => absolute(path) === image.src)) return;
        let state = states.get(image);
        if (!state) { state = {tried: new Set(), pending: false, alt: image.alt}; states.set(image, state); }
        if (state.pending) return;
        state.tried.add(absolute(image.currentSrc || original));
        state.pending = true;
        image.onerror = null;
        image.removeAttribute('onerror');
        const context = `${image.id} ${image.className} ${state.alt} ${image.parentElement?.className || ''}`;
        const profile = /avatar|profile|โปรไฟล์|เจ้าของร้าน/i.test(context) || image.hasAttribute('data-sidebar-avatar');
        const allStores = await stores();
        // Ignore an outdated failure if the UI selected a different image while loading.
        if (image.getAttribute('src') !== original) { state.pending = false; return; }
        const storeId = image.closest('[data-image-store-id]')?.dataset.imageStoreId;
        const matches = allStores.filter(store => storeId ? String(store.id) === storeId :
            [store.cover_image, store.owner_avatar_url, ...(store.sample_products || []).map(item => item.image_url)].some(url => url && absolute(url) === absolute(original)));
        const store = state.store || (matches.length === 1 ? matches[0] : null);
        state.store = store;
        const candidates = store ? (profile ? [store.owner_avatar_url] : [store.cover_image, ...(store.sample_products || []).map(item => item.image_url)]) : [];
        const next = candidates.find(url => url && /^https?:$/.test(new URL(absolute(url)).protocol) && !state.tried.has(absolute(url)));
        image.removeAttribute('srcset');
        image.closest('picture')?.querySelectorAll('source').forEach(source => source.removeAttribute('srcset'));
        state.pending = false;
        image.src = next || defaults[profile ? 0 : 1];
        if (state.alt) image.alt = next ? `${state.alt} (ภาพประกอบจากร้านเดียวกัน)` : `${state.alt} (ยังไม่มีภาพที่แสดงได้)`;
    }
    document.addEventListener('error', event => {
        if (!(event.target instanceof HTMLImageElement) || event.target.matches('#qr-image, [data-no-image-fallback], #p-image-preview-img')) return;
        event.stopImmediatePropagation();
        replaceBrokenImage(event.target);
    }, true);
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('img').forEach(image => {
            if (image.complete && !image.naturalWidth) replaceBrokenImage(image);
        });
    });
})();
