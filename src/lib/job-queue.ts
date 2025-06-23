import { createLogger } from './logger';

const logger = createLogger('job-queue');

export type JobData = {
  videoId: string;
  videoDbId: string;
  summaryDbId: string;
  userId: string;
  userEmail: string;
  user: { id: string; email: string; name?: string };
  metadata: any;
  totalDurationSeconds: number;
  creditsNeeded: number;
};

// DB-based addJobToQueue
export async function addJobToQueue(data: JobData): Promise<{ jobId: string }> {
  const { executeQuery } = await import('./db');
  await executeQuery(async (sql) => {
    await sql`
      INSERT INTO video_summaries (id, video_id, main_title, overall_summary, processing_status, created_at, updated_at, raw_ai_output, transcript_sent, prompt_tokens, completion_tokens, total_tokens, input_cost, output_cost, total_cost, video_duration_seconds, job_data)
      VALUES (${data.summaryDbId}, ${data.videoDbId}, ${data.metadata.title}, '', 'queued', NOW(), NOW(), '', '', 0, 0, 0, 0, 0, 0, ${data.totalDurationSeconds}, ${JSON.stringify(data)})
      ON CONFLICT (id) DO UPDATE SET job_data = EXCLUDED.job_data
    `;
  });
  logger.info('✅ Job added to DB queue', { jobId: data.summaryDbId, videoId: data.videoId, userId: data.userId, email: data.userEmail });
  return { jobId: data.summaryDbId };
}

// DB-based getJobById
export async function getJobById(jobId: string): Promise<any | null> {
  const { executeQuery } = await import('./db');
  const jobs = await executeQuery(async (sql) => {
    return await sql`SELECT * FROM video_summaries WHERE id = ${jobId}`;
  });
  if (jobs.length === 0) return null;
  return jobs[0];
}

// Configurable polling interval (default: 60s)
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS
  ? parseInt(process.env.POLL_INTERVAL_MS, 10)
  : 60000; // 60 seconds

