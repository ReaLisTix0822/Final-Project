const express = require('express');
const router = express.Router();
const db = require('../config/database');

// POST /api/matching/recommend
// Content-based Matching Algorithm matching supporter interest questionnaire
router.post('/recommend', async (req, res, next) => {
    try {
        const {
            disability_types = [],   // e.g. ['visual', 'hearing', 'physical', 'intellectual']
            category_ids = [],       // e.g. [1, 2, 3]
            purpose = 'all',         // 'home', 'gift', 'fashion', 'food', 'art', 'all'
            budget_max = 5000,
            sort_by_goal = false     // prioritize stores close to completing their support goal
        } = req.body;

        // Fetch all active products with store info
        const products = await db.all(`
            SELECT 
                p.*,
                c.name as category_name,
                c.icon as category_icon,
                s.id as store_id,
                s.store_name,
                s.disability_type,
                s.story as store_story,
                s.craft_technique,
                s.support_goal_title,
                s.support_goal_target,
                s.support_goal_current,
                s.province,
                COALESCE(AVG(r.rating), 5.0) as average_rating,
                COUNT(r.id) as review_count
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN stores s ON p.store_id = s.id
            LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
            WHERE p.is_active = 1 AND s.verification_status = 'approved'
            GROUP BY p.id
        `);

        // Compute Match Score for each product
        const scoredProducts = products.map(p => {
            let score = 50; // base score
            let matchReasons = [];

            // 1. Disability preference match (weight +30)
            if (disability_types.length > 0) {
                if (disability_types.includes(p.disability_type)) {
                    score += 30;
                    const dNames = {
                        visual: 'ผู้บกพร่องทางการมองเห็น',
                        hearing: 'ผู้บกพร่องทางการได้ยิน',
                        physical: 'ผู้บกพร่องทางการเคลื่อนไหว',
                        intellectual: 'ผู้บกพร่องทางสติปัญญา/ออทิสติก'
                    };
                    matchReasons.push(`ตรงกับกลุ่มเป้าหมายที่คุณต้องการสนับสนุน (${dNames[p.disability_type] || p.disability_type})`);
                }
            } else {
                score += 15;
            }

            // 2. Category interest match (weight +25)
            if (category_ids.length > 0) {
                if (category_ids.includes(p.category_id) || category_ids.includes(String(p.category_id))) {
                    score += 25;
                    matchReasons.push(`ตรงกับประเภทผลงานที่คุณสนใจ (${p.category_name})`);
                }
            } else {
                score += 10;
            }

            // 3. Budget match (weight +15)
            if (p.price <= budget_max) {
                score += 15;
                matchReasons.push(`ราคาอยู่ในงบประมาณที่คุณตั้งไว้ (${p.price} บาท)`);
            }

            // 4. Support Goal Progress incentive
            if (p.support_goal_target > 0) {
                const percent = Math.min(100, Math.round((p.support_goal_current / p.support_goal_target) * 100));
                if (sort_by_goal && percent < 100) {
                    score += 10;
                    matchReasons.push(`ช่วยผลักดันเป้าหมายร้านค้าให้สำเร็จ (ปัจจุบัน ${percent}%)`);
                }
            }

            // 5. High rating bonus (+5)
            if (p.average_rating >= 4.8) {
                score += 5;
                matchReasons.push('คะแนนรีวิวระดับยอดเยี่ยม 5 ดาว');
            }

            const matchPercentage = Math.min(99, Math.max(60, score));

            return {
                ...p,
                matchPercentage,
                matchReasons: matchReasons.slice(0, 3)
            };
        });

        // Sort by match score descending
        scoredProducts.sort((a, b) => b.matchPercentage - a.matchPercentage);

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
