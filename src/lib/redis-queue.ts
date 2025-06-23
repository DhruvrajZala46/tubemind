import { Redis } from '@upstash/redis';
import { createLogger } from './logger';
import { JobData } from './job-queue';

const logger = createLogger('redis-queue');

// Initialize Upstash Redis client
let redis: Redis | null = null;
let redisInitialized = false;

// Job queue configuration
const QUEUE_NAME = 'video_processing_jobs';
const PROCESSING_SET = 'processing_jobs';
const FAILED_SET = 'failed_jobs';

// Initialize Redis connection
export async function initializeRedisQueue(): Promise<boolean> {
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

    redis = new Redis({
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
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (error) {
    logger.error('❌ Failed to initialize Redis queue', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    redis = null;
    redisInitialized = false;
    return false;
  }
}

// Check if Redis is available
export function isRedisAvailable(): boolean {
  return redisInitialized && redis !== null;
}

// Add job to Redis queue
export async function addJobToRedisQueue(jobData: JobData): Promise<{ jobId: string; usedRedis: boolean }> {
  const jobId = jobData.summaryDbId;
  
  try {
    // Try Redis first
    if (!isRedisAvailable()) {
      await initializeRedisQueue();
    }

    if (isRedisAvailable() && redis) {
      // Create job object with proper structure
      const jobObject = {
        ...jobData,
        addedAt: Date.now(),
        status: 'queued'
      };

      // Serialize job data with error handling
      let serializedJob: string;
      try {
        serializedJob = JSON.stringify(jobObject);
      } catch (serializeError) {
        logger.error('❌ Failed to serialize job data', { 
          jobId,
          error: serializeError instanceof Error ? serializeError.message : String(serializeError)
        });
        return { jobId, usedRedis: false };
      }

      // Validate serialization worked
      try {
        JSON.parse(serializedJob); // Test parse to ensure it's valid
      } catch (validateError) {
        logger.error('❌ Job serialization validation failed', { 
          jobId,
          error: validateError instanceof Error ? validateError.message : String(validateError)
        });
        return { jobId, usedRedis: false };
      }

      // Add to queue using Redis LIST (LPUSH for queue, RPOP for processing)
      await redis.lpush(QUEUE_NAME, serializedJob);
      
      // Also store in a hash for easy lookup by ID
      await redis.hset(`job:${jobId}`, {
        data: serializedJob,
        status: 'queued',
        addedAt: Date.now()
      });

      logger.info('✅ Job added to Redis queue', { 
        jobId, 
        userId: jobData.userId,
        serializedLength: serializedJob.length
      });
      return { jobId, usedRedis: true };
    } else {
      // Redis not available, will fallback to DB
      logger.warn('⚠️ Redis not available, will use DB fallback', { jobId });
      return { jobId, usedRedis: false };
    }
  } catch (error) {
    logger.error('❌ Failed to add job to Redis queue', { 
      jobId, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { jobId, usedRedis: false };
  }
}

// Clean corrupted data from Redis queue  
export async function cleanCorruptedData(): Promise<number> {
  try {
    if (!isRedisAvailable() || !redis) {
      return 0;
    }

    logger.info('🧹 Cleaning corrupted data from Redis queue...');
    
    let cleanedCount = 0;
    const maxAttempts = 100; // Prevent infinite loop
    
    for (let i = 0; i < maxAttempts; i++) {
      // Peek at the oldest item without removing it
      const items = await redis.lrange(QUEUE_NAME, -1, -1);
      
      if (items.length === 0) {
        break; // Queue is empty
      }
      
      const item = items[0];
      
      try {
        // Try to parse the item
        const parsed = JSON.parse(item);
        
        // Validate required fields
        if (!parsed.summaryDbId || !parsed.videoId || !parsed.userId) {
          throw new Error('Missing required fields');
        }
        
        // Item is valid, stop cleaning
        break;
      } catch (parseError) {
        // Item is corrupted, remove it
        await redis.rpop(QUEUE_NAME);
        cleanedCount++;
        
        logger.warn('🗑️ Removed corrupted item from queue', { 
          item: item.substring(0, 100),
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`✅ Cleaned ${cleanedCount} corrupted items from Redis queue`);
    } else {
      logger.info('✅ No corrupted data found in Redis queue');
    }
    
    return cleanedCount;
  } catch (error) {
    logger.error('❌ Failed to clean corrupted data', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return 0;
  }
}

// Get next job from Redis queue
export async function getNextJobFromRedis(): Promise<JobData | null> {
  try {
    if (!isRedisAvailable() || !redis) {
      return null;
    }

    // Pop job from queue (RPOP for FIFO processing)
    const jobString = await redis.rpop(QUEUE_NAME);
    
    if (!jobString) {
      return null; // No jobs available
    }

    // Ensure we have a valid string before parsing
    if (typeof jobString !== 'string') {
      logger.error('❌ Invalid job data type from Redis', { 
        jobType: typeof jobString,
        jobValue: jobString 
      });
      return null;
    }

    let jobData: JobData & { addedAt: number; status: string };
    
    try {
      jobData = JSON.parse(jobString);
    } catch (parseError) {
      logger.error('❌ Failed to parse job JSON from Redis', { 
        jobString: jobString.substring(0, 100),
        parseError: parseError instanceof Error ? parseError.message : String(parseError)
      });
      return null;
    }

    // Validate job data structure
    if (!jobData.summaryDbId || !jobData.videoId || !jobData.userId) {
      logger.error('❌ Invalid job data structure from Redis', { 
        hasJobId: !!jobData.summaryDbId,
        hasVideoId: !!jobData.videoId,
        hasUserId: !!jobData.userId
      });
      return null;
    }
    
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
  } catch (error) {
    logger.error('❌ Failed to get job from Redis queue', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

// Mark job as completed
export async function markJobCompleted(jobId: string): Promise<boolean> {
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
  } catch (error) {
    logger.error('❌ Failed to mark job as completed in Redis', { 
      jobId, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

// Mark job as failed
export async function markJobFailed(jobId: string, errorMessage: string): Promise<boolean> {
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
  } catch (error) {
    logger.error('❌ Failed to mark job as failed in Redis', { 
      jobId, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

// Get job status from Redis
export async function getJobStatus(jobId: string): Promise<any | null> {
  try {
    if (!isRedisAvailable() || !redis) {
      return null;
    }

    const jobData = await redis.hgetall(`job:${jobId}`);
    return jobData && Object.keys(jobData).length > 0 ? jobData : null;
  } catch (error) {
    logger.error('❌ Failed to get job status from Redis', { 
      jobId, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

// Get queue statistics
export async function getRedisQueueStats(): Promise<{
  queueLength: number;
  processingCount: number;
  failedCount: number;
} | null> {
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
  } catch (error) {
    logger.error('❌ Failed to get Redis queue stats', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

// Health check for Redis
export async function checkRedisHealth(): Promise<{
  isConnected: boolean;
  isEnabled: boolean;
  url?: string;
  stats?: any;
}> {
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
    } else {
      return {
        isConnected: false,
        isEnabled: false,
        url: url.replace(/\/\/.*@/, '//***@')
      };
    }
  } catch (error) {
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