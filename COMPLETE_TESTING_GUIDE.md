# Complete TubeGPT Testing & Production Guide

This guide explains how to test your TubeGPT application locally and deploy it to production.

## 🧪 Local Testing (Complete System)

### Step 1: Fix Environment Variables

First, make sure your `.env.local` file has all required variables without quotes:

```bash
# Database
DATABASE_URL=postgresql://username:password@your-host.neon.tech/database?sslmode=require

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key

# OpenAI
OPENAI_API_KEY=sk-your_key

# YouTube
YOUTUBE_API_KEY=AIza_your_key

# Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
REDIS_URL=rediss://default:token@your-redis.upstash.io:6379

# Polar Payments (SANDBOX)
POLAR_WEBHOOK_SECRET=your_webhook_secret
POLAR_ACCESS_TOKEN=polar_oat_your_token
POLAR_SERVER=sandbox
```

Run the fix-env script to remove any problematic quotes:
```bash
npm run fix-env
```

### Step 2: Start the Complete System

Run the development setup that starts both the Next.js app and worker:
```bash
npm run dev-setup
```

This will:
- Start Next.js on port 3000
- Start the worker on port 8002
- Use Redis if available (or fall back to in-memory)

### Step 3: Test Each Feature

#### Video Processing
1. Go to http://localhost:3000
2. Sign in with Clerk
3. Go to dashboard
4. Submit a YouTube URL
5. Watch the processing status

#### Payment System
1. Go to http://localhost:3000/pricing
2. Click "Upgrade to Basic" or "Upgrade to Pro"
3. Complete the sandbox payment flow
4. Verify credits are added to your account

#### Webhook Testing
Use ngrok to test webhooks locally:
```bash
ngrok http 3000
```

Then update your Polar webhook URL to the ngrok URL.

### Step 4: Test Production-Like Environment

To test in a production-like environment:
```bash
npm run prod-test
```

This builds and runs the app in production mode.

## 🚀 Production Deployment

### Step 1: Update Environment Variables

For production, update these environment variables:

```
# Change to production
POLAR_SERVER=production

# Update product IDs in src/config/plans.ts
# Use the production product IDs from your Polar dashboard

# Set production URLs
NEXTAUTH_URL=https://your-production-domain.com
```

### Step 2: Update Product IDs

Edit `src/config/plans.ts` to use production product IDs:

```typescript
const PRODUCT_IDS = {
  sandbox: {
    basic: "861cd62e-ceb6-4beb-8c06-43a8652eae8c",
    pro: "4b2f5d5d-cba5-4ec2-b80e-d9053eec75b5"
  },
  production: {
    basic: "YOUR_PRODUCTION_BASIC_ID", 
    pro: "YOUR_PRODUCTION_PRO_ID"
  }
};
```

### Step 3: Update Webhook URLs

In your Polar dashboard:
1. Go to Settings > Webhooks
2. Update the webhook URL to your production URL
3. Make sure the webhook secret matches your POLAR_WEBHOOK_SECRET

### Step 4: Deploy to Leapcell.io

When deploying to Leapcell.io:

1. Set these environment variables:
   ```
   LEAPCELL=true
   DEPLOYMENT_ENV=leapcell
   ```

2. Make sure the worker script is configured to run:
   ```
   npm run worker:prod
   ```

### Step 5: Verify Production Deployment

After deploying:

1. Check the worker health endpoint:
   ```
   https://your-domain.com/api/health
   ```

2. Test the complete user flow:
   - Sign up
   - Process a video
   - Make a payment
   - Verify credits are added

## 🔍 Troubleshooting

### Redis Issues

If you see Redis errors like `NOPERM this user has no permissions`:

1. The system will automatically fall back to in-memory processing
2. For full Redis functionality, upgrade your Upstash plan

### Worker Not Starting

If the worker doesn't start:

1. Check logs for `.env.local not found` errors
2. In Leapcell, use the `npm run worker:prod` command

### Payment Issues

If payments aren't working:

1. Verify product IDs match between code and Polar dashboard
2. Check webhook URL and secret
3. Test with sandbox mode first

### Database Connection Issues

If you see database errors:

1. Verify DATABASE_URL is correct
2. Check for quotes around the URL
3. Run `npm run fix-env` to fix common issues

## 🧠 Remember

- In development: Use `npm run dev-setup` for complete testing
- For production: Update product IDs and set `POLAR_SERVER=production`
- For Leapcell: Set `LEAPCELL=true` and `DEPLOYMENT_ENV=leapcell` 