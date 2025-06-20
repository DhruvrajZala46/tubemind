import { z } from 'zod';
import * as dotenv from 'dotenv';

// Set default NODE_ENV if not defined (for local testing)
if (typeof process.env.NODE_ENV === 'undefined') {
  // Use Object.defineProperty to avoid read-only property error
  Object.defineProperty(process.env, 'NODE_ENV', { 
    value: 'development',
    writable: true
  });
}

// Detect Leapcell environment
const isLeapcellEnvironment = process.env.DEPLOYMENT_ENV === 'leapcell';

// Only try to load .env.local if not in Leapcell environment
if (!isLeapcellEnvironment) {
  try {
    dotenv.config({ path: '.env.local' });
    console.log('✅ Loaded environment variables from .env.local');
  } catch (error) {
    console.log('No .env.local file found, using environment variables');
  }
} else {
  console.log('🚀 Running in Leapcell environment, using system environment variables');
}

// Clean quotes from environment variables if present
function cleanEnvVar(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/^['"](.*)['"]$/, '$1');
}

// Clean important environment variables
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = cleanEnvVar(process.env.DATABASE_URL);
}
if (process.env.REDIS_URL) {
  process.env.REDIS_URL = cleanEnvVar(process.env.REDIS_URL);
}
if (process.env.UPSTASH_REDIS_REST_URL) {
  process.env.UPSTASH_REDIS_REST_URL = cleanEnvVar(process.env.UPSTASH_REDIS_REST_URL);
}
if (process.env.UPSTASH_REDIS_REST_TOKEN) {
  process.env.UPSTASH_REDIS_REST_TOKEN = cleanEnvVar(process.env.UPSTASH_REDIS_REST_TOKEN);
}

// -------------------------------------------------------------
// Centralised environment-variable validation.
// Throws at startup if any *required* variable is missing/invalid.
// -------------------------------------------------------------

// Check if we're in a test or development environment
const isTestOrDev = process.env.NODE_ENV === 'development' || 
                   process.env.NODE_ENV === 'test' || 
                   isLeapcellEnvironment;

console.log(`🔧 Running in ${isTestOrDev ? 'development/test' : 'production'} mode`);

// Leapcell environment detection
if (isLeapcellEnvironment) {
  console.log('🚀 Running in Leapcell environment (detected via DEPLOYMENT_ENV)');
}

// Define the environment schema type
export type EnvType = {
  // Core
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  
  // Redis configuration
  REDIS_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  DISABLE_REDIS?: 'true' | 'false';
  
  // Authentication / Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  
  // AI providers
  OPENAI_API_KEY: string;
  OPENAI_ORG_ID?: string;
  OPENAI_PROJECT_ID?: string;
  GOOGLE_GEMINI_API_KEY?: string;
  
  // YouTube / Transcript service
  YOUTUBE_API_KEY: string;
  PYTHON_TRANSCRIPT_SERVICE?: string;
  
  // Payments / Polar
  POLAR_WEBHOOK_SECRET: string;
  POLAR_ACCESS_TOKEN: string;
  POLAR_SERVER: 'production' | 'sandbox';
  
  // Observability
  SENTRY_DSN?: string;
  
  // Misc
  ANALYZE?: string;
  
  // Deployment environment
  DEPLOYMENT_ENV?: string;
  
  // Admin configuration
  ADMIN_USER_IDS?: string;
  
  // Monitoring
  MONITORING_API_KEY?: string;
  
  // Cron jobs
  CRON_SECRET?: string;
  
  // Transcript service
  TRANSCRIPT_SERVICE_URL?: string;
  
  // Optimizations
  TRANSCRIPT_MAX_RETRIES?: string;
  TRANSCRIPT_TIMEOUT_MS?: string;
  TRANSCRIPT_PARALLEL_DISABLED?: string;
  TRANSCRIPT_CACHE_DISABLED?: string;
  
  // Worker configuration
  WORKER_PORT?: string;
};

