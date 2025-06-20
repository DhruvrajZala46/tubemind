// Test script for Leapcell environment fixes
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Leapcell environment fixes...');

// Set environment variables for testing
process.env.NODE_ENV = 'development';
process.env.LEAPCELL = 'true';
process.env.DEPLOYMENT_ENV = 'leapcell';

// Test env.ts
console.log('\n📋 Testing environment handling in env.ts...');
try {
  const envModule = require('./src/lib/env');
  console.log('✅ env.ts loaded successfully');
  console.log('Environment variables:');
  console.log(`- NODE_ENV: ${envModule.NODE_ENV}`);
  console.log(`- LEAPCELL: ${process.env.LEAPCELL}`);
  console.log(`- DEPLOYMENT_ENV: ${process.env.DEPLOYMENT_ENV}`);
  console.log(`- Is Leapcell environment: ${envModule.isLeapcellEnvironment ? 'Yes' : 'No'}`);
} catch (error) {
  console.error('❌ env.ts error:', error.message);
}

// Test job-queue.ts
console.log('\n📋 Testing job queue in job-queue.ts...');
try {
  const { createJobProcessor } = require('./src/lib/job-queue');
  const jobProcessor = createJobProcessor();
  console.log('✅ job-queue.ts loaded successfully');
  console.log(`- Using in-memory queue: ${jobProcessor.isUsingInMemory ? 'Yes' : 'No'}`);
  console.log(`- Queue type: ${jobProcessor.queueType}`);
} catch (error) {
  console.error('❌ job-queue.ts error:', error.message);
}

// Test rate-limit.ts
console.log('\n📋 Testing rate limiting in rate-limit.ts...');
try {
  const { rateLimiter } = require('./src/lib/rate-limit');
  console.log('✅ rate-limit.ts loaded successfully');
  // Create a mock request
  const mockRequest = {
    ip: '127.0.0.1',
    nextUrl: {
      pathname: '/api/test'
    }
  };
  console.log('- Rate limiter initialized without errors');
} catch (error) {
  console.error('❌ rate-limit.ts error:', error.message);
}

// Test worker/extract.ts
console.log('\n📋 Testing worker in worker/extract.ts...');
try {
  // We don't want to actually run the worker, just check if it loads
  const workerPath = path.join(__dirname, 'src', 'worker', 'extract.ts');
  const workerContent = fs.readFileSync(workerPath, 'utf8');
  
  // Check for Leapcell environment handling
  if (workerContent.includes('LEAPCELL') || workerContent.includes('isLeapcellEnvironment')) {
    console.log('✅ worker/extract.ts has Leapcell environment handling');
  } else {
    console.log('⚠️ worker/extract.ts might not have proper Leapcell environment handling');
  }
} catch (error) {
  console.error('❌ worker/extract.ts error:', error.message);
}

// Test middleware.ts
console.log('\n📋 Testing middleware in middleware.ts...');
try {
  const middlewarePath = path.join(__dirname, 'src', 'middleware.ts');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check for Clerk middleware
  if (middlewareContent.includes('clerkMiddleware')) {
    console.log('✅ middleware.ts uses Clerk middleware');
  } else {
    console.log('⚠️ middleware.ts might not be using Clerk middleware correctly');
  }
} catch (error) {
  console.error('❌ middleware.ts error:', error.message);
}

console.log('\n🎯 TEST RESULTS SUMMARY:');
console.log('========================');
console.log('The tests verify that our fixes for Leapcell environment are in place.');
console.log('For a complete end-to-end test, you would need to deploy to Leapcell.');
console.log('========================');
console.log('📋 DEPLOYMENT CHECKLIST:');
console.log('1. Make sure middleware.ts is using clerkMiddleware correctly');
console.log('2. Ensure env.ts detects Leapcell environment');
console.log('3. Verify job-queue.ts falls back to in-memory queue in Leapcell');
console.log('4. Check that rate-limit.ts handles Redis connection issues gracefully');
console.log('5. Confirm worker/extract.ts loads environment variables correctly'); 