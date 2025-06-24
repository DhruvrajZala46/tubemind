// Production-Grade Cloud Tasks Worker
import 'dotenv/config';
import express from 'express';
import { processVideoJob } from '../lib/video-processor';
import { createLogger } from '../lib/logger';

const app = express();
const logger = createLogger('cloud-tasks-worker');

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    userAgent: req.get('user-agent'),
    contentLength: req.get('content-length')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    service: 'tubemind-worker',
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Main Cloud Tasks job processor
app.post('/', async (req, res) => {
  const startTime = Date.now();
  let jobData: any = null;
  
  try {
    // Parse job data from Cloud Tasks
    jobData = req.body;
    
    if (!jobData) {
      logger.error('No job data received');
      return res.status(400).json({ error: 'No job data provided' });
    }

    logger.info('Processing job', { 
      jobType: jobData.type || 'video-processing',
      videoId: jobData.videoId,
      userId: jobData.userId 
    });

    // Process the video job
    await processVideoJob(jobData);
    
    const processingTime = Date.now() - startTime;
    logger.info('Job completed successfully', { 
      videoId: jobData.videoId,
      processingTimeMs: processingTime 
    });

    res.status(200).json({ 
      status: 'completed',
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Job processing failed', {
      error: errorMessage,
      videoId: jobData?.videoId,
      userId: jobData?.userId,
      processingTimeMs: processingTime,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return appropriate error status for Cloud Tasks retry logic
    if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      // Retryable error
      res.status(429).json({ 
        error: 'Rate limited - will retry',
        retryable: true 
      });
    } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      // Non-retryable error
      res.status(401).json({ 
        error: 'Authentication failed',
        retryable: false 
      });
    } else {
      // Generic retryable error
      res.status(500).json({ 
        error: 'Job processing failed',
        retryable: true 
      });
    }
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { 
    error: err.message,
    stack: err.stack,
    path: req.path 
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    retryable: true 
  });
});

// Graceful shutdown
const server = app.listen(process.env.PORT || 8080, () => {
  logger.info(`Cloud Tasks worker listening on port ${process.env.PORT || 8080}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default app;