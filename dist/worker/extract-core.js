"use strict";
// Core video processing functionality
// This file contains the main video processing logic used by the worker
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideoExtraction = processVideoExtraction;
exports.processVideo = processVideo;
const logger_1 = require("../lib/logger");
// Initialize logger
const logger = (0, logger_1.createLogger)('worker:extract-core');
// Main video processing function that takes a job object (used by job queue and direct processing)
async function processVideoExtraction(job) {
    return await processVideo(job.videoId, job.videoDbId, job.summaryDbId, job.userId, job.userEmail, job.metadata, job.totalDurationSeconds, job.creditsNeeded);
}
// Define the Video Processing Function
async function processVideo(videoId, videoDbId, summaryDbId, userId, userEmail, metadata, totalDurationSeconds, creditsNeeded) {
    // Dynamic imports to prevent circular dependencies and improve startup time
    const { executeQuery } = await Promise.resolve().then(() => __importStar(require('../lib/db')));
    const { getVideoTranscript } = await Promise.resolve().then(() => __importStar(require('../lib/youtube')));
    const { extractKnowledgeWithOpenAI } = await Promise.resolve().then(() => __importStar(require('../lib/openai')));
    const { consumeCredits } = await Promise.resolve().then(() => __importStar(require('../lib/subscription')));
    // Enhanced Logging Helper
    const logStep = (step, status, details) => {
        const emojis = { START: '🚀', SUCCESS: '✅', FAILURE: '❌' };
        logger.info(`[${emojis[status]}] ${step}: ${status}`, { videoId, summaryDbId, userId, ...details });
    };
    logStep('Job Processing', 'START', { summaryDbId, videoId, creditsNeeded, totalDurationSeconds });
    const jobStartTime = Date.now();
    // Helper function to update processing status and progress in database
    const updateProgress = async (stage, progress, message) => {
        if (typeof summaryDbId === 'undefined') {
            logger.error('Cannot update status for an undefined summaryId');
            return;
        }
        try {
            await executeQuery(async (sql) => {
                await sql `
          UPDATE video_summaries 
          SET 
            processing_status = ${stage},
            processing_stage = ${stage},
            processing_progress = ${Math.max(0, Math.min(100, progress))},
            overall_summary = ${message || stage},
            updated_at = NOW()
          WHERE id = ${summaryDbId}
        `;
            });
            logger.info(`Progress updated: ${stage} (${progress}%)`, { summaryId: summaryDbId, message });
        }
        catch (e) {
            logger.error(`Failed to update progress for summary: ${e.message}`, { summaryId: summaryDbId });
        }
    };
    try {
        // === STEP 1: Fetch transcript ===
        const step1Time = Date.now();
        logStep('Transcript Fetch', 'START');
        await updateProgress('transcribing', 10, 'Starting transcript extraction...');
        // Assert videoId is not a UUID (DB ID)
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(videoId)) {
            logger.error('❌ videoId is a UUID, not a YouTube ID! This will cause SupaData 404.', { videoId, summaryDbId, userId });
            throw new Error('videoId is a UUID, not a YouTube ID!');
        }
        // Add delay to show initial progress
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        await updateProgress('transcribing', 30, 'Downloading video audio...');
        const transcript = await getVideoTranscript(videoId);
        if (!transcript || transcript.length === 0) {
            throw new Error('Transcript is empty or could not be fetched.');
        }
        // Add delay to show transcript progress
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        await updateProgress('transcribing', 100, 'Transcript extraction complete');
        logStep('Transcript Fetch', 'SUCCESS', { duration: `${Date.now() - step1Time}ms`, segments: transcript.length });
        // === STEP 2: Process with OpenAI ===
        const step2Time = Date.now();
        logStep('AI Knowledge Extraction', 'START');
        // Add delay before starting analysis
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        await updateProgress('summarizing', 10, 'Starting AI analysis...');
        // Add delay during analysis
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        await updateProgress('summarizing', 40, 'Analyzing transcript content...');
        const aiResult = await extractKnowledgeWithOpenAI(transcript, metadata.title, totalDurationSeconds);
        logStep('AI Knowledge Extraction', 'SUCCESS', { duration: `${Date.now() - step2Time}ms`, mainTitle: aiResult.mainTitle });
        if (!aiResult.mainTitle || !aiResult.overallSummary) {
            await updateProgress('failed', 0, 'Summary generation failed: missing main title or summary.');
            throw new Error('Summary generation failed: missing main title or summary.');
        }
        // Add delay to show analysis completion
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        await updateProgress('summarizing', 100, 'AI analysis complete');
        // === STEP 3: Update the summary with results ===
        const step3Time = Date.now();
        logStep('Database Update', 'START');
        // Add delay before finalizing
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
        await updateProgress('finalizing', 20, 'Organizing results...');
        await executeQuery(async (sql) => {
            await sql `
        UPDATE video_summaries 
        SET 
          main_title = ${aiResult.mainTitle},
          overall_summary = ${aiResult.overallSummary},
          raw_ai_output = ${aiResult.rawOpenAIOutput || aiResult.openaiOutput || 'No content available'},
          prompt_tokens = ${aiResult.promptTokens || 0},
          completion_tokens = ${aiResult.completionTokens || 0},
          total_tokens = ${aiResult.totalTokens || 0},
          input_cost = ${aiResult.inputCost || 0.0},
          output_cost = ${aiResult.outputCost || 0.0},
          total_cost = ${aiResult.totalCost || 0.0},
          processing_status = 'finalizing',
          processing_stage = 'finalizing',
          processing_progress = 60,
          updated_at = NOW()
        WHERE id = ${summaryDbId}
      `;
        });
        logStep('Database Update', 'SUCCESS', { duration: `${Date.now() - step3Time}ms` });
        // === STEP 4: Consume credits on success ===
        const step4Time = Date.now();
        logStep('Credit Consumption', 'START');
        // Add delay during credit processing
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        await updateProgress('finalizing', 80, 'Processing credits...');
        try {
            const creditResult = await consumeCredits(userId, creditsNeeded);
            if (!creditResult) {
                logger.warn('Credit consumption may have failed - returned false', {
                    userId,
                    creditsNeeded,
                    videoId,
                    summaryDbId
                });
            }
            // Force cache invalidation to ensure UI updates
            const { getCacheManager } = await Promise.resolve().then(() => __importStar(require('../lib/cache')));
            getCacheManager().invalidateUserSubscription(userId);
            logger.info('Credits consumed and cache invalidated', {
                userId,
                creditsNeeded,
                videoId,
                summaryDbId
            });
            logStep('Credit Consumption', 'SUCCESS', { duration: `${Date.now() - step4Time}ms` });
        }
        catch (creditError) {
            logger.error(`Credit consumption error: ${creditError.message}`, {
                userId,
                creditsNeeded,
                videoId,
                summaryDbId
            });
            logStep('Credit Consumption', 'FAILURE', { error: creditError.message });
            // Continue processing despite credit error - we'll log but not fail the job
        }
        // === STEP 5: Create video segments ===
        const step5Time = Date.now();
        if (aiResult.segments && aiResult.segments.length > 0) {
            logStep('Segment Creation', 'START', { segmentCount: aiResult.segments.length });
            // Add delay before segment creation
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
            await updateProgress('finalizing', 90, 'Creating video segments...');
            // We already have videoDbId passed as parameter, but double-check for safety
            if (!videoDbId) {
                const videoIdRows = await executeQuery(async (sql) => {
                    return await sql `SELECT video_id FROM video_summaries WHERE id = ${summaryDbId}`;
                });
                if (!videoIdRows || videoIdRows.length === 0 || !videoIdRows[0].video_id) {
                    throw new Error(`Could not find video_id for summary ${summaryDbId}`);
                }
                videoDbId = videoIdRows[0].video_id;
            }
            await executeQuery(async (sql) => {
                for (const [index, segment] of aiResult.segments.entries()) {
                    await sql `
            INSERT INTO video_segments (video_id, segment_number, start_time, end_time, title, summary) 
            VALUES (${videoDbId}, ${index + 1}, ${segment.startTime}, ${segment.endTime}, ${segment.title}, ${segment.narratorSummary})
          `;
                }
            });
            logStep('Segment Creation', 'SUCCESS', { duration: `${Date.now() - step5Time}ms`, count: aiResult.segments.length });
        }
        // === FINAL STEP: Complete processing ===
        // Add final delay to let users see the completion progress
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        await updateProgress('completed', 100, 'Processing complete');
        logStep('Job Processing', 'SUCCESS', { totalDuration: `${Date.now() - jobStartTime}ms` });
        return { status: 'completed', videoId, summaryId: summaryDbId };
    }
    catch (error) {
        // CRITICAL: This is the global error handler for the job.
        logStep('Job Processing', 'FAILURE', { error: error.message, totalDuration: `${Date.now() - jobStartTime}ms` });
        await updateProgress('failed', 0, `Processing failed: ${error.message}`);
        logger.error(`Job processing failed: ${error.message}`, {
            videoId,
            summaryDbId,
            stack: error.stack
        });
        // Consume credits on failure to prevent abuse.
        try {
            await consumeCredits(userId, creditsNeeded);
            // Force cache invalidation to ensure UI updates
            const { getCacheManager } = await Promise.resolve().then(() => __importStar(require('../lib/cache')));
            getCacheManager().invalidateUserSubscription(userId);
        }
        catch (creditError) {
            logger.error(`Failed to consume credits on failure: ${creditError.message}`);
        }
        throw error; // Re-throw to propagate the error
    }
}
