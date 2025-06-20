import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { createLogger } from './logger';
import { getRedisConfig, redis, initializeRedis } from './redis-client';

const logger = createLogger('job-queue');

export interface JobData {
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

const QUEUE_NAME = 'video-processing';

let queue: Queue | null = null;

// BullMQ configuration for Upstash free tier compatibility
const redisConnectionConfig = getRedisConfig();
const connection: ConnectionOptions | undefined = redisConnectionConfig ? {
  ...redisConnectionConfig,
  // CRITICAL: Disable all script-based operations for Upstash free tier
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  // Disable Redis command queue to prevent script usage
  enableOfflineQueue: false,
} : undefined;

logger.info('Redis connection configuration for BullMQ (script-free mode).', { connectionDetails: connection });

export async function initializeJobQueue(): Promise<void> {
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
    await initializeRedis();
    if (!redis) {
      throw new Error("Main redis client not available for BullMQ");
    }

    // CRITICAL FIX: Configure BullMQ to work without Lua scripts
    queue = new Queue(QUEUE_NAME, { 
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 10, // Keep only 10 completed jobs
        removeOnFail: 10,     // Keep only 10 failed jobs
      },
      // Note: Some advanced settings removed for Upstash compatibility
    });

    logger.info('✅ BullMQ queue initialized successfully (script-free mode).');
    
    queue.on('error', (error) => {
      logger.error('BullMQ queue error', { error: error.message });
    });

  } catch (error) {
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
async function initializeSimpleQueue(): Promise<void> {
  logger.info('🔄 Initializing simple Redis job queue (no scripts)...');
  
  if (!redis) {
    await initializeRedis();
    if (!redis) {
      throw new Error("Redis client not available for simple queue");
    }
  }
  
  // Mark that we're using simple queue mode
  (global as any).__SIMPLE_QUEUE_MODE = true;
  logger.info('✅ Simple Redis job queue initialized (Upstash free tier compatible).');
}

export async function addJobToQueue(data: JobData): Promise<Job> {
  // CRITICAL FIX: Force simple queue mode for Upstash compatibility
  // Always use simple queue to avoid any script permission issues
  logger.info('🚀 Using simple queue mode for Upstash compatibility', { videoId: data.videoId });
  return addJobToSimpleQueue(data);
}

// Simple job queue implementation that doesn't use Redis scripts
async function addJobToSimpleQueue(data: JobData): Promise<Job> {
  if (!redis) {
    throw new Error("Redis client not available for simple queue");
  }
  
  // CRITICAL FIX: Use videoDbId as jobId for consistent tracking
  const jobId = data.videoDbId;
  const jobData = JSON.stringify(data);
  
  logger.info('Adding job to simple Redis queue', { videoId: data.videoId, jobId, videoDbId: data.videoDbId });
  
  // Use simple Redis commands that work with Upstash free tier
  await redis.lpush('video-processing:jobs', jobData);
  await redis.hset(`video-processing:job:${jobId}`, {
    id: jobId,
    data: jobData,
    status: 'queued',
    created: Date.now().toString()
  });
  
  logger.info('✅ Job added to simple queue successfully', { jobId, videoId: data.videoId, videoDbId: data.videoDbId });
  
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
  } as unknown as Job;
}

export async function getJobById(jobId: string): Promise<Job<JobData> | null> {
  // Check if we're in simple queue mode
  if ((global as any).__SIMPLE_QUEUE_MODE) {
    return getJobFromSimpleQueue(jobId);
  }

  if (!queue) {
    logger.info('Queue not initialized, initializing now to get job status...');
    await initializeJobQueue();
    if (!queue && !(global as any).__SIMPLE_QUEUE_MODE) {
      logger.error('🔴 CRITICAL: Queue is null even after initialization attempt. Cannot get job.');
      return null;
    }
    
    if ((global as any).__SIMPLE_QUEUE_MODE) {
      return getJobFromSimpleQueue(jobId);
    }
  }
  
  try {
    const job = await queue!.getJob(jobId);
    if (!job) {
      logger.warn(`Job with ID ${jobId} not found.`);
      return null;
    }
    
    return job;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('NOPERM') || errorMessage.includes('script')) {
      logger.warn('⚠️ BullMQ getJob failed due to script permissions. Falling back to simple queue.', { error: errorMessage });
      (global as any).__SIMPLE_QUEUE_MODE = true;
      return getJobFromSimpleQueue(jobId);
    }
    
    throw error;
  }
}

async function getJobFromSimpleQueue(jobId: string): Promise<Job<JobData> | null> {
  if (!redis) {
    return null;
  }
  
  try {
    const jobInfo = await redis.hgetall(`video-processing:job:${jobId}`);
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
    } as unknown as Job<JobData>;
  } catch (error) {
    logger.error('Error getting job from simple queue', { jobId, error });
    return null;
  }
}

