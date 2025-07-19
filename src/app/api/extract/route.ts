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

// This is the correct function to enqueue jobs, no JobQueue class needed.
async function enqueueJobToCloudTasks(jobData: any): Promise<void> {
    const workerUrl = process.env.WORKER_SERVICE_URL;
    if (!workerUrl) {
        logger.error('WORKER_SERVICE_URL is not set. Cannot enqueue job.');
        // In a real scenario, you'd have a more robust fallback, but for now, we prevent it from crashing.
        // The job is in the DB, a separate process could pick it up.
        return;
    }

    try {
        logger.info('Enqueuing job via direct HTTP POST to worker (fire-and-forget)', { 
        videoId: jobData.videoId,
        userId: jobData.userId,
        workerUrl 
      });
      
      // Use dynamic import for node-fetch
      const fetch = (await import('node-fetch')).default;
      
        // We do NOT await this call. This is "fire-and-forget".
        fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jobData),
        }).catch(fetchError => {
            // Log the error but do not throw, as the API has already returned a successful response.
            // The worker infrastructure should handle retries based on jobs in the DB.
            logger.error('Fire-and-forget worker call failed.', {
                error: fetchError.message,
            videoId: jobData.videoId,
            userId: jobData.userId,
          });
        });

    } catch (error: any) {
        logger.error('Failed to initiate fire-and-forget worker call.', { 
        error: error.message,
        videoId: jobData.videoId,
        userId: jobData.userId,
        stack: error.stack
      });
    }
}


