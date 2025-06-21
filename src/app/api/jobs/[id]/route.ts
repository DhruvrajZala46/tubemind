import { NextRequest, NextResponse } from 'next/server';
import { getJobById } from '../../../../lib/job-queue';
import { createLogger } from '../../../../lib/logger';

const logger = createLogger('api:jobs:status');

// This endpoint is used by the frontend to poll for the status of a video processing job.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const jobId = params.id;
  logger.info(`Polling request for job ID: ${jobId}`);

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
  }

  try {
    const job = await getJobById(jobId);
    if (!job) {
      logger.warn(`No job found in DB for ID: ${jobId}.`);
      return NextResponse.json({
        jobId,
        state: 'not-found',
        message: 'Job not found in the database. It may be completed or invalid.',
      }, { status: 404 });
    }
    return NextResponse.json({
      jobId: job.id,
      state: job.processing_status,
      data: job,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    logger.error('Error fetching job status', { data: { jobId, error: errorMessage } });
    return NextResponse.json({ error: 'Failed to fetch job status.' }, { status: 500 });
  }
} 