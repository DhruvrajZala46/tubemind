#!/bin/bash

# TubeGPT Worker Startup Script
# This script handles starting the worker process in both development and production environments

# Determine environment
if [ "$NODE_ENV" = "production" ]; then
  echo "🚀 Starting TubeGPT worker in PRODUCTION mode"
  ENV_MODE="production"
else
  echo "🚀 Starting TubeGPT worker in DEVELOPMENT mode"
  ENV_MODE="development"
fi

# Run environment variable fix script if it exists
if [ -f "./fix-env.js" ]; then
  echo "🔧 Running environment variable fixes..."
  node fix-env.js
fi

# Set worker port if not already set
if [ -z "$WORKER_PORT" ]; then
  export WORKER_PORT=8002
  echo "⚙️ Setting default worker port: $WORKER_PORT"
fi

# Check for Leapcell deployment
if [ "$LEAPCELL" = "true" ] || [ "$DEPLOYMENT_ENV" = "leapcell" ]; then
  echo "☁️ Running in Leapcell environment"
  export LEAPCELL=true
fi

# Start the worker based on environment
if [ "$ENV_MODE" = "production" ]; then
  # Production mode - use Node directly with the compiled JS
  echo "🔄 Starting production worker..."
  
  # Check if we need to build first
  if [ ! -d "./dist" ] || [ "$FORCE_BUILD" = "true" ]; then
    echo "🔨 Building TypeScript files..."
    npm run build
  fi
  
  # Start the worker
  node dist/worker/extract.js
else
  # Development mode - use tsx for TypeScript support
  echo "🔄 Starting development worker..."
  
  # Use tsx for better TypeScript support
  if command -v tsx &> /dev/null; then
    tsx src/worker/extract.ts
  else
    # Fallback to ts-node if tsx is not available
    ts-node src/worker/extract.ts
  fi
fi 