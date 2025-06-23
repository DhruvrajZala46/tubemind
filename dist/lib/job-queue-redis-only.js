"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSimpleWorker = void 0;
exports.addJobToQueue = addJobToQueue;
exports.startRedisOnlyWorker = startRedisOnlyWorker;
exports.checkRedisOnlyHealth = checkRedisOnlyHealth;
const logger_1 = require("./logger");
const redis_queue_1 = require("./redis-queue");
const logger = (0, logger_1.createLogger)('redis-only-queue');
// 🚀 REDIS-ONLY JOB QUEUE - ZERO DATABASE INTERACTION!
async function addJobToQueue(data) {
    logger.info('🚀 Adding job to REDIS-ONLY queue (NO DATABASE)', {
        jobId: data.summaryDbId,
        videoId: data.videoId,
        userId: data.userId
    });
    // Initialize Redis if not already done
    if (!(0, redis_queue_1.isRedisAvailable)()) {
        logger.info('🔄 Initializing Redis connection...');
        await (0, redis_queue_1.initializeRedisQueue)();
    }
    // CRITICAL: Redis is REQUIRED - no fallback!
    if (!(0, redis_queue_1.isRedisAvailable)()) {
        const errorMsg = 'CRITICAL: Redis not available! Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN';
        logger.error(errorMsg, { jobId: data.summaryDbId });
        throw new Error(errorMsg);
    }
    try {
        // Add job ONLY to Redis - NO DATABASE BACKUP
        const redisResult = await (0, redis_queue_1.addJobToRedisQueue)(data);
        if (redisResult.usedRedis) {
            logger.info('✅ Job added to Redis-only queue successfully', {
                jobId: data.summaryDbId,
                videoId: data.videoId,
                userId: data.userId,
                databaseBackup: 'DISABLED'
            });
            return { jobId: data.summaryDbId, usedRedis: true };
        }
        else {
            throw new Error('Failed to add job to Redis queue');
        }
    }
    catch (error) {
        logger.error('❌ CRITICAL: Failed to add job to Redis-only queue', {
            jobId: data.summaryDbId,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error; // NO FALLBACK TO DATABASE!
    }
}
// 🚀 REDIS-ONLY WORKER - ZERO DATABASE POLLING!
async function startRedisOnlyWorker(processor, shouldStop = () => false) {
    console.log('🚨 REDIS-ONLY WORKER STARTING - ZERO DATABASE POLLING!');
    logger.info('🚀 Starting REDIS-ONLY worker - NO database polling whatsoever!');
    // CRITICAL: Redis must be available
    await (0, redis_queue_1.initializeRedisQueue)();
    const redisAvailable = (0, redis_queue_1.isRedisAvailable)();
    if (!redisAvailable) {
        const errorMsg = 'CRITICAL: Redis not available! Cannot start Redis-only worker. Set UPSTASH credentials.';
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }
    logger.info('✅ REDIS-ONLY MODE ACTIVATED', {
        databasePolling: 'DISABLED',
        neonBilling: 'ZERO_IMPACT',
        processingMode: 'INSTANT_REDIS_ONLY'
    });
    const pollForJobs = async () => {
        let pollCount = 0;
        let emptyPolls = 0;
        let consecutiveJobs = 0;
        const MAX_EMPTY_POLLS = 600; // 10 minutes of empty polls before restart
        const POLL_INTERVAL = 1000; // 1 second - ONLY Redis polling
        logger.info('🎯 REDIS-ONLY POLLING STARTED!', {
            pollInterval: `${POLL_INTERVAL}ms`,
            maxEmptyPolls: MAX_EMPTY_POLLS,
            databasePolling: 'COMPLETELY_DISABLED',
            freeRedisLimits: 'OPTIMIZED'
        });
        while (!shouldStop()) {
            pollCount++;
            try {
                // 🚀 ONLY Redis - ZERO DATABASE QUERIES!
                const startTime = Date.now();
                const jobData = await (0, redis_queue_1.getNextJobFromRedis)();
                const retrievalTime = Date.now() - startTime;
                if (jobData) {
                    consecutiveJobs++;
                    emptyPolls = 0; // Reset empty polls
                    logger.info('⚡ INSTANT Redis job retrieved!', {
                        jobId: jobData.summaryDbId,
                        videoId: jobData.videoId,
                        userId: jobData.userId,
                        retrievalTime: `${retrievalTime}ms`,
                        consecutiveJobs,
                        source: 'REDIS_ONLY'
                    });
                    const processingStartTime = Date.now();
                    try {
                        await processor(jobData);
                        await (0, redis_queue_1.markJobCompleted)(jobData.summaryDbId);
                        const totalProcessingTime = Date.now() - processingStartTime;
                        logger.info('✅ Redis job completed successfully', {
                            videoId: jobData.videoId,
                            userId: jobData.userId,
                            processingTime: `${totalProcessingTime}ms`,
                            mode: 'REDIS_ONLY',
                            databaseQueries: 0
                        });
                    }
                    catch (processingError) {
                        await (0, redis_queue_1.markJobFailed)(jobData.summaryDbId, processingError instanceof Error ? processingError.message : String(processingError));
                        logger.error('❌ Redis job processing failed', {
                            jobId: jobData.summaryDbId,
                            error: processingError instanceof Error ? processingError.message : String(processingError),
                            userId: jobData.userId
                        });
                    }
                    // Continue immediately to next job - NO DELAY FOR INSTANT PROCESSING!
                    continue;
                }
                else {
                    // No job found in Redis
                    consecutiveJobs = 0;
                    emptyPolls++;
                    if (emptyPolls % 60 === 0) { // Log every minute
                        logger.info('⏳ Redis queue empty, waiting for jobs...', {
                            emptyPolls,
                            maxEmptyPolls: MAX_EMPTY_POLLS,
                            uptime: `${Math.round(pollCount * POLL_INTERVAL / 1000)}s`,
                            databasePolling: 'DISABLED'
                        });
                    }
                    if (emptyPolls >= MAX_EMPTY_POLLS) {
                        logger.info('🔄 Worker restarting after long idle period', {
                            emptyPolls,
                            reason: 'Redis queue empty for 10+ minutes'
                        });
                        // Reset counter instead of exiting
                        emptyPolls = 0;
                    }
                }
                // Wait 1 second before next Redis check (FREE TIER OPTIMIZED)
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            }
            catch (outerError) {
                logger.error('❌ Error in Redis-only polling loop', {
                    error: outerError instanceof Error ? outerError.message : String(outerError)
                });
                // Wait 5 seconds on error, then continue
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        logger.info('🛑 Redis-only worker stopped (shutdown requested)');
    };
    logger.info('✅ Redis-only worker initialized - starting instant polling...');
    await pollForJobs();
}
// Health check for Redis-only mode
async function checkRedisOnlyHealth() {
    try {
        const redisHealth = await (0, redis_queue_1.checkRedisHealth)();
        return {
            isHealthy: redisHealth.isConnected,
            redisStatus: redisHealth,
            mode: 'REDIS_ONLY'
        };
    }
    catch (error) {
        return {
            isHealthy: false,
            redisStatus: { error: error instanceof Error ? error.message : String(error) },
            mode: 'REDIS_ONLY'
        };
    }
}
// Export for backward compatibility
exports.startSimpleWorker = startRedisOnlyWorker;
