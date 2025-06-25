import { createLogger } from './logger';

const logger = createLogger('cloud-tasks-queue');

interface JobData {
  videoId: string;
  userId: string;
  youtubeUrl: string;
  videoDbId?: string;
  summaryDbId?: string;
  userEmail?: string;
  user?: { id: string; email: string; name?: string };
  metadata?: any;
  totalDurationSeconds?: number;
  creditsNeeded?: number;
  type?: string;
  [key: string]: any;
}

// Check if we're in a Node.js environment (server-side)
const isServerSide = typeof globalThis !== 'undefined' && typeof globalThis.process !== 'undefined';

export async function enqueueJob(jobData: JobData): Promise<string> {
  // Only run on server-side (Cloud Run worker or API routes)
  if (!isServerSide) {
    throw new Error('Cloud Tasks can only be used on the server side');
  }

  try {
    // Dynamically import Cloud Tasks client only on server-side
    const { CloudTasksClient } = await import('@google-cloud/tasks');
    const client = new CloudTasksClient();

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    const queueName = process.env.CLOUD_TASKS_QUEUE_NAME || 'video-processing-queue';
    const workerUrl = process.env.WORKER_SERVICE_URL;

    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID or GCP_PROJECT environment variable is required');
    }

    if (!workerUrl) {
      throw new Error('WORKER_SERVICE_URL environment variable is required');
    }

    // Construct the parent path
    const parent = client.queuePath(projectId, location, queueName);

    // Construct the task
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: workerUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify(jobData)),
      },
    };

    logger.info('Enqueueing job to Cloud Tasks', {
      parent,
      workerUrl,
      videoId: jobData.videoId,
      userId: jobData.userId
    });

    // Send create task request
    const [response] = await client.createTask({ parent, task });
    
    const taskName = response.name || 'unknown';
    logger.info('Job enqueued successfully', {
      taskName,
      videoId: jobData.videoId
    });

    return taskName;
  } catch (error) {
    logger.error('Failed to enqueue job', {
      error: error instanceof Error ? error.message : String(error),
      jobData,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}