export const createWorker = (processor: (job: Job<JobData>) => Promise<void>) => {
  if (!connection) {
    logger.error('🔴 Redis connection not configured. Cannot create worker.');
    process.exit(1);
  }
  
  logger.info('🚀 Creating BullMQ worker (script-free mode)...');

  try {
    const worker = new Worker<JobData>(QUEUE_NAME, processor, {
      connection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000,
      }
    });

    worker.on('completed', (job: Job) => {
      logger.info(`✅ Job completed`, { jobId: job.id });
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        logger.error(`🔴 Job failed`, { jobId: job.id, error: error.message, attempts: job.attemptsMade });
      } else {
        logger.error('🔴 An unknown job failed', { error: error.message });
      }
    });
    
    worker.on('error', (error) => {
      logger.error('BullMQ worker error', { error: error.message });
      
      // If script errors occur, we should fall back to simple processing
      if (error.message.includes('NOPERM') || error.message.includes('script')) {
        logger.warn('⚠️ BullMQ worker failed due to script permissions. Consider using simple job processing.');
        (global as any).__SIMPLE_QUEUE_MODE = true;
      }
    });

    logger.info('✅ BullMQ worker created successfully (script-free mode).');
    return worker;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('NOPERM') || errorMessage.includes('script')) {
      logger.error('🔴 BullMQ worker creation failed due to script permissions. Using simple job processing.', { error: errorMessage });
      (global as any).__SIMPLE_QUEUE_MODE = true;
      
      // Return a mock worker that processes jobs directly
      return createSimpleWorker(processor);
    }
    
    throw error;
  }
};

// Simple worker implementation for Upstash free tier
function createSimpleWorker(processor: (job: Job<JobData>) => Promise<void>) {
  logger.info('🔄 Creating simple worker (no scripts)...');
  
  const worker = {
    on: (event: string, handler: Function) => {
      // Mock event handlers
    },
    close: async () => {
      logger.info('Simple worker closed');
    }
  };
  
  // Start polling for jobs
  const pollJobs = async () => {
    if (!redis) return;
    
    try {
      // Get job from simple queue
      const jobData = await redis.rpop('video-processing:jobs');
      if (jobData) {
        const data = JSON.parse(jobData);
        const job = {
          id: `simple-${Date.now()}`,
          data,
          name: QUEUE_NAME,
          opts: {},
          attemptsMade: 0,
          timestamp: Date.now()
        } as Job<JobData>;
        
        logger.info('Processing job from simple queue', { jobId: job.id, videoId: data.videoId });
        await processor(job);
        logger.info('✅ Simple job completed', { jobId: job.id });
      }
    } catch (error) {
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
export async function startSimpleWorker(
  processor: (jobData: JobData) => Promise<void>,
  shouldStop: () => boolean = () => false
): Promise<void> {
  logger.info('🚀 Starting simple Redis worker (script-free)...');
  
  await initializeJobQueue();
  
  if (!redis) {
    logger.error('❌ Redis not available, cannot start worker');
    throw new Error('Redis connection required for worker');
  }
  
    // Polling function
  const pollForJobs = async () => {
    while (!shouldStop()) {
      try {
        // Try to get a job from the simple queue
        const jobData = await redis!.rpop('video-processing:jobs');
        
        if (jobData) {
          const data = JSON.parse(jobData) as JobData;
          logger.info('📦 Found job in queue', { 
            videoId: data.videoId, 
            userId: data.userId, 
            videoDbId: data.videoDbId 
          });
          
          try {
            // Update job status to active
            await redis!.hset(`video-processing:job:${data.videoDbId}`, {
              status: 'active',
              started: Date.now().toString(),
            });
            
            logger.info('🔄 Starting job processing', { videoId: data.videoId, videoDbId: data.videoDbId });
            
            // Process the job
            await processor(data);
            
            // Mark job as completed
            await redis!.hset(`video-processing:job:${data.videoDbId}`, {
              status: 'completed',
              finished: Date.now().toString(),
            });
            
            logger.info('✅ Job processing completed successfully', { 
              videoId: data.videoId, 
              videoDbId: data.videoDbId 
            });
            
          } catch (jobError) {
            // Mark job as failed
            await redis!.hset(`video-processing:job:${data.videoDbId}`, {
              status: 'failed',
              finished: Date.now().toString(),
              error: jobError instanceof Error ? jobError.message : String(jobError),
            });
            
            logger.error('❌ Job processing failed', { 
              videoId: data.videoId, 
              videoDbId: data.videoDbId,
              error: jobError instanceof Error ? jobError.message : String(jobError) 
            });
          }
        } else {
          // No jobs found, wait before polling again (shorter interval for responsiveness)
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (pollError) {
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