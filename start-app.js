/**
 * Universal TubeGPT Application Starter
 * 
 * This script starts the entire TubeGPT application (Next.js + Worker)
 * in a consistent way across all environments (development and production).
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

// ============= CONFIGURATION =============

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isLeapcell = process.env.LEAPCELL === 'true' || process.env.DEPLOYMENT_ENV === 'leapcell';

// Set default ports with fallbacks
const NEXT_PORT = process.env.PORT || (isProduction ? 3000 : 8000);
const WORKER_PORT = process.env.WORKER_PORT || 8002;

// Banner
console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║            TubeGPT Application             ║
║                                            ║
╟────────────────────────────────────────────╢
║ Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}                  ║
║ Leapcell: ${isLeapcell ? 'YES' : 'NO'}                            ║
║ Next.js Port: ${NEXT_PORT}                         ║
║ Worker Port: ${WORKER_PORT}                         ║
╚════════════════════════════════════════════╝
`);

// ============= ENVIRONMENT SETUP =============

// Load environment variables
function setupEnvironment() {
  // Set environment variables for child processes
  process.env.NODE_ENV = NODE_ENV;
  process.env.PORT = NEXT_PORT;
  process.env.WORKER_PORT = WORKER_PORT;

  // Check if .env.local exists
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envLocalPath)) {
    const devEnvPath = path.join(process.cwd(), 'dev.env');
    
    if (fs.existsSync(devEnvPath)) {
      console.log('⚠️  .env.local not found. Creating from dev.env template...');
      fs.copyFileSync(devEnvPath, envLocalPath);
      console.log('✅ Created .env.local from template. Please update with your actual credentials.');
    } else {
      console.warn('⚠️ Neither .env.local nor dev.env found. Environment variables may be missing.');
    }
  }

  // Load environment variables
  if (fs.existsSync(envLocalPath)) {
    console.log('📋 Loading environment variables from .env.local');
    dotenv.config({ path: envLocalPath });
  }

  // Fix environment variables
  fixEnvironmentVariables();
}

// Fix common environment variable issues
function fixEnvironmentVariables() {
  console.log('🔧 Fixing environment variables...');
  
  // Fix Redis URL quotes
  if (process.env.REDIS_URL) {
    if (process.env.REDIS_URL.startsWith('"') && process.env.REDIS_URL.endsWith('"')) {
      process.env.REDIS_URL = process.env.REDIS_URL.slice(1, -1);
      console.log('✅ Fixed quotes in REDIS_URL');
    }
  }

  // Fix Database URL quotes
  if (process.env.DATABASE_URL) {
    if (process.env.DATABASE_URL.startsWith('"') && process.env.DATABASE_URL.endsWith('"')) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.slice(1, -1);
      console.log('✅ Fixed quotes in DATABASE_URL');
    }
  }

  // Save fixed variables back to .env.local if in development
  if (!isProduction && !isLeapcell) {
    try {
      const fixEnvPath = path.join(process.cwd(), 'fix-env.js');
      if (fs.existsSync(fixEnvPath)) {
        require(fixEnvPath);
      }
    } catch (error) {
      console.warn('⚠️ Error running fix-env.js:', error.message);
    }
  }
}

// ============= PROCESS MANAGEMENT =============

// Start Next.js server
function startNextApp() {
  console.log('🔧 Starting Next.js server...');
  
  const nextCommand = isProduction ? 'start' : 'dev';
  const nextApp = spawn('npm', ['run', nextCommand], { 
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  nextApp.on('error', (error) => {
    console.error('❌ Next.js process error:', error.message);
  });

  nextApp.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Next.js process exited with code ${code}`);
    }
  });

  return nextApp;
}

// Start worker process
function startWorker() {
  console.log('🔧 Starting worker process...');
  
  const workerCommand = isProduction ? 'worker:prod' : 'worker';
  const worker = spawn('npm', ['run', workerCommand], { 
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  worker.on('error', (error) => {
    console.error('❌ Worker process error:', error.message);
  });

  worker.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Worker process exited with code ${code}`);
      
      // Auto-restart worker in production
      if (isProduction) {
        console.log('🔄 Restarting worker process...');
        startWorker();
      }
    }
  });

  return worker;
}

// ============= MAIN EXECUTION =============

// Setup environment
setupEnvironment();

// Start processes
const nextApp = startNextApp();
const worker = startWorker();

// Handle process termination
process.on('SIGINT', () => {
  console.log('👋 Shutting down application...');
  
  nextApp.kill();
  worker.kill();
  
  process.exit(0);
});

console.log('✅ Application started');
console.log('📝 Next.js app: http://localhost:' + NEXT_PORT);
console.log('📝 Worker process: Running on port ' + WORKER_PORT);
console.log('📝 Press Ctrl+C to stop all processes'); 