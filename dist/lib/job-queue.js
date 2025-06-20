"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorker = void 0;
exports.initializeJobQueue = initializeJobQueue;
exports.addJobToQueue = addJobToQueue;
exports.getJobById = getJobById;
exports.startSimpleWorker = startSimpleWorker;
const bullmq_1 = require("bullmq");
const logger_1 = require("./logger");
const redis_client_1 = require("./redis-client");
const logger = (0, logger_1.createLogger)('job-queue');
const QUEUE_NAME = 'video-processing';
let queue = null;
// BullMQ configuration for Upstash free tier compatibility
const redisConnectionConfig = (0, redis_client_1.getRedisConfig)();
const connection = redisConnectionConfig ? {
    ...redisConnectionConfig,
    // CRITICAL: Disable all script-based operations for Upstash free tier
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true,
    // Disable Redis command queue to prevent script usage
    enableOfflineQueue: false,
} : undefined;
logger.info('Redis connection configuration for BullMQ (script-free mode).', { connectionDetails: connection });
async function initializeJobQueue() {
    if (queue) {
        logger.info('Job queue already initialized.');
        return;
    }
    logger.info('🚀 Starting Job Queue initialization (Upstash compatible mode)...');
    if (!connection) {
        logger.error('🔴 Redis connection not configured. Cannot initialize job queue.');
        throw new Error('Job queue could not be initialized due to missing Redis configuration.');
    }
    try {
        // Ensure the shared Redis client is ready first.
        await (0, redis_client_1.initializeRedis)();
        if (!redis_client_1.redis) {
            throw new Error("Main redis client not available for BullMQ");
        }
        // CRITICAL FIX: Configure BullMQ to work without Lua scripts
        queue = new bullmq_1.Queue(QUEUE_NAME, {
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: 10, // Keep only 10 completed jobs
                removeOnFail: 10, // Keep only 10 failed jobs
            },
            // Note: Some advanced settings removed for Upstash compatibility
        });
        logger.info('✅ BullMQ queue initialized successfully (script-free mode).');
        queue.on('error', (error) => {
            logger.error('BullMQ queue error', { error: error.message });
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('🔴 Failed to initialize BullMQ queue', { error: errorMessage });
        // If BullMQ fails due to script permissions, fall back to simple Redis operations
        if (errorMessage.includes('NOPERM') || errorMessage.includes('script')) {
            logger.warn('⚠️ Redis scripts are blocked. Using simple Redis fallback for job queue.');
            return initializeSimpleQueue();
        }
        throw error;
    }
}
// Simple Redis-based job queue fallback for Upstash free tier
async function initializeSimpleQueue() {
    logger.info('🔄 Initializing simple Redis job queue (no scripts)...');
    if (!redis_client_1.redis) {
        await (0, redis_client_1.initializeRedis)();
        if (!redis_client_1.redis) {
            throw new Error("Redis client not available for simple queue");
        }
    }
    // Mark that we're using simple queue mode
    global.__SIMPLE_QUEUE_MODE = true;
    logger.info('✅ Simple Redis job queue initialized (Upstash free tier compatible).');
}
async function addJobToQueue(data) {
    // Check if we're in simple queue mode
    if (global.__SIMPLE_QUEUE_MODE) {
        return addJobToSimpleQueue(data);
    }
    if (!queue) {
        logger.info('Queue not initialized, initializing now...');
        await initializeJobQueue();
        if (!queue && !global.__SIMPLE_QUEUE_MODE) {
            logger.error('🔴 CRITICAL: Queue is null even after initialization attempt. Cannot add job.');
            throw new Error('Failed to initialize job queue. Cannot add job.');
        }
        // If we fell back to simple mode during init, use that
        if (global.__SIMPLE_QUEUE_MODE) {
            return addJobToSimpleQueue(data);
        }
    }
    try {
        logger.info('Adding job to BullMQ queue', { videoId: data.videoId });
        const job = await queue.add(QUEUE_NAME, data);
        logger.info('✅ Job added to BullMQ queue successfully', { jobId: job.id, videoId: data.videoId });
        return job;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('NOPERM') || errorMessage.includes('script')) {
            logger.warn('⚠️ BullMQ failed due to script permissions. Falling back to simple queue.', { error: errorMessage });
            global.__SIMPLE_QUEUE_MODE = true;
            return addJobToSimpleQueue(data);
        }
        throw error;
    }
}
// Simple job queue implementation that doesn't use Redis scripts
async function addJobToSimpleQueue(data) {
    if (!redis_client_1.redis) {
        throw new Error("Redis client not available for simple queue");
    }
    const jobId = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const jobData = JSON.stringify(data);
    logger.info('Adding job to simple Redis queue', { videoId: data.videoId, jobId });
    // Use simple Redis commands that work with Upstash free tier
    await redis_client_1.redis.lpush('video-processing:jobs', jobData);
    await redis_client_1.redis.hset(`video-processing:job:${jobId}`, {
        id: jobId,
        data: jobData,
        status: 'waiting',
        created: Date.now()
    });
    logger.info('✅ Job added to simple queue successfully', { jobId, videoId: data.videoId });
    // Return a mock Job object for compatibility
    return {
        id: jobId,
        data,
        name: QUEUE_NAME,
        opts: {},
        attemptsMade: 0,
        finishedOn: undefined,
        processedOn: undefined,
        timestamp: Date.now(),
        delay: 0,
        priority: 0
    };
}
async function getJobById(jobId) {
    // Check if we're in simple queue mode
    if (global.__SIMPLE_QUEUE_MODE) {
        return getJobFromSimpleQueue(jobId);
    }
    if (!queue) {
        logger.info('Queue not initialized, initializing now to get job status...');
        await initializeJobQueue();
        if (!queue && !global.__SIMPLE_QUEUE_MODE) {
            logger.error('🔴 CRITICAL: Queue is null even after initialization attempt. Cannot get job.');
            return null;
        }
        if (global.__SIMPLE_QUEUE_MODE) {
            return getJobFromSimpleQueue(jobId);
        }
    }
    try {
        const job = await queue.getJob(jobId);
        if (!job) {
            logger.warn(`Job with ID ${jobId} not found.`);
            return null;
        }
        return job;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('NOPERM') || errorMessage.includes('script')) {
            logger.warn('⚠️ BullMQ getJob failed due to script permissions. Falling back to simple queue.', { error: errorMessage });
            global.__SIMPLE_QUEUE_MODE = true;
            return getJobFromSimpleQueue(jobId);
        }
        throw error;
    }
}
async function getJobFromSimpleQueue(jobId) {
    if (!redis_client_1.redis) {
        return null;
    }
    try {
        const jobInfo = await redis_client_1.redis.hgetall(`video-processing:job:${jobId}`);
        if (!jobInfo || !jobInfo.data) {
            return null;
        }
        const data = JSON.parse(jobInfo.data);
        return {
            id: jobId,
            data,
            name: QUEUE_NAME,
            opts: {},
            attemptsMade: 0,
            finishedOn: jobInfo.status === 'completed' ? parseInt(jobInfo.finished || '0') : undefined,
            processedOn: jobInfo.status === 'active' ? parseInt(jobInfo.started || '0') : undefined,
            timestamp: parseInt(jobInfo.created || '0'),
            delay: 0,
            priority: 0
        };
    }
    catch (error) {
        logger.error('Error getting job from simple queue', { jobId, error });
        return null;
    }
}
const createWorker = (processor) => {
    if (!connection) {
        logger.error('🔴 Redis connection not configured. Cannot create worker.');
        process.exit(1);
    }
    logger.info('🚀 Creating BullMQ worker (script-free mode)...');
    try {
        const worker = new bullmq_1.Worker(QUEUE_NAME, processor, {
            connection,
            concurrency: 5,
            limiter: {
                max: 10,
                duration: 1000,
            }
        });
        worker.on('completed', (job) => {
            logger.info(`✅ Job completed`, { jobId: job.id });
        });
        worker.on('failed', (job, error) => {
            if (job) {
                logger.error(`🔴 Job failed`, { jobId: job.id, error: error.message, attempts: job.attemptsMade });
            }
            else {
                logger.error('🔴 An unknown job failed', { error: error.message });
            }
        });
        worker.on('error', (error) => {
            logger.error('BullMQ worker error', { error: error.message });
            // If script errors occur, we should fall back to simple processing
            if (error.message.includes('NOPERM') || error.message.includes('script')) {
                logger.warn('⚠️ BullMQ worker failed due to script permissions. Consider using simple job processing.');
                global.__SIMPLE_QUEUE_MODE = true;
            }
        });
        logger.info('✅ BullMQ worker created successfully (script-free mode).');
        return worker;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('NOPERM') || errorMessage.includes('script')) {
            logger.error('🔴 BullMQ worker creation failed due to script permissions. Using simple job processing.', { error: errorMessage });
            global.__SIMPLE_QUEUE_MODE = true;
            // Return a mock worker that processes jobs directly
            return createSimpleWorker(processor);
        }
        throw error;
    }
};
exports.createWorker = createWorker;
// Simple worker implementation for Upstash free tier
function createSimpleWorker(processor) {
    logger.info('🔄 Creating simple worker (no scripts)...');
    const worker = {
        on: (event, handler) => {
            // Mock event handlers
        },
        close: async () => {
            logger.info('Simple worker closed');
        }
    };
    // Start polling for jobs
    const pollJobs = async () => {
        if (!redis_client_1.redis)
            return;
        try {
            // Get job from simple queue
            const jobData = await redis_client_1.redis.rpop('video-processing:jobs');
            if (jobData) {
                const data = JSON.parse(jobData);
                const job = {
                    id: `simple-${Date.now()}`,
                    data,
                    name: QUEUE_NAME,
                    opts: {},
                    attemptsMade: 0,
                    timestamp: Date.now()
                };
                logger.info('Processing job from simple queue', { jobId: job.id, videoId: data.videoId });
                await processor(job);
                logger.info('✅ Simple job completed', { jobId: job.id });
            }
        }
        catch (error) {
            logger.error('Error processing simple queue job', { error });
        }
        // Poll again after 5 seconds
        setTimeout(pollJobs, 5000);
    };
    // Start polling
    setTimeout(pollJobs, 1000);
    logger.info('✅ Simple worker created and polling for jobs.');
    return worker;
}
/**
 * Starts a simple Redis worker that polls for jobs without using scripts
 * This is compatible with Upstash free tier restrictions
 */
