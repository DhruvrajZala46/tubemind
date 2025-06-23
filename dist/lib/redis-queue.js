"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRedisQueue = initializeRedisQueue;
exports.isRedisAvailable = isRedisAvailable;
exports.addJobToRedisQueue = addJobToRedisQueue;
exports.getNextJobFromRedis = getNextJobFromRedis;
exports.markJobCompleted = markJobCompleted;
exports.markJobFailed = markJobFailed;
exports.getJobStatus = getJobStatus;
exports.getRedisQueueStats = getRedisQueueStats;
exports.checkRedisHealth = checkRedisHealth;
const redis_1 = require("@upstash/redis");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('redis-queue');
// Initialize Upstash Redis client
let redis = null;
let redisInitialized = false;
// Job queue configuration
const QUEUE_NAME = 'video_processing_jobs';
const PROCESSING_SET = 'processing_jobs';
const FAILED_SET = 'failed_jobs';
// Initialize Redis connection
async function initializeRedisQueue() {
    if (redisInitialized && redis) {
        return true;
    }
    try {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!url || !token) {
            logger.warn('⚠️ Upstash Redis credentials not found, will use DB fallback');
            return false;
        }
        redis = new redis_1.Redis({
            url,
            token,
            retry: {
                retries: 3,
                backoff: (retryCount) => Math.pow(2, retryCount) * 1000, // Exponential backoff
            },
        });
        // Test connection
        const pingResult = await redis.ping();
        if (pingResult === 'PONG') {
            redisInitialized = true;
            logger.info('✅ Redis queue initialized successfully');
            return true;
        }
        else {
            throw new Error('Redis ping failed');
        }
    }
    catch (error) {
        logger.error('❌ Failed to initialize Redis queue', {
            error: error instanceof Error ? error.message : String(error)
        });
        redis = null;
        redisInitialized = false;
        return false;
    }
}
// Check if Redis is available
function isRedisAvailable() {
    return redisInitialized && redis !== null;
}
// Add job to Redis queue
async function addJobToRedisQueue(jobData) {
    const jobId = jobData.summaryDbId;
    try {
        // Try Redis first
        if (!isRedisAvailable()) {
            await initializeRedisQueue();
        }
        if (isRedisAvailable() && redis) {
            // Serialize job data
            const serializedJob = JSON.stringify({
                ...jobData,
                addedAt: Date.now(),
                status: 'queued'
            });
            // Add to queue using Redis LIST (LPUSH for queue, RPOP for processing)
            await redis.lpush(QUEUE_NAME, serializedJob);
            // Also store in a hash for easy lookup by ID
            await redis.hset(`job:${jobId}`, {
                data: serializedJob,
                status: 'queued',
                addedAt: Date.now()
            });
            logger.info('✅ Job added to Redis queue', { jobId, userId: jobData.userId });
            return { jobId, usedRedis: true };
        }
        else {
            // Redis not available, will fallback to DB
            logger.warn('⚠️ Redis not available, will use DB fallback', { jobId });
            return { jobId, usedRedis: false };
        }
    }
    catch (error) {
        logger.error('❌ Failed to add job to Redis queue', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
        });
        return { jobId, usedRedis: false };
    }
}
// Get next job from Redis queue
async function getNextJobFromRedis() {
    try {
        if (!isRedisAvailable() || !redis) {
            return null;
        }
        // Pop job from queue (RPOP for FIFO processing)
        const jobString = await redis.rpop(QUEUE_NAME);
        if (!jobString) {
            return null; // No jobs available
        }
        const jobData = JSON.parse(jobString);
        // Move job to processing set
        await redis.sadd(PROCESSING_SET, jobData.summaryDbId);
        await redis.hset(`job:${jobData.summaryDbId}`, {
            status: 'processing',
            startedAt: Date.now()
        });
        logger.info('✅ Retrieved job from Redis queue', {
            jobId: jobData.summaryDbId,
            userId: jobData.userId
        });
        return jobData;
    }
    catch (error) {
        logger.error('❌ Failed to get job from Redis queue', {
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}
// Mark job as completed
async function markJobCompleted(jobId) {
    try {
        if (!isRedisAvailable() || !redis) {
            return false;
        }
        // Remove from processing set
        await redis.srem(PROCESSING_SET, jobId);
        // Update job status
        await redis.hset(`job:${jobId}`, {
            status: 'completed',
            completedAt: Date.now()
        });
        // Set expiration for completed job data (24 hours)
        await redis.expire(`job:${jobId}`, 86400);
        logger.info('✅ Job marked as completed in Redis', { jobId });
        return true;
    }
    catch (error) {
        logger.error('❌ Failed to mark job as completed in Redis', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}
// Mark job as failed
async function markJobFailed(jobId, errorMessage) {
    try {
        if (!isRedisAvailable() || !redis) {
            return false;
        }
        // Remove from processing set and add to failed set
        await redis.srem(PROCESSING_SET, jobId);
        await redis.sadd(FAILED_SET, jobId);
        // Update job status
        await redis.hset(`job:${jobId}`, {
            status: 'failed',
            failedAt: Date.now(),
            error: errorMessage
        });
        // Set expiration for failed job data (7 days for debugging)
        await redis.expire(`job:${jobId}`, 604800);
        logger.error('❌ Job marked as failed in Redis', { jobId, error: errorMessage });
        return true;
    }
    catch (error) {
        logger.error('❌ Failed to mark job as failed in Redis', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}
// Get job status from Redis
async function getJobStatus(jobId) {
    try {
        if (!isRedisAvailable() || !redis) {
            return null;
        }
        const jobData = await redis.hgetall(`job:${jobId}`);
        return jobData && Object.keys(jobData).length > 0 ? jobData : null;
    }
    catch (error) {
        logger.error('❌ Failed to get job status from Redis', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}
// Get queue statistics
async function getRedisQueueStats() {
    try {
        if (!isRedisAvailable() || !redis) {
            return null;
        }
        const [queueLength, processingCount, failedCount] = await Promise.all([
            redis.llen(QUEUE_NAME),
            redis.scard(PROCESSING_SET),
            redis.scard(FAILED_SET)
        ]);
        return {
            queueLength,
            processingCount,
            failedCount
        };
    }
    catch (error) {
        logger.error('❌ Failed to get Redis queue stats', {
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}
// Health check for Redis
async function checkRedisHealth() {
    try {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!url || !token) {
            return {
                isConnected: false,
                isEnabled: false,
                url: 'Not configured'
            };
        }
        if (!isRedisAvailable()) {
            await initializeRedisQueue();
        }
        if (isRedisAvailable() && redis) {
            const pingResult = await redis.ping();
            const stats = await getRedisQueueStats();
            return {
                isConnected: pingResult === 'PONG',
                isEnabled: true,
                url: url.replace(/\/\/.*@/, '//***@'), // Mask credentials
                stats
            };
        }
        else {
            return {
                isConnected: false,
                isEnabled: false,
                url: url.replace(/\/\/.*@/, '//***@')
            };
        }
    }
    catch (error) {
        logger.error('❌ Redis health check failed', {
            error: error instanceof Error ? error.message : String(error)
        });
        return {
            isConnected: false,
            isEnabled: true,
            url: process.env.UPSTASH_REDIS_REST_URL?.replace(/\/\/.*@/, '//***@') || 'Unknown'
        };
    }
}
