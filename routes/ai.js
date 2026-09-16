const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const db = require('../config/database');

// GET /api/ai/status
router.get('/status', (req, res) => {
    res.json({
        success: true,
        configured: geminiService.isConfigured(),
        model: geminiService.modelName,
        tier: 'Free Tier (Google AI Studio)',
        free_tier_limits: '15 RPM, 1,500 RPD, 1M Context Window',
        features: [
            'AI Accessibility Chatbot (น้องใจดี)',
            'AI Storytelling Assistant for Disabled Artisans (ระบบช่วยเขียนเรื่องราว)',
            'Smart Matching Explainer (ระบบอธิบายเหตุผลการจับคู่สินค้า)',
            'Screen Reader / TTS Summarization'
        ]
    });
});

// POST /api/ai/set-key (Set API key dynamically via admin or UI)
router.post('/set-key', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ API Key' });
    }

    const success = geminiService.setApiKey(apiKey.trim());
    res.json({
        success: true,
        message: 'บันทึก Gemini API Key เรียบร้อยแล้ว ระบบเปิดใช้งานโมเดล ' + geminiService.modelName,
        configured: geminiService.isConfigured()
    });
});

// POST /api/ai/chat
router.post('/chat', async (req, res, next) => {
    try {
        const { message, history } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุข้อความ' });
        }

        // Fetch top featured products to provide real-time context
        const featuredProducts = await db.all(
            'SELECT p.id, p.name, p.price, p.story, s.store_name, s.disability_type FROM products p JOIN stores s ON p.store_id = s.id WHERE p.is_active = 1 LIMIT 5'
        );

        const result = await geminiService.chat({
            message,
            history,
            marketplaceContext: {
                featuredProducts
            }
        });

        res.json({
            success: true,
            reply: result.reply,
            source: result.source,
            model: result.model || geminiService.modelName,
            note: result.note || null
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/ai/generate-story (Storytelling assistant for sellers)
router.post('/generate-story', async (req, res, next) => {
    try {
        const { artisanName, disabilityType, craftName, rawNotes, goalTitle } = req.body;

        const story = await geminiService.generateStory({
            artisanName,
            disabilityType,
            craftName,
            rawNotes,
            goalTitle
        });

        res.json({
            success: true,
            data: story
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
