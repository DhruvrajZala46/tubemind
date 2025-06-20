"use strict";
// Test version of extract.ts with hardcoded environment variables
// This file is identical to extract.ts but sets environment variables at the top
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
// Set required environment variables
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgresql://test:test@test.neon.tech/test?sslmode=require';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder_key';
process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_key';
process.env.OPENAI_API_KEY = 'sk-placeholder_key';
process.env.LEAPCELL = 'true';
process.env.DEPLOYMENT_ENV = 'leapcell';
const job_queue_1 = require("../lib/job-queue");
const logger_1 = require("../lib/logger");
const health_1 = require("./health");
// --- All other imports are now DYNAMIC inside the processor ---
// --- 1. Start Health Check Server Immediately ---
// This responds to the hosting platform's health checks quickly,
// preventing the worker from being killed during initialization.
(0, health_1.startHealthCheckServer)();
// --- 2. Initialize Logger ---
// The logger is lightweight and can be initialized at startup.
const logger = (0, logger_1.createLogger)('worker:extract');
// --- 3. Define the Job Processor with ENHANCED LOGGING ---
async function processor(job) {
    const { videoId, userId, metadata, creditsNeeded, summaryDbId, totalDurationSeconds } = job.data;
    // --- DYNAMICALLY IMPORT services inside the processor ---
    const { executeQuery } = await Promise.resolve().then(() => __importStar(require('../lib/db')));
    const { getVideoTranscript } = await Promise.resolve().then(() => __importStar(require('../lib/youtube')));
    const { extractKnowledgeWithOpenAI } = await Promise.resolve().then(() => __importStar(require('../lib/openai')));
    const { consumeCredits } = await Promise.resolve().then(() => __importStar(require('../lib/subscription')));
    // --- Enhanced Logging Helper ---
    const logStep = (step, status, details) => {
        const emojis = { START: '🚀', SUCCESS: '✅', FAILURE: '❌' };
        logger.info(`[${emojis[status]}] ${step}: ${status}`, { jobId: job.id, videoId, summaryDbId, ...details });
    };
    logStep('Job Processing', 'START', { summaryDbId, videoId, creditsNeeded, totalDurationSeconds });
    const jobStartTime = Date.now();
    const updateStatus = async (status, message) => {
        if (typeof summaryDbId === 'undefined') {
            logger.error('Cannot update status for an undefined summaryId');
            return;
        }
        try {
            await executeQuery(async (sql) => {
                await sql `
          UPDATE video_summaries 
          SET 
            processing_status = ${status},
            overall_summary = ${message || status},
            updated_at = NOW()
          WHERE id = ${summaryDbId}
        `;
            });
            logger.info(`DB Status updated to: ${status}`, { summaryId: summaryDbId });
        }
        catch (e) {
            logger.error('Failed to update status for summary', { summaryId: summaryDbId, error: e.message });
        }
    };
    try {
        // === STEP 1: Fetch transcript ===
        const step1Time = Date.now();
        logStep('Transcript Fetch', 'START');
        await updateStatus('transcribing', 'Fetching transcript...');
        const transcript = await getVideoTranscript(videoId);
        if (!transcript || transcript.length === 0) {
            throw new Error('Transcript is empty or could not be fetched.');
        }
        logStep('Transcript Fetch', 'SUCCESS', { duration: `${Date.now() - step1Time}ms`, segments: transcript.length });
        // === STEP 2: Process with OpenAI ===
        const step2Time = Date.now();
        logStep('AI Knowledge Extraction', 'START');
        await updateStatus('summarizing', 'Generating insights with AI...');
        const aiResult = await extractKnowledgeWithOpenAI(transcript, metadata.title, totalDurationSeconds);
        logStep('AI Knowledge Extraction', 'SUCCESS', { duration: `${Date.now() - step2Time}ms`, mainTitle: aiResult.mainTitle });
        // === STEP 3: Update the summary with results ===
        const step3Time = Date.now();
        logStep('Database Update', 'START');
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
          processing_status = 'complete',
          updated_at = NOW()
        WHERE id = ${summaryDbId}
      `;
        });
        logStep('Database Update', 'SUCCESS', { duration: `${Date.now() - step3Time}ms` });
        // === FINAL STEP: Consume credits on success ===
        const step4Time = Date.now();
        logStep('Credit Consumption', 'START');
        await consumeCredits(userId, creditsNeeded);
        logStep('Credit Consumption', 'SUCCESS', { duration: `${Date.now() - step4Time}ms` });
        await updateStatus('complete'); // Final status update
        logStep('Job Processing', 'SUCCESS', { totalDuration: `${Date.now() - jobStartTime}ms` });
        // STEP 4: Create video segments
        if (aiResult.segments && aiResult.segments.length > 0) {
            logger.info(`Inserting ${aiResult.segments.length} video segments`, { summaryId: summaryDbId });
            const videoIdRows = await executeQuery(async (sql) => {
                return await sql `SELECT video_id FROM video_summaries WHERE id = ${summaryDbId}`;
            });
            if (!videoIdRows || videoIdRows.length === 0 || !videoIdRows[0].video_id) {
                throw new Error(`Could not find video_id for summary ${summaryDbId}`);
            }
            const videoDbId = videoIdRows[0].video_id;
            await executeQuery(async (sql) => {
                for (const [index, segment] of aiResult.segments.entries()) {
                    await sql `
            INSERT INTO video_segments (video_id, segment_number, start_time, end_time, title, summary) 
            VALUES (${videoDbId}, ${index + 1}, ${segment.startTime}, ${segment.endTime}, ${segment.title}, ${segment.narratorSummary})
          `;
                }
            });
        }
        return { status: 'completed', videoId, summaryId: summaryDbId };
    }
    catch (error) {
        // CRITICAL: This is the global error handler for the job.
        logStep('Job Processing', 'FAILURE', { error: error.message, totalDuration: `${Date.now() - jobStartTime}ms` });
        await updateStatus('failed', `Processing failed: ${error.message}`);
        logger.error('Job processing failed terminally', {
            jobId: job.id,
            videoId,
            summaryDbId,
            error: error.message,
            stack: error.stack
        });
        // Consume credits on failure to prevent abuse.
        await consumeCredits(userId, creditsNeeded);
    }
}
// --- 4. Create and Start the Worker ---
// This is now very fast as it only sets up the queue listener.
const worker = (0, job_queue_1.createVideoWorker)(processor);
if (worker) {
    worker.on('completed', (job) => {
        logger.info(`Job event: completed`, { jobId: job.id, videoId: job.data.videoId });
    }).on('failed', (job, err) => {
        logger.error(`Job event: failed`, {
            jobId: job?.id,
            videoId: job?.data.videoId,
            userId: job?.data.userId,
            error: err.message,
        });
    });
    logger.info('Worker listener initialized. Waiting for jobs...');
}
else {
    logger.warn('Worker not started - Redis may not be configured.');
}
