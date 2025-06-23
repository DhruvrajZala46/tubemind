# Deploying Your Node.js Worker to Google Cloud Run

## 1. Prerequisites
- Google Cloud account (https://console.cloud.google.com/)
- Google Cloud SDK installed (`gcloud` CLI) or use Google Cloud Shell
- Your Neon DATABASE_URL and any other secrets ready

## 2. Build Your Project (if using TypeScript)
```
npm run build
```

## 3. Build and Push Docker Image
```
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/worker
```

## 4. Deploy to Cloud Run
```
gcloud run deploy worker \
  --image gcr.io/YOUR_PROJECT_ID/worker \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 900
```
- You can set `--timeout` up to 3600 (60 min) if needed.

## 5. Set Environment Variables
- In the Cloud Run console: Service → Edit & Deploy New Revision → Add environment variables (e.g., `DATABASE_URL`)

## 6. Trigger Your Worker
- You will get a public HTTPS URL (e.g., `https://worker-xxxxxx.a.run.app/start`)
- POST to this URL to trigger jobs from your Vercel frontend or API.

## 7. Logs
```
gcloud run services logs read worker
```

## 8. Notes
- Cloud Run auto-scales: each request gets its own container instance.
- You only pay (or use free tier) for actual compute time.
- If you need to change code, repeat build and deploy steps. 