# 🔧 **ENVIRONMENT SETUP GUIDE**

## 🚨 **CRITICAL: Fix Database Connection Issues**

The logs show database connection failures. Here's how to fix them:

### **1. LOCAL DEVELOPMENT (.env.local)**

Create `.env.local` file in your project root with these variables:

```bash
# Database (Neon)
DATABASE_URL="postgresql://username:password@your-host.neon.tech/database?sslmode=require"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key"
CLERK_SECRET_KEY="sk_test_your_key"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard/new"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard/new"

# Payment System (Polar) - SANDBOX
POLAR_ACCESS_TOKEN="polar_at_your_sandbox_token"
POLAR_WEBHOOK_SECRET="wh_your_webhook_secret"
POLAR_ENVIRONMENT="sandbox"

# External APIs
YOUTUBE_API_KEY="AIza_your_youtube_key"
OPENAI_API_KEY="sk-your_openai_key"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_token"

# App Configuration
NEXTAUTH_URL="http://localhost:8000"
NODE_ENV="development"
WORKER_PORT=8001
```

### **2. PRODUCTION DEPLOYMENT**

Set these environment variables in your deployment platform:

#### **Leapcell.io Environment Variables:**
```bash
DATABASE_URL=postgresql://username:password@your-host.neon.tech/database?sslmode=require
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_key
CLERK_SECRET_KEY=sk_live_your_key
POLAR_ACCESS_TOKEN=polar_at_your_production_token
POLAR_WEBHOOK_SECRET=wh_your_production_webhook_secret
POLAR_ENVIRONMENT=production
YOUTUBE_API_KEY=AIza_your_youtube_key
OPENAI_API_KEY=sk-your_openai_key
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
NEXTAUTH_URL=https://your-domain.com
NODE_ENV=production
WORKER_PORT=8000
```

## 🎯 **PRODUCT ID CONFIGURATION**

### **Current Sandbox Product IDs:**
- Basic: `861cd62e-ceb6-4beb-8c06-43a8652eae8c`
- Pro: `4b2f5d5d-cba5-4ec2-b80e-d9053eec75b5`

### **When Moving to Production:**

1. **Update Product IDs in `src/config/plans.ts`:**
```typescript
production: {
  basic: "your_production_basic_id",
  pro: "your_production_pro_id"
}
```

2. **Set Environment Variable:**
```bash
POLAR_ENVIRONMENT=production
```

## 🔄 **WEBHOOK CONFIGURATION**

### **Sandbox Webhook URL:**
```
https://your-domain.com/api/webhook
```

### **Production Webhook URL:**
```
https://your-production-domain.com/api/webhook
```

**Events to Subscribe to:**
- `checkout.created`
- `checkout.updated` 
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.revoked`

## 🗄️ **DATABASE SCHEMA FIX**

The logs show that you need to run the database setup. Do this:

### **Option 1: Via API (Recommended)**
```bash
curl -X POST https://your-domain.com/api/setup-db
```

### **Option 2: Manual SQL (Neon Dashboard)**
```sql
-- Add missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_reserved INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
  description TEXT,
  reference_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference_id ON credit_transactions(reference_id);

-- Update existing users
UPDATE users SET credits_reserved = 0 WHERE credits_reserved IS NULL;
```

## 🚀 **DEPLOYMENT CHECKLIST**

### **Before Production:**
- [ ] Test all payment flows in sandbox
- [ ] Verify webhook endpoints respond correctly
- [ ] Run database migrations
- [ ] Update product IDs for production
- [ ] Set production environment variables
- [ ] Test with real Polar payments

### **Production Deployment:**
- [ ] Set `POLAR_ENVIRONMENT=production`
- [ ] Update webhook URL in Polar dashboard
- [ ] Verify SSL certificates
- [ ] Monitor error logs
- [ ] Test payment flow end-to-end

## 🛠️ **DEBUGGING COMMANDS**

### **Check Database Connection:**
```bash
curl https://your-domain.com/api/setup-db
```

### **Check Environment:**
```bash
curl https://your-domain.com/api/health
```

### **Test Webhook:**
```bash
curl -X POST https://your-domain.com/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## ⚠️ **COMMON ISSUES & FIXES**

### **Database Connection Failed:**
- Check `DATABASE_URL` format
- Verify Neon database is running
- Check SSL connection requirements

### **Worker Not Showing Logs:**
- Worker runs in separate process
- Check health endpoint: `http://localhost:8001/health`
- Worker logs show up in background process

### **Product ID Mismatch:**
- Verify product IDs in Polar dashboard
- Update `src/config/plans.ts` with correct IDs
- Check `POLAR_ENVIRONMENT` setting

### **Webhook Failures:**
- Verify webhook secret matches
- Check webhook URL is accessible
- Monitor `failed_webhooks` table for errors 