"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Production-Grade Cloud Tasks Worker
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const extract_core_1 = require("./extract-core");
const logger_1 = require("../lib/logger");
const app = (0, express_1.default)();
const logger = (0, logger_1.createLogger)('cloud-tasks-worker');
// Middleware
app.use(express_1.default.json({ limit: '10mb' }));
// CORS middleware for Cloud Run
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'tubemind-worker'
    });
});
app.get('/', (req, res) => {
    res.status(200).json({
        service: 'tubemind-worker',
        status: 'ready',
        timestamp: new Date().toISOString()
    });
});
// Main Cloud Tasks job processor
app.post('/', async (req, res) => {
    const startTime = Date.now();
    let jobData = null;
    try {
        // Parse job data from Cloud Tasks
        jobData = req.body;
        if (!jobData) {
            logger.error('No job data received');
            res.status(400).json({ error: 'No job data provided' });
            return;
        }
        logger.info('Processing job with new progress tracking', {
            jobType: jobData.type || 'video-processing',
            videoId: jobData.videoId,
            userId: jobData.userId
        });
        // Process the video job using new extract-core with progress tracking
        await (0, extract_core_1.processVideoExtraction)(jobData);
        const processingTime = Date.now() - startTime;
        logger.info('Job completed successfully', {
            videoId: jobData.videoId,
            processingTimeMs: processingTime
        });
        res.status(200).json({
            status: 'completed',
            processingTimeMs: processingTime,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const processingTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Job processing failed', {
            error: errorMessage,
            videoId: jobData?.videoId,
            userId: jobData?.userId,
            processingTimeMs: processingTime,
            stack: error instanceof Error ? error.stack : undefined
        });
        // Return appropriate error status for Cloud Tasks retry logic
        if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            // Retryable error
            res.status(429).json({
                error: 'Rate limited - will retry',
                retryable: true
            });
        }
        else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
            // Non-retryable error
            res.status(401).json({
                error: 'Authentication failed',
                retryable: false
            });
        }
        else {
            // Generic retryable error
            res.status(500).json({
                error: 'Job processing failed',
                retryable: true
            });
        }
    }
});
// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error in worker', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
    });
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});
// Graceful shutdown
const server = app.listen(process.env.PORT || 8080, () => {
    logger.info(`Cloud Tasks worker listening on port ${process.env.PORT || 8080}`);
});
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});
exports.default = app;
