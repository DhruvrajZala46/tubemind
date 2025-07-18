-- Migration: Reset stale credits_reserved values where there are no active processing jobs
-- This prevents users from being blocked by dangling reservations.

UPDATE users u
SET    credits_reserved = 0
WHERE  credits_reserved > 0
  AND NOT EXISTS (
        SELECT 1
        FROM   video_summaries vs
        JOIN   videos v ON v.id = vs.video_id
        WHERE  v.user_id = u.id
          AND  vs.processing_status IN ('queued','processing','transcribing','summarizing','finalizing')
      ); 