// Schema with appropriate validation
const EnvSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid connection string URL' }),
  
  // Redis configuration
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  DISABLE_REDIS: z.enum(['true', 'false']).optional().default('false'),
  
  // Authentication / Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  
  // AI providers
  OPENAI_API_KEY: z.string(),
  OPENAI_ORG_ID: z.string().optional(),
  OPENAI_PROJECT_ID: z.string().optional(),
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  
  // YouTube / Transcript service
  YOUTUBE_API_KEY: z.string(),
  PYTHON_TRANSCRIPT_SERVICE: z.string().url().optional(),
  
  // Payments / Polar
  POLAR_WEBHOOK_SECRET: z.string(),
  POLAR_ACCESS_TOKEN: z.string(),
  POLAR_SERVER: z.enum(['production', 'sandbox']).default('production'),
  
  // Observability
  SENTRY_DSN: z.string().optional(),
  
  // Misc
  ANALYZE: z.string().optional(),
  
  // Deployment environment
  DEPLOYMENT_ENV: z.string().optional(),
  
  // Admin configuration
  ADMIN_USER_IDS: z.string().optional(),
  
  // Monitoring
  MONITORING_API_KEY: z.string().optional(),
  
  // Cron jobs
  CRON_SECRET: z.string().optional(),
  
  // Transcript service
  TRANSCRIPT_SERVICE_URL: z.string().optional(),
  
  // Optimizations
  TRANSCRIPT_MAX_RETRIES: z.string().optional(),
  TRANSCRIPT_TIMEOUT_MS: z.string().optional(),
  TRANSCRIPT_PARALLEL_DISABLED: z.string().optional(),
  TRANSCRIPT_CACHE_DISABLED: z.string().optional(),
  
  // Worker configuration
  WORKER_PORT: z.string().optional(),
});

// Detect if we're running a worker process
const isWorkerProcess = process.argv[1]?.includes('worker') || 
                       process.env.WORKER_MODE === 'true' ||
                       isLeapcellEnvironment;

console.log(`🔧 Environment validation mode: ${isWorkerProcess ? 'WORKER' : 'API'}`);

// Create worker-specific schema for lighter validation
const WorkerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid connection string URL' }),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  DISABLE_REDIS: z.enum(['true', 'false']).optional().default('false'),
  OPENAI_API_KEY: z.string(),
  DEPLOYMENT_ENV: z.string().optional(),
  WORKER_PORT: z.string().optional(),
});

// Parse environment variables with appropriate schema
let env: EnvType;
try {
  if (isWorkerProcess) {
    env = WorkerEnvSchema.parse(process.env) as EnvType;
    console.log('✅ Worker environment variables validated successfully');
  } else {
    env = EnvSchema.parse(process.env) as EnvType;
    console.log('✅ Environment variables validated successfully');
  }
} catch (error) {
  console.error('❌ Environment validation failed:', error);
  throw error;
}

// Check for missing critical environment variables
if (!env.DATABASE_URL) {
  console.error('❌ Missing required DATABASE_URL environment variable');
  throw new Error('Missing required DATABASE_URL environment variable');
}

// Only validate API-specific variables if not in worker mode
if (!isWorkerProcess) {
  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !env.CLERK_SECRET_KEY) {
    console.error('❌ Missing required Clerk authentication keys');
    throw new Error('Missing required Clerk authentication keys');
  }

  if (!env.YOUTUBE_API_KEY) {
    console.error('❌ Missing required YouTube API key');
    throw new Error('Missing required YouTube API key');
  }

  if (!env.POLAR_WEBHOOK_SECRET || !env.POLAR_ACCESS_TOKEN) {
    console.error('❌ Missing required Polar payment credentials');
    throw new Error('Missing required Polar payment credentials');
  }
}

// Always validate OpenAI API key (needed by both API and worker)
if (!env.OPENAI_API_KEY) {
  console.error('❌ Missing required OpenAI API key');
  throw new Error('Missing required OpenAI API key');
}

export default env; 