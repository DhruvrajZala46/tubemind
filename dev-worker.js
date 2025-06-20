/**
 * Development Worker Process
 * 
 * This script runs the video processing worker in development mode
 * with proper environment configuration that matches production behavior.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

console.log('🚀 Starting TubeGPT worker process in development mode...');

// Check if we're on Windows - Redis often has permission issues on Windows
const isWindows = os.platform() === 'win32';
if (isWindows) {
  console.log('⚠️ Windows environment detected - Redis may have permission issues');
  console.log('💡 If Redis fails, you can set DISABLE_REDIS=true in .env.local to use in-memory processing');
  // Don't automatically disable Redis - let the user's .env.local settings take precedence
  // process.env.DISABLE_REDIS = 'true'; // COMMENTED OUT - Redis should work on Windows now
}

// Path to .env.local
const envPath = path.join(process.cwd(), '.env.local');

// Fix environment variables before starting the worker
function fixEnvironmentVariables() {
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found. Please create it before running the worker.');
    process.exit(1);
  }

  // Create a backup of the original file
  const backupPath = `${envPath}.backup-${Date.now()}`;
  fs.copyFileSync(envPath, backupPath);
  console.log(`📦 Created backup of .env.local at ${backupPath}`);
  
  // Read the file
  let content = fs.readFileSync(envPath, 'utf8');
  let modified = false;
  
  // Fix Redis URL quotes
  if (content.includes("REDIS_URL='") || content.includes('REDIS_URL="')) {
    console.log('⚠️ REDIS_URL has quotes that may cause connection issues');
    content = content.replace(/REDIS_URL=['"](.+?)['"]/, 'REDIS_URL=$1');
    modified = true;
    console.log('✅ Removed quotes from REDIS_URL');
  }
  
  // Fix Upstash Redis URL quotes
  if (content.includes("UPSTASH_REDIS_REST_URL='") || content.includes('UPSTASH_REDIS_REST_URL="')) {
    console.log('⚠️ UPSTASH_REDIS_REST_URL has quotes that may cause connection issues');
    content = content.replace(/UPSTASH_REDIS_REST_URL=['"](.+?)['"]/, 'UPSTASH_REDIS_REST_URL=$1');
    modified = true;
    console.log('✅ Removed quotes from UPSTASH_REDIS_REST_URL');
  }
  
  // Fix Upstash Redis token quotes
  if (content.includes("UPSTASH_REDIS_REST_TOKEN='") || content.includes('UPSTASH_REDIS_REST_TOKEN="')) {
    console.log('⚠️ UPSTASH_REDIS_REST_TOKEN has quotes that may cause connection issues');
    content = content.replace(/UPSTASH_REDIS_REST_TOKEN=['"](.+?)['"]/, 'UPSTASH_REDIS_REST_TOKEN=$1');
    modified = true;
    console.log('✅ Removed quotes from UPSTASH_REDIS_REST_TOKEN');
  }
  
  // COMMENTED OUT - Don't automatically disable Redis on Windows anymore
  // Add DISABLE_REDIS flag for Windows if not already present
  // if (isWindows && !content.includes('DISABLE_REDIS=')) {
  //   console.log('⚠️ Adding DISABLE_REDIS=true for Windows environment');
  //   content += '\nDISABLE_REDIS=true\n';
  //   modified = true;
  //   console.log('✅ Added DISABLE_REDIS=true to environment');
  // }
  
  // Save changes if needed
  if (modified) {
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('✅ Updated environment variables in .env.local');
  } else {
    console.log('✅ No issues found in environment variables');
  }
  
  console.log('✅ Environment variable fix completed');
}

// Run the environment variable fix
try {
  // First try to run the full fix-env.js script if it exists
  if (fs.existsSync(path.join(process.cwd(), 'fix-env.js'))) {
    console.log('🔧 Running environment variable fixes...');
    require('./fix-env');
  } else {
    // Otherwise use the built-in fix
    fixEnvironmentVariables();
  }
} catch (error) {
  console.error('❌ Error fixing environment variables:', error);
  // Continue anyway to allow the worker to start
}

// Set worker port if not already set
if (!process.env.WORKER_PORT) {
  process.env.WORKER_PORT = '8002';
}

// Set development mode flag
process.env.NODE_ENV = 'development';

// Start the worker process
console.log('🔄 Starting worker process...');

// Create a child process to run the worker
const worker = spawn('npm', ['run', 'worker'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

console.log('⏳ Worker is running. Press Ctrl+C to stop.');

// Handle worker process events
worker.on('error', (error) => {
  console.error('❌ Failed to start worker process:', error);
});

worker.on('close', (code) => {
  if (code !== 0) {
    console.log(`👋 Worker process exited with code ${code}`);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('👋 Shutting down worker process...');
  worker.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('👋 Shutting down worker process...');
  worker.kill('SIGTERM');
  process.exit(0); 
});