/**
 * Development Environment Startup Script
 * 
 * This script starts both the Next.js app and the worker process
 * in development mode with proper environment configuration.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting TubeGPT development environment...');

// Check if .env.local exists
const envLocalPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envLocalPath)) {
  const devEnvPath = path.join(process.cwd(), 'dev.env');
  
  if (fs.existsSync(devEnvPath)) {
    console.log('⚠️  .env.local not found. Creating from dev.env template...');
    fs.copyFileSync(devEnvPath, envLocalPath);
    console.log('✅ Created .env.local from template. Please update with your actual credentials.');
  } else {
    console.error('❌ Neither .env.local nor dev.env found. Please create .env.local with required environment variables.');
    process.exit(1);
  }
}

// Set environment variables for child processes
const env = { ...process.env, NODE_ENV: 'development' };

// Start Next.js development server
console.log('🔧 Starting Next.js development server...');
const nextApp = spawn('npm', ['run', 'dev'], { 
  stdio: 'inherit',
  shell: true,
  env
});

// Start worker process
console.log('🔧 Starting worker process...');
const worker = spawn('npm', ['run', 'dev-worker'], { 
  stdio: 'inherit',
  shell: true,
  env
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('👋 Shutting down development environment...');
  
  nextApp.kill();
  worker.kill();
  
  process.exit(0);
});

// Handle child process errors
nextApp.on('error', (error) => {
  console.error('❌ Next.js process error:', error);
});

worker.on('error', (error) => {
  console.error('❌ Worker process error:', error);
});

// Handle child process exit
nextApp.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Next.js process exited with code ${code}`);
  }
});

worker.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Worker process exited with code ${code}`);
  }
});

console.log('✅ Development environment started');
console.log('📝 Next.js app: http://localhost:8000');
console.log('📝 Worker process: Running in background');
console.log('📝 Press Ctrl+C to stop all processes'); 