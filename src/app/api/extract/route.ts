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
import { addJobToQueue } from '../../../lib/job-queue';
import { validateVideoProcessingRequest } from '../../../lib/security-utils';
import { canUserPerformAction, reserveCredits, releaseCredits } from '../../../lib/subscription';

const logger = createLogger('api:extract');
const cache = getCacheManager();

function parseDurationToSeconds(durationStr: any) {
  if (typeof durationStr === 'number') return durationStr;
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 1) {
    return Number(parts[0]);
  }
  return 0;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info('🎬 Video extraction API request received');
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
      logger.warn('Authentication failed - no user found');
      return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

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

    const totalDurationSeconds = parseDurationToSeconds(metadata.duration);
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

    let summaryId: string;
    try {
      const summaryInsertResult = await dbWithRetry(async () => {
        return await executeQuery(async (sql) => {
          return await sql`
            INSERT INTO video_summaries (video_id, processing_status, main_title, overall_summary, raw_ai_output, transcript_sent, prompt_tokens, completion_tokens, total_tokens, input_cost, output_cost, total_cost, video_duration_seconds)
            VALUES (${videoDbId}, 'queued', ${metadata.title}, 'Your video is in the queue and will be processed shortly.', '', '', 0, 0, 0, 0, 0, 0, ${totalDurationSeconds})
            RETURNING id
          `;
        });
      }, 'Create Summary Entry');
      summaryId = summaryInsertResult[0].id;

      // Start processing the video by adding it to the queue
      try {
        const job = await addJobToQueue({
          videoId,
          videoDbId,
          summaryDbId: summaryId,
          userId,
          userEmail,
          user,
          metadata,
          totalDurationSeconds,
          creditsNeeded
        });

        logger.info('Job added to queue successfully', {
          userId,
          data: { videoId, jobId: job.id, creditsNeeded }
        });

        return NextResponse.json({
          success: true,
          data: {
            videoId: videoDbId,
            summaryId: summaryId,
            message: "Video is now in the processing queue.",
            redirectUrl: `/dashboard/${videoDbId}`
          }
        }, { status: 202 });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to add job to queue. Releasing reserved credits.', { userId, data: { videoId, error: errorMessage } });
        
        // IMPORTANT: If we can't add to the queue, we MUST release the credits
        await releaseCredits(userId, creditsNeeded);
        cache.invalidateUserSubscription(userId);

        return NextResponse.json({ error: 'Failed to add video to processing queue. Your credits have been returned. Please try again in a moment.' }, { status: 500 });
      }
    } catch (error: any) {
      logger.error('Failed to create summary entry', { userId, data: { videoId, error: error.message } });
       
      // If summary creation fails, we must also release credits
      await releaseCredits(userId, creditsNeeded);
      cache.invalidateUserSubscription(userId);
      
      return NextResponse.json({ error: 'Failed to create summary entry. Your credits have been restored.' }, { status: 500 });
    }
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