-- 🚨 CRITICAL FIX: Missing database tables
-- These tables are required for video processing and takeaways storage
-- COMPLETE SQL SCRIPT - Run this entire block

CREATE TABLE IF NOT EXISTS video_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    segment_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    start_time INTEGER NOT NULL, -- seconds
    end_time INTEGER NOT NULL,   -- seconds
    hook TEXT,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_video_segment UNIQUE(video_id, segment_number),
    CONSTRAINT positive_times CHECK (start_time >= 0 AND end_time >= 0),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_segments_video_id ON video_segments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_segments_segment_number ON video_segments(video_id, segment_number);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_video_segments_updated_at 
    BEFORE UPDATE ON video_segments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 🚨 CRITICAL FIX: Missing video_takeaways table
-- This table is required for storing video key takeaways
CREATE TABLE IF NOT EXISTS video_takeaways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    takeaway TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_order CHECK (order_index >= 0),
    CONSTRAINT unique_video_takeaway UNIQUE(video_id, order_index)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_takeaways_video_id ON video_takeaways(video_id);
CREATE INDEX IF NOT EXISTS idx_video_takeaways_order ON video_takeaways(video_id, order_index);

-- Add trigger for updated_at
CREATE TRIGGER update_video_takeaways_updated_at 
    BEFORE UPDATE ON video_takeaways 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 