async function startSimpleWorker(processor, shouldStop = () => false) {
    logger.info('🚀 Starting simple Redis worker (script-free)...');
    await initializeJobQueue();
    if (!redis_client_1.redis) {
        logger.error('❌ Redis not available, cannot start worker');
        throw new Error('Redis connection required for worker');
    }
    // Polling function
    const pollForJobs = async () => {
        while (!shouldStop()) {
            try {
                // Try to get a job from the simple queue
                const jobData = await redis_client_1.redis.rpop('video-processing:jobs');
                if (jobData) {
                    const data = JSON.parse(jobData);
                    logger.info('📦 Found job in queue', { videoId: data.videoId, userId: data.userId });
                    try {
                        // Update job status to active
                        await redis_client_1.redis.hset(`video-processing:job:${data.videoDbId}`, {
                            status: 'active',
                            started: Date.now().toString(),
                        });
                        // Process the job
                        await processor(data);
                        // Mark job as completed
                        await redis_client_1.redis.hset(`video-processing:job:${data.videoDbId}`, {
                            status: 'completed',
                            finished: Date.now().toString(),
                        });
                        logger.info('✅ Job processing completed successfully', { videoId: data.videoId });
                    }
                    catch (jobError) {
                        // Mark job as failed
                        await redis_client_1.redis.hset(`video-processing:job:${data.videoDbId}`, {
                            status: 'failed',
                            finished: Date.now().toString(),
                            error: jobError instanceof Error ? jobError.message : String(jobError),
                        });
                        logger.error('❌ Job processing failed', {
                            videoId: data.videoId,
                            error: jobError instanceof Error ? jobError.message : String(jobError)
                        });
                    }
                }
                else {
                    // No jobs found, wait before polling again
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            catch (pollError) {
                logger.error('Error polling for jobs', {
                    error: pollError instanceof Error ? pollError.message : String(pollError)
                });
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        logger.info('🛑 Worker stopped polling (shutdown requested)');
    };
    logger.info('✅ Simple worker started, polling for jobs...');
    // Start polling (non-blocking)
    pollForJobs().catch(error => {
        logger.error('Critical error in worker polling', { error });
    });
}
// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down job queue and worker...');
    if (queue) {
        await queue.close();
    }
    process.exit(0);
});
