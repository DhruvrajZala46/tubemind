-- Migration: Fix corrupted credits_reserved values
-- This prevents users from being blocked by negative or corrupted reserved credits

-- 1. Reset any negative credits_reserved to 0
UPDATE users 
SET credits_reserved = 0 
WHERE credits_reserved < 0;

-- 2. Reset any credits_reserved that exceed the user's limit
UPDATE users u
SET credits_reserved = 0
WHERE credits_reserved > COALESCE(credits_limit, 60);

-- 3. Reset credits_reserved for users with no active processing jobs
UPDATE users u
SET credits_reserved = 0
WHERE credits_reserved > 0
  AND NOT EXISTS (
    SELECT 1
    FROM video_summaries vs
    JOIN videos v ON v.id = vs.video_id
    WHERE v.user_id = u.id
      AND vs.processing_status IN ('queued','processing','transcribing','summarizing','finalizing')
  );

-- 4. Add constraint to prevent future negative values
-- Note: This will be added in a separate migration if needed 