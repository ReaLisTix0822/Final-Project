// ==============================================================================
// LAZY-LOADING MOTION
// 1. Lazy images show a shimmer while loading, then fade in (img[loading="lazy"])
// 2. Cards (always visible) rise 12px with a light fade the first time they scroll into view
// Loaded in <head> so it sees every image load event. Respects prefers-reduced-motion.
// ==============================================================================
(() => {
    const root = document.documentElement;
    root.classList.add('lazy-motion');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const REVEAL_SELECTOR = [
        '.product-card', '.taladjai-product-card', '.artisan-card', '.artisan-store-card',
        '.category-card', '.campaign-card-grid', '.managed-address-card', '.address-summary-card'
    ].join(',');

    // ---- 1. Image fade-in -------------------------------------------------------
    const markLoaded = img => img.classList.add('is-loaded');
    const onImageEvent = event => {
        if (event.target instanceof HTMLImageElement) markLoaded(event.target);
    };
    // load / error do not bubble, so listen in the capture phase.
    // An error still ends the shimmer; image-fallbacks.js then swaps in a fallback.
    document.addEventListener('load', onImageEvent, true);
    document.addEventListener('error', onImageEvent, true);

    const sweepImages = node => {
        const images = node instanceof HTMLImageElement ? [node] : node.querySelectorAll?.('img') || [];
        images.forEach(img => {
            // Already in the browser cache: no load event will reach us.
            if (img.complete && img.naturalWidth > 0) markLoaded(img);
        });
    };

    // ---- 2. Card reveal on scroll -----------------------------------------------
    const revealObserver = !reduceMotion && 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
        : null;

    const sweepCards = node => {
        if (!revealObserver || !(node instanceof Element)) return;
        const cards = node.matches(REVEAL_SELECTOR) ? [node] : node.querySelectorAll(REVEAL_SELECTOR);
        cards.forEach(card => {
            if (card.classList.contains('reveal-item')) return;
            // Small stagger for cards that sit side by side in the same grid
            const index = Array.prototype.indexOf.call(card.parentElement?.children || [], card);
            card.style.setProperty('--reveal-delay', `${Math.min(Math.max(index, 0) % 4, 3) * 40}ms`);
            card.classList.add('reveal-item');
            revealObserver.observe(card);
        });
    };

    const sweep = node => { sweepImages(node); sweepCards(node); };

    // Product lists are rendered by JavaScript, so watch for new nodes.
    new MutationObserver(mutations => {
        mutations.forEach(mutation => mutation.addedNodes.forEach(sweep));
    }).observe(root, { childList: true, subtree: true });

    document.addEventListener('DOMContentLoaded', () => sweep(document.body));
})();
