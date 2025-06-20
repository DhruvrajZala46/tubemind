// Direct Worker Test Script
// This script directly loads the worker code with dummy environment variables

// Set required environment variables
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgresql://test:test@test.neon.tech/test?sslmode=require';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder_key';
process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_key';
process.env.OPENAI_API_KEY = 'sk-placeholder_key';
process.env.LEAPCELL = 'true';
process.env.DEPLOYMENT_ENV = 'leapcell';

console.log('Starting worker in test mode with dummy environment variables...');

// Create mock worker functionality
const mockWorker = {
  on: (event, callback) => {
    console.log(`Registered handler for event: ${event}`);
    return mockWorker;
  }
};

// Mock BullMQ functionality
require.cache[require.resolve('bullmq')] = {
  exports: {
    Queue: class MockQueue {
      constructor() { console.log('Mock Queue created'); }
    },
    Worker: class MockWorker {
      constructor(queueName, processor) { 
        console.log(`Mock Worker created for queue: ${queueName}`);
        // Execute the processor with a mock job to test it
        setTimeout(() => {
          console.log('Executing processor with mock job...');
          processor({
            id: 'mock-job-123',
            data: {
              videoId: 'test-video-id',
              userId: 'test-user-id',
              metadata: { title: 'Test Video' },
              creditsNeeded: 5,
              summaryDbId: 'test-summary-id',
              totalDurationSeconds: 120
            }
          }).catch(err => console.error('Processor error:', err));
        }, 1000);
        return mockWorker;
      }
    },
    Job: class MockJob {}
  }
};

// Mock the database
require.cache[require.resolve('../src/lib/db')] = {
  exports: {
    executeQuery: async (callback) => {
      console.log('Mock database query executed');
      return [];
    }
  }
};

// Now try to load the worker
try {
  require('../src/worker/extract');
  console.log('Worker loaded successfully in test mode');
} catch (error) {
  console.error('Failed to load worker:', error);
} 