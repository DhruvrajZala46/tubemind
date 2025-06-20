-- Add credits_reserved column to users table
ALTER TABLE users ADD COLUMN credits_reserved INTEGER NOT NULL DEFAULT 0;

-- Add credits_reserved column to user_subscription_summary view
-- Note: Views in SQL are not altered directly. We need to drop and recreate it.
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
  u.credits_used,
  u.credits_reserved, -- Add the new column here
  CASE
    WHEN u.subscription_tier = 'free' THEN 600
    WHEN u.subscription_tier = 'pro' THEN 6000
    WHEN u.subscription_tier = 'agency' THEN 30000
    ELSE 0
  END as credits_limit,
  u.last_credit_reset,
  u.created_at,
  u.updated_at,
  CASE
    WHEN (CASE WHEN u.subscription_tier = 'free' THEN 600 WHEN u.subscription_tier = 'pro' THEN 6000 WHEN u.subscription_tier = 'agency' THEN 30000 ELSE 0 END) > 0
    THEN (u.credits_used::numeric / (CASE WHEN u.subscription_tier = 'free' THEN 600 WHEN u.subscription_tier = 'pro' THEN 6000 WHEN u.subscription_tier = 'agency' THEN 30000 ELSE 0 END)) * 100
    ELSE 0
  END as usage_percentage,
  (CASE WHEN u.subscription_tier = 'free' THEN 600 WHEN u.subscription_tier = 'pro' THEN 6000 WHEN u.subscription_tier = 'agency' THEN 30000 ELSE 0 END) - u.credits_used as remaining_credits,
  u.credits_used >= (CASE WHEN u.subscription_tier = 'free' THEN 600 WHEN u.subscription_tier = 'pro' THEN 6000 WHEN u.subscription_tier = 'agency' THEN 30000 ELSE 0 END) as is_over_limit
FROM
  users u;

-- Also update the trigger/function for user updates if it exists
-- (Assuming there is one, if not, this part is not needed)
-- Example:
-- CREATE OR REPLACE FUNCTION sync_user_to_summary() RETURNS TRIGGER AS $$
-- BEGIN
--   -- ... logic to update the summary view, make sure it handles the new column
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Make sure any triggers are re-applied if necessary
-- CREATE TRIGGER on_user_update
-- AFTER UPDATE ON users
-- FOR EACH ROW EXECUTE PROCEDURE sync_user_to_summary(); 