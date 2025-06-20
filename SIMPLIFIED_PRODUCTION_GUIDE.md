# TubeGPT Simplified Production Guide

This guide provides straightforward instructions for deploying TubeGPT to production.

## 1. Preparation

### Check Product IDs
1. Verify your Polar product IDs match what's in the code:
   - Sandbox Basic: `5ee6ffad-ea07-47bf-8219-ad7b77ce4e3f`
   - Sandbox Pro: `a0cb28d8-e607-4063-b3ea-c753178bbf53`
   - If they don't match, update them in:
     - `src/config/plans.ts`
     - `src/app/api/webhook/route.ts`

### Test Locally
1. Run `node test-payment-webhook.js your-email@example.com`
2. Verify subscription updates work correctly

## 2. Database Setup

1. Create a Neon PostgreSQL database
2. Run the schema.sql file to create all tables
3. Note your connection string

## 3. Redis Setup

1. Create an Upstash Redis database
2. Note your connection details:
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
   - REDIS_URL

## 4. Vercel Deployment (Frontend)

1. Connect your GitHub repository to Vercel
2. Set these environment variables:
   ```
   # Core Configuration
   NODE_ENV=production
   
   # Database
   DATABASE_URL=your-neon-connection-string
   
   # Authentication - Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
   CLERK_SECRET_KEY=your-clerk-secret-key
   
   # AI Providers
   OPENAI_API_KEY=your-openai-api-key
   
   # YouTube API
   YOUTUBE_API_KEY=your-youtube-api-key
   
   # Payment Processing - Polar
   POLAR_WEBHOOK_SECRET=your-polar-webhook-secret
   POLAR_ACCESS_TOKEN=your-polar-access-token
   POLAR_SERVER=production
   POLAR_ENVIRONMENT=production
   SUCCESS_URL=https://your-production-domain.com/payment/success
   CANCEL_URL=https://your-production-domain.com/payment/failure
   
   # Redis
   UPSTASH_REDIS_REST_URL=your-redis-rest-url
   UPSTASH_REDIS_REST_TOKEN=your-redis-rest-token
   REDIS_URL=your-redis-connection-string
   DISABLE_REDIS=false
   ```
3. Deploy the application
4. Note your production URL

## 5. Leapcell Deployment (Worker)

1. Create a new Leapcell application
2. Connect your GitHub repository
3. Use the same environment variables as Vercel
4. Add these additional variables:
   ```
   LEAPCELL=true
   DEPLOYMENT_ENV=leapcell
   ```
5. Set the start command to: `npm run worker`
6. Deploy the worker

## 6. Configure Polar for Production

1. Log in to your Polar dashboard
2. Switch to production mode
3. Get your production product IDs
4. Update them in your code:
   ```javascript
   // In src/config/plans.ts
   production: {
     basic: "your-production-basic-id",
     pro: "your-production-pro-id"
   }
   
   // In src/app/api/webhook/route.ts
   const PLAN_PRODUCT_IDS = {
     basic: 'your-production-basic-id',
     pro: 'your-production-pro-id',
   };
   ```
5. Set your webhook URL to:
   ```
   https://your-production-domain.com/api/webhook
   ```

## 7. Final Testing

1. Create a test user account
2. Purchase a subscription
3. Verify the webhook receives the event
4. Submit a video for processing
5. Verify the job is sent to the worker
6. Check that the summary is generated correctly

## Troubleshooting

### Payment Issues
- Verify product IDs match between Polar and your code
- Check webhook URL is correctly configured
- Verify POLAR_WEBHOOK_SECRET matches

### Worker Issues
- Check worker logs for errors
- Verify Redis is connected properly
- Ensure the worker has the same environment variables as the main app

### Redis Issues
- Verify Redis URLs don't have quotes around them
- Set DISABLE_REDIS=false
- Check that your IP is allowed in Redis firewall settings 