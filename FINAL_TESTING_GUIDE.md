# TubeGPT Final Testing Guide

This guide provides comprehensive instructions for testing all components of TubeGPT before and after deployment to ensure everything works correctly.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Database Testing](#database-testing)
3. [Redis Testing](#redis-testing)
4. [Worker Process Testing](#worker-process-testing)
5. [Payment Processing Testing](#payment-processing-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## Environment Setup

Before testing, ensure your environment is properly configured:

### Local Development Environment

1. Create a `.env.local` file with all required variables:
   ```
   # Core Configuration
   NODE_ENV=development
   
   # Database
   DATABASE_URL=postgresql://neondb_owner:password@endpoint.neon.tech/neondb?sslmode=require
   
   # Authentication - Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
   CLERK_SECRET_KEY=your_secret_key
   
   # AI Providers
   OPENAI_API_KEY=your_openai_api_key
   
   # YouTube API
   YOUTUBE_API_KEY=your_youtube_api_key
   
   # Payment Processing - Polar
   POLAR_WEBHOOK_SECRET=your_webhook_secret
   POLAR_ACCESS_TOKEN=your_access_token
   POLAR_SERVER=sandbox
   
   # Redis Configuration
   UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   REDIS_URL=rediss://default:password@your-redis-url.upstash.io:6379
   DISABLE_REDIS=false
   ```

2. Run the environment validation script:
   ```bash
   node fix-env.js
   ```

3. Fix any issues reported by the validation script.

## Database Testing

### 1. Connection Testing

1. Run the database connection test:
   ```bash
   node test-fixes.js --test=database
   ```

2. Verify the output shows a successful connection.

### 2. Schema Validation

1. Run the schema validation test:
   ```bash
   node test-fixes.js --test=schema
   ```

2. Ensure all required tables and columns exist.

### 3. Reset Database (Optional)

To start with a clean database for testing:

```sql
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN 
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'TRUNCATE TABLE ' || quote_ident(rec.tablename) || ' RESTART IDENTITY CASCADE;';
  END LOOP;
END
$$;
```

## Redis Testing

### 1. Redis Connection Test

1. Run the Redis connection test:
   ```bash
   node fix-redis.js
   ```

2. Verify the output shows a successful connection.

### 2. Job Queue Testing

1. Start the worker process:
   ```bash
   node dev-worker.js
   ```

2. In another terminal, run the job queue test:
   ```bash
   node test-worker.js
   ```

3. Verify jobs are being processed by the worker.

### 3. Common Redis Issues

- **Quotes in URLs**: Ensure Redis URLs don't have quotes around them
- **Windows Permission Issues**: On Windows, you may need to set `DISABLE_REDIS=true` for local testing
- **Connection Timeout**: Check your network connection and firewall settings

## Worker Process Testing

### 1. Local Worker Testing

1. Start the worker process:
   ```bash
   node dev-worker.js
   ```

2. Check the worker health endpoint:
   ```bash
   curl http://localhost:8002/health
   ```

3. Submit a test job:
   ```bash
   node direct-worker-test.js
   ```

### 2. Production Worker Testing

1. Deploy the worker to Leapcell
2. Check the worker health endpoint:
   ```bash
   curl https://your-worker-url.leapcell.dev/health
   ```

3. Submit a test job through the main application

## Payment Processing Testing

### 1. Webhook Testing

1. Start the application:
   ```bash
   npm run dev
   ```

2. Run the webhook test:
   ```bash
   node test-payment-system.js
   ```

3. Verify webhook events are processed correctly.

### 2. Subscription Flow Testing

1. Test creating a subscription:
   ```bash
   node test-subscription.js
   ```

2. Verify the subscription is created in the database.

3. Test subscription status updates:
   ```bash
   node test-subscription-simple.js
   ```

### 3. Payment Redirect Testing

1. Start the application:
   ```bash
   npm run dev
   ```

2. Navigate to the pricing page
3. Purchase a subscription
4. Verify redirect to success/failure page works
5. Check database for subscription status update

## End-to-End Testing

### 1. User Registration and Authentication

1. Start the application:
   ```bash
   npm run dev
   ```

2. Register a new user
3. Verify user is created in the database
4. Test login functionality

### 2. Video Processing Flow

1. Submit a YouTube video for processing
2. Verify job is sent to the worker
3. Check database for status updates
4. Verify summary is generated correctly
5. Check credit deduction

### 3. Production Simulation

1. Run the production simulation:
   ```bash
   node start-prod.js
   ```

2. Test all features in production-like environment

## Troubleshooting Common Issues

### Redis Connection Issues

If Redis isn't connecting:

1. Check for quotes in Redis URLs:
   ```bash
   type .env.local | findstr REDIS
   ```

2. Remove quotes if present:
   ```bash
   node -e "const fs = require('fs'); const content = fs.readFileSync('.env.local', 'utf8').replace(/UPSTASH_REDIS_REST_URL=\"([^\"]+)\"/, 'UPSTASH_REDIS_REST_URL=$1').replace(/UPSTASH_REDIS_REST_TOKEN=\"([^\"]+)\"/, 'UPSTASH_REDIS_REST_TOKEN=$1'); fs.writeFileSync('.env.local', content);"
   ```

3. Set `DISABLE_REDIS=false`:
   ```bash
   node -e "const fs = require('fs'); const content = fs.readFileSync('.env.local', 'utf8').replace(/DISABLE_REDIS=true/, 'DISABLE_REDIS=false'); fs.writeFileSync('.env.local', content);"
   ```

### Database Connection Issues

If database connection fails:

1. Check the database URL format
2. Verify credentials are correct
3. Test connection with a PostgreSQL client
4. Check IP allowlist in Neon dashboard

### Payment Webhook Issues

If payment webhooks aren't working:

1. Verify webhook URL in Polar dashboard
2. Check webhook secret matches
3. Look for webhook errors in logs
4. Check the `failed_webhooks` table in database

### Worker Not Processing Jobs

If worker isn't processing jobs:

1. Check if Redis is connected
2. Verify worker health endpoint is responding
3. Check worker logs for errors
4. Ensure environment variables match between app and worker

By following this testing guide, you can ensure all components of TubeGPT are working correctly before deploying to production. 