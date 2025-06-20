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

// BullMQ recommends a single connection for all queue instances.
const redisConnectionConfig = getRedisConfig();
const connection: ConnectionOptions | undefined = redisConnectionConfig ? {
  ...redisConnectionConfig,
  // This is crucial for serverless environments like Vercel
  enableReadyCheck: false,
  // Upstash free tier does not support EVALSHA or other scripts, so we must tell BullMQ
  // not to use them. This is a legacy mode that is less performant but required.
  // We can't set `scripts` path to false, so we use this workaround
  maxRetriesPerRequest: null // This tells ioredis not to retry on commands, which can help with script errors
} : undefined;

logger.info('Redis connection configuration for BullMQ.', { connectionDetails: connection });

export async function initializeJobQueue(): Promise<void> {
  if (queue) {
    logger.info('Job queue already initialized.');
    return;
  }
  
  logger.info('🚀 Starting Job Queue initialization...');

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

    queue = new Queue(QUEUE_NAME, { 
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    logger.info('✅ BullMQ queue initialized successfully and connected to Redis.');
    
    queue.on('error', (error) => {
      logger.error('BullMQ queue error', { error: error.message });
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('🔴 Failed to initialize BullMQ queue', { error: errorMessage });
    // We throw here because if the queue is not working, the app cannot function.
    throw error;
  }
}

export async function addJobToQueue(data: JobData): Promise<Job> {
  if (!queue) {
    logger.info('Queue not initialized, initializing now...');
    await initializeJobQueue();
    if (!queue) { // Check again after initialization attempt
      logger.error('🔴 CRITICAL: Queue is null even after initialization attempt. Cannot add job.');
      throw new Error('Failed to initialize job queue. Cannot add job.');
    }
  }

  logger.info('Adding job to queue', { videoId: data.videoId });
  const job = await queue.add(QUEUE_NAME, data);
  logger.info('✅ Job added to queue successfully', { jobId: job.id, videoId: data.videoId });
  return job;
}

export async function getJobById(jobId: string): Promise<Job<JobData> | null> {
  if (!queue) {
    logger.info('Queue not initialized, initializing now to get job status...');
    await initializeJobQueue();
    if (!queue) {
      logger.error('🔴 CRITICAL: Queue is null even after initialization attempt. Cannot get job.');
      return null;
    }
  }
  
  const job = await queue.getJob(jobId);
  if (!job) {
    logger.warn(`Job with ID ${jobId} not found.`);
    return null;
  }
  
  return job;
}

export const createWorker = (processor: (job: Job<JobData>) => Promise<void>) => {
  if (!connection) {
    logger.error('🔴 Redis connection not configured. Cannot create worker.');
    // In a worker process, we should exit if we can't connect.
    process.exit(1);
  }
  
  logger.info('🚀 Creating BullMQ worker...');

  const worker = new Worker<JobData>(QUEUE_NAME, processor, {
    connection,
    concurrency: 5, // Number of jobs to process at the same time
    limiter: {
      max: 10,
      duration: 1000,
    },
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
  });

  logger.info('✅ BullMQ worker created successfully.');
  return worker;
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down job queue and worker...');
  if (queue) {
    await queue.close();
  }
  // The worker will be closed in its own process.
  process.exit(0);
});