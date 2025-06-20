# Leapcell Deployment Guide

## Step 1: Set Up Environment Variables

When deploying to Leapcell, add these environment variables to your Leapcell dashboard:

```
# Database
DATABASE_URL=postgresql://username:password@your-host.neon.tech/database?sslmode=require

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard/new
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard/new

# Polar Payment System
POLAR_ACCESS_TOKEN=polar_at_your_token
POLAR_WEBHOOK_SECRET=wh_your_webhook_secret
POLAR_ENVIRONMENT=production  # Change to production for live payments

# External APIs
YOUTUBE_API_KEY=AIza_your_youtube_key
OPENAI_API_KEY=sk-your_openai_key

# Redis (Optional in Leapcell due to permission issues)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# App Configuration
NEXTAUTH_URL=https://your-leapcell-app.leapcell.io
NODE_ENV=production
WORKER_PORT=8001

# Leapcell Specific
LEAPCELL=true
DEPLOYMENT_ENV=leapcell
```

## Step 2: Deploy Your Application

1. Connect your GitHub repository to Leapcell
2. Set the environment variables above
3. Deploy your application

## Step 3: Configure Worker Process

Leapcell will automatically run your worker process as specified in your `package.json`. The worker will:

1. Use environment variables directly (no .env.local file needed)
2. Fall back to in-memory processing if Redis has permission issues
3. Process jobs correctly even without Redis

## Step 4: Verify Deployment

After deployment:

1. Check the worker health endpoint: `https://your-app.leapcell.io/api/health`
2. Test video processing with a short video
3. Verify that credits are properly deducted

## Troubleshooting

If you encounter issues:

1. Check Leapcell logs for errors
2. Verify all environment variables are set correctly
3. Make sure your database is accessible from Leapcell
4. If Redis issues persist, the app will automatically use in-memory processing

## Going to Production

When ready to go live:

1. Change `POLAR_ENVIRONMENT` to `production`
2. Update product IDs in `src/config/plans.ts` if needed
3. Set `NODE_ENV` to `production` 