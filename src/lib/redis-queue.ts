// Redis Queue - Legacy compatibility stub
// This file exists for backward compatibility with existing imports
// The actual queue functionality has been migrated to Cloud Tasks

import { createLogger } from './logger';

const logger = createLogger('redis-queue-stub');

// Stub functions for backward compatibility
export function getQueueStats() {
  logger.warn('Redis queue stats called - migrated to Cloud Tasks');
  return {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0
  };
}

export function getQueueHealth() {
  logger.warn('Redis queue health called - migrated to Cloud Tasks');
  return {
    isConnected: false,
    isEnabled: false,
    url: 'migrated-to-cloud-tasks'
  };
}

// Additional stub functions for health check compatibility
export function checkRedisHealth() {
  logger.warn('Redis health check called - migrated to Cloud Tasks');
  return {
    status: 'healthy',
    message: 'Queue migrated to Cloud Tasks',
    isConnected: false
  };
}

export function getRedisQueueStats() {
  logger.warn('Redis queue stats called - migrated to Cloud Tasks');
  return getQueueStats();
}

// Legacy Redis queue functions - all stubs for Cloud Tasks migration
export async function addJobToRedisQueue(jobData: any) {
  logger.warn('addJobToRedisQueue called - migrated to Cloud Tasks');
  return { jobId: 'migrated-to-cloud-tasks', usedRedis: false };
}

export async function getNextJobFromRedis(): Promise<any | null> {
  logger.warn('getNextJobFromRedis called - migrated to Cloud Tasks');
  return null;
}

export async function markJobCompleted(jobId: string) {
  logger.warn('markJobCompleted called - migrated to Cloud Tasks');
  return true;
}

export async function markJobFailed(jobId: string, error?: string) {
  logger.warn('markJobFailed called - migrated to Cloud Tasks');
  return true;
}

export async function getJobStatus(jobId: string) {
  logger.warn('getJobStatus called - migrated to Cloud Tasks');
  return { status: 'migrated-to-cloud-tasks' };
}

export async function removeCompletedJobs() {
  logger.warn('removeCompletedJobs called - migrated to Cloud Tasks');
  return 0;
}

export async function initializeRedisQueue() {
  logger.warn('initializeRedisQueue called - migrated to Cloud Tasks');
  return true;
}

export function isRedisAvailable() {
  logger.warn('isRedisAvailable called - migrated to Cloud Tasks');
  return false;
}

export async function cleanCorruptedData() {
  logger.warn('cleanCorruptedData called - migrated to Cloud Tasks');
  return 0;
}

// Export empty object for any other imports
export default {
  getQueueStats,
  getQueueHealth
}; 