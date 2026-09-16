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

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check endpoint
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
