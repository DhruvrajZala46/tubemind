# TubeGPT Deployment Fixes

## Issues Fixed

### 1. Worker Environment Variables in Leapcell.io
- **Problem**: Worker process failing with `.env.local not found` errors in Leapcell.io
- **Fix**: Created `dev-worker.js` that properly loads environment variables without requiring `.env.local`

### 2. Redis Permission Issues
- **Problem**: Redis errors `NOPERM this user has no permissions to run the 'zremrangebyscore' command`
- **Fix**: Implemented in-memory fallbacks for rate limiting and job queues when Redis permissions are limited

### 3. Environment Variable Handling
- **Problem**: Environment variables with quotes causing connection issues
- **Fix**: Added quote-stripping functionality in `env.ts` and scripts

### 4. Development Scripts
- **Problem**: Difficult to test the full application locally
- **Fix**: Created comprehensive scripts for development and production-like testing

## Files Modified

1. **src/lib/env.ts**
   - Added robust environment variable handling with fallbacks
   - Added quote-stripping functionality
   - Added environment detection for Leapcell

2. **src/lib/rate-limit.ts**
   - Implemented in-memory rate limiting fallback
   - Added better error handling for Redis connection issues
   - Cleaned quotes from Redis URLs

3. **src/lib/job-queue.ts**
   - Added in-memory job processing fallback
   - Improved error handling for Redis connection issues
   - Added Leapcell environment detection

4. **src/middleware.ts**
   - Updated to use new rate limiter

5. **package.json**
   - Added new development scripts
   - Modified worker scripts to not require `.env.local`

## New Files Created

1. **dev-worker.js**
   - Runs worker in development mode
   - Properly loads environment variables
   - Falls back to in-memory processing when needed

2. **start-dev.js**
   - Runs both Next.js app and worker together
   - Loads and fixes environment variables
   - Provides clear logging

3. **fix-env.js**
   - Fixes common issues in `.env.local` file
   - Removes problematic quotes

4. **start-prod.js**
   - Tests application in production-like environment
   - Builds and runs the application in production mode

5. **TESTING_GUIDE.md**
   - Comprehensive guide for testing the application
   - Troubleshooting steps for common issues

## How to Use

### Local Development
```bash
# Fix environment variables and start both app and worker
npm run dev-setup

# Just fix environment variables
npm run fix-env

# Run only the worker
npm run dev-worker
```

### Production Testing
```bash
# Test in production-like environment
npm run prod-test
```

### Leapcell.io Deployment
When deploying to Leapcell.io, make sure to:
1. Set `LEAPCELL=true` environment variable
2. Set `DEPLOYMENT_ENV=leapcell` environment variable
3. Use the worker script that doesn't require `.env.local`

## Automatic Adaptations

The system now automatically adapts to the available resources:
- Uses Redis when available with proper permissions
- Falls back to in-memory processing when Redis permissions are limited
- Properly handles environment variables with or without quotes
- Provides clear error messages when resources are missing 