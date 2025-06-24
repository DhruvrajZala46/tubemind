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

// Export empty object for any other imports
export default {
  getQueueStats,
  getQueueHealth
}; 