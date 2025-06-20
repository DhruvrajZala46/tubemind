import { executeQuery } from './db';
import { createLogger } from './logger';
import { extractKnowledgeWithOpenAI, OpenAIServiceError, RateLimitError, QuotaExceededError } from './openai';
import { storeVideoAndSummaryWithTransaction } from './db-actions';
import { canUserPerformAction } from './subscription';
import { getVideoTranscript } from './youtube';

const logger = createLogger('video-processing-helpers');

export async function processVideoInBackground(
  videoId: string,
  videoDbId: string,
  summaryDbId: number,
  userId: string,
  userEmail: string,
  user: any,
  metadata: any,
  totalDurationSeconds: number,
  creditsNeeded: number
) {
    logger.info('Starting background video processing', { data: { videoId, videoDbId } });

    try {
        await updateSummaryStatus(summaryDbId, 'transcribing');

        const transcript = await getVideoTranscript(videoId);

        await updateSummaryStatus(summaryDbId, 'summarizing');

        const extraction = await extractKnowledgeWithOpenAI(transcript, metadata.title, totalDurationSeconds);

        // Atomically update summary and create takeaways
        await updateSummaryAndTakeaways(summaryDbId, videoDbId, extraction);

        await createVideoSegments(videoDbId, extraction.segments);

        await updateSummaryStatus(summaryDbId, 'completed');
        logger.info('Video processing completed successfully', { data: { videoId } });

        await trackAdditionalUsage(userId, videoId, extraction, creditsNeeded);

    } catch (error: any) {
        logger.error('Error in background video processing', {
            data: {
                videoId,
                error: error.message,
            }
        });
        await updateSummaryStatus(summaryDbId, 'failed');
    }
}

export async function updateSummaryStatus(summaryId: number, status: string) {
    await executeQuery(sql =>
        sql`UPDATE video_summaries SET processing_status = ${status}, updated_at = NOW() WHERE id = ${summaryId}`
    );
}

async function updateSummaryAndTakeaways(summaryId: number, videoDbId: string, extraction: any) {
    // Start a transaction
    const tx = await executeQuery(sql => sql.transaction());
    try {
        // 1. Update the main summary
        await tx`
            UPDATE video_summaries
            SET
                main_title = ${extraction.mainTitle},
                overall_summary = ${extraction.overallSummary},
                processing_status = 'completed',
                updated_at = NOW()
            WHERE id = ${summaryId}
        `;

        // 2. Delete old takeaways for this video to prevent duplicates
        await tx`DELETE FROM video_takeaways WHERE video_id = ${videoDbId}`;

        // 3. Insert new key takeaways
        if (extraction.keyTakeaways && extraction.keyTakeaways.length > 0) {
            for (let i = 0; i < extraction.keyTakeaways.length; i++) {
                const takeaway = extraction.keyTakeaways[i];
                await tx`
                    INSERT INTO video_takeaways (video_id, takeaway, order_index)
                    VALUES (${videoDbId}, ${takeaway}, ${i + 1})
                `;
            }
        }
        
        // Commit the transaction
        await tx.commit();
    } catch (error) {
        // If anything fails, roll back the transaction
        await tx.rollback();
        throw error; // Re-throw the error to be caught by the main try-catch block
    }
}

function timeStringToSeconds(timeStr: string): number {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const cleanTime = timeStr.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    let seconds = 0;
    if (parts.length === 3) { // HH:MM:SS
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) { // MM:SS
        seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) { // SS
        seconds = parts[0];
    }
    return seconds;
}

async function createVideoSegments(videoDbId: string, segments: any[]) {
    if (!segments || segments.length === 0) return;

    for (const segment of segments) {
        await executeQuery(sql =>
            sql`
                INSERT INTO video_segments (video_id, title, summary, start_time, end_time, full_text)
                VALUES (
                    ${videoDbId},
                    ${segment.title},
                    ${segment.summary},
                    ${timeStringToSeconds(segment.start_time)},
                    ${timeStringToSeconds(segment.end_time)},
                    ${segment.full_text}
                )
            `
        );
    }
}

async function trackAdditionalUsage(
  userId: string,
  videoId: string,
  extraction: any,
  creditsNeeded: number
) {
    // This could be used for more granular tracking in the future
    logger.info('Tracking final usage', { data: { userId, videoId, credits: creditsNeeded } });
} 