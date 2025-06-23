"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideoInBackground = processVideoInBackground;
exports.updateSummaryStatus = updateSummaryStatus;
const db_1 = require("./db");
const logger_1 = require("./logger");
const openai_1 = require("./openai");
const youtube_1 = require("./youtube");
const logger = (0, logger_1.createLogger)('video-processing-helpers');
async function processVideoInBackground(videoId, videoDbId, summaryDbId, userId, userEmail, user, metadata, totalDurationSeconds, creditsNeeded) {
    logger.info('Starting background video processing', { data: { videoId, videoDbId } });
    try {
        await updateSummaryStatus(summaryDbId, 'transcribing');
        const transcript = await (0, youtube_1.getVideoTranscript)(videoId);
        await updateSummaryStatus(summaryDbId, 'summarizing');
        const extraction = await (0, openai_1.extractKnowledgeWithOpenAI)(transcript, metadata.title, totalDurationSeconds);
        // Atomically update summary and create takeaways
        await updateSummaryAndTakeaways(summaryDbId, videoDbId, extraction);
        await createVideoSegments(videoDbId, extraction.segments);
        await updateSummaryStatus(summaryDbId, 'completed');
        logger.info('Video processing completed successfully', { data: { videoId } });
        await trackAdditionalUsage(userId, videoId, extraction, creditsNeeded);
    }
    catch (error) {
        logger.error('Error in background video processing', {
            data: {
                videoId,
                error: error.message,
            }
        });
        await updateSummaryStatus(summaryDbId, 'failed');
    }
}
async function updateSummaryStatus(summaryId, status) {
    await (0, db_1.executeQuery)(sql => sql `UPDATE video_summaries SET processing_status = ${status}, updated_at = NOW() WHERE id = ${summaryId}`);
}
async function updateSummaryAndTakeaways(summaryId, videoDbId, extraction) {
    // Start a transaction
    const tx = await (0, db_1.executeQuery)(sql => sql.transaction());
    try {
        // 1. Update the main summary
        await tx `
            UPDATE video_summaries
            SET
                main_title = ${extraction.mainTitle},
                overall_summary = ${extraction.overallSummary},
                processing_status = 'completed',
                updated_at = NOW()
            WHERE id = ${summaryId}
        `;
        // 2. Delete old takeaways for this video to prevent duplicates
        await tx `DELETE FROM video_takeaways WHERE video_id = ${videoDbId}`;
        // 3. Insert new key takeaways
        if (extraction.keyTakeaways && extraction.keyTakeaways.length > 0) {
            for (let i = 0; i < extraction.keyTakeaways.length; i++) {
                const takeaway = extraction.keyTakeaways[i];
                await tx `
                    INSERT INTO video_takeaways (video_id, takeaway, order_index)
                    VALUES (${videoDbId}, ${takeaway}, ${i + 1})
                `;
            }
        }
        // Commit the transaction
        await tx.commit();
    }
    catch (error) {
        // If anything fails, roll back the transaction
        await tx.rollback();
        throw error; // Re-throw the error to be caught by the main try-catch block
    }
}
function timeStringToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string')
        return 0;
    const cleanTime = timeStr.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':').map(Number);
    if (parts.some(isNaN))
        return 0;
    let seconds = 0;
    if (parts.length === 3) { // HH:MM:SS
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    else if (parts.length === 2) { // MM:SS
        seconds = parts[0] * 60 + parts[1];
    }
    else if (parts.length === 1) { // SS
        seconds = parts[0];
    }
    return seconds;
}
async function createVideoSegments(videoDbId, segments) {
    if (!segments || segments.length === 0)
        return;
    for (const segment of segments) {
        await (0, db_1.executeQuery)(sql => sql `
                INSERT INTO video_segments (video_id, title, summary, start_time, end_time, full_text)
                VALUES (
                    ${videoDbId},
                    ${segment.title},
                    ${segment.summary},
                    ${timeStringToSeconds(segment.start_time)},
                    ${timeStringToSeconds(segment.end_time)},
                    ${segment.full_text}
                )
            `);
    }
}
async function trackAdditionalUsage(userId, videoId, extraction, creditsNeeded) {
    // This could be used for more granular tracking in the future
    logger.info('Tracking final usage', { data: { userId, videoId, credits: creditsNeeded } });
}
