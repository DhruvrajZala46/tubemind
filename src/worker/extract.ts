// FORCE Redis to be enabled - MUST BE FIRST BEFORE ANY IMPORTS
process.env.DISABLE_REDIS = 'false';
process.env.FORCE_REDIS_ON_WINDOWS = 'true';

console.log('🔧 INITIAL Redis Configuration BEFORE IMPORTS:');
console.log(`   DISABLE_REDIS: ${process.env.DISABLE_REDIS}`);
console.log(`   FORCE_REDIS_ON_WINDOWS: ${process.env.FORCE_REDIS_ON_WINDOWS}`);

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
  } catch (error) {
    console.log('No .env.local file found or error loading it, using system environment variables');
  }
} else {
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
import 'dotenv/config'; // Load environment variables from .env files
import { startSimpleWorker, JobData } from '../lib/job-queue';
import { processVideoJob } from '../lib/video-processor';
import { startHealthCheckServer } from './health';
import { createLogger } from '../lib/logger';

const logger = createLogger('worker:extract');

logger.info('🚀 Worker process starting...');
logger.info(`✅ Node.js version: ${process.version}`);
logger.info(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);

// Graceful shutdown handler
let isShuttingDown = false;

const shutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info(`👋 Received ${signal}. Shutting down worker...`);
  // Allow current jobs to finish before shutting down
  setTimeout(() => {
    process.exit(0);
  }, 5000); // 5 second graceful shutdown
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function startWorker() {
  try {
    // 1. Start the health check server
    // This is crucial for production monitoring services to know the worker is alive.
    logger.info('🏥 Starting health check server...');
startHealthCheckServer();
    logger.info('✅ Health check server started.');

    // 2. Define the job processing function
    // This is the core logic that the worker will execute for each job.
    const handleJob = async (jobData: JobData) => {
      const jobId = `${jobData.videoDbId}-${Date.now()}`;
      logger.info(`🔄 Processing job ${jobId} for video ${jobData.videoId}`);
      try {
        await processVideoJob(jobData);
        logger.info(`✅ Job ${jobId} completed successfully.`);
      } catch (error) {
        logger.error(`❌ Job ${jobId} failed.`, { error: error instanceof Error ? error.message : String(error) });
        // Re-throwing the error is important for proper error handling
        throw error;
      }
    };

    // 3. Start the simple Redis worker
    // This polls Redis directly without BullMQ to avoid script permission issues
    logger.info('👷‍♂️ Starting simple Redis worker...');
    
    // Add a heartbeat to detect process termination
    const heartbeat = setInterval(() => {
      logger.info('💓 Worker heartbeat - process is alive');
    }, 10000); // Every 10 seconds
    
    try {
      logger.info('🔥 About to call startSimpleWorker - this should start polling...');
      await startSimpleWorker(handleJob, () => isShuttingDown);
      logger.info('🛑 startSimpleWorker returned unexpectedly!');
    } catch (workerError) {
      logger.error('💥 CRITICAL: startSimpleWorker failed!', { 
        error: workerError instanceof Error ? workerError.message : String(workerError),
        stack: workerError instanceof Error ? workerError.stack : undefined
      });
      clearInterval(heartbeat);
      throw workerError;
    } finally {
      clearInterval(heartbeat);
    }
    
    logger.info('✅ Worker created and listening for jobs.');

    // Keep the process alive. In a containerized environment, the process
    // is expected to run indefinitely.
    console.log('⏳ Worker is running and waiting for jobs. Press Ctrl+C to exit.');

  } catch (error) {
    logger.error('💥 A critical error occurred during worker initialization.', { error: error instanceof Error ? error.message : String(error) });
    // If the worker can't even start, something is seriously wrong. Exit the process.
    process.exit(1);
  }
}

// Start the worker
startWorker();

/**
 * Direct video processing function for backup when job queue fails
 * This ensures users always get their summaries even if Redis/worker issues occur
 */
export async function processVideoDirectly(
  videoId: string,
  videoDbId: string,
  summaryDbId: string,
  userId: string,
  userEmail: string,
  metadata: any,
  totalDurationSeconds: number,
  creditsNeeded: number
): Promise<void> {
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
    const { processVideoExtraction } = await import('./extract-core');
    await processVideoExtraction(job);
    
    logger.info(`✅ Direct video processing completed for ${videoId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Direct video processing failed for ${videoId}: ${errorMessage}`);
    throw error;
  }
} 