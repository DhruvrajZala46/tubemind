const { neon } = require('@neondatabase/serverless');

async function checkJobs() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('🔍 Checking for queued jobs...');
  const jobs = await sql`
    SELECT vs.id as summary_id, vs.processing_status, v.video_id, v.title, vs.created_at
    FROM video_summaries vs
    JOIN videos v ON vs.video_id = v.id  
    WHERE vs.processing_status = 'queued'
    ORDER BY vs.created_at DESC
    LIMIT 5
  `;
  
  console.log(`Found ${jobs.length} queued jobs:`, jobs);
  
  // Also check Redis for pending jobs
  console.log('\n🔍 Checking Redis for pending jobs...');
  const { Redis } = require('@upstash/redis');
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  
  for (const job of jobs) {
    const pendingKey = `video-processing:pending:${job.summary_id}`;
    const pendingData = await redis.get(pendingKey);
    console.log(`Job ${job.summary_id}: ${pendingData ? 'HAS' : 'NO'} Redis data`);
  }
}

checkJobs().catch(console.error); 