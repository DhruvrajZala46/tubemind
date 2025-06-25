"use strict";
// Redis Queue - Legacy compatibility stub
// This file exists for backward compatibility with existing imports
// The actual queue functionality has been migrated to Cloud Tasks
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueueStats = getQueueStats;
exports.getQueueHealth = getQueueHealth;
exports.checkRedisHealth = checkRedisHealth;
exports.getRedisQueueStats = getRedisQueueStats;
exports.addJobToRedisQueue = addJobToRedisQueue;
exports.getNextJobFromRedis = getNextJobFromRedis;
exports.markJobCompleted = markJobCompleted;
exports.markJobFailed = markJobFailed;
exports.getJobStatus = getJobStatus;
exports.removeCompletedJobs = removeCompletedJobs;
exports.initializeRedisQueue = initializeRedisQueue;
exports.isRedisAvailable = isRedisAvailable;
exports.cleanCorruptedData = cleanCorruptedData;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('redis-queue-stub');
// Stub functions for backward compatibility
function getQueueStats() {
    logger.warn('Redis queue stats called - migrated to Cloud Tasks');
    return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
    };
}
function getQueueHealth() {
    logger.warn('Redis queue health called - migrated to Cloud Tasks');
    return {
        isConnected: false,
        isEnabled: false,
        url: 'migrated-to-cloud-tasks'
    };
}
// Additional stub functions for health check compatibility
function checkRedisHealth() {
    logger.warn('Redis health check called - migrated to Cloud Tasks');
    return {
        status: 'healthy',
        message: 'Queue migrated to Cloud Tasks',
        isConnected: false
    };
}
function getRedisQueueStats() {
    logger.warn('Redis queue stats called - migrated to Cloud Tasks');
    return getQueueStats();
}
// Legacy Redis queue functions - all stubs for Cloud Tasks migration
async function addJobToRedisQueue(jobData) {
    logger.warn('addJobToRedisQueue called - migrated to Cloud Tasks');
    return { jobId: 'migrated-to-cloud-tasks', usedRedis: false };
}
async function getNextJobFromRedis() {
    logger.warn('getNextJobFromRedis called - migrated to Cloud Tasks');
    return null;
}
async function markJobCompleted(jobId) {
    logger.warn('markJobCompleted called - migrated to Cloud Tasks');
    return true;
}
async function markJobFailed(jobId, error) {
    logger.warn('markJobFailed called - migrated to Cloud Tasks');
    return true;
}
async function getJobStatus(jobId) {
    logger.warn('getJobStatus called - migrated to Cloud Tasks');
    return { status: 'migrated-to-cloud-tasks' };
}
async function removeCompletedJobs() {
    logger.warn('removeCompletedJobs called - migrated to Cloud Tasks');
    return 0;
}
async function initializeRedisQueue() {
    logger.warn('initializeRedisQueue called - migrated to Cloud Tasks');
    return true;
}
function isRedisAvailable() {
    logger.warn('isRedisAvailable called - migrated to Cloud Tasks');
    return false;
}
async function cleanCorruptedData() {
    logger.warn('cleanCorruptedData called - migrated to Cloud Tasks');
    return 0;
}
// Export empty object for any other imports
exports.default = {
    getQueueStats,
    getQueueHealth
};
