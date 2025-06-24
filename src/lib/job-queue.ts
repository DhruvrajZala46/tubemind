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
  youtubeUrl: string;
};

// Dynamic import for Cloud Tasks to avoid Vercel build issues
async function enqueueJobToCloudTasks(jobData: JobData): Promise<string> {
  try {
    // Only import when actually needed (server-side)
    const { enqueueJob } = await import('./cloud-tasks-queue');
    return await enqueueJob(jobData);
  } catch (error) {
    logger.error('Failed to import or use Cloud Tasks', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// Cloud Tasks-based addJobToQueue
export async function addJobToQueue(data: JobData): Promise<{ jobId: string; usedCloudTasks?: boolean }> {
  logger.info('🚀 Adding job to Cloud Tasks queue', { jobId: data.summaryDbId, videoId: data.videoId, userId: data.userId });
  
  try {
    // Use Cloud Tasks for job processing
    const taskName = await enqueueJobToCloudTasks(data);
    
    logger.info('✅ Job added to Cloud Tasks successfully', { 
      jobId: data.summaryDbId, 
      videoId: data.videoId, 
      userId: data.userId,
      taskName 
    });
    
    // Also add to DB for tracking
    await addJobToDbQueue(data);
    logger.info('✅ Job also added to DB for tracking', { jobId: data.summaryDbId });
    
    return { jobId: data.summaryDbId, usedCloudTasks: true };
    
  } catch (error) {
    logger.error('❌ Cloud Tasks queue failed, falling back to DB', { 
      jobId: data.summaryDbId, 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Fallback to DB queue
    const dbResult = await addJobToDbQueue(data);
    return { jobId: dbResult.jobId, usedCloudTasks: false };
  }
}

// DB-based tracking (for status and fallback)
async function addJobToDbQueue(data: JobData): Promise<{ jobId: string }> {
  const { executeQuery } = await import('./db');
  await executeQuery(async (sql: any) => {
    await sql`
      INSERT INTO video_summaries (id, video_id, main_title, overall_summary, processing_status, created_at, updated_at, raw_ai_output, transcript_sent, prompt_tokens, completion_tokens, total_tokens, input_cost, output_cost, total_cost, video_duration_seconds, job_data)
      VALUES (${data.summaryDbId}, ${data.videoDbId}, ${data.metadata.title}, '', 'queued', NOW(), NOW(), '', '', 0, 0, 0, 0, 0, 0, ${data.totalDurationSeconds}, ${JSON.stringify(data)})
      ON CONFLICT (id) DO UPDATE SET job_data = EXCLUDED.job_data
    `;
  });
  logger.info('✅ Job added to DB for tracking', { jobId: data.summaryDbId, videoId: data.videoId, userId: data.userId });
  return { jobId: data.summaryDbId };
}

// DB-based getJobById
export async function getJobById(jobId: string): Promise<any | null> {
  const { executeQuery } = await import('./db');
  const jobs = await executeQuery(async (sql: any) => {
    return await sql`SELECT * FROM video_summaries WHERE id = ${jobId}`;
  });
  if (jobs.length === 0) return null;
  return jobs[0];
}

// Legacy worker function - no longer needed with Cloud Tasks but kept for compatibility
export async function startSimpleWorker(
  processor: (jobData: JobData) => Promise<void>,
  shouldStop: () => boolean = () => false
): Promise<void> {
  logger.warn('⚠️ Legacy worker called - jobs are now processed by Cloud Tasks worker service');
  logger.info('🚀 Cloud Tasks handles job processing automatically');
  
  // No-op - Cloud Tasks handles the job processing
  return Promise.resolve();
} 