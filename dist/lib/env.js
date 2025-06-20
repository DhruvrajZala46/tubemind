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
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const dotenv = __importStar(require("dotenv"));
// Set default NODE_ENV if not defined (for local testing)
if (typeof process.env.NODE_ENV === 'undefined') {
    // Use Object.defineProperty to avoid read-only property error
    Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true
    });
}
// Detect Leapcell environment
const isLeapcellEnvironment = process.env.LEAPCELL === 'true' || process.env.DEPLOYMENT_ENV === 'leapcell';
// Only try to load .env.local if not in Leapcell environment
if (!isLeapcellEnvironment) {
    try {
        dotenv.config({ path: '.env.local' });
        console.log('✅ Loaded environment variables from .env.local');
    }
    catch (error) {
        console.log('No .env.local file found, using environment variables');
    }
}
else {
    console.log('🚀 Running in Leapcell environment, using system environment variables');
}
// Clean quotes from environment variables if present
function cleanEnvVar(value) {
    if (!value)
        return value;
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
    console.log('🚀 Running in Leapcell environment');
}
// Schema with appropriate validation
const EnvSchema = zod_1.z.object({
    // Core
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: zod_1.z.string().url({ message: 'DATABASE_URL must be a valid connection string URL' }),
    // Redis configuration
    REDIS_URL: zod_1.z.string().optional(),
    UPSTASH_REDIS_REST_URL: zod_1.z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: zod_1.z.string().optional(),
    DISABLE_REDIS: zod_1.z.enum(['true', 'false']).optional().default('false'),
    // Authentication / Clerk
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: zod_1.z.string(),
    CLERK_SECRET_KEY: zod_1.z.string(),
    // AI providers
    OPENAI_API_KEY: zod_1.z.string(),
    OPENAI_ORG_ID: zod_1.z.string().optional(),
    OPENAI_PROJECT_ID: zod_1.z.string().optional(),
    GOOGLE_GEMINI_API_KEY: zod_1.z.string().optional(),
    // YouTube / Transcript service
    YOUTUBE_API_KEY: zod_1.z.string(),
    PYTHON_TRANSCRIPT_SERVICE: zod_1.z.string().url().optional(),
    // Payments / Polar
    POLAR_WEBHOOK_SECRET: zod_1.z.string(),
    POLAR_ACCESS_TOKEN: zod_1.z.string(),
    POLAR_SERVER: zod_1.z.enum(['production', 'sandbox']).default('production'),
    // Observability
    SENTRY_DSN: zod_1.z.string().optional(),
    // Misc
    ANALYZE: zod_1.z.string().optional(),
    // Leapcell detection
    LEAPCELL: zod_1.z.string().optional(),
    DEPLOYMENT_ENV: zod_1.z.string().optional(),
    // Admin configuration
    ADMIN_USER_IDS: zod_1.z.string().optional(),
    // Monitoring
    MONITORING_API_KEY: zod_1.z.string().optional(),
    // Cron jobs
    CRON_SECRET: zod_1.z.string().optional(),
    // Transcript service
    TRANSCRIPT_SERVICE_URL: zod_1.z.string().optional(),
    // Optimizations
    TRANSCRIPT_MAX_RETRIES: zod_1.z.string().optional(),
    TRANSCRIPT_TIMEOUT_MS: zod_1.z.string().optional(),
    TRANSCRIPT_PARALLEL_DISABLED: zod_1.z.string().optional(),
    TRANSCRIPT_CACHE_DISABLED: zod_1.z.string().optional(),
    // Worker configuration
    WORKER_PORT: zod_1.z.string().optional(),
});
// Parse environment variables
let env;
try {
    env = EnvSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
}
catch (error) {
    console.error('❌ Environment validation failed:', error);
    throw error;
}
// Check for missing critical environment variables
if (!env.DATABASE_URL) {
    console.error('❌ Missing required DATABASE_URL environment variable');
    throw new Error('Missing required DATABASE_URL environment variable');
}
if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !env.CLERK_SECRET_KEY) {
    console.error('❌ Missing required Clerk authentication keys');
    throw new Error('Missing required Clerk authentication keys');
}
if (!env.OPENAI_API_KEY) {
    console.error('❌ Missing required OpenAI API key');
    throw new Error('Missing required OpenAI API key');
}
if (!env.YOUTUBE_API_KEY) {
    console.error('❌ Missing required YouTube API key');
    throw new Error('Missing required YouTube API key');
}
if (!env.POLAR_WEBHOOK_SECRET || !env.POLAR_ACCESS_TOKEN) {
    console.error('❌ Missing required Polar payment credentials');
    throw new Error('Missing required Polar payment credentials');
}
exports.default = env;
