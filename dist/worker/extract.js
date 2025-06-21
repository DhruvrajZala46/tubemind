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
exports.processVideoDirectly = processVideoDirectly;
// FORCE Redis to be enabled - MUST BE FIRST BEFORE ANY IMPORTS
process.env.DISABLE_REDIS = 'false';
process.env.FORCE_REDIS_ON_WINDOWS = 'true';
console.log('🔧 INITIAL Redis Configuration BEFORE IMPORTS:');
console.log(`   DISABLE_REDIS: ${process.env.DISABLE_REDIS}`);
console.log(`   FORCE_REDIS_ON_WINDOWS: ${process.env.FORCE_REDIS_ON_WINDOWS}`);
// Load .env.local only in development
if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config();
}
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
require("dotenv/config"); // Load environment variables from .env files
const job_queue_1 = require("../lib/job-queue");
const video_processor_1 = require("../lib/video-processor");
const health_1 = require("./health");
const logger_1 = require("../lib/logger");
const logger = (0, logger_1.createLogger)('worker:extract');
logger.info('🚀 Worker process starting...');
logger.info(`✅ Node.js version: ${process.version}`);
logger.info(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
let isShuttingDown = false;
const shutdown = (signal) => {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    logger.info(`👋 Received ${signal}. Shutting down worker...`);
    setTimeout(() => {
        process.exit(0);
    }, 5000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
async function startWorker() {
    try {
        logger.info('🏥 Starting health check server...');
        (0, health_1.startHealthCheckServer)();
        logger.info('✅ Health check server started.');
        const handleJob = async (jobData) => {
            const jobId = `${jobData.videoDbId}-${Date.now()}`;
            logger.info(`🔄 Processing job ${jobId} for video ${jobData.videoId}`);
            try {
                await (0, video_processor_1.processVideoJob)(jobData);
                logger.info(`✅ Job ${jobId} completed successfully.`);
            }
            catch (error) {
                logger.error(`❌ Job ${jobId} failed.`, { error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        };
        // Start the new DB-polling worker
        logger.info('🔥 About to call startSimpleWorker (DB polling mode) - this should start polling...');
        await (0, job_queue_1.startSimpleWorker)(handleJob, () => isShuttingDown);
        logger.info('🛑 startSimpleWorker returned unexpectedly!');
        logger.info('✅ Worker created and listening for jobs.');
        console.log('⏳ Worker is running and waiting for jobs. Press Ctrl+C to exit.');
    }
    catch (error) {
        logger.error('💥 A critical error occurred during worker initialization.', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    }
}
startWorker();
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
