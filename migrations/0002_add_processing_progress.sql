-- Add processing progress tracking columns to video_summaries table
-- This migration adds columns to track detailed progress for the Perplexity-style loader

-- Add processing_progress column (0-100 percentage)
ALTER TABLE video_summaries
ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 0;

-- Add processing_stage column (more detailed than processing_status)
ALTER TABLE video_summaries
ADD COLUMN IF NOT EXISTS processing_stage VARCHAR DEFAULT NULL;

-- Add index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_video_summaries_processing_status 
ON video_summaries(processing_status);

-- Update existing rows to have consistent values
UPDATE video_summaries
SET 
  processing_progress = CASE
    WHEN processing_status = 'completed' OR processing_status = 'complete' THEN 100
    WHEN processing_status = 'failed' THEN 0
    ELSE 0
  END,
  processing_stage = processing_status
WHERE processing_progress IS NULL OR processing_stage IS NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN video_summaries.processing_progress IS 'Progress percentage (0-100) for the current processing stage';
COMMENT ON COLUMN video_summaries.processing_stage IS 'Detailed processing stage for UI display (transcribing, summarizing, finalizing, etc.)'; 