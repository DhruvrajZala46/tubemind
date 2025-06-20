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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideo = void 0;
exports.processVideoDirectly = processVideoDirectly;
// FORCE Redis to be enabled - MUST BE FIRST BEFORE ANY IMPORTS
process.env.DISABLE_REDIS = 'false';
process.env.FORCE_REDIS_ON_WINDOWS = 'true';
console.log('🔧 INITIAL Redis Configuration BEFORE IMPORTS:');
console.log(`   DISABLE_REDIS: ${process.env.DISABLE_REDIS}`);
console.log(`   FORCE_REDIS_ON_WINDOWS: ${process.env.FORCE_REDIS_ON_WINDOWS}`);
// Universal Worker Process for TubeGPT
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
// Verify the override worked
console.log('🔧 REDIS Configuration AFTER env override:');
console.log(`   DISABLE_REDIS (should be false): ${process.env.DISABLE_REDIS}`);
console.log(`   FORCE_REDIS_ON_WINDOWS (should be true): ${process.env.FORCE_REDIS_ON_WINDOWS}`);
console.log('🔧 FINAL Redis Configuration:');
console.log(`   DISABLE_REDIS: ${process.env.DISABLE_REDIS}`);
console.log(`   UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET'}`);
console.log(`   UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET'}`);
console.log(`   FORCE_REDIS_ON_WINDOWS: ${process.env.FORCE_REDIS_ON_WINDOWS}`);
// NOW import modules after environment is properly set
const job_queue_1 = require("../lib/job-queue");
const health_1 = require("./health");
const extract_core_1 = require("./extract-core");
Object.defineProperty(exports, "processVideo", { enumerable: true, get: function () { return extract_core_1.processVideo; } });
const logger_1 = require("../lib/logger");
// Initialize logger
const logger = (0, logger_1.createLogger)('worker:extract');
// Flag to prevent multiple initializations
let workerStarted = false;
// Start health check server for monitoring
logger.info('Starting health check server...');
(0, health_1.startHealthCheckServer)();
// Start the worker process
async function initializeWorker() {
    if (workerStarted) {
        logger.info('Worker already started, skipping initialization');
        return;
    }
    workerStarted = true;
    logger.info('Starting worker process...');
    try {
        // Start the worker to process jobs
        await (0, job_queue_1.startWorker)();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to start worker: ${errorMessage}`);
        // Even if the worker fails to start, we can still process videos directly
        // This ensures that the application continues to work even if Redis is unavailable
        logger.info('Worker will process videos directly without Redis queue');
    }
}
// Initialize the worker immediately
initializeWorker().catch(error => {
    logger.error(`Error during worker initialization: ${error.message}`);
});
// Keep the process alive
console.log('⏳ Worker process started. Keeping alive...');
// Add a simple heartbeat to keep the process running
setInterval(() => {
    logger.info('💓 Worker heartbeat - process is alive');
}, 30000); // Every 30 seconds
// Handle process signals gracefully
process.on('SIGTERM', () => {
    logger.info('👋 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger.info('👋 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    if (error.stack) {
        logger.error(error.stack);
    }
    // Don't exit immediately, log and continue
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled rejection at ${promise}: ${reason}`);
    // Don't exit immediately, log and continue
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
