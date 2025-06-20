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
exports.useRedis = exports.redis = void 0;
exports.initializeRedis = initializeRedis;
exports.isRedisReady = isRedisReady;
exports.enqueueVideoJob = enqueueVideoJob;
exports.dequeueAndProcessJob = dequeueAndProcessJob;
exports.getQueueLength = getQueueLength;
exports.getJobStatus = getJobStatus;
exports.clearQueue = clearQueue;
exports.startWorker = startWorker;
exports.getVideoQueue = getVideoQueue;
exports.checkRedisHealth = checkRedisHealth;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const os_1 = __importDefault(require("os"));
// Initialize logger
const logger = (0, logger_1.createLogger)('job-queue');
// Queue configuration
const QUEUE_NAME = 'video-processing-queue';
const JOB_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_RETRY_ATTEMPTS = 3; // Maximum number of Redis connection attempts
// Check if running on Windows - Redis often has permission issues on Windows
const isWindows = os_1.default.platform() === 'win32';
if (isWindows) {
    logger.warn('Windows environment detected - Redis may have permission issues');
    logger.info('If Redis fails, set FORCE_REDIS_ON_WINDOWS=true to force Redis usage or DISABLE_REDIS=true to use in-memory processing');
}
// Initialize Redis client if credentials are available
let redis = null;
exports.redis = redis;
let useRedis = false;
exports.useRedis = useRedis;
let redisConnectionAttempted = false;
let redisInitializationPromise = null;
// Get Redis URL dynamically (not at module load time)
function getRedisUrl() {
    return process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || null;
}
// Check if Redis is explicitly disabled
// Note: We check the current value of DISABLE_REDIS since it can be overridden at runtime
function isRedisDisabledCheck() {
    const redisUrl = getRedisUrl();
    const disabled = !redisUrl ||
        redisUrl.trim() === '' ||
        process.env.DISABLE_REDIS === 'true';
    // Reduced logging verbosity here to avoid spamming logs
    if (disabled) {
        logger.info(`Redis is disabled (url: ${redisUrl ? 'SET' : 'NOT SET'}, DISABLE_REDIS: ${process.env.DISABLE_REDIS})`);
    }
    return disabled;
}
/**
 * Initialize the Redis connection with proper error handling.
 * This function can be called multiple times, but will only attempt to connect once.
 */