const logger = createLogger('api:extract');
const cache = getCacheManager();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info('🎬 Video extraction API request received');
  metrics.apiRequest('/extract', 'POST', 0, startTime);

  let userId: string | null = null;
  let videoId: string | null = null;
  let summaryId: string | null = null;
  let creditsReserved = 0;

  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const user = await currentUser();
    if (!user) {
      logger.warn('Authentication failed - no user found');
      return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(user);
    userId = dbUser.id;
    const userEmail = dbUser.email || '';
    logger.info('User authenticated', { userId, email: userEmail });

    if (!userId) {
      // This should theoretically never happen if the above logic is correct, but it satisfies TypeScript.
      return NextResponse.json({ error: 'Failed to identify user.' }, { status: 500 });
    }

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
        creditsLimit: subscription.creditsLimit,
        creditsReserved: subscription.creditsReserved,
      }
    });

    let metadata = cache.getCachedVideoMetadata(videoId);
    if (!metadata) {
      try {
        metadata = await getVideoMetadata(videoId);
        cache.cacheVideoMetadata(videoId, metadata);
        logger.info(`📊 Fresh metadata fetched for video: ${videoId}`);
      } catch (error: any) {
        logger.error('Failed to fetch video metadata', { userId, videoId, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      logger.info(`⚡️ Cache HIT for metadata: ${videoId}`);
    }

    const totalDurationSeconds = metadata.durationInSeconds || 0;
    const creditsNeeded = calculateVideoCredits(totalDurationSeconds);
    
    const permission = await canUserPerformAction(userId, 'extract_video', creditsNeeded);
    if (!permission.allowed) {
      logger.warn('User has insufficient credits or permission denied.', { userId, reason: permission.reason });
      return NextResponse.json({ 
        error: permission.reason || 'Insufficient credits. Please upgrade your plan or wait for your credits to reset.' 
      }, { status: 402 });
    }

    // 👉 Robust check: if ANY summary already exists for this video (except failed) just return it
    const existingVideoAndSummary = await executeQuery<{id: string, summary_id: string, status: string}[]>(sql => 
      sql`SELECT v.id, vs.id as summary_id, vs.processing_status 
          FROM videos v
         JOIN video_summaries vs ON v.id = vs.video_id 
         WHERE v.video_id = ${videoId!} AND v.user_id = ${userId} AND vs.processing_status <> 'failed'`
    );

    if (existingVideoAndSummary && existingVideoAndSummary.length > 0) {
        logger.info(`Video already processed for user. Returning existing summary.`, { userId, videoId, summaryId: existingVideoAndSummary[0].summary_id });
      return NextResponse.json({
            message: 'Video already processed. Returning existing summary.',
            videoId: existingVideoAndSummary[0].id,
            summaryId: existingVideoAndSummary[0].summary_id,
            status: 'completed'
        }, { status: 200 });
    }

    await reserveCredits(userId, creditsNeeded);
    creditsReserved = creditsNeeded;
    logger.info(`🔒 ${creditsNeeded} credits reserved for user ${userId}`);

    summaryId = randomUUID();
    let videoDbId: string;

    const videoData = {
      user_id: userId,
      video_id: videoId,
      title: metadata.title,
      description: metadata.description,
      thumbnail_url: metadata.thumbnailUrl,
      channel_title: metadata.channelTitle,
      duration: totalDurationSeconds,
      view_count: metadata.viewCount,
      publish_date: metadata.publishDate,
    };
    
    const existingVideo = await executeQuery<{id: string}[]>(sql => 
      sql`SELECT id FROM videos WHERE video_id = ${videoId}`
    );

    if (existingVideo && existingVideo.length > 0) {
      videoDbId = existingVideo[0].id;
      logger.info(`Existing video found in DB with id: ${videoDbId}`, { videoId });
      await executeQuery(sql => 
        sql`UPDATE videos SET 
            user_id = ${videoData.user_id},
            video_id = ${videoData.video_id},
            title = ${videoData.title},
            description = ${videoData.description},
            thumbnail_url = ${videoData.thumbnail_url},
            channel_title = ${videoData.channel_title},
            duration = ${videoData.duration},
            view_count = ${videoData.view_count},
            publish_date = ${videoData.publish_date}
          WHERE id = ${videoDbId}`
      );
    } else {
      videoDbId = randomUUID();
      logger.info(`Creating new video in DB with id: ${videoDbId}`, { videoId });
      await executeQuery(sql => 
        sql`INSERT INTO videos (id, user_id, video_id, title, description, thumbnail_url, channel_title, duration, view_count, publish_date)
           VALUES (${videoDbId}, ${videoData.user_id}, ${videoData.video_id}, ${videoData.title}, ${videoData.description}, ${videoData.thumbnail_url}, ${videoData.channel_title}, ${videoData.duration}, ${videoData.view_count}, ${videoData.publish_date})`
      );
    }

    const summaryData = {
      id: summaryId,
      video_id: videoDbId,
      main_title: metadata.title,
      processing_status: 'queued',
      video_duration_seconds: totalDurationSeconds,
      overall_summary: '',
      raw_ai_output: '',
      transcript_sent: '',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      input_cost: 0,
      output_cost: 0,
      total_cost: 0,
    };
    
    await executeQuery(sql => 
      sql`INSERT INTO video_summaries (id, video_id, main_title, processing_status, video_duration_seconds, overall_summary, raw_ai_output, transcript_sent, prompt_tokens, completion_tokens, total_tokens, input_cost, output_cost, total_cost)
         VALUES (${summaryData.id}, ${summaryData.video_id}, ${summaryData.main_title}, ${summaryData.processing_status}, ${summaryData.video_duration_seconds}, ${summaryData.overall_summary}, ${summaryData.raw_ai_output}, ${summaryData.transcript_sent}, ${summaryData.prompt_tokens}, ${summaryData.completion_tokens}, ${summaryData.total_tokens}, ${summaryData.input_cost}, ${summaryData.output_cost}, ${summaryData.total_cost})
         ON CONFLICT (video_id) DO UPDATE SET processing_status = EXCLUDED.processing_status RETURNING id`
    );

    logger.info(`✅ Job created and saved to DB. Summary ID: ${summaryId}`, { userId, videoId });

    const jobData = {
      videoId: videoId,
      videoDbId,
      summaryDbId: summaryId,
      userId: userId,
      userEmail: userEmail,
      metadata: metadata,
      totalDurationSeconds: totalDurationSeconds,
      creditsNeeded: creditsNeeded,
      youtubeUrl: url,
    };

    // Enqueue the job for the worker to process, but DO NOT wait for it.
    // This is the key to avoiding timeouts.
    // No need to `await`, this is fire-and-forget
    enqueueJobToCloudTasks(jobData);
      
    logger.info('🚀 Job enqueued for background processing.', { userId, videoId, summaryId });

    metrics.apiRequest('/extract', 'POST', 202, startTime);
    return NextResponse.json({
      message: 'Video processing started.',
      videoId: videoDbId,
      summaryId: summaryId,
      status: 'queued'
    }, { status: 202 });

  } catch (error: any) {
    logger.error('❌ Unhandled error in /api/extract', {
      userId,
      videoId,
      error: error.message,
      stack: error.stack,
    });

    if (userId && creditsReserved > 0) {
      try {
        await releaseCredits(userId, creditsReserved);
        logger.info(`Credits released for user ${userId} due to error.`, { creditsReserved });
      } catch (releaseError: any) {
        logger.error('CRITICAL: Failed to release credits after an error.', {
          userId,
          creditsReserved,
          originalError: error.message,
          releaseError: releaseError.message,
        });
      }
    }
    
    metrics.apiRequest('/extract', 'POST', 500, startTime);
    const responseBody = {
      error: 'An unexpected error occurred while starting the video processing. Your credits have not been charged. Please try again.',
      details: error.message
    };
    return NextResponse.json(responseBody, { status: 500 });
  }
} 