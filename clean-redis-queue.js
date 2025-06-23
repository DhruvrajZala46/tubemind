const { Redis } = require('@upstash/redis');

async function cleanRedisQueue() {
  console.log('🧹 CLEANING REDIS QUEUE');
  console.log('======================');
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.log('❌ Redis credentials not set');
    return false;
  }
  
  try {
    const redis = new Redis({ url, token });
    
    // Test connection
    const pingResult = await redis.ping();
    if (pingResult !== 'PONG') {
      console.log('❌ Redis connection failed');
      return false;
    }
    
    console.log('✅ Redis connected successfully');
    
    // Clear all queue data to start fresh
    const queueName = 'video_processing_jobs';
    const processingSet = 'processing_jobs';
    const failedSet = 'failed_jobs';
    
    console.log('\n🗑️ Clearing queue data...');
    
    // Get queue length before clearing
    const queueLength = await redis.llen(queueName);
    const processingCount = await redis.scard(processingSet);
    const failedCount = await redis.scard(failedSet);
    
    console.log(`📊 Found: ${queueLength} queued jobs, ${processingCount} processing, ${failedCount} failed`);
    
    if (queueLength > 0) {
      await redis.del(queueName);
      console.log(`✅ Cleared ${queueLength} jobs from queue`);
    }
    
    if (processingCount > 0) {
      await redis.del(processingSet);
      console.log(`✅ Cleared ${processingCount} processing jobs`);
    }
    
    if (failedCount > 0) {
      await redis.del(failedSet);
      console.log(`✅ Cleared ${failedCount} failed jobs`);
    }
    
    // Clear any job hash data
    const keys = await redis.keys('job:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`✅ Cleared ${keys.length} job metadata entries`);
    }
    
    console.log('\n🎉 Redis queue cleaned successfully!');
    console.log('   - All corrupted data removed');
    console.log('   - Ready for fresh job processing');
    console.log('   - No more JSON parsing errors');
    
    return true;
    
  } catch (error) {
    console.log(`❌ Cleanup failed: ${error.message}`);
    return false;
  }
}

// Run cleanup
cleanRedisQueue()
  .then(success => {
    if (success) {
      console.log('\n🚀 Redis queue is now clean and ready!');
      process.exit(0);
    } else {
      console.log('\n❌ Cleanup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  }); 