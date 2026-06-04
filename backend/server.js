/* =====================================================
   TransitIQ — Express Server Entry Point
   Smart Student Transportation System
   ===================================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const submissionsRouter = require('./routes/submissions');
const recommendationsRouter = require('./routes/recommendations');
const analyticsRouter = require('./routes/analytics');
const nearbyTransitRouter = require('./routes/nearby-transit');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Middleware ==========

// CORS — Allow frontend to communicate with backend
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));

// Parse JSON request bodies
app.use(express.json());

// Request logging (simple dev logger)
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

// ========== Routes ==========

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'TransitIQ API is running',
        timestamp: new Date().toISOString(),
    });
});

// API routes
app.use('/api/submissions', submissionsRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/nearby-transit', nearbyTransitRouter);

// ========== 404 Handler ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.url}`,
    });
});

// ========== Global Error Handler ==========
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.message);
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
    });
});

// ========== Start Server ==========
app.listen(PORT, () => {
    console.log('');
    console.log('🚌 ===================================');
    console.log(`🚌  TransitIQ API Server`);
    console.log(`🚌  Running on http://localhost:${PORT}`);
    console.log(`🚌  Health: http://localhost:${PORT}/api/health`);
    console.log('🚌 ===================================');
    console.log('');
});
