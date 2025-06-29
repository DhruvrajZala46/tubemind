import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, getVideoMetadata } from '../../../lib/youtube';
import { currentUser } from '@clerk/nextjs/server';
import { getUserSubscription } from '../../../lib/subscription';
import { createLogger } from '../../../lib/logger';
import { executeQuery } from '../../../lib/db';
import { getCacheManager } from '../../../lib/cache';
import { dbWithRetry } from '../../../lib/error-recovery';
import { metrics } from '../../../lib/monitoring';
import { trackVideoProcessing } from '../../../lib/api-middleware';
import { calculateVideoCredits } from '../../../lib/credit-utils';
import { validateVideoProcessingRequest } from '../../../lib/security-utils';
import { canUserPerformAction, reserveCredits, releaseCredits } from '../../../lib/subscription';
import { getOrCreateUser } from '../../../lib/auth-utils';
import { randomUUID } from 'crypto';

// Define JobData interface locally
interface JobData {
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
}

// Cloud Tasks integration with Vercel-compatible fallback
async function enqueueJobToCloudTasks(jobData: JobData): Promise<string> {
  const project = process.env.GCP_PROJECT || 'agile-entry-463508-u6';
  const queue = process.env.CLOUD_TASKS_QUEUE || 'video-processing-queue';
  const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
  const workerUrl = process.env.WORKER_SERVICE_URL || 'https://tubemind-worker-304961481608.us-central1.run.app';
  
  // Check if we're in Vercel environment - use HTTP API instead of SDK
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    try {
      logger.info('Using direct HTTP call to worker (Vercel environment)', { 
        videoId: jobData.videoId,
        userId: jobData.userId,
        workerUrl 
      });
      
      // Use dynamic import for node-fetch
      const fetch = (await import('node-fetch')).default;
      
      // Create timeout controller with longer timeout for video processing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout (videos take time)
      
      try {
        // Make direct HTTP call to worker service
        // Note: This is fire-and-forget - worker will continue even if this times out
        const response = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jobData),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          logger.error('Worker service returned error', { 
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            videoId: jobData.videoId,
            userId: jobData.userId,
            workerUrl
          });
          // Don't throw - let it fall through to success (worker may still process)
          logger.info('Worker call failed but job is queued in database - processing may continue', {
            videoId: jobData.videoId,
            userId: jobData.userId
          });
        } else {
          const result = await response.json();
          logger.info('Worker service responded successfully', { 
            videoId: jobData.videoId,
            userId: jobData.userId,
            result
          });
        }
        
        return `direct-call-${jobData.summaryDbId}`;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // If it's a timeout, that's OK - worker continues in background
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
          logger.info('Worker call timed out but job is queued - processing continues in background', {
            videoId: jobData.videoId,
            userId: jobData.userId,
            timeout: '30s'
          });
          return `timeout-ok-${jobData.summaryDbId}`;
        }
        
        throw fetchError;
      }
    } catch (error: any) {
      logger.error('Direct worker call failed', { 
        error: error.message,
        videoId: jobData.videoId,
        userId: jobData.userId,
        workerUrl,
        stack: error.stack
      });
      
      // For now, don't throw - let the job stay in database queue
      // In production, you might want to implement a retry mechanism
      return `failed-${jobData.summaryDbId}`;
    }
  } else {
    // Use Cloud Tasks SDK for non-Vercel environments
    try {
      const { CloudTasksClient } = await import('@google-cloud/tasks');
      
      const client = new CloudTasksClient();
      const parent = client.queuePath(project, location, queue);
      
      const task = {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: workerUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          body: Buffer.from(JSON.stringify(jobData)).toString('base64'),
        },
      };
      
      logger.info('Creating Cloud Tasks job', { 
        videoId: jobData.videoId,
        userId: jobData.userId,
        queue: parent,
        workerUrl 
      });
      
      const request = { parent: parent, task: task };
      const [response] = await client.createTask(request);
      
      logger.info('Cloud Tasks job created successfully', { 
        taskName: response.name,
        videoId: jobData.videoId,
        userId: jobData.userId 
      });
      
      return response.name || `task-${jobData.summaryDbId}`;
      
    } catch (error: any) {
      logger.error('Failed to create Cloud Tasks job', { 
        error: error.message,
        videoId: jobData.videoId,
        userId: jobData.userId 
      });
      
      return `fallback-${jobData.summaryDbId}`;
    }
  }
}

