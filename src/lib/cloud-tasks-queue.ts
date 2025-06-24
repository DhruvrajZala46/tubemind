import { CloudTasksClient } from '@google-cloud/tasks';
import { createLogger } from './logger';

const logger = createLogger('cloud-tasks-queue');

// Initialize Cloud Tasks client
const client = new CloudTasksClient();

interface JobData {
  videoId: string;
  userId: string;
  youtubeUrl: string;
  type?: string;
  [key: string]: any;
}

export async function enqueueJob(jobData: JobData): Promise<string> {
  try {
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