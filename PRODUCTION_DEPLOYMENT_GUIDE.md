# 🚀 **PRODUCTION DEPLOYMENT GUIDE**

## Overview
- **App**: Deploy to Vercel (Next.js frontend + API)
- **Worker**: Deploy to Leapcell.io (background processing)
- **Database**: Neon PostgreSQL (already hosted)
- **Redis**: Upstash (already hosted)

---

## 🌐 **STEP 1: DEPLOY APP TO VERCEL**

### 1.1 Prepare for Vercel Deployment
```bash
# Ensure your repository is up to date
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### 1.2 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure environment variables:

**Required Environment Variables for Vercel:**
```bash
# Authentication
CLERK_SECRET_KEY=sk_live_xxxxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx

# Database
DATABASE_URL=postgresql://your-neon-url

# Redis (for API caching)
UPSTASH_REDIS_REST_URL=https://your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-token

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Stripe (if using)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Supabase (for transcripts)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Important: Disable Redis for Vercel (app doesn't need worker queue)
DISABLE_REDIS=true
```

### 1.3 Vercel Configuration
Create `vercel.json` (already exists):
```json
{
  "functions": {
    "src/app/api/extract/route.ts": {
      "maxDuration": 300
    }
  },
  "env": {
    "DISABLE_REDIS": "true"
  }
}
```

---

## ⚡ **STEP 2: DEPLOY WORKER TO LEAPCELL.IO**

### 2.1 Create Worker Deployment Package
```bash
# Create worker deployment directory
mkdir tubegpt-worker-deploy
cd tubegpt-worker-deploy

# Copy essential worker files
cp ../package.json .
cp ../package-lock.json .
cp -r ../src/worker .
cp -r ../src/lib .
cp ../tsconfig.json .
cp ../next.config.mjs .

# Create worker-specific package.json
cat > package.json << 'EOF'
{
  "name": "tubegpt-worker",
  "version": "1.0.0",
  "description": "TubeGPT Worker for Leapcell",
  "main": "worker/extract.ts",
  "scripts": {
    "start": "tsx worker/extract.ts",
    "build": "echo 'No build needed for TypeScript worker'"
  },
  "dependencies": {
    "tsx": "^4.0.0",
    "@clerk/nextjs": "^4.29.9",
    "@neondatabase/serverless": "^0.9.0",
    "ioredis": "^5.3.2",
    "openai": "^4.28.4",
    "dotenv": "^16.4.5",
    "winston": "^3.11.0"
  }
}
EOF
```

### 2.2 Create Worker Environment File
Create `.env` for Leapcell:
```bash
# Worker Configuration
NODE_ENV=production
LEAPCELL=true
DEPLOYMENT_ENV=leapcell

# Force Redis Connection
DISABLE_REDIS=false
FORCE_REDIS_ON_WINDOWS=true

# Database
DATABASE_URL=postgresql://your-neon-url

# Redis (REQUIRED for worker)
UPSTASH_REDIS_REST_URL=https://your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-token

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# YouTube Data API
YOUTUBE_API_KEY=your-youtube-api-key
```

### 2.3 Deploy to Leapcell
1. Go to [leapcell.io](https://leapcell.io)
2. Create new project
3. Upload worker files
4. Set environment variables
5. Set startup command: `npm run start`
6. Deploy

---

## 🔧 **STEP 3: CONFIGURE INTEGRATION**

### 3.1 Update App Environment (Vercel)
Add the worker URL to your Vercel environment:
```bash
WORKER_URL=https://your-worker.leapcell.io
```

### 3.2 Test Connection
```bash
# Test worker health
curl https://your-worker.leapcell.io/health

# Expected response:
{
  "status": "healthy",
  "redis": "connected",
  "timestamp": "2024-xx-xx"
}
```

---

## ✅ **STEP 4: FINAL VALIDATION**

### 4.1 Test Complete Flow
1. Go to your Vercel app: `https://your-app.vercel.app`
2. Submit a YouTube video
3. Check that it processes successfully
4. Verify worker logs in Leapcell dashboard

### 4.2 Monitor Performance
- **Vercel**: Check function logs and performance
- **Leapcell**: Monitor worker health and processing times
- **Neon**: Monitor database connections
- **Upstash**: Check Redis usage

---

## 🚨 **TROUBLESHOOTING**

### Common Issues:

#### 1. Worker Not Connecting to Redis
**Solution:**
```bash
# In Leapcell, ensure these are set:
DISABLE_REDIS=false
UPSTASH_REDIS_REST_URL=https://your-url
UPSTASH_REDIS_REST_TOKEN=your-token
```

#### 2. App Shows "Processing Forever"
**Causes:**
- Worker not running
- Redis connection failed
- Environment variables mismatch

**Solution:**
1. Check worker health endpoint
2. Verify Redis credentials
3. Check Leapcell logs

#### 3. Credit Calculation Errors
**Fixed in this version:**
- No more double-counting of reserved credits
- Proper available credit calculation

#### 4. Redirect Errors
**Fixed in this version:**
- All API responses now include proper `redirectUrl`
- Frontend properly handles response format

---

## 📈 **SCALING CONSIDERATIONS**

### Auto-scaling Setup:
- **Vercel**: Automatically scales
- **Leapcell**: Configure auto-scaling based on queue size
- **Neon**: Monitor connection pool usage
- **Upstash**: Monitor Redis memory usage

### Performance Optimization:
- Enable Vercel Edge caching
- Use Redis for transcript caching
- Monitor OpenAI API usage and costs

---

## 🔐 **SECURITY CHECKLIST**

- [ ] All environment variables use production values
- [ ] Clerk configured for production domain
- [ ] Database connections use SSL
- [ ] Redis connections secured
- [ ] API rate limiting enabled
- [ ] Error messages don't expose sensitive data

---

## 💾 **BACKUP STRATEGY**

- **Database**: Neon automatic backups
- **Code**: GitHub repository
- **Environment**: Document all env vars
- **Redis**: Upstash automatic persistence

---

Your TubeGPT app is now production-ready! 🎉

**App URL**: https://your-app.vercel.app
**Worker URL**: https://your-worker.leapcell.io 