// Fallback: Add job to database for manual processing
async function addJobToDatabase(jobData: JobData): Promise<void> {
  await executeQuery(async (sql: any) => {
    await sql`
      INSERT INTO video_summaries (id, video_id, main_title, overall_summary, processing_status, created_at, updated_at, raw_ai_output, transcript_sent, prompt_tokens, completion_tokens, total_tokens, input_cost, output_cost, total_cost, video_duration_seconds, job_data)
      VALUES (${jobData.summaryDbId}, ${jobData.videoDbId}, ${jobData.metadata.title}, '', 'queued', NOW(), NOW(), '', '', 0, 0, 0, 0, 0, 0, ${jobData.totalDurationSeconds}, ${JSON.stringify(jobData)})
      ON CONFLICT (id) DO UPDATE SET job_data = EXCLUDED.job_data
    `;
  });
}

const logger = createLogger('api:extract');
const cache = getCacheManager();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info('🎬 Video extraction API request received', { userId: null, email: null });
  metrics.apiRequest('/extract', 'POST', 0, startTime);

  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const user = await currentUser();
    if (!user) {
      logger.warn('Authentication failed - no user found', { userId: null, email: null });
      return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }
    await getOrCreateUser(user);

    const userId = user.id;
    const userEmail = user.emailAddresses[0]?.emailAddress || '';
    logger.info('User authenticated', { userId, email: userEmail });

    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      logger.error('User subscription not found. This should not happen after authentication.', { userId });
      return NextResponse.json({ error: 'Could not retrieve your subscription details. Please try signing out and back in.' }, { status: 500 });
    }

    logger.info('User subscription status', { 
      userId, 
      data: {
        tier: subscription.tier,
        status: subscription.status,
        creditsUsed: subscription.creditsUsed,
        creditsLimit: subscription.creditsLimit
      }
    });

    let metadata = cache.getCachedVideoMetadata(videoId);
    if (!metadata) {
      try {
        metadata = await getVideoMetadata(videoId);
        cache.cacheVideoMetadata(videoId, metadata);
        console.log(`📊 Fresh metadata fetched for video: ${videoId}`);
      } catch (error: any) {
        logger.error('Failed to fetch video metadata', { userId, data: { videoId, error: error.message } });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      console.log(`⚡ Cache HIT for metadata: ${videoId}`);
    }

    const totalDurationSeconds = metadata.durationInSeconds || 0;
    const creditsNeeded = calculateVideoCredits(totalDurationSeconds);
    
    // Check if user has enough credits with improved validation
    const creditsUsed = subscription.creditsUsed || 0;
    const creditsReserved = subscription.creditsReserved || 0;
    const creditsLimit = subscription.creditsLimit || 0;
    // FIX: Don't double-count reserved credits - they're for OTHER pending jobs
    const totalAvailable = Math.max(0, creditsLimit - creditsUsed);
    
    if (creditsNeeded > totalAvailable) {
      logger.warn('Credit limit exceeded', { 
        userId, 
        data: { 
          creditsNeeded, 
          available: totalAvailable, 
          creditsUsed,
          creditsReserved,
          creditsLimit,
          tier: subscription.tier 
        } 
      });
      
      // Provide a more detailed error message
      return NextResponse.json({ 
        error: `Credit limit exceeded. You need ${creditsNeeded} credits for this video but only have ${totalAvailable} credits available.`, 
        subscription: { 
          tier: subscription.tier, 
          creditsUsed: creditsUsed,
          creditsReserved: creditsReserved,
          creditsLimit: creditsLimit,
          available: totalAvailable
        } 
      }, { status: 403 });
    }

    // Reserve credits before queueing the job to prevent race conditions
    try {
      await reserveCredits(userId, creditsNeeded);
      // Invalidate cache immediately after reserving credits
      cache.invalidateUserSubscription(userId);
      
      logger.info('Credits reserved successfully', {
        userId,
        data: {
          creditsNeeded,
          previouslyAvailable: totalAvailable,
          newAvailable: totalAvailable - creditsNeeded
        }
      });
    } catch (creditError: any) {
      logger.error('Failed to reserve credits', { userId, error: creditError.message });
      return NextResponse.json({ error: 'Failed to reserve credits. Please try again.' }, { status: 500 });
    }

    const existingVideo = await dbWithRetry(async () => {
      return await executeQuery(async (sql) => {
        return await sql`
          SELECT v.id, v.video_id, vs.id as summary_id, 'completed' as processing_status, vs.main_title
          FROM videos v
          LEFT JOIN video_summaries vs ON v.id = vs.video_id
          WHERE v.user_id = ${userId} AND v.video_id = ${videoId}
          LIMIT 1
        `;
      });
    }, 'Check Existing Video');
    
    if (existingVideo.length > 0) {
      logger.info('Video already processed for this user, returning cached result');
      return NextResponse.json({
        success: true,
        data: {
          videoId,
          summaryId: existingVideo[0].summary_id,
          alreadyProcessed: true,
          processingStatus: existingVideo[0].processing_status || 'completed',
          title: existingVideo[0].main_title,
          message: 'Video already processed',
          redirectUrl: `/dashboard/${existingVideo[0].id}`
        }
      });
    }

    const securityCheck = await validateVideoProcessingRequest(userId);
    if (!securityCheck.allowed) {
      logger.warn('Security check failed (rate-limit)', { userId, data: { videoId, reason: securityCheck.reason } });
      return NextResponse.json({ error: securityCheck.reason }, { status: 429 });
    }

    let videoDbId: string;
    try {
      const videoInsertResult = await dbWithRetry(async () => {
        return await executeQuery(async (sql) => {
          return await sql`
            INSERT INTO videos (user_id, video_id, title, description, thumbnail_url, channel_title, duration, view_count, publish_date)
            VALUES (${userId}, ${videoId}, ${metadata.title}, ${metadata.description || ''}, ${metadata.thumbnailUrl || ''}, ${metadata.channelTitle || ''}, ${totalDurationSeconds}, ${parseInt(metadata.viewCount) || 0}, NOW())
            RETURNING id
          `;
        });
      }, 'Create Video Entry');
      videoDbId = videoInsertResult[0].id;
    } catch (error: any) {
      logger.error('Failed to create video entry', { userId, data: { videoId, error: error.message } });
      return NextResponse.json({ error: 'Failed to create video entry.' }, { status: 500 });
    }

    // After inserting the video and summary, add the job to the DB queue
    const summaryId = randomUUID();
    const jobData: JobData = {
      videoId,
      videoDbId,
      summaryDbId: summaryId,
      userId,
      userEmail,
      user: { id: userId, email: userEmail, name: user.fullName ?? undefined },
      metadata,
      totalDurationSeconds,
      creditsNeeded,
      youtubeUrl: url
    };
    try {
      logger.info('JobData to be queued', { jobData });
      
      // For Vercel frontend: Add to database queue
      // The Cloud Run API service will poll this and use Cloud Tasks
      await addJobToDatabase(jobData);
      logger.info('Job added to database queue (Cloud Run will process via Cloud Tasks)');
        
      // Also call the placeholder function for consistency
      await enqueueJobToCloudTasks(jobData);
      
    } catch (queueError: any) {
      logger.error('Failed to queue video processing job', { userId, error: queueError.message });
      await releaseCredits(userId, creditsNeeded);
      return NextResponse.json({ error: 'Failed to queue video processing job.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        summaryId,
        alreadyProcessed: false,
        processingStatus: 'queued',
        title: metadata.title,
        message: 'Job queued for processing',
        redirectUrl: `/dashboard/${videoDbId}`
      }
    });
  } catch (error: any) {
    // This is a general catch-all for unexpected errors
    const e = error?.message || 'An unexpected error occurred.';
    logger.error('Unhandled error in video extraction endpoint', { data: { error: e } });
    return NextResponse.json({ error: 'An unexpected error occurred. If this persists, please contact support.' }, { status: 500 });
  } finally {
    const duration = Date.now() - startTime;
    logger.info(`🎬 Video extraction API request finished in ${duration}ms`);
    metrics.apiRequest('/extract', 'POST', duration, startTime);
  }
} 