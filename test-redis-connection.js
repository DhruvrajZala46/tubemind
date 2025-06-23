const { Redis } = require('@upstash/redis');

async function testRedisConnection() {
  console.log('🔍 REDIS CONNECTION DIAGNOSTIC TEST');
  console.log('====================================');
  
  // Check environment variables
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  console.log('📋 Environment Variables:');
  console.log(`UPSTASH_REDIS_REST_URL: ${url ? `✅ SET (${url.substring(0, 30)}...)` : '❌ NOT SET'}`);
  console.log(`UPSTASH_REDIS_REST_TOKEN: ${token ? `✅ SET (${token.substring(0, 20)}...)` : '❌ NOT SET'}`);
  
  if (!url || !token) {
    console.log('❌ CRITICAL: Redis credentials missing!');
    console.log('👉 Add these to Google Cloud Run environment variables:');
    console.log('   - UPSTASH_REDIS_REST_URL');
    console.log('   - UPSTASH_REDIS_REST_TOKEN');
    return false;
  }
  
  try {
    console.log('\n🔗 Testing Redis connection...');
    const redis = new Redis({ url, token });
    
    const startTime = Date.now();
    const pingResult = await redis.ping();
    const endTime = Date.now();
    
    if (pingResult === 'PONG') {
      console.log(`✅ REDIS CONNECTION SUCCESSFUL! (${endTime - startTime}ms)`);
      
      // Test basic operations
      console.log('\n🧪 Testing basic Redis operations...');
      
      const testKey = `test:${Date.now()}`;
      await redis.set(testKey, 'test-value', { ex: 10 });
      const getValue = await redis.get(testKey);
      
      if (getValue === 'test-value') {
        console.log('✅ SET/GET operations working');
        
        // Test queue operations
        const queueName = 'test_queue';
        await redis.lpush(queueName, JSON.stringify({ test: 'data', timestamp: Date.now() }));
        const popResult = await redis.rpop(queueName);
        
        if (popResult) {
          console.log('✅ QUEUE operations working');
          console.log('🎉 REDIS IS FULLY FUNCTIONAL!');
          return true;
        } else {
          console.log('❌ Queue operations failed');
          return false;
        }
      } else {
        console.log('❌ SET/GET operations failed');
        return false;
      }
    } else {
      console.log(`❌ REDIS PING FAILED: ${pingResult}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ REDIS CONNECTION FAILED: ${error.message}`);
    console.log('Full error:', error);
    return false;
  }
}

// Run the test
testRedisConnection()
  .then(success => {
    if (success) {
      console.log('\n🚀 REDIS READY FOR INSTANT PROCESSING!');
      process.exit(0);
    } else {
      console.log('\n❌ REDIS NOT WORKING - WILL USE SLOW DATABASE POLLING');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }); 