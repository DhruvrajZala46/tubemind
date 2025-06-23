"use strict";
// 📋 PHASE 2.5: COMPREHENSIVE QUEUE SYSTEM FOR AI PROCESSING
// Handles background processing to prevent timeouts and improve scalability
Object.defineProperty(exports, "__esModule", { value: true });
exports.queue = void 0;
exports.addVideoProcessingJob = addVideoProcessingJob;
exports.getJobStatus = getJobStatus;
exports.getUserProcessingHistory = getUserProcessingHistory;
exports.waitForVideoProcessing = waitForVideoProcessing;
exports.getQueueMetrics = getQueueMetrics;
exports.getQueueStats = getQueueStats;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('queue');
var JobType;
(function (JobType) {
    JobType["YOUTUBE_TRANSCRIPT"] = "youtube_transcript";
    JobType["AI_PROCESSING"] = "ai_processing";
    JobType["VIDEO_ANALYSIS"] = "video_analysis";
    JobType["BATCH_PROCESSING"] = "batch_processing";
    JobType["CLEANUP"] = "cleanup";
})(JobType || (JobType = {}));
var JobStatus;
(function (JobStatus) {
    JobStatus["PENDING"] = "pending";
    JobStatus["PROCESSING"] = "processing";
    JobStatus["COMPLETED"] = "completed";
    JobStatus["FAILED"] = "failed";
    JobStatus["RETRYING"] = "retrying";
    JobStatus["CANCELLED"] = "cancelled";
})(JobStatus || (JobStatus = {}));
// 🚀 COMPREHENSIVE QUEUE MANAGER
class QueueManager {
    constructor() {
        this.jobs = new Map();
        this.handlers = new Map();
        this.processingJobs = new Set();
        this.processInterval = null;
        this.metrics = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            processingStartTime: Date.now()
        };
        this.config = {
            maxConcurrentJobs: 5, // Process max 5 jobs simultaneously
            processInterval: 1000, // Check for new jobs every second
            defaultTimeout: 300000, // 5 minutes default timeout
            maxRetries: 3,
            cleanupInterval: 300000, // Clean old jobs every 5 minutes
        };
        this.registerDefaultHandlers();
        this.startProcessing();
        logger.info('📋 Queue System initialized');
    }
    static getInstance() {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager();
        }
        return QueueManager.instance;
    }
    // 📋 JOB MANAGEMENT
    /**
     * Add job to queue
     */
    async addJob(type, data, userId, options = {}) {
        const jobId = this.generateJobId();
        const job = {
            id: jobId,
            type,
            data,
            status: JobStatus.PENDING,
            priority: options.priority || 1,
            attempts: 0,
            maxAttempts: options.maxAttempts || this.config.maxRetries,
            createdAt: new Date(),
            updatedAt: new Date(),
            userId,
            metadata: options.metadata
        };
        this.jobs.set(jobId, job);
        this.metrics.totalJobs++;
        logger.info(`📋 Job added to queue: ${jobId} (${type}) for user: ${userId}`);
        return jobId;
    }
    /**
     * Get job status
     */
    getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }
    /**
     * Get user's jobs
     */
    getUserJobs(userId) {
        return Array.from(this.jobs.values())
            .filter(job => job.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Cancel job
     */
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job || job.status === JobStatus.COMPLETED) {
            return false;
        }
        job.status = JobStatus.CANCELLED;
        job.updatedAt = new Date();
        this.processingJobs.delete(jobId);
        logger.info(`❌ Job cancelled: ${jobId}`);
        return true;
    }
    // 🔧 JOB HANDLERS
    /**
     * Register job handler
     */
    registerHandler(handler) {
        this.handlers.set(handler.type, handler);
        logger.info(`🔧 Handler registered for: ${handler.type}`);
    }
    /**
     * Register default handlers for our use cases
     */
    registerDefaultHandlers() {
        // YouTube transcript extraction
        this.registerHandler({
            type: JobType.YOUTUBE_TRANSCRIPT,
            concurrency: 3,
            timeout: 60000, // 1 minute
            handler: async (job) => {
                const { youtubeUrl, extractionMethod } = job.data;
                // This will be implemented with actual YouTube extraction logic
                logger.info(`🎬 Processing YouTube transcript: ${youtubeUrl}`);
                // Simulate processing time
                await new Promise(resolve => setTimeout(resolve, 5000));
                return {
                    transcript: `Transcript for ${youtubeUrl}`,
                    method: extractionMethod,
                    wordCount: 1500
                };
            }
        });
        // AI processing
        this.registerHandler({
            type: JobType.AI_PROCESSING,
            concurrency: 2, // Limit AI processing to prevent OpenAI rate limits
            timeout: 180000, // 3 minutes
            handler: async (job) => {
                const { transcript, analysisType, userId } = job.data;
                logger.info(`🤖 Processing AI analysis: ${analysisType} for user: ${userId}`);
                // This will be implemented with actual OpenAI logic
                await new Promise(resolve => setTimeout(resolve, 10000));
                return {
                    summary: `AI-generated summary`,
                    keyPoints: ['Point 1', 'Point 2', 'Point 3'],
                    analysisType,
                    processingTime: '10s'
                };
            }
        });
        // Video analysis (combined transcript + AI)
        this.registerHandler({
            type: JobType.VIDEO_ANALYSIS,
            concurrency: 2,
            timeout: 300000, // 5 minutes
            handler: async (job) => {
                const { youtubeUrl, analysisType, userId } = job.data;
                logger.info(`📊 Processing full video analysis: ${youtubeUrl}`);
                // Step 1: Extract transcript
                const transcriptJobId = await this.addJob(JobType.YOUTUBE_TRANSCRIPT, { youtubeUrl, extractionMethod: 'youtube-transcript' }, userId, { priority: 10 } // High priority for sub-jobs
                );
                // Wait for transcript completion
                const transcriptResult = await this.waitForJob(transcriptJobId);
                // Step 2: Process with AI
                const aiJobId = await this.addJob(JobType.AI_PROCESSING, { transcript: transcriptResult.transcript, analysisType, userId }, userId, { priority: 10 });
                // Wait for AI completion
                const aiResult = await this.waitForJob(aiJobId);
                return {
                    videoUrl: youtubeUrl,
                    transcript: transcriptResult,
                    analysis: aiResult,
                    completedAt: new Date()
                };
            }
        });
        // Cleanup old jobs
        this.registerHandler({
            type: JobType.CLEANUP,
            concurrency: 1,
            timeout: 30000,
            handler: async (job) => {
                const daysOld = job.data.daysOld || 7;
                const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
                let cleaned = 0;
                for (const [jobId, jobData] of this.jobs.entries()) {
                    if (jobData.createdAt < cutoffDate &&
                        (jobData.status === JobStatus.COMPLETED || jobData.status === JobStatus.FAILED)) {
                        this.jobs.delete(jobId);
                        cleaned++;
                    }
                }
                logger.info(`🧹 Cleaned up ${cleaned} old jobs`);
                return { cleaned };
            }
        });
    }
    // ⚙️ PROCESSING ENGINE
    /**
     * Start processing jobs
     */
    startProcessing() {
        this.processInterval = setInterval(async () => {
            await this.processJobs();
        }, this.config.processInterval);
        // Schedule periodic cleanup
        setInterval(async () => {
            await this.addJob(JobType.CLEANUP, { daysOld: 7 }, 'system');
        }, this.config.cleanupInterval);
    }
    /**
     * Process pending jobs
     */
    async processJobs() {
        if (this.processingJobs.size >= this.config.maxConcurrentJobs) {
            return; // Already at max capacity
        }
        // Get pending jobs sorted by priority and creation time
        const pendingJobs = Array.from(this.jobs.values())
            .filter(job => job.status === JobStatus.PENDING)
            .sort((a, b) => {
            // Higher priority first, then older jobs first
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
        // Process jobs up to concurrency limit
        const slotsAvailable = this.config.maxConcurrentJobs - this.processingJobs.size;
        const jobsToProcess = pendingJobs.slice(0, slotsAvailable);
        for (const job of jobsToProcess) {
            this.processJob(job); // Fire and forget
        }
    }
    /**
     * Process individual job
     */
    async processJob(job) {
        const handler = this.handlers.get(job.type);
        if (!handler) {
            logger.error(`❌ No handler found for job type: ${job.type}`);
            this.markJobFailed(job, 'No handler found');
            return;
        }
        // Check concurrency limit for this job type
        const concurrentJobsOfType = Array.from(this.processingJobs)
            .map(jobId => this.jobs.get(jobId))
            .filter(j => j && j.type === job.type).length;
        if (concurrentJobsOfType >= handler.concurrency) {
            return; // Wait for slot to open up
        }
        // Mark as processing
        job.status = JobStatus.PROCESSING;
        job.startedAt = new Date();
        job.updatedAt = new Date();
        job.attempts++;
        this.processingJobs.add(job.id);
        logger.info(`⚙️ Processing job: ${job.id} (${job.type}) - attempt ${job.attempts}`);
        try {
            // Set timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Job timeout')), handler.timeout);
            });
            // Execute handler with timeout
            const result = await Promise.race([
                handler.handler(job),
                timeoutPromise
            ]);
            // Mark as completed
            job.status = JobStatus.COMPLETED;
            job.completedAt = new Date();
            job.updatedAt = new Date();
            job.result = result;
            this.metrics.completedJobs++;
            logger.info(`✅ Job completed: ${job.id} (${job.type})`);
        }
        catch (error) {
            logger.error(`❌ Job failed: ${job.id} (${job.type}) - ${error.message}`);
            if (job.attempts < job.maxAttempts) {
                // Retry with exponential backoff
                job.status = JobStatus.RETRYING;
                job.updatedAt = new Date();
                const delay = Math.min(1000 * Math.pow(2, job.attempts - 1), 30000);
                setTimeout(() => {
                    job.status = JobStatus.PENDING;
                }, delay);
                logger.info(`🔄 Job will retry in ${delay}ms: ${job.id}`);
            }
            else {
                this.markJobFailed(job, error.message);
            }
        }
        finally {
            this.processingJobs.delete(job.id);
        }
    }
    /**
     * Mark job as failed
     */
    markJobFailed(job, error) {
        job.status = JobStatus.FAILED;
        job.error = error;
        job.completedAt = new Date();
        job.updatedAt = new Date();
        this.metrics.failedJobs++;
        logger.error(`❌ Job permanently failed: ${job.id} - ${error}`);
    }
    /**
     * Wait for job completion
     */
    async waitForJob(jobId, timeoutMs = 300000) {
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const job = this.jobs.get(jobId);
                if (!job) {
                    clearInterval(checkInterval);
                    reject(new Error('Job not found'));
                    return;
                }
                if (job.status === JobStatus.COMPLETED) {
                    clearInterval(checkInterval);
                    resolve(job.result);
                    return;
                }
                if (job.status === JobStatus.FAILED || job.status === JobStatus.CANCELLED) {
                    clearInterval(checkInterval);
                    reject(new Error(job.error || 'Job failed'));
                    return;
                }
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(checkInterval);
                    reject(new Error('Wait timeout'));
                    return;
                }
            }, 1000);
        });
    }
    // 📊 METRICS & MONITORING
    /**
     * Get queue metrics
     */
    getMetrics() {
        const jobs = Array.from(this.jobs.values());
        const runtime = (Date.now() - this.metrics.processingStartTime) / 60000; // minutes
        return {
            total: jobs.length,
            pending: jobs.filter(j => j.status === JobStatus.PENDING).length,
            processing: jobs.filter(j => j.status === JobStatus.PROCESSING).length,
            completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
            failed: jobs.filter(j => j.status === JobStatus.FAILED).length,
            throughput: runtime > 0 ? this.metrics.completedJobs / runtime : 0
        };
    }
    /**
     * Get detailed stats
     */
    getDetailedStats() {
        const jobs = Array.from(this.jobs.values());
        return {
            byType: Object.values(JobType).map(type => ({
                type,
                count: jobs.filter(j => j.type === type).length
            })),
            byStatus: Object.values(JobStatus).map(status => ({
                status,
                count: jobs.filter(j => j.status === status).length
            })),
            avgProcessingTime: this.calculateAvgProcessingTime(jobs),
            topUsers: this.getTopUsers(jobs)
        };
    }
    calculateAvgProcessingTime(jobs) {
        const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED && j.startedAt && j.completedAt);
        if (completedJobs.length === 0)
            return 0;
        const totalTime = completedJobs.reduce((sum, job) => {
            return sum + (job.completedAt.getTime() - job.startedAt.getTime());
        }, 0);
        return totalTime / completedJobs.length;
    }
    getTopUsers(jobs) {
        const userCounts = jobs.reduce((acc, job) => {
            acc[job.userId] = (acc[job.userId] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(userCounts)
            .map(([userId, count]) => ({ userId, jobCount: count }))
            .sort((a, b) => b.jobCount - a.jobCount)
            .slice(0, 10);
    }
    // 🔧 UTILITIES
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Graceful shutdown
     */
    async shutdown() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
        }
        // Wait for processing jobs to complete (with timeout)
        const timeout = 30000; // 30 seconds
        const startTime = Date.now();
        while (this.processingJobs.size > 0 && (Date.now() - startTime) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        logger.info('📋 Queue system shutdown complete');
    }
}
// 🎯 EXPORTED INSTANCE AND FUNCTIONS
exports.queue = QueueManager.getInstance();
// 🚀 CONVENIENCE FUNCTIONS
/**
 * Add YouTube video for processing
 */
async function addVideoProcessingJob(youtubeUrl, analysisType, userId, priority = 1) {
    return exports.queue.addJob(JobType.VIDEO_ANALYSIS, { youtubeUrl, analysisType, userId }, userId, { priority, metadata: { source: 'web_interface' } });
}
/**
 * Get job status
 */
function getJobStatus(jobId) {
    return exports.queue.getJob(jobId);
}
/**
 * Get user's processing history
 */
function getUserProcessingHistory(userId) {
    return exports.queue.getUserJobs(userId);
}
/**
 * Wait for job completion with user-friendly wrapper
 */
async function waitForVideoProcessing(jobId, timeoutMinutes = 10) {
    return exports.queue.waitForJob(jobId, timeoutMinutes * 60 * 1000);
}
// 📊 EXPORT METRICS
function getQueueMetrics() {
    return exports.queue.getMetrics();
}
function getQueueStats() {
    return exports.queue.getDetailedStats();
}
