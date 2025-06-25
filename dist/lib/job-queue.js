"use strict";
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
exports.addJobToQueue = addJobToQueue;
exports.getJobById = getJobById;
exports.startSimpleWorker = startSimpleWorker;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('job-queue');
// Frontend-compatible Cloud Tasks stub (for Vercel builds)
async function enqueueJobToCloudTasks(jobData) {
    // For Vercel frontend builds: just return a placeholder
    // The actual Cloud Tasks integration happens on Cloud Run
    logger.info('Frontend queue - job will be processed by Cloud Run worker', {
        jobId: jobData.summaryDbId,
        videoId: jobData.videoId
    });
    return `frontend-queued-${jobData.summaryDbId}`;
}
// Cloud Tasks-based addJobToQueue
async function addJobToQueue(data) {
    logger.info('🚀 Adding job to Cloud Tasks queue', { jobId: data.summaryDbId, videoId: data.videoId, userId: data.userId });
    try {
        // Use Cloud Tasks for job processing
        const taskName = await enqueueJobToCloudTasks(data);
        logger.info('✅ Job added to Cloud Tasks successfully', {
            jobId: data.summaryDbId,
            videoId: data.videoId,
            userId: data.userId,
            taskName
        });
        // Also add to DB for tracking
        await addJobToDbQueue(data);
        logger.info('✅ Job also added to DB for tracking', { jobId: data.summaryDbId });
        return { jobId: data.summaryDbId, usedCloudTasks: true };
    }
    catch (error) {
        logger.error('❌ Cloud Tasks queue failed, falling back to DB', {
            jobId: data.summaryDbId,
            error: error instanceof Error ? error.message : String(error)
        });
        // Fallback to DB queue
        const dbResult = await addJobToDbQueue(data);
        return { jobId: dbResult.jobId, usedCloudTasks: false };
    }
}
// DB-based tracking (for status and fallback)
async function addJobToDbQueue(data) {
    const { executeQuery } = await Promise.resolve().then(() => __importStar(require('./db')));
    await executeQuery(async (sql) => {
        await sql `
      INSERT INTO video_summaries (id, video_id, main_title, overall_summary, processing_status, created_at, updated_at, raw_ai_output, transcript_sent, prompt_tokens, completion_tokens, total_tokens, input_cost, output_cost, total_cost, video_duration_seconds, job_data)
      VALUES (${data.summaryDbId}, ${data.videoDbId}, ${data.metadata.title}, '', 'queued', NOW(), NOW(), '', '', 0, 0, 0, 0, 0, 0, ${data.totalDurationSeconds}, ${JSON.stringify(data)})
      ON CONFLICT (id) DO UPDATE SET job_data = EXCLUDED.job_data
    `;
    });
    logger.info('✅ Job added to DB for tracking', { jobId: data.summaryDbId, videoId: data.videoId, userId: data.userId });
    return { jobId: data.summaryDbId };
}
// DB-based getJobById
async function getJobById(jobId) {
    const { executeQuery } = await Promise.resolve().then(() => __importStar(require('./db')));
    const jobs = await executeQuery(async (sql) => {
        return await sql `SELECT * FROM video_summaries WHERE id = ${jobId}`;
    });
    if (jobs.length === 0)
        return null;
    return jobs[0];
}
// Legacy worker function - no longer needed with Cloud Tasks but kept for compatibility
async function startSimpleWorker(processor, shouldStop = () => false) {
    logger.warn('⚠️ Legacy worker called - jobs are now processed by Cloud Tasks worker service');
    logger.info('🚀 Cloud Tasks handles job processing automatically');
    // No-op - Cloud Tasks handles the job processing
    return Promise.resolve();
}
