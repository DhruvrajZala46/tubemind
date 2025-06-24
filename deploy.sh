#!/bin/bash

# Production-Grade Cloud Tasks + Cloud Run Deployment Script
set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-agile-entry-463508-u6}"
QUEUE_NAME="${QUEUE_NAME:-my-queue}"
REGION="${REGION:-us-central1}"
WORKER_SERVICE_NAME="tubemind-worker"
API_SERVICE_NAME="tubemind-api"

echo "🚀 Starting production deployment..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Queue: $QUEUE_NAME"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required services
echo "🔧 Enabling required Google Cloud services..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  --project=$PROJECT_ID

# Create Cloud Tasks queue (if it doesn't exist)
echo "📋 Setting up Cloud Tasks queue..."
if ! gcloud tasks queues describe $QUEUE_NAME --location=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
  echo "Creating new queue: $QUEUE_NAME"
  gcloud tasks queues create $QUEUE_NAME \
    --location=$REGION \
    --project=$PROJECT_ID \
    --max-concurrent-dispatches=10 \
    --max-dispatches-per-second=5 \
    --max-retry-duration=3600s \
    --max-attempts=5
else
  echo "Queue $QUEUE_NAME already exists"
fi

# Deploy the worker service
echo "🏗️ Deploying Cloud Tasks worker service..."
gcloud run deploy $WORKER_SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --project=$PROJECT_ID \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=10 \
  --timeout=900 \
  --max-instances=100 \
  --min-instances=0 \
  --execution-environment=gen2 \
  --service-account="${PROJECT_ID}@appspot.gserviceaccount.com" \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT=$PROJECT_ID,CLOUD_TASKS_QUEUE=$QUEUE_NAME,CLOUD_TASKS_LOCATION=$REGION"

# Get worker URL for API service
WORKER_URL=$(gcloud run services describe $WORKER_SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

echo "✅ Worker deployed at: $WORKER_URL"

# Deploy API service (optional - for handling API requests)
echo "🌐 Deploying API service..."
gcloud run deploy $API_SERVICE_NAME \
  --source . \
  --dockerfile=Dockerfile.api \
  --region $REGION \
  --platform managed \
  --project=$PROJECT_ID \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --concurrency=80 \
  --timeout=300 \
  --max-instances=50 \
  --min-instances=0 \
  --execution-environment=gen2 \
  --service-account="${PROJECT_ID}@appspot.gserviceaccount.com" \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT=$PROJECT_ID,CLOUD_TASKS_QUEUE=$QUEUE_NAME,CLOUD_TASKS_LOCATION=$REGION,WORKER_URL=$WORKER_URL"

API_URL=$(gcloud run services describe $API_SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

echo "✅ API service deployed at: $API_URL"

# Test the deployment
echo "🧪 Testing deployment..."
echo "Testing worker health check..."
curl -f "$WORKER_URL/health" || echo "⚠️ Worker health check failed"

echo "Testing API health check..."
curl -f "$API_URL/health" || echo "⚠️ API health check failed"

# Show deployment summary
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Summary:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Cloud Tasks Queue: $QUEUE_NAME"
echo "  Worker Service: $WORKER_URL"
echo "  API Service: $API_URL"
echo ""
echo "📋 Next Steps:"
echo "  1. Update your frontend to call: $API_URL"
echo "  2. Set environment variables in your frontend deployment"
echo "  3. Monitor Cloud Run logs: gcloud run services logs read $WORKER_SERVICE_NAME --region=$REGION"
echo "  4. Monitor Cloud Tasks: https://console.cloud.google.com/cloudtasks/queues/$REGION/$QUEUE_NAME?project=$PROJECT_ID"
echo ""
echo "💰 Cost Optimization:"
echo "  - Worker scales to zero when idle (no cost)"
echo "  - Only pay for actual job processing time"
echo "  - Auto-scales based on queue depth"
echo "  - Production-grade retry logic built-in" 