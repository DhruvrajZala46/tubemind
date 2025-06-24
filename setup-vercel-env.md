# Vercel Environment Variables Setup

To fix the video processing issue, you need to add these environment variables to your Vercel project:

## Required Variables for Cloud Tasks Integration:

```bash
GCP_PROJECT=agile-entry-463508-u6
CLOUD_TASKS_QUEUE=video-processing-queue  
CLOUD_TASKS_LOCATION=us-central1
WORKER_SERVICE_URL=https://tubemind-worker-304961481608.us-central1.run.app
```

## How to Add Them:

### Option 1: Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Find your project (tubemind)
3. Go to Settings → Environment Variables
4. Add each variable above

### Option 2: Vercel CLI (if linked)
```bash
vercel env add GCP_PROJECT
# Enter: agile-entry-463508-u6

vercel env add CLOUD_TASKS_QUEUE  
# Enter: video-processing-queue

vercel env add CLOUD_TASKS_LOCATION
# Enter: us-central1

vercel env add WORKER_SERVICE_URL
# Enter: https://tubemind-worker-304961481608.us-central1.run.app
```

### Option 3: Local Development (.env.local)
Create a `.env.local` file in your project root with:
```env
GCP_PROJECT=agile-entry-463508-u6
CLOUD_TASKS_QUEUE=video-processing-queue
CLOUD_TASKS_LOCATION=us-central1
WORKER_SERVICE_URL=https://tubemind-worker-304961481608.us-central1.run.app
```

## After Adding Variables:
1. Redeploy your Vercel project
2. Test video submission
3. Check Cloud Run logs for worker activity

The fix I applied will now create Cloud Tasks that trigger your worker service directly! 