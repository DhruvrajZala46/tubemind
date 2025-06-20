/**
 * Production Startup Script
 * 
 * This script starts the TubeGPT application in production mode
 * with proper environment configuration and error handling.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

console.log('🚀 Starting TubeGPT in PRODUCTION mode...');

// Set production environment
process.env.NODE_ENV = 'production';

// Load environment variables from .env.local if available
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log('✅ Loading environment variables from .env.local');
  dotenv.config({ path: envPath });
} else {
  console.log('⚠️ No .env.local file found. Using system environment variables.');
}

// Validate critical environment variables
const requiredVars = [
  'DATABASE_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'YOUTUBE_API_KEY'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these variables in .env.local or in your environment before starting the application.');
  process.exit(1);
}

// Check for Redis configuration
if (!process.env.REDIS_URL && !process.env.UPSTASH_REDIS_REST_URL) {
  console.warn('⚠️ No Redis URL configured. The application will use in-memory processing.');
  console.warn('This is not recommended for production use with multiple instances.');
}

// Start Next.js in production mode
console.log('🔄 Starting Next.js server...');
const nextProcess = spawn('next', ['start'], {
  stdio: 'inherit',
  env: process.env
});

nextProcess.on('error', (err) => {
  console.error('❌ Failed to start Next.js server:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down Next.js server...');
  nextProcess.kill('SIGINT');
  process.exit(0);
});

// Start worker process if WORKER_ENABLED is set
if (process.env.WORKER_ENABLED === 'true') {
  console.log('🔄 Starting worker process...');
  
  // Start the worker process
  const workerProcess = spawn('bash', ['start-worker.sh'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  workerProcess.on('error', (err) => {
    console.error('❌ Failed to start worker process:', err);
  });
  
  // Handle worker process exit
  workerProcess.on('exit', (code) => {
    console.log(`Worker process exited with code ${code}`);
    if (code !== 0) {
      console.log('🔄 Restarting worker process...');
      // Restart worker process
      spawn('bash', ['start-worker.sh'], {
        stdio: 'inherit',
        detached: true,
        env: { ...process.env, NODE_ENV: 'production' }
      });
    }
  });
} else {
  console.log('ℹ️ Worker process not started. Set WORKER_ENABLED=true to start the worker.');
} 