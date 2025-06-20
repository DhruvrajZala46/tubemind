import { NextRequest, NextResponse } from 'next/server';
import { getJobById } from '../../../../lib/job-queue';
import { createLogger } from '../../../../lib/logger';
import { Job } from 'bullmq';

const logger = createLogger('api:jobs:status');

// This endpoint is used by the frontend to poll for the status of a video processing job.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const jobId = params.id;
  logger.info(`Polling request for job ID: ${jobId}`);

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
  }

  try {
    // We are looking for the summary ID, which is the primary key for the summary table.
    // In the previous version, this was also used as the Job ID. We need to find the job
    // associated with the video summary.
    // FOR NOW, let's assume the ID passed IS the BullMQ job ID.
    // A better approach in the future might be to store the BullMQ job ID in the video_summaries table.
    
    const job = await getJobById(jobId);

    if (!job) {
      // It's possible the job is already complete and removed, or the ID is invalid.
      // We should check the database for a final status.
      // This is a placeholder for that logic. For now, we assume not found is a valid state.
      logger.warn(`No job found in queue for ID: ${jobId}. It might be completed or invalid.`);
      return NextResponse.json({
        jobId,
        state: 'not-found',
        message: 'Job not found in the active queue. It may be completed or invalid.',
      }, { status: 404 });
    }

    const state = await job.getState();
    const progress = job.progress;
    const failedReason = job.failedReason;
    const returnValue = job.returnvalue;

    logger.info(`Job status for ${jobId}: ${state}`, {
      data: {
        jobId: job.id,
        state,
        progress,
        failedReason
      }
    });
    
    return NextResponse.json({
      jobId: job.id,
      state,
      progress,
      failedReason,
      data: job.data, // Contains videoId, summaryDbId etc.
      returnValue, // Contains final summary data if completed
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    logger.error('Error fetching job status', { data: { jobId, error: errorMessage } });
    return NextResponse.json({ error: 'Failed to fetch job status.' }, { status: 500 });
  }
} 