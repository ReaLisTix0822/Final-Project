// ==============================================================================
// PRODUCT COLOURS (product detail page)
// Finds the main colours in the product photo and shows them as swatches with a
// Thai colour name, so the colours are announced by screen readers and are not
// conveyed by colour alone (WCAG 1.1.1 / 1.4.1).
// ProductColors.render(sectionElement, imageUrl, productName)
// ==============================================================================
const ProductColors = (() => {
    const SAMPLE = 64;          // photo is scaled down to 64x64 before counting
    const MAX_COLOURS = 4;
    const MIN_SHARE = 0.05;     // ignore colours covering less than 5% of the photo

    function toHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        if (max === min) return { h: 0, s: 0, l };
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return { h: h * 60, s, l };
    }

    // Plain-language Thai colour name from RGB
    function thaiName(r, g, b) {
        const { h, s, l } = toHsl(r, g, b);
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);   // 0-255: how far from grey
        if (chroma < 14) {
            if (l < 0.18) return 'ดำ';
            if (l > 0.93) return 'ขาว';
            return l < 0.35 ? 'เทาเข้ม' : l < 0.68 ? 'เทา' : 'เทาอ่อน';
        }
        if (l < 0.12) return 'ดำ';
        if (l > 0.95) return 'ขาว';
        // Warm, not very saturated hues read as browns / beige rather than orange
        if (h >= 15 && h < 55 && (s < 0.55 || l < 0.45)) {
            if (l < 0.25) return 'น้ำตาลเข้ม';
            if (l < 0.45) return 'น้ำตาล';
            if (l < 0.7) return 'น้ำตาลอ่อน';
            return 'ครีม';
        }
        if (chroma < 30) return l < 0.35 ? 'เทาเข้ม' : l < 0.68 ? 'เทา' : 'เทาอ่อน';

        let base;
        if (h < 12 || h >= 345) base = 'แดง';
        else if (h < 40) base = 'ส้ม';
        else if (h < 52) base = l < 0.62 ? 'เหลืองทอง' : 'เหลือง';
        else if (h < 68) base = l < 0.4 ? 'เขียวมะกอก' : 'เหลือง';
        else if (h < 160) base = 'เขียว';
        else if (h < 195) base = 'เขียวน้ำทะเล';
        else if (h < 250) base = l > 0.62 ? 'ฟ้า' : 'น้ำเงิน';
        else if (h < 290) base = 'ม่วง';
        else base = 'ชมพู';

        if (['ฟ้า', 'เหลือง', 'เหลืองทอง'].includes(base)) return base;
        if (l < 0.3) return `${base}เข้ม`;
        if (l > 0.75) return `${base}อ่อน`;
        return base;
    }

    // Count colours in coarse buckets, then merge neighbours into a few dominant colours
    function dominant(img) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = SAMPLE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);   // throws if the image is cross-origin without CORS

        const buckets = new Map();
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
            const b = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
            b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; b.n++;
            buckets.set(key, b);
            total++;
        }

        const colours = [];
        [...buckets.values()].sort((a, b) => b.n - a.n).forEach(bk => {
            const c = { r: bk.r / bk.n, g: bk.g / bk.n, b: bk.b / bk.n, n: bk.n };
            const near = colours.find(o => Math.hypot(o.r - c.r, o.g - c.g, o.b - c.b) < 48);
            if (near) {
                const n = near.n + c.n;
                near.r = (near.r * near.n + c.r * c.n) / n;
                near.g = (near.g * near.n + c.g * c.n) / n;
                near.b = (near.b * near.n + c.b * c.n) / n;
                near.n = n;
            } else {
                colours.push(c);
            }
        });

        const named = [];
        colours.sort((a, b) => b.n - a.n).forEach(c => {
            const share = c.n / total;
            if (share < MIN_SHARE || named.length >= MAX_COLOURS) return;
            const name = thaiName(c.r, c.g, c.b);
            const same = named.find(x => x.name === name);
            if (same) { same.share += share; return; }   // two shades with the same name -> one swatch
            const hex = '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
            named.push({ hex, name, share });
        });
        return named;
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    async function render(section, imageUrl, productName = '') {
        if (!section || !imageUrl) return;
        try {
            const colours = dominant(await loadImage(imageUrl));
            if (!colours.length) return;
            const summary = colours.map(c => c.name).join(', ');
            const safeName = String(productName).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
            section.innerHTML = `
                <h2 class="detail-colors-title" id="detail-colors-title">โทนสีของสินค้า</h2>
                <ul class="detail-colors-list" aria-label="โทนสีของ${safeName ? ` ${safeName}` : 'สินค้า'}: ${summary}">
                    ${colours.map(c => `
                    <li class="detail-color">
                        <span class="detail-color-swatch" style="background:${c.hex}" aria-hidden="true"></span>
                        <span class="detail-color-name">${c.name}</span>
                        <span class="sr-only">ประมาณ ${Math.round(c.share * 100)} เปอร์เซ็นต์ของภาพ</span>
                    </li>`).join('')}
                </ul>
                <p class="detail-colors-note">สีโดยประมาณจากรูปถ่าย สีจริงอาจต่างไปตามแสงและหน้าจอ</p>`;
            section.hidden = false;
        } catch (err) {
            section.hidden = true;   // photo could not be read (e.g. no CORS): leave the section out
        }
    }

    return { render, thaiName };
})();

if (typeof window !== 'undefined') window.ProductColors = ProductColors;
