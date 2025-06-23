"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideoDirectly = processVideoDirectly;
// --- ALL IMPORTS FIRST ---
require("dotenv/config");
const job_queue_1 = require("../lib/job-queue");
const video_processor_1 = require("../lib/video-processor");
const health_1 = require("./health");
const logger_1 = require("../lib/logger");
const redis_queue_1 = require("../lib/redis-queue");
const http_1 = __importDefault(require("http"));
const serverless_1 = require("@neondatabase/serverless");
// --- THEN your Redis config, env loading, etc ---
process.env.DISABLE_REDIS = 'false';
process.env.FORCE_REDIS_ON_WINDOWS = 'true';
console.log('🔧 INITIAL Redis Configuration BEFORE IMPORTS:');
console.log(`   FORCE_REDIS_ON_WINDOWS: ${process.env.FORCE_REDIS_ON_WINDOWS}`);
// Load .env.local only in development
if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config();
}
// Universal Worker Process for TubeMind
// Works identically in both development and production environments
// Check environment type
const isLeapcellEnvironment = process.env.LEAPCELL === 'true' || process.env.DEPLOYMENT_ENV === 'leapcell';
const isProductionEnv = process.env.NODE_ENV === 'production';
// Load environment variables - works in all environments
if (!isLeapcellEnvironment) {
    try {
        require('dotenv').config({ path: '.env.local' });
        console.log('✅ Loaded environment variables from .env.local');
    }
    catch (error) {
        console.log('No .env.local file found or error loading it, using system environment variables');
    }
}
else {
    console.log('🚀 Running in Leapcell environment, using system environment variables');
}
// FORCE Redis again after loading env vars to override any .env.local settings
process.env.DISABLE_REDIS = 'false';
process.env.FORCE_REDIS_ON_WINDOWS = 'true';
console.log('🔧 REDIS Configuration AFTER env override:');
console.log(`   FORCE_REDIS_ON_WINDOWS (should be true): ${process.env.FORCE_REDIS_ON_WINDOWS}`);
console.log('🔧 FINAL Redis Configuration:');
console.log(`   DISABLE_REDIS: ${process.env.DISABLE_REDIS}`);
console.log(`   UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET'}`);
console.log(`   UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET'}`);
console.log(`   FORCE_REDIS_ON_WINDOWS: ${process.env.FORCE_REDIS_ON_WINDOWS}`);
// --- THEN logger ---
const logger = (0, logger_1.createLogger)('worker:extract');
// Add this after logger is defined and environment variables are loaded
const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || 'NOT SET';
const maskedDbUrl = dbUrl.replace(/(:)([^:]*)(@)/, (m, p1, p2, p3) => p1 + '*****' + p3);
logger.info(`🔗 Neon DB connection string: ${maskedDbUrl}`);
logger.info('🚀 Enhanced worker process starting with Redis integration...');
logger.info(`✅ Node.js version: ${process.version}`);
logger.info(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
let isShuttingDown = false;
let workerRunning = false;
const shutdown = (signal) => {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    logger.info(`👋 Received ${signal}. Shutting down enhanced worker...`);
    setTimeout(() => {
        process.exit(0);
    }, 5000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// --- PRE-FLIGHT TESTS ---
(async () => {
    try {
        // Test Neon DB connectivity
        const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
        if (!connectionString) {
            console.error('❌ No Neon connection string found in env');
        }
        else {
            const sql = (0, serverless_1.neon)(connectionString);
            console.log('🟢 [Preflight] Neon connection pool created');
            const result = await sql `SELECT 1 as test`;
            console.log('🟢 [Preflight] Neon test query succeeded:', result);
        }
        // Test Redis connectivity
        console.log('🔍 [Preflight] Testing Redis connectivity...');
        const redisInitialized = await (0, redis_queue_1.initializeRedisQueue)();
        if (redisInitialized) {
            console.log('🟢 [Preflight] Redis connection successful!');
        }
        else {
            console.log('⚠️ [Preflight] Redis not available, will use DB fallback');
        }
    }
    catch (err) {
        console.error('🔴 [Preflight] Tests failed:', err);
    }
})();
async function startWorker() {
    console.log('🚨 ENTERED startWorker with Redis integration');
    try {
        logger.info('🏥 Starting health check server...');
        (0, health_1.startHealthCheckServer)();
        logger.info('✅ Health check server started.');
        // Initialize Redis queue
        const redisInitialized = await (0, redis_queue_1.initializeRedisQueue)();
        logger.info(`🔗 Redis initialization: ${redisInitialized ? '✅ Success' : '⚠️ Failed, using DB only'}`);
        const handleJob = async (jobData) => {
            const jobId = `${jobData.videoDbId}-${Date.now()}`;
            logger.info(`🔄 Processing job ${jobId} for video ${jobData.videoId}`, {
                source: (0, redis_queue_1.isRedisAvailable)() ? 'Redis' : 'Database',
                userId: jobData.userId
            });
            try {
                await (0, video_processor_1.processVideoJob)(jobData);
                logger.info(`✅ Job ${jobId} completed successfully.`, {
                    videoId: jobData.videoId,
                    userId: jobData.userId
                });
            }
            catch (error) {
                logger.error(`❌ Job ${jobId} failed.`, {
                    error: error instanceof Error ? error.message : String(error),
                    videoId: jobData.videoId,
                    userId: jobData.userId
                });
                throw error;
            }
        };
        logger.info('🔥 Starting enhanced worker (Redis + DB polling)...');
        await (0, job_queue_1.startSimpleWorker)(handleJob, () => isShuttingDown);
        logger.info('🛑 Enhanced worker returned unexpectedly!');
        console.log('⏳ Enhanced worker is running. Press Ctrl+C to exit.');
    }
    catch (error) {
        logger.error('💥 Critical error during enhanced worker initialization.', {
            error: error instanceof Error ? error.message : String(error)
        });
        console.error('💥 Critical error during enhanced worker initialization.', error);
        setTimeout(() => process.exit(1), 1000);
    }
}
// Enhanced HTTP endpoint to trigger the worker on-demand
const server = http_1.default.createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    // CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    if (req.method === 'POST' && url.pathname === '/start') {
        console.log('🚨 /start endpoint triggered');
        if (!workerRunning) {
            workerRunning = true;
            startWorker().finally(() => { workerRunning = false; });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Enhanced worker started',
                redis: (0, redis_queue_1.isRedisAvailable)()
            }));
        }
        else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Enhanced worker already running',
                redis: (0, redis_queue_1.isRedisAvailable)()
            }));
        }
    }
    else if (req.method === 'GET' && url.pathname === '/health') {
        // Health check endpoint
        try {
            const { checkRedisHealth } = await Promise.resolve().then(() => __importStar(require('../lib/redis-queue')));
            const redisHealth = await checkRedisHealth();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                worker: workerRunning ? 'running' : 'stopped',
                redis: redisHealth,
                timestamp: new Date().toISOString()
            }));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'error',
                error: error instanceof Error ? error.message : String(error)
            }));
        }
    }
    else if (req.method === 'GET' && url.pathname === '/stats') {
        // Stats endpoint
        try {
            const { getRedisQueueStats } = await Promise.resolve().then(() => __importStar(require('../lib/redis-queue')));
            const stats = await getRedisQueueStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                worker: workerRunning ? 'running' : 'stopped',
                redis: stats,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString()
            }));
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: error instanceof Error ? error.message : String(error)
            }));
        }
    }
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});
const PORT = process.env.WORKER_TRIGGER_PORT || 8079;
server.listen(PORT, () => {
    console.log(`🚀 Enhanced worker trigger server listening on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`📈 Stats: http://localhost:${PORT}/stats`);
    console.log(`🔥 Trigger: POST http://localhost:${PORT}/start`);
});
/**
 * Direct video processing function for backup when job queue fails
 * This ensures users always get their summaries even if Redis/worker issues occur
 */
async function processVideoDirectly(videoId, videoDbId, summaryDbId, userId, userEmail, metadata, totalDurationSeconds, creditsNeeded) {
    logger.info(`🎬 Starting direct video processing for ${videoId}`);
    try {
        // Create VideoJob object
        const job = {
            videoId,
            videoDbId,
            summaryDbId,
            userId,
            userEmail,
            user: { id: userId, email: userEmail },
            metadata,
            totalDurationSeconds,
            creditsNeeded
        };
        // Process the video directly using existing processing logic
        const { processVideoExtraction } = await Promise.resolve().then(() => __importStar(require('./extract-core')));
        await processVideoExtraction(job);
        logger.info(`✅ Direct video processing completed for ${videoId}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Direct video processing failed for ${videoId}: ${errorMessage}`);
        throw error;
    }
}
