# TubeGPT Deployment Guide

This guide provides step-by-step instructions for deploying TubeGPT to production environments, ensuring all components work together properly.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deploying the Next.js Application](#deploying-the-nextjs-application)
5. [Deploying the Worker Process](#deploying-the-worker-process)
6. [Setting Up Payment Processing](#setting-up-payment-processing)
7. [Verifying and Testing the Deployment](#verifying-and-testing-the-deployment)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting the deployment process, ensure you have:

- A Vercel account for deploying the Next.js application
- A Leapcell account for deploying the worker process
- A Neon database account for PostgreSQL
- An Upstash account for Redis
- A Polar account for payment processing
- OpenAI API credentials
- YouTube API credentials
- Clerk authentication credentials

## Database Setup

### 1. Create a New Neon Database

1. Log in to your Neon account and create a new project
2. Create a new database named `tubegpt` (or your preferred name)
3. Note your connection string, which should look like:
   ```
   postgresql://neondb_owner:password@endpoint.neon.tech/neondb?sslmode=require
   ```

### 2. Initialize the Database Schema

1. Connect to your database using a PostgreSQL client
2. Run the schema creation script:

```sql
-- Execute the schema.sql file to create all tables
-- This will create the complete database structure

-- If you need to reset the database for a fresh start, run:
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

## Environment Configuration

Create a `.env` file for production with the following variables:

```
# Core Configuration
NODE_ENV=production

# Database (REQUIRED)
DATABASE_URL=postgresql://neondb_owner:password@endpoint.neon.tech/neondb?sslmode=require

# Authentication - Clerk (REQUIRED)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# AI Providers (REQUIRED)
OPENAI_API_KEY=your_openai_api_key

# YouTube API (REQUIRED)
YOUTUBE_API_KEY=your_youtube_api_key

# Payment Processing - Polar (REQUIRED)
POLAR_WEBHOOK_SECRET=your_webhook_secret
POLAR_ACCESS_TOKEN=your_access_token
POLAR_SERVER=production
SUCCESS_URL=https://your-production-domain.com/payment/success
CANCEL_URL=https://your-production-domain.com/payment/failure

# Redis - REQUIRED for Production (Rate Limiting + Job Queue)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token
REDIS_URL=rediss://default:password@your-redis-url.upstash.io:6379
DISABLE_REDIS=false

# Error Tracking (HIGHLY RECOMMENDED)
SENTRY_DSN=your_sentry_dsn

# Admin Configuration
ADMIN_USER_IDS=your_admin_user_id

# Monitoring
MONITORING_API_KEY=your_monitoring_api_key

# Cron Jobs
CRON_SECRET=your_cron_secret

# Production Optimizations
TRANSCRIPT_MAX_RETRIES=5
TRANSCRIPT_TIMEOUT_MS=600000
TRANSCRIPT_PARALLEL_DISABLED=false
TRANSCRIPT_CACHE_DISABLED=false
```

## Deploying the Next.js Application

### 1. Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Configure the environment variables as defined above
3. Deploy the application
4. Note your production URL (e.g., `https://tubegpt.vercel.app`)

### 2. Configure Webhook URLs

Update your environment variables with the correct webhook URLs:

```
SUCCESS_URL=https://tubegpt.vercel.app/payment/success
CANCEL_URL=https://tubegpt.vercel.app/payment/failure
```

## Deploying the Worker Process

### 1. Deploy to Leapcell

1. Log in to your Leapcell account
2. Create a new application
3. Connect your GitHub repository
4. Configure the environment variables (same as the Next.js app)
5. Add the following additional variable for deployment detection:
   ```
   DEPLOYMENT_ENV=leapcell
   ```
6. Set the start command to: `npm run worker`
7. Deploy the worker

### 2. Verify Worker Health

1. Access the worker health endpoint: `https://your-worker-url.leapcell.dev/health`
2. Verify it returns a 200 OK response

## Setting Up Payment Processing

### 1. Configure Polar for Production

1. Log in to your Polar dashboard
2. Switch from sandbox to production mode
3. Update your product IDs in `src/config/plans.ts`
4. Configure the webhook URL to point to your production endpoint:
   ```
   https://tubegpt.vercel.app/api/webhook
   ```

### 2. Test Payment Flow

1. Make a test purchase using a real card
2. Verify the webhook receives the event
3. Check that credits are properly allocated
4. Verify the subscription status updates correctly

## Verifying and Testing the Deployment

### 1. Test User Registration and Authentication

1. Create a new user account
2. Verify authentication works correctly
3. Check that user data is saved to the database

### 2. Test Video Processing

1. Submit a YouTube video for processing
2. Verify the job is sent to the worker
3. Check that the summary is generated correctly
4. Verify credits are deducted properly

### 3. Test Subscription Management

1. Purchase a subscription
2. Verify the subscription status updates
3. Check that credit limits are enforced
4. Test cancellation flow

## Troubleshooting

### Redis Connection Issues

If Redis isn't connecting properly:

1. Verify your Redis URLs don't have quotes around them
2. Check that `DISABLE_REDIS` is set to `false`
3. Ensure your firewall allows connections to Redis
4. Try running the `fix-redis.js` script to diagnose issues

### Worker Not Processing Jobs

If the worker isn't processing jobs:

1. Check the worker logs for errors
2. Verify Redis is connected properly
3. Ensure the worker has the same environment variables as the main app
4. Check that the worker health endpoint is responding

### Payment Webhook Issues

If payment webhooks aren't working:

1. Check the webhook URL is correctly configured in Polar
2. Verify the `POLAR_WEBHOOK_SECRET` matches between Polar and your app
3. Look for webhook errors in your application logs
4. Check the `failed_webhooks` table in your database

### Database Connection Issues

If database connections are failing:

1. Verify your `DATABASE_URL` is correct
2. Check that your IP is allowed in the Neon firewall settings
3. Ensure your database user has the correct permissions
4. Try connecting with a PostgreSQL client to verify credentials

## Additional Resources

- [Leapcell Documentation](https://docs.leapcell.dev/)
- [Vercel Documentation](https://vercel.com/docs)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Neon PostgreSQL Documentation](https://neon.tech/docs)
- [Polar Payments Documentation](https://docs.polar.sh/)