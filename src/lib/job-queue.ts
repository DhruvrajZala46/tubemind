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
  
  // Ensure Redis is initialized before adding job
  if (!redis) {
    logger.info('🔄 Redis client not available, initializing...');
    await initializeRedis();
    if (!redis) {
      throw new Error("Could not initialize Redis client for job queue");
    }
  }
  
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
  
  try {
    // Try the simple approach first with basic Redis operations
    await redis.hset(`video-processing:job:${jobId}`, {
      id: jobId,
      data: jobData,
      status: 'queued',
      created: Date.now().toString()
    });
    
    // Use a simple SET instead of LPUSH to work around Upstash restrictions
    const queueKey = `video-processing:pending:${jobId}`;
    await redis.setex(queueKey, 3600, jobData); // Expire after 1 hour
    
    logger.info('✅ Job added to simple queue successfully', { jobId, videoId: data.videoId, videoDbId: data.videoDbId });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('NOPERM')) {
      logger.error('❌ Redis command not permitted on Upstash free tier', { 
        error: errorMessage, 
        jobId, 
        videoId: data.videoId 
      });
      
      // Fallback: Just store the job status, worker will process via database polling
      await redis.hset(`video-processing:job:${jobId}`, {
        id: jobId,
        status: 'queued',
        created: Date.now().toString(),
        fallback: 'database-polling'
      });
      
      logger.warn('⚠️ Using database polling fallback due to Redis restrictions', { jobId });
    } else {
      throw error;
    }
  }
  
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
  
  try {
    // CRITICAL FIX: Initialize Redis directly, bypass BullMQ completely for worker
    logger.info('🔄 Initializing Redis client directly for worker...');
    await initializeRedis();
    
    if (!redis) {
      logger.error('❌ Redis not available, cannot start worker');
      throw new Error('Redis connection required for worker');
    }
    
    logger.info('✅ Redis connection verified, starting job polling...');
    
    // Test Redis connection before starting with aggressive timeout and fallback
    logger.info('🏓 Testing Redis connection with 3-second timeout...');
    try {
      const pingPromise = redis.ping();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Redis ping timeout after 3 seconds')), 3000)
      );
      
      const pingResult = await Promise.race([pingPromise, timeoutPromise]);
      logger.info('🏓 Redis ping successful, proceeding to polling!', { result: pingResult });
    } catch (pingError) {
      logger.warn('⚠️ Redis ping failed/timed out, skipping and going to polling anyway!', { error: pingError instanceof Error ? pingError.message : String(pingError) });
      // Don't let ping failure block the worker - continue to polling
    }
    
    logger.info('🚀 CRITICAL: Redis ping section completed, proceeding to job polling!');
    
    // Force simple queue mode for worker
    logger.info('🔧 Setting simple queue mode...');
    (global as any).__SIMPLE_QUEUE_MODE = true;
    logger.info('✅ Simple queue mode enabled for worker');
    
    // Polling function - adapted for SET-based queue due to Upstash restrictions
    const pollForJobs = async () => {
      let pollCount = 0;
      
      logger.info('🎯 POLLING LOOP STARTED - this should appear in logs!');
      logger.info('💥 CRITICAL DEBUG: Inside pollForJobs function!');
      logger.info('💥 CRITICAL DEBUG: About to enter while loop!!');
      
      while (!shouldStop()) {
        pollCount++;
        
        try {
          // Get queued jobs from database since Redis LPUSH/RPOP is restricted
          logger.info('🔍 Polling database for queued jobs...', { pollCount });
          
          // Add database connection test
          logger.info('📡 Testing database connection...');
          const { executeQuery } = await import('../lib/db');
          
          logger.info('📊 Executing database query for queued jobs...');
          const queuedJobs = await executeQuery(async (sql) => {
            return await sql`
              SELECT vs.video_id as video_db_id, v.video_id, v.user_id, v.title, vs.id as summary_id
              FROM video_summaries vs
              JOIN videos v ON vs.video_id = v.id  
              WHERE vs.processing_status = 'queued'
              ORDER BY vs.created_at ASC
              LIMIT 1
            `;
          });
          
          logger.info(`📊 Database query completed, found ${queuedJobs.length} queued jobs`, { pollCount });
          
          if (queuedJobs.length > 0) {
            const job = queuedJobs[0];
            
            // Check if this job has pending data in Redis
            const pendingKey = `video-processing:pending:${job.video_db_id}`;
            const jobData = await redis!.get(pendingKey);
            
            if (jobData) {
              // Found Redis job data
              const data = JSON.parse(jobData) as JobData;
              logger.info('📦 Found job in database with Redis data', { 
                videoId: data.videoId, 
                userId: data.userId, 
                videoDbId: data.videoDbId,
                pollCount 
              });
              
              try {
                // Remove the pending job from Redis
                await redis!.del(pendingKey);
                
                // Update job status to active
                await redis!.hset(`video-processing:job:${data.videoDbId}`, {
                  status: 'active',
                  started: Date.now().toString(),
                });
                
                // Update database status
                await executeQuery(async (sql) => {
                  await sql`UPDATE video_summaries SET processing_status = 'processing' WHERE id = ${job.summary_id}`;
                });
                
                logger.info('🔄 Starting job processing', { videoId: data.videoId, videoDbId: data.videoDbId });
                
                // Process the job
                await processor(data);
                
                // Mark job as completed in Redis
                await redis!.hset(`video-processing:job:${data.videoDbId}`, {
                  status: 'completed',
                  finished: Date.now().toString(),
                });
                
                logger.info('✅ Job processing completed successfully', { 
                  videoId: data.videoId, 
                  videoDbId: data.videoDbId 
                });
                
              } catch (jobError) {
                // Mark job as failed in both Redis and database
                await redis!.hset(`video-processing:job:${data.videoDbId}`, {
                  status: 'failed',
                  finished: Date.now().toString(),
                  error: jobError instanceof Error ? jobError.message : String(jobError),
                });
                
                await executeQuery(async (sql) => {
                  await sql`UPDATE video_summaries SET processing_status = 'failed' WHERE id = ${job.summary_id}`;
                });
                
                logger.error('❌ Job processing failed', { 
                  videoId: data.videoId, 
                  videoDbId: data.videoDbId,
                  error: jobError instanceof Error ? jobError.message : String(jobError) 
                });
              }
            } else {
              // Job in database but no Redis data - reconstruct job data from database
              logger.info('📋 Found queued job in database without Redis data, reconstructing...', { 
                videoDbId: job.video_db_id,
                videoId: job.video_id,
                userId: job.user_id,
                pollCount 
              });
              
              // Get additional job data from database
              const jobDetails = await executeQuery(async (sql) => {
                return await sql`
                  SELECT v.*, vs.*, u.email, u.full_name
                  FROM videos v
                  JOIN video_summaries vs ON v.id = vs.video_id
                  LEFT JOIN users u ON v.user_id = u.id
                  WHERE v.id = ${job.video_db_id}
                `;
              });
              
              if (jobDetails.length > 0) {
                const details = jobDetails[0];
                
                // Reconstruct JobData from database
                const reconstructedJobData: JobData = {
                  videoId: details.video_id,
                  videoDbId: details.id,
                  summaryDbId: details.id, // video_summaries.id
                  userId: details.user_id,
                  userEmail: details.email || 'unknown@example.com',
                  user: { id: details.user_id, email: details.email, name: details.full_name },
                  metadata: {
                    title: details.title,
                    duration: details.duration,
                    channelTitle: details.channel_title,
                    thumbnailUrl: details.thumbnail_url
                  },
                  totalDurationSeconds: details.duration || 0,
                  creditsNeeded: 1 // Default credit cost
                };
                
                logger.info('🔧 Reconstructed job data from database', { 
                  videoId: reconstructedJobData.videoId,
                  videoDbId: reconstructedJobData.videoDbId 
                });
                
                try {
                  // Update database status to processing
                  await executeQuery(async (sql) => {
                    await sql`UPDATE video_summaries SET processing_status = 'processing' WHERE id = ${job.summary_id}`;
                  });
                  
                  // Update Redis status if possible
                  if (redis) {
                    await redis.hset(`video-processing:job:${job.video_db_id}`, {
                      status: 'active',
                      started: Date.now().toString(),
                    });
                  }
                  
                  logger.info('🔄 Starting reconstructed job processing', { 
                    videoId: reconstructedJobData.videoId, 
                    videoDbId: reconstructedJobData.videoDbId 
                  });
                  
                  // Process the reconstructed job
                  await processor(reconstructedJobData);
                  
                  // Mark job as completed
                  if (redis) {
                    await redis.hset(`video-processing:job:${job.video_db_id}`, {
                      status: 'completed',
                      finished: Date.now().toString(),
                    });
                  }
                  
                  logger.info('✅ Reconstructed job processing completed successfully', { 
                    videoId: reconstructedJobData.videoId, 
                    videoDbId: reconstructedJobData.videoDbId 
                  });
                  
                } catch (jobError) {
                  // Mark job as failed
                  if (redis) {
                    await redis.hset(`video-processing:job:${job.video_db_id}`, {
                      status: 'failed',
                      finished: Date.now().toString(),
                      error: jobError instanceof Error ? jobError.message : String(jobError),
                    });
                  }
                  
                  await executeQuery(async (sql) => {
                    await sql`UPDATE video_summaries SET processing_status = 'failed' WHERE id = ${job.summary_id}`;
                  });
                  
                  logger.error('❌ Reconstructed job processing failed', { 
                    videoId: reconstructedJobData.videoId, 
                    videoDbId: reconstructedJobData.videoDbId,
                    error: jobError instanceof Error ? jobError.message : String(jobError) 
                  });
                }
              } else {
                logger.error('🔴 Could not reconstruct job data - database details not found', { 
                  videoDbId: job.video_db_id 
                });
              }
            }
          } else {
            // Log polling activity every 10 polls (20 seconds) to show worker is alive  
            if (pollCount % 10 === 0) {
              logger.info('🔍 Worker polling for jobs via database...', { pollCount });
            }
            
            // No jobs found, wait before polling again
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (pollError) {
          logger.error('Error polling for jobs', { 
            error: pollError instanceof Error ? pollError.message : String(pollError),
            pollCount 
          });
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
      
      logger.info('🛑 Worker stopped polling (shutdown requested)');
    };
    
    logger.info('✅ Simple worker initialized, starting polling loop...');
    
    // Start polling and await it (blocking)
    try {
      logger.info('🚀 About to call pollForJobs() - this should block...');
      await pollForJobs();
      logger.info('🛑 pollForJobs() returned unexpectedly!');
    } catch (pollingError) {
      logger.error('💥 CRITICAL: pollForJobs() threw an error!', { 
        error: pollingError instanceof Error ? pollingError.message : String(pollingError),
        stack: pollingError instanceof Error ? pollingError.stack : undefined
      });
      throw pollingError;
    }
    
  } catch (error) {
    logger.error('❌ Critical error starting simple worker', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down job queue and worker...');
  if (queue) {
    await queue.close();
  }
  process.exit(0);
});