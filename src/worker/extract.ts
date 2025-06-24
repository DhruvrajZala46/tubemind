// --- ALL IMPORTS FIRST ---
import 'dotenv/config';
import { startSimpleWorker, JobData } from '../lib/job-queue-redis-only';
import { processVideoJob } from '../lib/video-processor';
import { startHealthCheckServer } from './health';
import { createLogger } from '../lib/logger';
import { initializeRedisQueue, isRedisAvailable } from '../lib/redis-queue';
import http from 'http';
import { neon } from '@neondatabase/serverless';
import express from 'express';

// --- THEN your Redis config, env loading, etc ---
process.env.DISABLE_REDIS = 'false';
process.env.FORCE_REDIS_ON_WINDOWS = 'true';

console.log('🔧 INITIAL Redis Configuration BEFORE IMPORTS:');
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

console.log('🔧 REDIS Configuration AFTER env override:');
console.log(`   FORCE_REDIS_ON_WINDOWS (should be true): ${process.env.FORCE_REDIS_ON_WINDOWS}`);

console.log('🔧 FINAL Redis Configuration:');
console.log(`   DISABLE_REDIS: ${process.env.DISABLE_REDIS}`);
console.log(`   UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET'}`);
console.log(`   UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET'}`);
console.log(`   FORCE_REDIS_ON_WINDOWS: ${process.env.FORCE_REDIS_ON_WINDOWS}`);

// --- THEN logger ---
const logger = createLogger('worker:extract');

// Add this after logger is defined and environment variables are loaded
const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || 'NOT SET';
const maskedDbUrl = dbUrl.replace(/(:)([^:]*)(@)/, (m, p1, p2, p3) => p1 + '*****' + p3);
logger.info(`🔗 Neon DB connection string: ${maskedDbUrl}`);

logger.info('🚀 Enhanced worker process starting with Redis integration...');
logger.info(`✅ Node.js version: ${process.version}`);
logger.info(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);

let isShuttingDown = false;
let workerRunning = false;

const shutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`👋 Received ${signal}. Shutting down enhanced worker...`);
  setTimeout(() => {
    process.exit(0);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- PRE-FLIGHT TESTS ---
(async () => {
  try {
    // Test Neon DB connectivity
    const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      console.error('❌ No Neon connection string found in env');
    } else {
      const sql = neon(connectionString);
      console.log('🟢 [Preflight] Neon connection pool created');
      const result = await sql`SELECT 1 as test`;
      console.log('🟢 [Preflight] Neon test query succeeded:', result);
    }

    // Test Redis connectivity
    console.log('🔍 [Preflight] Testing Redis connectivity...');
    const redisInitialized = await initializeRedisQueue();
    if (redisInitialized) {
      console.log('🟢 [Preflight] Redis connection successful!');
    } else {
      console.log('⚠️ [Preflight] Redis not available, will use DB fallback');
    }
  } catch (err) {
    console.error('🔴 [Preflight] Tests failed:', err);
  }
})();

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  try {
    await processVideoJob(req.body);
    res.status(200).json({ status: 'done' });
  } catch (err) {
    console.error('Worker error:', err);
    res.status(500).json({ error: 'Job failed' });
  }
});

app.listen(process.env.PORT || 8080, () => {
  console.log('Worker listening on port', process.env.PORT || 8080);
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