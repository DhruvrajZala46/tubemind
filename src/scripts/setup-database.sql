-- TubeGPT Database Setup Script
-- This script ensures the database schema is complete and up-to-date
-- Run this script against your production database to fix any missing columns or views

-- 1. Add credits_reserved column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'credits_reserved'
    ) THEN
        ALTER TABLE users ADD COLUMN credits_reserved INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added credits_reserved column to users table';
    ELSE
        RAISE NOTICE 'credits_reserved column already exists in users table';
    END IF;
END $$;

-- 2. Drop and recreate the user_subscription_summary view with correct schema
DROP VIEW IF EXISTS user_subscription_summary;

CREATE OR REPLACE VIEW user_subscription_summary AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.subscription_tier,
  u.subscription_status,
  u.subscription_end_date,
  u.subscription_id,
  COALESCE(u.credits_used, 0) as credits_used,
  COALESCE(u.credits_reserved, 0) as credits_reserved,
  CASE
    WHEN u.subscription_tier = 'free' THEN 60    -- 1 hour = 60 minutes
    WHEN u.subscription_tier = 'basic' THEN 300  -- 5 hours = 300 minutes  
    WHEN u.subscription_tier = 'pro' THEN 900    -- 15 hours = 900 minutes
    WHEN u.subscription_tier = 'enterprise' THEN -1  -- Unlimited
    ELSE 60
  END as credits_limit,
  u.last_credit_reset,
  u.created_at,
  u.updated_at,
  CASE
    WHEN (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) = -1
    THEN 0 -- Enterprise has unlimited, so 0% usage
    WHEN (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) > 0
    THEN (COALESCE(u.credits_used, 0)::numeric / (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END)) * 100
    ELSE 0
  END as usage_percentage,
  CASE
    WHEN (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) = -1
    THEN 999999 -- Enterprise has unlimited
    ELSE (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) - COALESCE(u.credits_used, 0)
  END as remaining_credits,
  CASE
    WHEN (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END) = -1
    THEN FALSE -- Enterprise never over limit
    ELSE COALESCE(u.credits_used, 0) >= (CASE WHEN u.subscription_tier = 'free' THEN 60 WHEN u.subscription_tier = 'basic' THEN 300 WHEN u.subscription_tier = 'pro' THEN 900 WHEN u.subscription_tier = 'enterprise' THEN -1 ELSE 60 END)
  END as is_over_limit
FROM
  users u;

-- 3. Set default values for existing users who might have NULL credits_used or credits_reserved
UPDATE users 
SET 
  credits_used = COALESCE(credits_used, 0),
  credits_reserved = COALESCE(credits_reserved, 0)
WHERE 
  credits_used IS NULL OR credits_reserved IS NULL;

-- 4. Verify the schema is correct
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    -- Check if all required columns exist in users table
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name IN ('id', 'email', 'credits_used', 'credits_reserved', 'subscription_tier', 'subscription_status');
    
    IF col_count = 6 THEN
        RAISE NOTICE '✅ All required columns exist in users table';
    ELSE
        RAISE NOTICE '⚠️ Missing columns in users table. Expected 6, found %', col_count;
    END IF;
    
    -- Check if user_subscription_summary view exists
    SELECT COUNT(*) INTO col_count
    FROM information_schema.views 
    WHERE table_name = 'user_subscription_summary';
    
    IF col_count = 1 THEN
        RAISE NOTICE '✅ user_subscription_summary view exists';
    ELSE
        RAISE NOTICE '⚠️ user_subscription_summary view does not exist';
    END IF;
END $$;

-- 5. Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_credits_used ON users(credits_used);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_id ON video_summaries(video_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);

-- Final verification
SELECT 'Database setup completed successfully!' as status; 