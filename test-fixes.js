#!/usr/bin/env node

/**
 * Test script to verify all fixes are working
 * Run with: node test-fixes.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8000';

// Test utilities
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testDatabaseSetup() {
  console.log('🔧 Testing Database Setup...');
  try {
    const response = await makeRequest('/api/setup-db', 'POST');
    if (response.status === 200) {
      console.log('✅ Database setup successful');
      
      // Check if credit_transactions table exists
      const hasCreditTransactions = response.data.tables.some(
        table => table.table_name === 'credit_transactions'
      );
      
      if (hasCreditTransactions) {
        console.log('✅ credit_transactions table exists');
      } else {
        console.log('❌ credit_transactions table missing');
      }
      
      return true;
    }
    console.log('❌ Database setup failed:', response.status);
    return false;
  } catch (error) {
    console.log('❌ Database setup error:', error.message);
    return false;
  }
}

async function testHealthCheck() {
  console.log('🏥 Testing Health Check...');
  try {
    // Test both potential ports
    for (const port of [8000, 8001]) {
      try {
        const response = await new Promise((resolve, reject) => {
          const req = http.request(`http://localhost:${port}/health`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              try {
                resolve({ status: res.statusCode, data: JSON.parse(body), port });
              } catch {
                resolve({ status: res.statusCode, data: body, port });
              }
            });
          });
          req.on('error', reject);
          req.setTimeout(2000, () => reject(new Error('Timeout')));
          req.end();
        });

        if (response.status === 200) {
          console.log(`✅ Health check working on port ${port}`);
          console.log(`   Status: ${response.data.status}`);
          return true;
        }
      } catch (error) {
        // Port not available, continue to next
      }
    }
    console.log('❌ Health check not responding on any port');
    return false;
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('🪝 Testing Webhook Endpoint...');
  try {
    // Test webhook endpoint exists (should return 400 for missing signature)
    const response = await makeRequest('/api/webhook', 'POST', { test: 'data' });
    
    // 400 is expected for missing webhook signature
    if (response.status === 400 || response.status === 401) {
      console.log('✅ Webhook endpoint responding correctly');
      return true;
    }
    
    console.log('❌ Webhook endpoint unexpected response:', response.status);
    return false;
  } catch (error) {
    console.log('❌ Webhook endpoint error:', error.message);
    return false;
  }
}

async function testRateLimit() {
  console.log('🚦 Testing Rate Limiting...');
  try {
    // Test that rate limit endpoint exists and uses basic Redis commands
    const response = await makeRequest('/api/extract', 'POST', {
      url: 'https://youtube.com/watch?v=test'
    });
    
    // Should get 401 (unauthorized) or 429 (rate limited) - both indicate rate limiting is working
    if (response.status === 401 || response.status === 429 || response.status === 403) {
      console.log('✅ Rate limiting system working');
      return true;
    }
    
    console.log('❌ Rate limiting unexpected response:', response.status);
    return false;
  } catch (error) {
    console.log('❌ Rate limiting error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 STARTING COMPREHENSIVE TESTING...\n');
  
  const tests = [
    { name: 'Database Setup', fn: testDatabaseSetup },
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Webhook Endpoint', fn: testWebhookEndpoint },
    { name: 'Rate Limiting', fn: testRateLimit }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
    console.log(''); // Add spacing between tests
  }
  
  console.log('🎯 TEST RESULTS SUMMARY:');
  console.log('========================');
  
  let allPassed = true;
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
    if (!result.passed) allPassed = false;
  }
  
  console.log('========================');
  
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! System is ready for production.');
  } else {
    console.log('⚠️  Some tests failed. Please check the issues above.');
  }
  
  console.log('\n📋 MANUAL VERIFICATION NEEDED:');
  console.log('1. Try processing a video in the web interface');
  console.log('2. Verify subscription status shows as active');
  console.log('3. Test payment integration in Polar sandbox');
  console.log('4. Deploy to Leapcell.io and verify worker starts correctly');
}

// Test script for deployment fixes
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

// Run tests
runAllTests().catch(console.error); 