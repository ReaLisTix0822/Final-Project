const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { PUBLIC_DISABILITY_SQL } = require('../services/consent');
const { optionalUserId } = require('../middleware/auth');

// Save the chosen disability types and the categories behind the chosen product types
// (one row per type with category_id NULL, one row per category with type_id NULL)
async function saveMatchingPreferences(userId, typeIds, categoryIds) {
    await db.run('DELETE FROM matching_preferences WHERE user_id = ?', [userId]);
    for (const typeId of typeIds) {
        await db.run('INSERT INTO matching_preferences (user_id, type_id, category_id) VALUES (?, ?, NULL)', [userId, typeId]);
    }
    for (const categoryId of categoryIds) {
        await db.run('INSERT INTO matching_preferences (user_id, type_id, category_id) VALUES (?, NULL, ?)', [userId, categoryId]);
    }
}

// POST /api/matching/recommend
// Content-based Matching Algorithm matching supporter interest questionnaire
router.post('/recommend', async (req, res, next) => {
    try {
        const {
            product_types = [], purpose = 'self', budget_max = 1500,
            store_preference = 'all', disability_types = []
        } = req.body;
        const disabilityTypes = await db.all('SELECT id, code, COALESCE(label, name) as label FROM disability_types');
        const chosenTypes = Array.isArray(disability_types)
            ? disabilityTypes.filter(type => disability_types.includes(type.code))
            : [];
        if (!Array.isArray(disability_types) || chosenTypes.length !== new Set(disability_types).size) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกกลุ่มช่างฝีมือที่ระบบรองรับ' });
        }
        const typePatterns = {
            bag: /กระเป๋า|bag|wallet/i,
            clothing: /เสื้อ|ผ้า|scarf|shirt|clothing/i,
            household: /ถาด|แก้ว|จาน|ชาม|ตะกร้า|ของใช้|tray|mug|coaster|basket/i,
            decor: /ภาพวาด|ตกแต่ง|โคม|แจกัน|painting|art|decor/i,
            food: /อาหาร|ขนม|ชา|กาแฟ|food|sweet|snack/i
        };
        if (!Array.isArray(product_types) || product_types.some(type => !Object.hasOwn(typePatterns, type))
            || !['self', 'gift', 'support'].includes(purpose)
            || !['all', 'new', 'near_goal'].includes(store_preference)
            || (budget_max !== null && (typeof budget_max !== 'number' || !Number.isFinite(budget_max) || budget_max < 0))) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกคำตอบและงบประมาณที่ถูกต้อง' });
        }
        const budget = budget_max === null ? Infinity : budget_max;

        // Fetch all active products with store info
        const products = await db.all(`
            SELECT 
                p.*,
                c.name as category_name,
                c.icon as category_icon,
                s.id as store_id,
                s.store_name,
                ${PUBLIC_DISABILITY_SQL} as disability_type,
                s.story as store_story,
                s.craft_technique,
                s.support_goal_title,
                s.support_goal_target,
                s.support_goal_current,
                s.province,
                s.created_at as store_created_at,
                AVG(r.rating) as average_rating,   -- NULL when there are no reviews (no fake 5 stars)
                COUNT(r.id) as review_count
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN stores s ON p.store_id = s.id
            LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
            WHERE p.is_active = 1 AND s.verification_status = 'approved'
            GROUP BY p.id
        `);

        const typeNames = { bag: 'กระเป๋า', clothing: 'เสื้อผ้าและผ้าทอ', household: 'ของใช้', decor: 'ของตกแต่ง', food: 'อาหารและขนม' };
        const candidates = products.filter(product => {
            const title = product.name || '';
            return Number(product.price) <= budget && Number(product.stock) > 0
                && (!product_types.length || product_types.some(type => typePatterns[type].test(title)));
        });
        // Rank newest shops by their actual creation date, without assuming an opening date.
        const newestIds = [...new Set([...candidates].sort((a, b) =>
            String(b.store_created_at || '').localeCompare(String(a.store_created_at || ''))
        ).map(product => product.store_id))];
        const scoredProducts = candidates.map(product => {
            let score = 60;
            const reasons = [];
            const name = product.name || '';
            const matchedType = product_types.find(type => typePatterns[type].test(name));
            if (matchedType) { score += 15; reasons.push(`ตรงกับประเภทที่คุณสนใจ: ${typeNames[matchedType]}`); }
            if (Number.isFinite(budget)) reasons.push(`ราคา ${Number(product.price).toLocaleString('th-TH')} บาท อยู่ในงบต่อชิ้น`);
            if (purpose === 'gift') {
                if (/ของขวัญ|ที่ระลึก|กระเป๋า|ผ้าพันคอ|แก้ว|ภาพวาด|gift|scarf|mug/i.test(name + ' ' + (product.description || ''))) {
                    score += 10; reasons.push('แนะนำเป็นไอเดียของขวัญจากประเภทสินค้า');
                }
            } else if (purpose === 'self') {
                if (/กระเป๋า|ผ้า|ถาด|จาน|แก้ว|ชาม|ขนม|ของใช้/i.test(name)) { score += 10; reasons.push('เป็นสินค้าสำหรับใช้ในชีวิตประจำวัน'); }
            } else { reasons.push('ร่วมสนับสนุนผลงานและรายได้ของช่างฝีมือ'); score += 5; }
            if (store_preference === 'new') {
                const rank = newestIds.indexOf(product.store_id);
                score += Math.max(0, 12 - rank * 3);
                reasons.unshift('ให้ความสำคัญกับร้านที่เข้าร่วมระบบล่าสุด');
            }
            const progress = Number(product.support_goal_target) > 0
                ? Number(product.support_goal_current) / Number(product.support_goal_target) : 0;
            if (store_preference === 'near_goal' && progress > 0 && progress < 1) {
                score += progress * 15;
                reasons.unshift(`ร้านสะสมทุนได้แล้ว ${Math.round(progress * 100)}% ของเป้าหมาย`);
            }
            const chosenType = chosenTypes.find(type => type.code === product.disability_type);
            if (chosenType) {
                score += 15;
                reasons.unshift(`ผลงานจาก${chosenType.label} ตามที่คุณเลือก`);
            }
            if (Number(product.review_count) > 0 && Number(product.average_rating) >= 4.8) score += 3;
            return { ...product, matchPercentage: Math.min(99, Math.round(score)), matchReasons: reasons.slice(0, 3), matchScore: score };
        });
        scoredProducts.sort((a, b) => b.matchScore - a.matchScore || Number(a.id) - Number(b.id));

        const userId = optionalUserId(req);
        if (userId && await db.get('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [userId])) {
            const categoryIds = [...new Set(products
                .filter(product => product_types.some(type => typePatterns[type].test(product.name || '')))
                .map(product => Number(product.category_id)))];
            await saveMatchingPreferences(userId, chosenTypes.map(type => Number(type.id)), categoryIds);
        }

        // Group top recommended stores
        const storeMap = new Map();
        scoredProducts.forEach(p => {
            if (!storeMap.has(p.store_id)) {
                storeMap.set(p.store_id, {
                    store_id: p.store_id,
                    store_name: p.store_name,
                    disability_type: p.disability_type,
                    store_story: p.store_story,
                    craft_technique: p.craft_technique,
                    support_goal_title: p.support_goal_title,
                    support_goal_target: p.support_goal_target,
                    support_goal_current: p.support_goal_current,
                    province: p.province,
                    top_product_name: p.name,
                    top_product_image: p.image_url,
                    matchPercentage: p.matchPercentage,
                    reasons: p.matchReasons
                });
            }
        });

        res.json({
            success: true,
            total_matched: scoredProducts.length,
            recommended_products: scoredProducts.slice(0, 8),
            recommended_stores: Array.from(storeMap.values()).slice(0, 4)
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
