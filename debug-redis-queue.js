/**
 * Debug script to manually add job to Redis and check queue status
 */

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://engaging-killdeer-29111.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'AnG3AAIgcDETALVB_CWi7XbIYNwwNlBOSN-66f46PXESyhIQQGboZg'
});

async function debugRedisQueue() {
  console.log('🔍 Redis Queue Debug Tool');
  console.log('========================\n');

  try {
    // Test Redis connection
    console.log('1️⃣ Testing Redis connection...');
    const pingResult = await redis.ping();
    console.log(`✅ Redis PING: ${pingResult}\n`);

    // Check current queue status
    console.log('2️⃣ Checking queue status...');
    const queueLength = await redis.llen('video-processing:jobs');
    console.log(`📊 Current queue length: ${queueLength} jobs\n`);

    // List all jobs in queue (non-destructive peek)
    console.log('3️⃣ Peeking at jobs in queue...');
    const jobs = await redis.lrange('video-processing:jobs', 0, -1);
    console.log(`📋 Jobs in queue: ${jobs.length}`);
    
    if (jobs.length > 0) {
      jobs.forEach((job, index) => {
        try {
          const parsed = JSON.parse(job);
          console.log(`   Job ${index + 1}: VideoID=${parsed.videoId}, UserID=${parsed.userId}, VideoDbId=${parsed.videoDbId}`);
        } catch (e) {
          console.log(`   Job ${index + 1}: [Parse Error] ${job.substring(0, 100)}...`);
        }
      });
    } else {
      console.log('   No jobs found in queue');
    }
    console.log('');

    // Check specific job status
    console.log('4️⃣ Checking recent job statuses...');
    const jobKeys = await redis.keys('video-processing:job:*');
    console.log(`🔑 Found ${jobKeys.length} job status keys`);
    
    for (const key of jobKeys.slice(0, 5)) { // Check first 5
      const jobInfo = await redis.hgetall(key);
      const jobId = key.replace('video-processing:job:', '');
      console.log(`   ${jobId}: ${jobInfo.status || 'unknown'} (created: ${jobInfo.created || 'unknown'})`);
    }
    console.log('');

    // Add a test job manually
    console.log('5️⃣ Adding test job to queue...');
    const testJob = {
      videoId: 'TEST123',
      videoDbId: 'test-db-id-' + Date.now(),
      summaryDbId: 'test-summary-id-' + Date.now(),
      userId: 'test-user',
      userEmail: 'test@example.com',
      user: { id: 'test-user', email: 'test@example.com' },
      metadata: { title: 'Test Video' },
      totalDurationSeconds: 120,
      creditsNeeded: 1
    };

    const jobData = JSON.stringify(testJob);
    await redis.lpush('video-processing:jobs', jobData);
    await redis.hset(`video-processing:job:${testJob.videoDbId}`, {
      id: testJob.videoDbId,
      data: jobData,
      status: 'queued',
      created: Date.now().toString()
    });

    console.log(`✅ Test job added: ${testJob.videoDbId}`);
    console.log('');

    // Final queue check
    console.log('6️⃣ Final queue status...');
    const finalQueueLength = await redis.llen('video-processing:jobs');
    console.log(`📊 Queue length after test: ${finalQueueLength} jobs`);
    
    console.log('\n🎯 Debug complete! Check worker logs to see if test job is picked up.');
    
  } catch (error) {
    console.error('❌ Redis debug error:', error.message);
  }
}

debugRedisQueue(); 