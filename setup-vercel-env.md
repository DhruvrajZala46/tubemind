# Vercel Environment Variables Setup

To fix the video processing issue, you need to add this environment variable to your Vercel project:

## Required Variables for Worker Integration:

```bash
WORKER_SERVICE_URL=https://tubemind-worker-304961481608.us-central1.run.app
```

**Note:** The system now uses direct HTTP calls to the worker instead of Cloud Tasks SDK to avoid Vercel compatibility issues.

## How to Add Them:

### Option 1: Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Find your project (tubemind)
3. Go to Settings → Environment Variables
4. Add each variable above

### Option 2: Vercel CLI (if linked)
```bash
vercel env add WORKER_SERVICE_URL
# Enter: https://tubemind-worker-304961481608.us-central1.run.app
```

### Option 3: Local Development (.env.local)
Create a `.env.local` file in your project root with:
```env
WORKER_SERVICE_URL=https://tubemind-worker-304961481608.us-central1.run.app
```

## After Adding Variables:
1. Redeploy your Vercel project
2. Test video submission
3. Check Cloud Run logs for worker activity

The fix I applied will now directly call your worker service via HTTP, bypassing Cloud Tasks SDK issues on Vercel! 