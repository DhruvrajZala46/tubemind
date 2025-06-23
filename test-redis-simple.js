console.log('🚀 Testing Redis Queue Implementation');
console.log('=====================================');

async function testBasics() {
  try {
    // Test environment variables
    console.log('\n1️⃣ Environment Variables');
    console.log(`UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? 'SET ✅' : 'NOT SET ❌'}`);
    console.log(`UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET ✅' : 'NOT SET ❌'}`);
    
    // Test if Upstash SDK is installed
    console.log('\n2️⃣ Dependencies');
    try {
      require('@upstash/redis');
      console.log('✅ @upstash/redis package found');
    } catch (e) {
      console.log('❌ @upstash/redis package missing');
      return;
    }

    // Test basic Redis connection if credentials are available
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.log('\n3️⃣ Redis Connection Test');
      const { Redis } = require('@upstash/redis');
      
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      try {
        const result = await redis.ping();
        console.log(`✅ Redis PING: ${result}`);
        
        // Test basic operations
        await redis.set('test_key', 'test_value');
        const value = await redis.get('test_key');
        console.log(`✅ Redis SET/GET test: ${value}`);
        
        // Clean up
        await redis.del('test_key');
        console.log('✅ Redis cleanup completed');
        
      } catch (error) {
        console.log(`❌ Redis connection failed: ${error.message}`);
      }
    } else {
      console.log('\n3️⃣ Redis Connection Test');
      console.log('⚠️ Skipping Redis test (credentials not set)');
      console.log('   To test Redis, set:');
      console.log('   - UPSTASH_REDIS_REST_URL');
      console.log('   - UPSTASH_REDIS_REST_TOKEN');
    }

    console.log('\n📊 SUMMARY');
    console.log('===========');
    console.log('✅ Basic tests completed');
    console.log('📋 NEXT STEPS:');
    console.log('1. Set up Upstash Redis if not done yet');
    console.log('2. Run: npm run build');
    console.log('3. Run: npm run worker');
    console.log('4. Test video processing');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testBasics(); 