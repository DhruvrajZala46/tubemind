# TubeGPT Testing Guide

This guide provides comprehensive instructions for testing the TubeGPT application in both development and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Development Testing](#development-testing)
4. [Production Testing](#production-testing)
5. [Worker Process Testing](#worker-process-testing)
6. [Troubleshooting](#troubleshooting)
7. [Deployment Checklist](#deployment-checklist)

## Prerequisites

Before testing, ensure you have the following:

- Node.js v16+ installed
- npm v7+ installed
- PostgreSQL database (local or remote)
- Redis server (optional but recommended)
- YouTube API key
- Clerk authentication keys

## Environment Setup

1. **Create your environment file**:

   ```bash
   # Copy the development environment template
   cp dev.env .env.local
   ```

2. **Fix environment variables**:

   ```bash
   # Run the environment fixer script to remove problematic quotes
   node fix-env.js
   ```

3. **Validate your setup**:

   ```bash
   # Check that your environment is properly configured
   node test-deployment.js
   ```

## Development Testing

### Starting the Application

1. **Start the Next.js development server**:

   ```bash
   npm run dev
   ```

   This will start the Next.js application on http://localhost:8000.

2. **Start the worker process in development mode**:

   ```bash
   # Method 1: Using the dev-worker script
   npm run dev-worker

   # Method 2: Using the worker shell script
   bash start-worker.sh
   ```

### Testing Video Processing

1. **Submit a video for processing**:
   - Navigate to http://localhost:8000/dashboard/new
   - Enter a YouTube URL and submit
   - The video should be queued for processing

2. **Monitor the worker process**:
   - Check the worker console output for processing status
   - The worker health endpoint is available at http://localhost:8002/health

## Production Testing

### Starting the Application in Production Mode

1. **Build the application**:

   ```bash
   npm run build
   ```

2. **Start the application in production mode**:

   ```bash
   # Method 1: Using the production starter script
   WORKER_ENABLED=true node start-prod.js

   # Method 2: Manual start
   npm run start
   # In a separate terminal
   bash start-worker.sh
   ```

### Testing Production Features

1. **Test rate limiting**: Submit multiple requests in quick succession
2. **Test error recovery**: Intentionally cause errors and verify recovery
3. **Test subscription features**: Verify credit consumption and limits

## Worker Process Testing

The worker process is responsible for processing video extraction jobs. Here's how to test it:

1. **Verify worker is running**:

   ```bash
   # Check health endpoint
   curl http://localhost:8002/health
   ```

2. **Submit a test job**:

   ```bash
   # Use the test script
   node test-worker.js
   ```

3. **Monitor job processing**:
   - Check worker logs for processing steps
   - Verify database updates for job status

## Troubleshooting

### Common Issues and Solutions

#### Redis Connection Issues

If you see Redis connection errors:

```
[ioredis] Unhandled error event: Error: connect EPERM /
```

Solutions:
- Run `node fix-env.js` to remove quotes from Redis URL
- Verify Redis is running and accessible
- Set `REDIS_URL=` (empty) to use in-memory processing instead

#### Worker Not Starting

If the worker fails to start:

```
TypeError: (0 , import_job_queue.createVideoWorker) is not a function
```

Solutions:
- Verify you're using the latest worker code
- Check that job-queue.ts exports the required functions
- Use `npm run dev-worker` which includes proper TypeScript support

#### Database Connection Errors

If you see database connection errors:

```
Error fetching user subscription: NeonDbError: Error connecting to database
```

Solutions:
- Check your DATABASE_URL in .env.local
- Verify the database is accessible from your network
- Run `node fix-env.js` to fix potential quote issues

## Deployment Checklist

Before deploying to production:

1. **Environment Variables**:
   - Remove all quotes from connection strings
   - Set `NODE_ENV=production`
   - Configure proper Redis URL

2. **Worker Configuration**:
   - Set `WORKER_ENABLED=true`
   - Configure proper scaling for your expected load

3. **Final Testing**:
   - Test the complete flow in production mode
   - Verify worker process auto-recovery
   - Check all API endpoints

4. **Monitoring Setup**:
   - Enable logging
   - Set up alerts for worker failures
   - Monitor Redis and database connections 