export async function startSimpleWorker(
  processor: (jobData: JobData) => Promise<void>,
  shouldStop: () => boolean = () => false
): Promise<void> {
  console.log('🚨 ENTERED startSimpleWorker');
  logger.info('🚀 Starting production-grade DB polling worker...');
  try {
    const pollForJobs = async () => {
      let pollCount = 0;
      let emptyPolls = 0;
      const MAX_EMPTY_POLLS = 5; // Stop after 5 empty polls
      logger.info('🎯 POLLING LOOP STARTED - this should appear in logs!');
      while (!shouldStop()) {
        pollCount++;
        try {
          logger.info('🔍 Polling database for queued jobs...', { pollCount, userId: undefined, email: undefined });
          logger.info('🔍 [job-queue] About to execute database query for queued jobs...');
          const { executeQuery } = await import('./db');
          let queuedJobs;
          try {
            queuedJobs = await executeQuery(async (sql: any) => {
              return await sql`
                SELECT vs.id as summary_id, vs.video_id as video_db_id, v.video_id as youtube_video_id, v.user_id, v.title, vs.job_data
                FROM video_summaries vs
                JOIN videos v ON vs.video_id = v.id
                WHERE vs.processing_status = 'queued'
                ORDER BY vs.created_at ASC
                LIMIT 1;
              `;
            });
            logger.info('[job-queue] DB query result', { result: queuedJobs });
          } catch (dbError) {
            logger.error('[job-queue] DB query failed', { error: dbError instanceof Error ? dbError.message : dbError });
            throw dbError;
          }
          logger.info('DEBUG: queuedJobs', {
            type: typeof queuedJobs,
            isArray: Array.isArray(queuedJobs),
            keys: Object.keys(queuedJobs || {}),
            value: queuedJobs
          });
          logger.info('DEBUG: jobsArr.length', { length: queuedJobs.length });
          logger.info('DEBUG: emptyPolls', { emptyPolls, MAX_EMPTY_POLLS });
          if (!queuedJobs || queuedJobs.length === 0) {
            emptyPolls++;
            logger.info(`DEBUG: Incremented emptyPolls to ${emptyPolls}`);
            if (emptyPolls >= MAX_EMPTY_POLLS) {
              logger.info('🚨 Worker is about to exit after max empty polls!');
              setTimeout(() => process.exit(0), 1000); // Give logs time to flush
            }
          } else {
            emptyPolls = 0; // Reset if job found
          }
          if (queuedJobs.length > 0) {
            const job = queuedJobs[0];
            logger.info('🟢 Found queued job in DB, starting processing...', job);
            let reconstructedJobData: JobData | null = null;
            if (job.job_data) {
              try {
                reconstructedJobData = typeof job.job_data === 'string' ? JSON.parse(job.job_data) : job.job_data;
              } catch (e) {
                logger.error('❌ Failed to parse job_data JSON', { error: e, job_data: job.job_data, userId: undefined, email: undefined });
              }
            }
            if (reconstructedJobData) {
              logger.info('✅ Using job_data from DB', reconstructedJobData);
              // Fail-fast: skip jobs with missing userId or userEmail
              if (!reconstructedJobData.userId || !reconstructedJobData.userEmail) {
                logger.error('❌ Skipping job: userId or userEmail missing in job_data', { jobId: job.summary_id, jobData: reconstructedJobData, userId: reconstructedJobData.userId, email: reconstructedJobData.userEmail });
                // Mark job as failed in DB
                await executeQuery(async (sql) => {
                  await sql`UPDATE video_summaries SET processing_status = 'failed' WHERE id = ${job.summary_id}`;
                });
                return;
              }
              // Assert videoId is not a UUID (DB ID)
              if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reconstructedJobData.videoId)) {
                logger.error('❌ reconstructedJobData.videoId is a UUID, not a YouTube ID! This will cause SupaData 404.', { videoId: reconstructedJobData.videoId, videoDbId: reconstructedJobData.videoDbId, userId: reconstructedJobData.userId });
                throw new Error('reconstructedJobData.videoId is a UUID, not a YouTube ID!');
              }
              // Assert videoDbId is a UUID
              if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reconstructedJobData.videoDbId)) {
                logger.error('❌ reconstructedJobData.videoDbId is not a UUID! This will break DB relations.', { videoId: reconstructedJobData.videoId, videoDbId: reconstructedJobData.videoDbId, userId: reconstructedJobData.userId });
                throw new Error('reconstructedJobData.videoDbId is not a UUID!');
              }
            }
            if (!reconstructedJobData) {
              // Fallback for legacy jobs - use data from polling query
              logger.warn('⚠️ Using legacy job reconstruction path (job_data is null)');
              
              // We already have the YouTube video ID from the polling query
              if (job.youtube_video_id) {
                // Get additional details
                const jobDetails = await executeQuery(async (sql) => {
                  return await sql`
                    SELECT v.video_id as youtube_video_id, v.id as video_db_id, vs.id as summary_id, vs.main_title as title, vs.video_duration_seconds as duration, v.channel_title, v.thumbnail_url, v.user_id, vs.processing_status, u.email, u.full_name
                    FROM videos v
                    JOIN video_summaries vs ON v.id = vs.video_id
                    LEFT JOIN users u ON v.user_id = u.id
                    WHERE vs.id = ${job.summary_id}
                  `;
                });
                logger.info('RAW jobDetails:', jobDetails);
                if (jobDetails.length > 0) {
                  const details = jobDetails[0];
                  reconstructedJobData = {
                    videoId: job.youtube_video_id, // USE THE YOUTUBE_VIDEO_ID FROM POLLING QUERY!
                    videoDbId: job.video_db_id,    // This is the database UUID
                    summaryDbId: job.summary_id,
                    userId: details.user_id,
                    userEmail: details.email || 'unknown@example.com',
                    user: { id: details.user_id, email: details.email, name: details.full_name },
                    metadata: {
                      title: details.title,
                      duration: details.duration,
                      channelTitle: details.channel_title,
                      thumbnailUrl: details.thumbnail_url
                    },
                    totalDurationSeconds: details.duration || 0,
                    creditsNeeded: Math.max(1, Math.ceil((details.duration || 0) / 60))
                  };
                  logger.warn('⚠️ Legacy job reconstructed with YouTube ID from polling query', { reconstructedJobData, userId: undefined, email: undefined });
                } else {
                  logger.error('No job details found for summary_id', { summary_id: job.summary_id });
                }
              } else {
                logger.error('No youtube_video_id in polling query result', { job });
              }
            }
            if (reconstructedJobData) {
              // Update DB status to processing
              await executeQuery(async (sql) => {
                await sql`UPDATE video_summaries SET processing_status = 'processing' WHERE id = ${job.summary_id}`;
              });
              logger.info('🔄 Starting job processing', { videoId: reconstructedJobData.videoId, videoDbId: reconstructedJobData.videoDbId, userId: reconstructedJobData.userId, email: reconstructedJobData.userEmail });
              try {
                await processor(reconstructedJobData);
                await executeQuery(async (sql) => {
                  await sql`UPDATE video_summaries SET processing_status = 'completed' WHERE id = ${job.summary_id}`;
                });
                logger.info('✅ Job processing completed successfully', { videoId: reconstructedJobData.videoId, videoDbId: reconstructedJobData.videoDbId, userId: reconstructedJobData.userId, email: reconstructedJobData.userEmail });
              } catch (jobError) {
                await executeQuery(async (sql) => {
                  await sql`UPDATE video_summaries SET processing_status = 'failed' WHERE id = ${job.summary_id}`;
                });
                logger.error('❌ Job processing failed', { videoId: reconstructedJobData.videoId, videoDbId: reconstructedJobData.videoDbId, error: jobError instanceof Error ? jobError.message : String(jobError), userId: reconstructedJobData.userId, email: reconstructedJobData.userEmail });
              }
            } else {
              logger.error('❌ No valid job data found for processing. Skipping job.', { job });
            }
          }
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (pollError) {
          logger.error('Error polling for jobs', { error: pollError instanceof Error ? pollError.message : String(pollError), pollCount, userId: undefined, email: undefined });
          console.error('Error polling for jobs', pollError);
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
      logger.info('🛑 Worker stopped polling (shutdown requested or idle).');
    };
    logger.info('✅ DB polling worker initialized, starting polling loop...');
    await pollForJobs();
  } catch (error) {
    logger.error('❌ Critical error starting DB polling worker', { error: error instanceof Error ? error.message : String(error), userId: undefined, email: undefined });
    console.error('❌ Critical error starting DB polling worker', error);
    setTimeout(() => process.exit(1), 1000);
  }
}