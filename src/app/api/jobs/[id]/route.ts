import { NextRequest, NextResponse } from 'next/server';
import { getVideoQueue, getJobStatus } from '../../../../lib/job-queue';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  try {
    // Try to get the job status directly first
    const status = await getJobStatus(jobId);
    
    // For compatibility with old code, also try the queue object
    const videoQueue = getVideoQueue();
    if (!videoQueue) {
      // If queue is not available but we have a valid status, return that
      if (status !== 'not_found') {
        return NextResponse.json({
          id: jobId,
          status,
          progress: 0,
          failedReason: status === 'failed' ? 'Unknown error' : null,
          returnValue: null,
        });
      }
      return NextResponse.json({ error: 'Job queue not available' }, { status: 503 });
    }
    
    const job = await videoQueue.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const isCompleted = await job.isCompleted();
    const isFailed = await job.isFailed();

    return NextResponse.json({
      id: job.id,
      status: isCompleted ? 'completed' : isFailed ? 'failed' : job.processedOn ? 'processing' : 'queued',
      progress: job.progress,
      failedReason: job.failedReason || null,
      returnValue: job.returnvalue || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 