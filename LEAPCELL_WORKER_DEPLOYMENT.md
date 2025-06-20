# 🚀 URGENT: Leapcell Worker Deployment Instructions

## 🎯 Critical Update Required

Your worker is currently stuck in a processing loop because it's using the **old BullMQ architecture** while your API is using the **new simple Redis architecture**. This deployment will fix the mismatch.

## 📋 Quick Deployment Steps

### 1. Build the Updated Worker
```bash
npm run worker:build
```

### 2. Deploy to Leapcell
Follow these steps in your Leapcell dashboard:

1. **Access your worker project** on Leapcell
2. **Upload the updated code** from your Git repository:
   - Branch: `main` 
   - Latest commit: `1990f35` (worker architecture fix)
3. **Ensure environment variables** are set:
   ```
   NODE_ENV=production
   LEAPCELL=true
   DISABLE_REDIS=false
   FORCE_REDIS_ON_WINDOWS=true
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   ```
4. **Start command**: `npm run worker:prod`
5. **Deploy and restart** the worker

## 🔍 Expected Results After Deployment

### Successful Worker Logs:
```
🚀 Starting simple Redis worker (script-free)...
✅ Simple worker started, polling for jobs...
📦 Found job in queue { videoId: 'Ab1FyDL4HEY', userId: 'user_xxx' }
✅ Job processing completed successfully { videoId: 'Ab1FyDL4HEY' }
```

### Your Job Will Process:
- Status will change from "queued" → "active" → "completed"
- Video summary will appear in your dashboard
- No more infinite polling loops

## 🆘 If You Need Help

If deployment fails or you're unsure about any step:

1. **Check Leapcell logs** for error messages
2. **Verify environment variables** are correctly set
3. **Ensure the Git repository** has the latest commits pushed

## ⚡ Why This Update Is Critical

- **Before**: Worker used BullMQ (scripts) ❌
- **After**: Worker uses simple Redis polling (no scripts) ✅
- **Result**: Compatible with Upstash free tier limitations

Your current job (`d7c0dee5-da5f-405b-99fa-476fb3fb3492`) will be processed immediately after the worker deployment completes.

## 🎉 Success Confirmation

After deployment, your video processing should:
1. ✅ Complete within 2-3 minutes
2. ✅ Show progress from "queued" to "completed"
3. ✅ Display the full video summary
4. ✅ No more NOPERM errors in logs 