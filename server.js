require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const storeRoutes = require('./routes/stores');
const matchingRoutes = require('./routes/matching');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const campaignRoutes = require('./routes/campaigns');
const adminRoutes = require('./routes/admin');
const chatbotRoutes = require('./routes/chatbot');
const aiRoutes = require('./routes/ai');
const favoriteRoutes = require('./routes/favorites');
const chatRoutes = require('./routes/chat');
const cartRoutes = require('./routes/cart');
const notificationRoutes = require('./routes/notifications');
const addressRoutes = require('./routes/addresses');
const followRoutes = require('./routes/follows');
const tipRoutes = require('./routes/tips');
const disabilityTypeRoutes = require('./routes/disabilityTypes');
const reportRoutes = require('./routes/reports');
const searchHistoryRoutes = require('./routes/searchHistory');
const complaintRoutes = require('./routes/complaints');
const accessibilitySettingsRoutes = require('./routes/accessibilitySettings');

const { getSellerRevenue } = require('./services/salesStats');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Privacy policy (PDPA) at a short address
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/disability-types', disabilityTypeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/search-history', searchHistoryRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/accessibility-settings', accessibilitySettingsRoutes);


// Health check endpoint
app.get('/api/marketplace/stats', async (req, res, next) => {
    try {
        const stats = await db.get(`
            SELECT
                (SELECT COUNT(*) FROM stores WHERE verification_status = 'approved') AS verified_stores,
                (SELECT AVG(rating) FROM reviews WHERE status = 'approved') AS average_rating
        `);
        // Seller revenue = product subtotal + tips of paid orders, WITHOUT shipping (services/salesStats.js)
        const sellerRevenue = await getSellerRevenue();
        res.set('Cache-Control', 'no-store');
        res.json({ success: true, data: {
            verified_stores: Number(stats.verified_stores),
            average_rating: stats.average_rating == null ? null : Number(stats.average_rating),
            seller_revenue: sellerRevenue
        } });
    } catch (err) { next(err); }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        database: db.getDriver(),
        platform: 'Inclusive Handicraft Marketplace for Disabilities People (IT 2569/WEB06)',
        timestamp: new Date().toISOString()
    });
});

// Fallback for HTML routing
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Global Error Handler
app.use(errorHandler);

// Start server
async function startServer() {
    try {
        console.log('🚀 Initializing Database and Marketplace Data...');
        await db.init();
        
        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`🌟 Inclusive Marketplace Server running on port ${PORT}`);
            console.log(`🌐 Accessible at: http://localhost:${PORT}`);
            console.log(`🎯 Database Mode: ${db.getDriver().toUpperCase()}`);
            console.log(`=======================================================`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

startServer();
