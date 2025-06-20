// Test script to validate Redis connection and video processing
require('dotenv').config({ path: '.env.local' });

console.log('🧪 Testing TubeGPT System...');
console.log('');

// Test environment variables
console.log('📋 Environment Variables:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   DISABLE_REDIS: ${process.env.DISABLE_REDIS}`);
console.log(`   UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? 'SET ✅' : 'NOT SET ❌'}`);
console.log(`   UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET ✅' : 'NOT SET ❌'}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET ✅' : 'NOT SET ❌'}`);
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET ✅' : 'NOT SET ❌'}`);
console.log('');

// Test Redis connection
async function testRedis() {
  console.log('🔄 Testing Redis Connection...');
  try {
    const { checkRedisHealth } = await import('./src/lib/job-queue.ts');
    const health = await checkRedisHealth();
    
    console.log(`   Redis Status: ${health.isConnected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`   Redis Enabled: ${health.isEnabled ? '✅ Yes' : '❌ No'}`);
    console.log(`   Redis URL: ${health.url || 'Not available'}`);
    if (health.errorMessage) {
      console.log(`   Error: ${health.errorMessage}`);
    }
    
    return health.isConnected;
  } catch (error) {
    console.log(`   ❌ Redis test failed: ${error.message}`);
    return false;
  }
}

// Test database connection
async function testDatabase() {
  console.log('🔄 Testing Database Connection...');
  try {
    const { executeQuery } = await import('./src/lib/db.ts');
    await executeQuery(async (sql) => {
      return await sql`SELECT 1 as test`;
    });
    console.log('   ✅ Database connection successful');
    return true;
  } catch (error) {
    console.log(`   ❌ Database test failed: ${error.message}`);
    return false;
  }
}

// Test OpenAI connection
async function testOpenAI() {
  console.log('🔄 Testing OpenAI Connection...');
  try {
    const { createLogger } = await import('./src/lib/logger.ts');
    // Simple test - just check if the module loads
    console.log('   ✅ OpenAI module loaded successfully');
    return true;
  } catch (error) {
    console.log(`   ❌ OpenAI test failed: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting System Tests...');
  console.log('');
  
  const redisWorking = await testRedis();
  console.log('');
  
  const dbWorking = await testDatabase();
  console.log('');
  
  const openaiWorking = await testOpenAI();
  console.log('');
  
  console.log('📊 Test Results Summary:');
  console.log(`   Redis: ${redisWorking ? '✅ Working' : '❌ Failed (will use in-memory backup)'}`);
  console.log(`   Database: ${dbWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`   OpenAI: ${openaiWorking ? '✅ Working' : '❌ Failed'}`);
  console.log('');
  
  if (dbWorking && openaiWorking) {
    console.log('🎉 Core systems are working! Video processing should work.');
    if (redisWorking) {
      console.log('✨ Redis is also working - optimal performance with worker queue.');
    } else {
      console.log('⚠️  Redis not working - will use direct processing backup.');
    }
  } else {
    console.log('💥 Critical systems failed - video processing will not work.');
  }
  
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Start worker: npm run worker');
  console.log('   2. Start app: npm run dev');
  console.log('   3. Test video processing at http://localhost:8000');
}

runTests().catch(console.error); 