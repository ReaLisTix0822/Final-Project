// ==============================================================================
// SMART SEARCH (products page)
// Finds products by name first, then by related keywords:
//  - ignores Thai tone marks / case / spaces  ("กระเป่า" finds "กระเป๋า")
//  - synonyms in Thai and English             ("mug" finds "แก้วกาแฟ", "ผ้าไหม" finds "ผ้าพันคอ")
//  - small typos                              ("ผ้าพนคอ" finds "ผ้าพันคอ")
// SmartSearch.score(product, query) -> 0 when unrelated, higher = more relevant.
// ==============================================================================
const SmartSearch = (() => {
    const SYNONYMS = [
        ['กระเป๋า', 'bag', 'ย่าม', 'กระเป๋าถือ', 'กระเป๋าสะพาย', 'handbag', 'tote'],
        ['กระเป๋าสตางค์', 'กระเป๋าเงิน', 'wallet', 'purse'],
        ['แก้ว', 'แก้วน้ำ', 'แก้วกาแฟ', 'ถ้วย', 'mug', 'cup'],
        ['จาน', 'ถาด', 'tray', 'plate', 'จานรอง', 'ที่รองแก้ว', 'coaster'],
        ['ผ้า', 'ผ้าทอ', 'ผ้าไหม', 'ไหม', 'silk', 'ผ้าพันคอ', 'scarf', 'ผ้าคลุมไหล่', 'มัดหมี่', 'textile'],
        ['ขนม', 'ขนมไทย', 'ของกิน', 'อาหาร', 'snack', 'dessert', 'food'],
        ['ของขวัญ', 'ของฝาก', 'gift', 'กล่องของขวัญ', 'ที่ระลึก', 'souvenir'],
        ['ภาพวาด', 'รูปวาด', 'ภาพ', 'painting', 'art', 'ศิลปะ', 'งานศิลป์', 'สีน้ำ', 'watercolor'],
        ['ไม้', 'งานไม้', 'wood', 'wooden', 'ไม้จามจุรี', 'acacia'],
        ['ไม้ไผ่', 'ไผ่', 'bamboo'],
        ['หนัง', 'หนังแท้', 'leather'],
        ['จักสาน', 'สาน', 'งานสาน', 'woven', 'basket', 'ตะกร้า', 'ผักตบชวา', 'hyacinth'],
        ['เซรามิก', 'ceramic', 'ดินเผา', 'pottery', 'เครื่องปั้น'],
        ['กาแฟ', 'coffee'],
        ['แฮนด์เมด', 'ทำมือ', 'handmade', 'งานฝีมือ', 'hand-made']
    ];

    // Lowercase, drop Thai tone marks / short-vowel marks and punctuation, collapse spaces
    const normalize = text => String(text || '')
        .toLowerCase()
        .normalize('NFC')
        .replace(/[็-๎]/g, '')          // ็ ่ ้ ๊ ๋ ์ ํ ๎
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const compact = text => normalize(text).replace(/\s/g, '');

    const NORMALIZED_GROUPS = SYNONYMS.map(group => group.map(compact));

    // Related words for one query term (the term itself first)
    function expand(term) {
        const related = new Set([term]);
        NORMALIZED_GROUPS.forEach(group => {
            if (group.some(word => word === term || (term.length >= 3 && (word.includes(term) || term.includes(word))))) {
                group.forEach(word => related.add(word));
            }
        });
        return [...related];
    }

    // Character-bigram similarity (0..1) for typo tolerance
    function bigrams(s) {
        const out = [];
        for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
        return out;
    }
    function dice(a, b) {
        if (a.length < 2 || b.length < 2) return 0;
        const A = bigrams(a), B = bigrams(b);
        const counts = new Map();
        A.forEach(g => counts.set(g, (counts.get(g) || 0) + 1));
        let hits = 0;
        B.forEach(g => { const n = counts.get(g); if (n) { hits++; counts.set(g, n - 1); } });
        return (2 * hits) / (A.length + B.length);
    }
    // Best similarity of `term` against any same-length slice of `text` (Thai has no word spaces)
    function fuzzyIn(term, text) {
        if (term.length < 3 || !text) return 0;
        let best = 0;
        for (const len of [term.length - 1, term.length, term.length + 1]) {
            if (len < 2) continue;
            for (let i = 0; i + len <= text.length; i++) {
                const score = dice(term, text.slice(i, i + len));
                if (score > best) best = score;
                if (best === 1) return 1;
            }
        }
        return best;
    }

    const FIELDS = [
        ['name', 10],
        ['category_name', 5],
        ['store_name', 4],
        ['story', 2],
        ['description', 2]
    ];

    function score(product, query) {
        const q = normalize(query);
        if (!q) return 1;
        const fields = FIELDS.map(([key, weight]) => [compact(product[key]), weight]);
        const whole = q.replace(/\s/g, '');
        const terms = [...new Set([whole, ...q.split(' ').filter(t => t.length >= 2)])];

        let total = 0;
        let matchedTerms = 0;
        terms.forEach(term => {
            let best = 0;
            const related = expand(term);
            fields.forEach(([text, weight]) => {
                if (!text) return;
                if (text.includes(term)) best = Math.max(best, weight * 3);                         // exact
                else if (weight < 4) return;                                // story / description: exact words only
                else if (related.some(word => word !== term && text.includes(word))) best = Math.max(best, weight * 1.6); // synonym
                else {
                    const sim = fuzzyIn(term, text);                                                     // typo
                    if (sim >= 0.72) best = Math.max(best, weight * sim);
                }
            });
            if (best > 0) matchedTerms++;
            total += best;
        });
        // Multi-word queries: every word (or the whole phrase) should be related
        if (terms.length > 1 && matchedTerms < terms.length - 1) return 0;
        return total;
    }

    return { score, normalize, expand };
})();

if (typeof window !== 'undefined') window.SmartSearch = SmartSearch;
