import Redis from 'ioredis';
import { createLogger } from './logger';
import os from 'os';

// Initialize logger
const logger = createLogger('job-queue');

// Queue configuration
const QUEUE_NAME = 'video-processing-queue';
const JOB_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_RETRY_ATTEMPTS = 3; // Maximum number of Redis connection attempts

// Check if running on Windows - Redis often has permission issues on Windows
const isWindows = os.platform() === 'win32';
if (isWindows) {
  logger.warn('Windows environment detected - Redis may have permission issues');
  logger.info('If Redis fails, set FORCE_REDIS_ON_WINDOWS=true to force Redis usage or DISABLE_REDIS=true to use in-memory processing');
}

// Initialize Redis client if credentials are available
let redis: Redis | null = null;
let useRedis = false;
let redisConnectionAttempted = false;
let redisInitializationPromise: Promise<boolean> | null = null;

// Get Redis URL dynamically (not at module load time)
function getRedisUrl(): string | null {
  // Prioritize the standard Redis URL format (`rediss://`), which ioredis understands natively.
  // This is the correct URL for connecting to Upstash with ioredis.
  return process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || null;
}

// Check if Redis is explicitly disabled
// Note: We check the current value of DISABLE_REDIS since it can be overridden at runtime
function isRedisDisabledCheck(): boolean {
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
export async function initializeRedis(): Promise<boolean> {
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
      useRedis = false;
      return false;
    }
    
    const redisUrl = getRedisUrl();
    if (!redisUrl) {
      logger.warn('No Redis URL found, using in-memory processing');
      useRedis = false;
      return false;
    }
    
    try {
      logger.info(`Attempting to connect to Redis...`);
      
      const options: any = {
        maxRetriesPerRequest: MAX_RETRY_ATTEMPTS,
        retryStrategy(times: number) {
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
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      };

      // The key fix: Pass the connection URL string directly to ioredis.
      // It correctly handles `redis://` and `rediss://` protocols, including TLS for Upstash.
      // This avoids the previous "Protocol error" by not attempting to connect to an HTTP URL.
      redis = new Redis(redisUrl, options);

      redis.on('connect', () => logger.info('Redis client connected successfully'));
      redis.on('ready', () => {
        logger.info('Redis client ready and operational');
        useRedis = true;
      });
      redis.on('reconnecting', () => logger.info('Redis client reconnecting...'));
      redis.on('end', () => {
        logger.warn('Redis connection ended');
        useRedis = false;
      });
      redis.on('error', (err: any) => {
        logger.error(`Redis client error: ${err.message}`);
        useRedis = false;
      });

      // Aggressively connect and verify
      await redis.connect();
      const pingResult = await redis.ping();
      
      if (pingResult === 'PONG') {
        logger.info('✅ Redis connection verified with PING - Redis is working!');
        useRedis = true;
        return true;
      } else {
        throw new Error('Redis ping failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Redis initialization failed: ${errorMessage}. Falling back to in-memory processing.`);
      useRedis = false;
      if (redis) {
        redis.disconnect();
      }
      return false;
    }
  })();
  
  return redisInitializationPromise;
}

// Function to check if redis is connected and ready without trying to initialize
export function isRedisReady(): boolean {
  return useRedis && redis !== null && redis.status === 'ready';
}

// In-memory job processing (for local development or when Redis is unavailable)
const inMemoryQueue = new Map<string, any>();
const inMemoryProcessingQueue: string[] = [];

// Job interface
export interface VideoJob {
  videoId: string;
  videoDbId: string;
  summaryDbId: string;
  userId: string;
  userEmail: string;
  user: any;
  metadata: any;
  totalDurationSeconds: number;
  creditsNeeded: number;
}

// Function to process a video job
async function processVideoJob(job: VideoJob): Promise<boolean> {
  logger.info(`Processing job for video ${job.videoId}`);
  
  try {
    // Import the processVideo function from extract.ts
    const { processVideo } = await import('../worker/extract');
    
    // Process the video
    await processVideo(
      job.videoId,
      job.videoDbId,
      job.summaryDbId,
      job.userId,
      job.userEmail,
      job.metadata,
      job.totalDurationSeconds,
      job.creditsNeeded
    );
    
    logger.info(`Job completed for video ${job.videoId}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing job for video ${job.videoId}: ${errorMessage}`);
    return false;
  }
}

// Enqueue a video processing job.
// Will attempt to use Redis, but falls back to in-memory processing if Redis is unavailable.
// @param job The video job to enqueue
// @returns The Job ID
export async function enqueueVideoJob(job: VideoJob): Promise<string> {
  // Ensure Redis initialization has been attempted
  await initializeRedis();

  if (isRedisReady()) {
    try {
      logger.info(`Enqueuing job ${job.summaryDbId} to Redis for video ${job.videoId}`);
      await redis!.lpush(QUEUE_NAME, JSON.stringify(job));
      logger.info(`Job ${job.summaryDbId} successfully enqueued to Redis`);
      return job.summaryDbId;
    } catch (error) {
      logger.error(`Failed to enqueue job to Redis: ${error instanceof Error ? error.message : String(error)}`);
      logger.warn(`Falling back to in-memory processing for job ${job.summaryDbId}`);
      // Fallback to in-memory processing
      processInMemory(job);
      return job.summaryDbId;
    }
  } else {
    logger.warn(`Redis not ready, processing job ${job.summaryDbId} in-memory`);
    // Fallback to in-memory processing
    processInMemory(job);
    return job.summaryDbId;
  }
}

// Process a job in-memory
async function processInMemory(job: VideoJob): Promise<void> {
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
export async function dequeueAndProcessJob(): Promise<boolean> {
  const jobJSON = await redis!.brpop(QUEUE_NAME, 0); // blocking pop with 0 timeout
  
  if (jobJSON && jobJSON.length > 1) {
    const jobData = jobJSON[1];
    logger.info(`Job dequeued from Redis: ${jobData.substring(0, 100)}...`);
    
    // Parse the job data
    const job: VideoJob = JSON.parse(jobData);
    
    // Process the job
    const success = await processVideoJob(job);
    
    // Clean up
    await redis!.del(`job:${job.summaryDbId}`);
    
    return success;
  } else {
    return false;
  }
}

// Get the number of jobs in the queue
export async function getQueueLength(): Promise<number> {
  if (!useRedis || !redis || redis.status !== 'ready') {
    return inMemoryProcessingQueue.length;
  }
  
  try {
    return await redis.llen(QUEUE_NAME);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting queue length: ${errorMessage}`);
    
    // Disable Redis on error
    useRedis = false;
    
    return inMemoryProcessingQueue.length;
  }
}

// Get the status of a job
export async function getJobStatus(jobId: string): Promise<'queued' | 'processing' | 'completed' | 'failed' | 'not_found'> {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting status for job ${jobId}: ${errorMessage}`);
    
    // Disable Redis on error
    useRedis = false;
    
    // Fall back to in-memory status check
    if (inMemoryProcessingQueue.includes(jobId)) {
      return 'processing';
    }
    return inMemoryQueue.has(jobId) ? 'queued' : 'not_found';
  }
}

// Clear all jobs from the queue
export async function clearQueue(): Promise<boolean> {
  if (!useRedis || !redis || redis.status !== 'ready') {
    inMemoryQueue.clear();
    inMemoryProcessingQueue.length = 0;
    return true;
  }
  
  try {
    await redis.del(QUEUE_NAME);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error clearing queue: ${errorMessage}`);
    
    // Disable Redis on error
    useRedis = false;
    
    // Fall back to clearing in-memory queue
    inMemoryQueue.clear();
    inMemoryProcessingQueue.length = 0;
    return true;
  }
}

// Starts the worker to continuously process jobs from the queue.
// This should only be run in a dedicated worker process.
export async function startWorker(pollInterval = 5000): Promise<void> {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing job from Redis: ${errorMessage}`);
      
      // If Redis connection is lost, try to reconnect
      if (!isRedisReady()) {
        logger.warn('Redis connection lost. Attempting to reconnect...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // wait before retrying
        await initializeRedis();
      } else {
         // wait before processing next job
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
  }
}

// For compatibility with older code that expects a queue object
export function getVideoQueue() {
  // Return a simplified queue interface that mimics the old BullMQ interface
  return {
    add: async (jobName: string, data: any) => {
      const jobId = await enqueueVideoJob(data);
      return { id: jobId };
    },
    getJob: async (jobId: string) => {
      const status = await getJobStatus(jobId);
      if (status === 'not_found') return null;
      
      // If using in-memory queue, get the job data
      const job = inMemoryQueue.get(jobId);
      if (!job) return null;
      
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
export async function checkRedisHealth(): Promise<{
  isConnected: boolean;
  isEnabled: boolean;
  url: string | null;
  errorMessage?: string;
}> {
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
    } else {
      return {
        isConnected: false,
        isEnabled: true, // It's enabled, but not connected
        url: redisUrl,
        errorMessage: 'Redis client is not ready. Check worker logs for connection errors.',
      };
    }
  } catch (error) {
    return {
      isConnected: false,
      isEnabled: true,
      url: redisUrl,
      errorMessage: error instanceof Error ? error.message : 'Failed to connect to Redis',
    };
  }
}

// Export the Redis client for other modules to use
export { redis, useRedis };