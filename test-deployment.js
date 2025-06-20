// Test script for deployment fixes
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing deployment fixes...');

// Set environment variables for testing
process.env.NODE_ENV = 'development';
process.env.LEAPCELL = 'true';
process.env.DEPLOYMENT_ENV = 'leapcell';

// Test env.js
console.log('\n📋 Testing environment handling...');
try {
  // Check if the env.ts file has Leapcell environment detection
  const envPath = path.join(__dirname, 'src', 'lib', 'env.ts');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('LEAPCELL') || envContent.includes('isLeapcellEnvironment')) {
    console.log('✅ env.ts has Leapcell environment handling');
  } else {
    console.log('⚠️ env.ts might not have proper Leapcell environment handling');
  }
} catch (error) {
  console.error('❌ env.ts error:', error.message);
}

// Test job-queue.ts
console.log('\n📋 Testing job queue handling...');
try {
  // Check if the job-queue.ts file has in-memory fallback
  const jobQueuePath = path.join(__dirname, 'src', 'lib', 'job-queue.ts');
  const jobQueueContent = fs.readFileSync(jobQueuePath, 'utf8');
  
  if (jobQueueContent.includes('inMemoryQueue') || jobQueueContent.includes('isUsingInMemory')) {
    console.log('✅ job-queue.ts has in-memory queue fallback');
  } else {
    console.log('⚠️ job-queue.ts might not have proper in-memory fallback');
  }
} catch (error) {
  console.error('❌ job-queue.ts error:', error.message);
}

// Test rate-limit.ts
console.log('\n📋 Testing rate limiting handling...');
try {
  // Check if the rate-limit.ts file has error handling
  const rateLimitPath = path.join(__dirname, 'src', 'lib', 'rate-limit.ts');
  const rateLimitContent = fs.readFileSync(rateLimitPath, 'utf8');
  
  if (rateLimitContent.includes('try') && rateLimitContent.includes('catch')) {
    console.log('✅ rate-limit.ts has error handling');
  } else {
    console.log('⚠️ rate-limit.ts might not have proper error handling');
  }
} catch (error) {
  console.error('❌ rate-limit.ts error:', error.message);
}

// Test worker/extract.ts
console.log('\n📋 Testing worker handling...');
try {
  // Check if the worker/extract.ts file has Leapcell environment handling
  const workerPath = path.join(__dirname, 'src', 'worker', 'extract.ts');
  const workerContent = fs.readFileSync(workerPath, 'utf8');
  
  if (workerContent.includes('LEAPCELL') || workerContent.includes('isLeapcellEnvironment')) {
    console.log('✅ worker/extract.ts has Leapcell environment handling');
  } else {
    console.log('⚠️ worker/extract.ts might not have proper Leapcell environment handling');
  }
} catch (error) {
  console.error('❌ worker/extract.ts error:', error.message);
}

// Test middleware.ts
console.log('\n📋 Testing middleware handling...');
try {
  // Check if the middleware.ts file has Clerk middleware
  const middlewarePath = path.join(__dirname, 'src', 'middleware.ts');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  if (middlewareContent.includes('clerkMiddleware')) {
    console.log('✅ middleware.ts uses Clerk middleware');
  } else {
    console.log('⚠️ middleware.ts might not be using Clerk middleware correctly');
  }
} catch (error) {
  console.error('❌ middleware.ts error:', error.message);
}

// Check for documentation files
console.log('\n📋 Testing documentation...');
try {
  const deploymentGuidePath = path.join(__dirname, 'DEPLOYMENT_GUIDE.md');
  if (fs.existsSync(deploymentGuidePath)) {
    console.log('✅ DEPLOYMENT_GUIDE.md exists');
  } else {
    console.log('⚠️ DEPLOYMENT_GUIDE.md is missing');
  }
  
  const fixesSummaryPath = path.join(__dirname, 'FIXES_SUMMARY.md');
  if (fs.existsSync(fixesSummaryPath)) {
    console.log('✅ FIXES_SUMMARY.md exists');
  } else {
    console.log('⚠️ FIXES_SUMMARY.md is missing');
  }
} catch (error) {
  console.error('❌ Documentation error:', error.message);
}

console.log('\n🎯 TEST RESULTS SUMMARY:');
console.log('========================');
console.log('The tests verify that our deployment fixes are in place.');
console.log('For a complete end-to-end test, you would need to deploy to Leapcell.');
console.log('========================');
console.log('📋 DEPLOYMENT CHECKLIST:');
console.log('1. Make sure middleware.ts is using clerkMiddleware correctly');
console.log('2. Ensure env.ts detects Leapcell environment');
console.log('3. Verify job-queue.ts falls back to in-memory queue in Leapcell');
console.log('4. Check that rate-limit.ts handles Redis connection issues gracefully');
console.log('5. Confirm worker/extract.ts loads environment variables correctly'); 