async function initializeRedis() {
    if (redisInitializationPromise) {
        return redisInitializationPromise;
    }
    redisInitializationPromise = (async () => {
        if (redisConnectionAttempted) {
            return useRedis;
        }
        redisConnectionAttempted = true;
        logger.info('🚀 Starting Redis initialization...');
        if (isRedisDisabledCheck()) {
            logger.warn('Redis disabled via config, using in-memory job processing');
            exports.useRedis = useRedis = false;
            return false;
        }
        const redisUrl = getRedisUrl();
        if (!redisUrl) {
            logger.warn('No Redis URL found, using in-memory processing');
            exports.useRedis = useRedis = false;
            return false;
        }
        try {
            logger.info(`Attempting to connect to Redis at ${redisUrl?.substring(0, 30)}...`);
            const options = {
                maxRetriesPerRequest: MAX_RETRY_ATTEMPTS,
                retryStrategy(times) {
                    if (times > MAX_RETRY_ATTEMPTS) {
                        logger.warn(`Redis connection failed after ${MAX_RETRY_ATTEMPTS} attempts, falling back to in-memory processing`);
                        return null; // Stop retrying
                    }
                    const delay = Math.min(times * 200, 1000);
                    logger.warn(`Redis connection attempt ${times} failed, retrying in ${delay}ms`);
                    return delay;
                },
                connectionName: 'tubegpt-worker',
                connectTimeout: 10000,
                lazyConnect: true,
            };
            if (redisUrl.includes('upstash.io')) {
                logger.info('Detected Upstash Redis, using REST API configuration');
                const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
                if (!upstashToken) {
                    throw new Error('UPSTASH_REDIS_REST_TOKEN is required for Upstash Redis');
                }
                const urlObj = new URL(redisUrl);
                options.host = urlObj.hostname;
                options.port = parseInt(urlObj.port) || 443;
                options.password = upstashToken;
                options.tls = {};
            }
            exports.redis = redis = new ioredis_1.default(redisUrl.includes('upstash.io') ? options : redisUrl, options);
            redis.on('connect', () => logger.info('Redis client connected successfully'));
            redis.on('ready', () => {
                logger.info('Redis client ready and operational');
                exports.useRedis = useRedis = true;
            });
            redis.on('reconnecting', () => logger.info('Redis client reconnecting...'));
            redis.on('end', () => {
                logger.warn('Redis connection ended');
                exports.useRedis = useRedis = false;
            });
            redis.on('error', (err) => {
                logger.error(`Redis client error: ${err.message}`);
                exports.useRedis = useRedis = false;
            });
            // Aggressively connect and verify
            await redis.connect();
            const pingResult = await redis.ping();
            if (pingResult === 'PONG') {
                logger.info('✅ Redis connection verified with PING - Redis is working!');
                exports.useRedis = useRedis = true;
                return true;
            }
            else {
                throw new Error('Redis ping failed');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Redis initialization failed: ${errorMessage}. Falling back to in-memory processing.`);
            exports.useRedis = useRedis = false;
            if (redis) {
                redis.disconnect();
            }
            return false;
        }
    })();
    return redisInitializationPromise;
}
// Function to check if redis is connected and ready without trying to initialize
function isRedisReady() {
    return useRedis && redis !== null && redis.status === 'ready';
}
// In-memory job processing (for local development or when Redis is unavailable)
const inMemoryQueue = new Map();
const inMemoryProcessingQueue = [];
// Function to process a video job
async function processVideoJob(job) {
    logger.info(`Processing job for video ${job.videoId}`);
    try {
        // Import the processVideo function from extract.ts
        const { processVideo } = await Promise.resolve().then(() => __importStar(require('../worker/extract')));
        // Process the video
        await processVideo(job.videoId, job.videoDbId, job.summaryDbId, job.userId, job.userEmail, job.metadata, job.totalDurationSeconds, job.creditsNeeded);
        logger.info(`Job completed for video ${job.videoId}`);
        return true;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error processing job for video ${job.videoId}: ${errorMessage}`);
        return false;
    }
}
// Enqueue a video processing job.
// Will attempt to use Redis, but falls back to in-memory processing if Redis is unavailable.
// @param job The video job to enqueue
// @returns The Job ID
async function enqueueVideoJob(job) {
    // Ensure Redis initialization has been attempted
    await initializeRedis();
    if (isRedisReady()) {
        try {
            logger.info(`Enqueuing job ${job.summaryDbId} to Redis for video ${job.videoId}`);
            await redis.lpush(QUEUE_NAME, JSON.stringify(job));
            logger.info(`Job ${job.summaryDbId} successfully enqueued to Redis`);
            return job.summaryDbId;
        }
        catch (error) {
            logger.error(`Failed to enqueue job to Redis: ${error instanceof Error ? error.message : String(error)}`);
            logger.warn(`Falling back to in-memory processing for job ${job.summaryDbId}`);
            // Fallback to in-memory processing
            processInMemory(job);
            return job.summaryDbId;
        }
    }
    else {
        logger.warn(`Redis not ready, processing job ${job.summaryDbId} in-memory`);
        // Fallback to in-memory processing
        processInMemory(job);
        return job.summaryDbId;
    }
}
// Process a job in-memory
async function processInMemory(job) {
    const jobId = job.summaryDbId;
    inMemoryQueue.set(jobId, job);
    inMemoryProcessingQueue.push(jobId);
    // Process immediately in the same process
    setTimeout(() => {
        processVideoJob(job).then(() => {
            inMemoryQueue.delete(jobId);
            // Remove from processing queue
            const index = inMemoryProcessingQueue.indexOf(jobId);
            if (index > -1) {
                inMemoryProcessingQueue.splice(index, 1);
            }
        });
    }, 100);
}
// Dequeue and process the next job
async function dequeueAndProcessJob() {
    const jobJSON = await redis.brpop(QUEUE_NAME, 0); // blocking pop with 0 timeout
    if (jobJSON && jobJSON.length > 1) {
        const jobData = jobJSON[1];
        logger.info(`Job dequeued from Redis: ${jobData.substring(0, 100)}...`);
        // Parse the job data
        const job = JSON.parse(jobData);
        // Process the job
        const success = await processVideoJob(job);
        // Clean up
        await redis.del(`job:${job.summaryDbId}`);
        return success;
    }
    else {
        return false;
    }
}
// Get the number of jobs in the queue
async function getQueueLength() {
    if (!useRedis || !redis || redis.status !== 'ready') {
        return inMemoryProcessingQueue.length;
    }
    try {
        return await redis.llen(QUEUE_NAME);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting queue length: ${errorMessage}`);
        // Disable Redis on error
        exports.useRedis = useRedis = false;
        return inMemoryProcessingQueue.length;
    }
}
// Get the status of a job
async function getJobStatus(jobId) {
    if (!useRedis || !redis || redis.status !== 'ready') {
        if (inMemoryProcessingQueue.includes(jobId)) {
            return 'processing';
        }
        return inMemoryQueue.has(jobId) ? 'queued' : 'not_found';
    }
    try {
        const jobExists = await redis.exists(`job:${jobId}`);
        if (!jobExists) {
            return 'not_found';
        }
        // Check if the job is in the queue
        const queuePosition = await redis.lpos(QUEUE_NAME, jobId);
        if (queuePosition !== null) {
            return 'queued';
        }
        // If the job exists but is not in the queue, it's being processed
        return 'processing';
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting status for job ${jobId}: ${errorMessage}`);
        // Disable Redis on error
        exports.useRedis = useRedis = false;
        // Fall back to in-memory status check
        if (inMemoryProcessingQueue.includes(jobId)) {
            return 'processing';
        }
        return inMemoryQueue.has(jobId) ? 'queued' : 'not_found';
    }
}
// Clear all jobs from the queue
async function clearQueue() {
    if (!useRedis || !redis || redis.status !== 'ready') {
        inMemoryQueue.clear();
        inMemoryProcessingQueue.length = 0;
        return true;
    }
    try {
        await redis.del(QUEUE_NAME);
        return true;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error clearing queue: ${errorMessage}`);
        // Disable Redis on error
        exports.useRedis = useRedis = false;
        // Fall back to clearing in-memory queue
        inMemoryQueue.clear();
        inMemoryProcessingQueue.length = 0;
        return true;
    }
}
// Starts the worker to continuously process jobs from the queue.
// This should only be run in a dedicated worker process.
async function startWorker(pollInterval = 5000) {
    logger.info('Starting job queue worker');
    const redisInitialized = await initializeRedis();
    if (!redisInitialized || !isRedisReady()) {
        logger.warn('Redis not available, worker not started (using in-memory processing)');
        return;
    }
    logger.info('✅ Redis initialized successfully, starting Redis-based worker');
    // Graceful shutdown handler
    const shutdown = async () => {
        logger.info('Shutting down job queue worker');
        await clearQueue();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    logger.info('🚀 Redis worker started successfully!');
    // Continuously process jobs
    while (true) {
        try {
            const jobProcessed = await dequeueAndProcessJob();
            if (!jobProcessed) {
                // This should not happen with brpop unless there's an error
                logger.info('No job found, waiting...');
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error processing job from Redis: ${errorMessage}`);
            // If Redis connection is lost, try to reconnect
            if (!isRedisReady()) {
                logger.warn('Redis connection lost. Attempting to reconnect...');
                await new Promise(resolve => setTimeout(resolve, 5000)); // wait before retrying
                await initializeRedis();
            }
            else {
                // wait before processing next job
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }
    }
}
// For compatibility with older code that expects a queue object
function getVideoQueue() {
    // Return a simplified queue interface that mimics the old BullMQ interface
    return {
        add: async (jobName, data) => {
            const jobId = await enqueueVideoJob(data);
            return { id: jobId };
        },
        getJob: async (jobId) => {
            const status = await getJobStatus(jobId);
            if (status === 'not_found')
                return null;
            // If using in-memory queue, get the job data
            const job = inMemoryQueue.get(jobId);
            if (!job)
                return null;
            // Return a simplified job object
            return {
                id: jobId,
                data: job,
                isCompleted: async () => status === 'completed',
                isFailed: async () => status === 'failed',
                processedOn: status === 'processing' ? Date.now() : undefined,
                progress: 0,
                failedReason: null,
                returnvalue: null
            };
        }
    };
}
// Function to check Redis health
async function checkRedisHealth() {
    const redisUrl = getRedisUrl();
    const isDisabledByEnv = process.env.DISABLE_REDIS === 'true';
    if (isDisabledByEnv || !redisUrl) {
        return {
            isConnected: false,
            isEnabled: false,
            url: redisUrl,
            errorMessage: isDisabledByEnv ? 'Redis disabled by DISABLE_REDIS=true' : 'No Redis URL provided',
        };
    }
    try {
        // Ensure initialization has been attempted
        await initializeRedis();
        if (isRedisReady()) {
            return {
                isConnected: true,
                isEnabled: true,
                url: redisUrl,
            };
        }
        else {
            return {
                isConnected: false,
                isEnabled: true, // It's enabled, but not connected
                url: redisUrl,
                errorMessage: 'Redis client is not ready. Check worker logs for connection errors.',
            };
        }
    }
    catch (error) {
        return {
            isConnected: false,
            isEnabled: true,
            url: redisUrl,
            errorMessage: error instanceof Error ? error.message : 'Failed to connect to Redis',
        };
    }
}
