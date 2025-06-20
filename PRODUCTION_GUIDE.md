# TubeGPT Production Deployment Guide

This guide provides comprehensive instructions for deploying TubeGPT to production using Vercel for the Next.js application and Leapcell for the worker process.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Redis Configuration](#redis-configuration)
4. [Vercel Deployment](#vercel-deployment)
5. [Leapcell Worker Deployment](#leapcell-worker-deployment)
6. [Payment Processing Setup](#payment-processing-setup)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting the deployment process, ensure you have:

- A [Vercel](https://vercel.com) account for the Next.js application
- A [Leapcell](https://leapcell.io) account for the worker process
- A [Neon](https://neon.tech) account for PostgreSQL database
- An [Upstash](https://upstash.com) account for Redis
- A [Polar](https://polar.sh) account for payment processing
- [OpenAI API](https://openai.com/api/) credentials
- [YouTube API](https://developers.google.com/youtube/v3) credentials
- [Clerk](https://clerk.dev) authentication credentials

## Database Setup

### 1. Prepare Your Production Database

1. Log in to your Neon account and create a new project
2. Create a new database for production
3. Note your connection string for later use

### 2. Initialize the Database Schema

1. Connect to your database using a PostgreSQL client
2. Run the schema creation script from `schema.sql`

### 3. Clean Database (Optional)

If you need to clean the database before going to production:

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

## Redis Configuration

### 1. Set Up Upstash Redis

1. Log in to your Upstash account
2. Create a new Redis database
3. Select the region closest to your users
4. Note the following credentials:
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
   - REDIS_URL

### 2. Important Redis Configuration Notes

- **Remove quotes**: Ensure Redis URLs don't have quotes around them
- **Set DISABLE_REDIS=false**: This enables Redis for job queue and rate limiting
- **Test connection**: Use `fix-redis.js` to test the connection before deployment

## Vercel Deployment

### 1. Prepare Your Environment Variables

Create a `.env.production` file with the following variables:

```
# Core Configuration
NODE_ENV=production

# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@endpoint.neon.tech/dbname?sslmode=require

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

# Error Tracking (RECOMMENDED)
SENTRY_DSN=your_sentry_dsn

# Admin Configuration
ADMIN_USER_IDS=your_admin_user_id
```

### 2. Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Configure the environment variables from your `.env.production` file
3. Set the build command to `npm run build`
4. Set the output directory to `.next`
5. Deploy the application
6. Note your production URL (e.g., `https://tubegpt.vercel.app`)

### 3. Update Success/Cancel URLs

After deployment, update your environment variables with the correct webhook URLs:

```
SUCCESS_URL=https://tubegpt.vercel.app/payment/success
CANCEL_URL=https://tubegpt.vercel.app/payment/failure
```

## Leapcell Worker Deployment

### 1. Prepare for Leapcell Deployment

1. Ensure your code is pushed to GitHub
2. Make sure `src/worker/extract.ts` is properly configured to work in the Leapcell environment

### 2. Deploy to Leapcell

1. Log in to your Leapcell account
2. Create a new application
3. Connect your GitHub repository
4. Configure the environment variables (same as Vercel)
5. Add these additional variables:
   ```
   LEAPCELL=true
   DEPLOYMENT_ENV=leapcell
   ```
6. Set the start command to `node src/worker/extract.ts`
7. Deploy the worker
8. Note your worker URL (e.g., `https://tubegpt-worker.leapcell.dev`)

### 3. Verify Worker Health

After deployment, check the worker health endpoint:

```
https://tubegpt-worker.leapcell.dev/health
```

You should see a JSON response with status "healthy".

## Payment Processing Setup

### 1. Configure Polar for Production

1. Log in to your Polar dashboard
2. Switch from sandbox to production mode
3. Update your product IDs in `src/config/plans.ts` with production IDs
4. Configure the webhook URL to point to your production endpoint:
   ```
   https://tubegpt.vercel.app/api/webhook
   ```

### 2. Update Plan Configuration

Update `src/config/plans.ts` with your production product IDs:

```typescript
export const PLANS = {
  FREE: {
    name: 'Free',
    credits: 60,
    price: 0,
    productId: 'your_free_plan_product_id',
  },
  BASIC: {
    name: 'Basic',
    credits: 1800,
    price: 9.99,
    productId: 'your_basic_plan_product_id',
  },
  PRO: {
    name: 'Pro',
    credits: 6000,
    price: 29.99,
    productId: 'your_pro_plan_product_id',
  },
};
```

## Post-Deployment Verification

### 1. Verify Next.js Application

1. Visit your production URL
2. Test user registration and login
3. Verify dashboard loads correctly
4. Check that API endpoints are working

### 2. Verify Worker Process

1. Check the worker health endpoint
2. Submit a test video for processing
3. Verify the job is sent to the worker
4. Check that the summary is generated correctly

### 3. Verify Payment Processing

1. Test purchasing a subscription
2. Verify webhook events are received
3. Check that user subscription status updates
4. Verify credit allocation works correctly

## Troubleshooting

### Redis Connection Issues

If Redis isn't connecting properly:

1. Check that Redis URLs don't have quotes around them
2. Verify `DISABLE_REDIS` is set to `false`
3. Check network connectivity between Vercel/Leapcell and Upstash
4. Verify Redis credentials are correct

### Worker Not Processing Jobs

If the worker isn't processing jobs:

1. Check the Leapcell logs for errors
2. Verify Redis is connected properly
3. Ensure environment variables match between Vercel and Leapcell
4. Check that the worker health endpoint returns "healthy"

### Payment Webhook Issues

If payment webhooks aren't working:

1. Verify webhook URL is correctly configured in Polar
2. Check that `POLAR_WEBHOOK_SECRET` matches between Polar and your app
3. Look for webhook errors in your application logs
4. Check the `failed_webhooks` table in your database

### Database Connection Issues

If database connections are failing:

1. Verify your `DATABASE_URL` is correct
2. Check that your IP is allowed in the Neon firewall settings
3. Ensure your database user has the correct permissions

## Final Checklist

Before announcing your production deployment:

- [ ] Next.js application deployed and accessible
- [ ] Worker process deployed and healthy
- [ ] Database schema initialized correctly
- [ ] Redis connection working properly
- [ ] Payment processing configured and tested
- [ ] Webhooks receiving events correctly
- [ ] User registration and login working
- [ ] Video processing working end-to-end
- [ ] Subscription management working correctly
- [ ] Error handling and monitoring in place 