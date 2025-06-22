// FORCE Redis to be enabled - MUST BE FIRST BEFORE ANY IMPORTS
process.env.DISABLE_REDIS = 'false';
process.env.FORCE_REDIS_ON_WINDOWS = 'true';

console.log('🔧 INITIAL Redis Configuration BEFORE IMPORTS:');
console.log(`   DISABLE_REDIS: ${process.env.DISABLE_REDIS}`);
console.log(`   FORCE_REDIS_ON_WINDOWS: ${process.env.FORCE_REDIS_ON_WINDOWS}`);

// Load .env.local only in development
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
}

// Universal Worker Process for TubeMind
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
import http from 'http';

const logger = createLogger('worker:extract');

logger.info('🚀 Worker process starting...');
logger.info(`✅ Node.js version: ${process.version}`);
logger.info(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);

let isShuttingDown = false;
let workerRunning = false;

const shutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`👋 Received ${signal}. Shutting down worker...`);
  setTimeout(() => {
    process.exit(0);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function startWorker() {
  try {
    logger.info('🏥 Starting health check server...');
    startHealthCheckServer();
    logger.info('✅ Health check server started.');

    const handleJob = async (jobData: JobData) => {
      const jobId = `${jobData.videoDbId}-${Date.now()}`;
      logger.info(`🔄 Processing job ${jobId} for video ${jobData.videoId}`);
      try {
        await processVideoJob(jobData);
        logger.info(`✅ Job ${jobId} completed successfully.`);
      } catch (error) {
        logger.error(`❌ Job ${jobId} failed.`, { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    };

    // Start the new DB-polling worker
    logger.info('🔥 About to call startSimpleWorker (DB polling mode) - this should start polling...');
    await startSimpleWorker(handleJob, () => isShuttingDown);
    logger.info('🛑 startSimpleWorker returned unexpectedly!');

    logger.info('✅ Worker created and listening for jobs.');
    console.log('⏳ Worker is running and waiting for jobs. Press Ctrl+C to exit.');
  } catch (error) {
    logger.error('💥 A critical error occurred during worker initialization.', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// HTTP endpoint to trigger the worker on-demand
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/start') {
    if (!workerRunning) {
      workerRunning = true;
      startWorker().finally(() => { workerRunning = false; });
      res.writeHead(200);
      res.end('Worker started');
    } else {
      res.writeHead(200);
      res.end('Worker already running');
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(process.env.WORKER_TRIGGER_PORT || 8080, () => {
  console.log('Worker trigger server listening on port', process.env.WORKER_TRIGGER_PORT || 8080);
});

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