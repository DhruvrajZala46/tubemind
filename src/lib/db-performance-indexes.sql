-- 🚀 PHASE 5.4: DATABASE PERFORMANCE OPTIMIZATION INDEXES
-- Run this script to dramatically improve query performance

-- ================================
-- CRITICAL PERFORMANCE INDEXES
-- ================================

-- 🔍 PRIMARY LOOKUP INDEXES (Most Important)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_user_video_lookup 
ON videos(user_id, video_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_user_created 
ON videos(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_summaries_video_lookup 
ON video_summaries(video_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_tracking_user_action 
ON usage_tracking(user_id, action_type, created_at DESC);

-- 🔍 SEARCH AND ANALYTICS INDEXES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_title_search 
ON videos USING gin(to_tsvector('english', title));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_summaries_content_search 
ON video_summaries USING gin(to_tsvector('english', main_title || ' ' || overall_summary));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_channel_title 
ON videos(channel_title) WHERE channel_title IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_duration_stats 
ON videos(duration) WHERE duration > 0;

-- 🔍 COST ANALYTICS INDEXES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_summaries_cost_analytics 
ON video_summaries(total_cost, created_at DESC) WHERE total_cost > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_summaries_token_analytics 
ON video_summaries(total_tokens, created_at DESC) WHERE total_tokens > 0;

-- 🔍 TIME-BASED INDEXES FOR REPORTING
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_monthly_stats 
ON videos(user_id, DATE_TRUNC('month', created_at));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_tracking_monthly 
ON usage_tracking(user_id, DATE_TRUNC('month', created_at), credits_used);

-- ================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ================================

-- 🔍 USER DASHBOARD QUERIES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_user_dashboard 
ON videos(user_id, created_at DESC, title, thumbnail_url);

-- 🔍 VIDEO PROCESSING EFFICIENCY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_processing_check 
ON videos(video_id, user_id, created_at);

-- 🔍 SUBSCRIPTION AND BILLING
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_subscription_status 
ON users(subscription_tier, subscription_status, created_at);

-- ================================
-- PARTIAL INDEXES FOR SPECIFIC CONDITIONS
-- ================================

-- 🔍 ACTIVE USERS ONLY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_active_users 
ON videos(user_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '90 days';

-- 🔍 EXPENSIVE PROCESSING ONLY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expensive_processing 
ON video_summaries(video_id, total_cost) 
WHERE total_cost > 0.01; -- Above 1 cent

-- 🔍 FAILED PROCESSING (for debugging)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_failed_processing 
ON video_summaries(video_id, created_at) 
WHERE total_cost = 0 OR total_tokens = 0;

-- ================================
-- FOREIGN KEY CONSTRAINTS (if missing)
-- ================================

-- Ensure referential integrity with indexes
ALTER TABLE video_summaries 
ADD CONSTRAINT fk_video_summaries_video_id 
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

ALTER TABLE video_segments 
ADD CONSTRAINT fk_video_segments_video_id 
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

ALTER TABLE video_takeaways 
ADD CONSTRAINT fk_video_takeaways_video_id 
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

ALTER TABLE usage_tracking 
ADD CONSTRAINT fk_usage_tracking_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ================================
-- PERFORMANCE MONITORING VIEWS
-- ================================

-- 🔍 VIEW: Query performance monitoring
CREATE OR REPLACE VIEW query_performance_stats AS
SELECT 
  schemaname,
  tablename,
  attname as column_name,
  n_distinct,
  correlation,
  most_common_vals[1:5] as top_values
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename IN ('videos', 'video_summaries', 'users', 'usage_tracking')
ORDER BY tablename, attname;

-- 🔍 VIEW: Index usage statistics
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as rows_read,
  idx_tup_fetch as rows_fetched,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED INDEX - Consider dropping'
    WHEN idx_scan < 100 THEN 'Low usage'
    ELSE 'Good usage'
  END as usage_status
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 🔍 VIEW: Table size and performance
CREATE OR REPLACE VIEW table_performance_overview AS
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  ROUND((idx_scan::float / GREATEST(seq_scan + idx_scan, 1)) * 100, 2) as index_usage_pct
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ================================
-- MAINTENANCE FUNCTIONS
-- ================================

-- 🔍 FUNCTION: Analyze table performance
CREATE OR REPLACE FUNCTION analyze_table_performance(table_name text)
RETURNS TABLE(
  metric text,
  value text,
  recommendation text
) AS $$
BEGIN
  -- Run ANALYZE on the table first
  EXECUTE 'ANALYZE ' || table_name;
  
  RETURN QUERY
  SELECT 
    'Table Size'::text,
    pg_size_pretty(pg_total_relation_size(table_name))::text,
    'Consider partitioning if > 10GB'::text
  UNION ALL
  SELECT 
    'Index Usage %'::text,
    ROUND((idx_scan::float / GREATEST(seq_scan + idx_scan, 1)) * 100, 2)::text || '%',
    CASE 
      WHEN ROUND((idx_scan::float / GREATEST(seq_scan + idx_scan, 1)) * 100, 2) < 80 
      THEN 'Low index usage - check query patterns'
      ELSE 'Good index usage'
    END
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public' AND tablename = table_name;
END;
$$ LANGUAGE plpgsql;

-- 🔍 FUNCTION: Get slow query suggestions
CREATE OR REPLACE FUNCTION get_optimization_suggestions()
RETURNS TABLE(
  table_name text,
  suggestion text,
  priority text
) AS $$
BEGIN
  RETURN QUERY
  -- Large sequential scans
  SELECT 
    t.tablename::text,
    'High sequential scans detected - consider adding indexes'::text,
    'HIGH'::text
  FROM pg_stat_user_tables t
  WHERE t.seq_scan > t.idx_scan * 2
    AND t.seq_tup_read > 10000
  
  UNION ALL
  
  -- Unused indexes
  SELECT 
    i.tablename::text,
    'Unused index: ' || i.indexname || ' - consider dropping'::text,
    'MEDIUM'::text
  FROM pg_stat_user_indexes i
  WHERE i.idx_scan = 0
    AND i.indexname NOT LIKE '%_pkey'
  
  UNION ALL
  
  -- Tables without recent ANALYZE
  SELECT 
    t.tablename::text,
    'Table statistics outdated - run ANALYZE'::text,
    'HIGH'::text
  FROM pg_stat_user_tables t
  WHERE t.last_analyze < NOW() - INTERVAL '7 days'
     OR t.last_analyze IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- AUTOMATIC MAINTENANCE
-- ================================

-- 🔍 FUNCTION: Auto-optimize database (run weekly)
CREATE OR REPLACE FUNCTION auto_optimize_database()
RETURNS text AS $$
DECLARE
  table_rec record;
  result_text text := '';
BEGIN
  -- Update statistics for all tables
  FOR table_rec IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ANALYZE ' || table_rec.tablename;
    result_text := result_text || 'Analyzed ' || table_rec.tablename || E'\n';
  END LOOP;
  
  -- Vacuum if needed (only if table has significant dead tuples)
  FOR table_rec IN
    SELECT schemaname, tablename
    FROM pg_stat_user_tables
    WHERE n_dead_tup > greatest(n_live_tup * 0.1, 1000)
  LOOP
    EXECUTE 'VACUUM ' || table_rec.schemaname || '.' || table_rec.tablename;
    result_text := result_text || 'Vacuumed ' || table_rec.tablename || E'\n';
  END LOOP;
  
  RETURN result_text || 'Database optimization completed.';
END;
$$ LANGUAGE plpgsql;

-- ================================
-- PERFORMANCE ALERTS
-- ================================

-- 🔍 VIEW: Performance alerts
CREATE OR REPLACE VIEW performance_alerts AS
WITH table_stats AS (
  SELECT 
    tablename,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
    seq_scan,
    idx_scan,
    n_dead_tup,
    n_live_tup
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public'
)
SELECT 
  tablename,
  CASE 
    WHEN size_bytes > 1073741824 THEN 'Large table (>1GB) - consider partitioning'
    WHEN seq_scan > idx_scan * 3 THEN 'High sequential scan ratio - missing indexes?'
    WHEN n_dead_tup > n_live_tup * 0.2 THEN 'High dead tuple ratio - needs VACUUM'
    ELSE 'No issues detected'
  END as alert,
  CASE 
    WHEN size_bytes > 1073741824 THEN 'HIGH'
    WHEN seq_scan > idx_scan * 3 THEN 'MEDIUM'
    WHEN n_dead_tup > n_live_tup * 0.2 THEN 'LOW'
    ELSE 'INFO'
  END as priority
FROM table_stats
WHERE size_bytes > 1073741824 
   OR seq_scan > idx_scan * 3 
   OR n_dead_tup > n_live_tup * 0.2;

-- ================================
-- COMPLETION MESSAGE
-- ================================

DO $$ 
BEGIN 
  RAISE NOTICE '🚀 PHASE 5.4: Database optimization indexes created successfully!';
  RAISE NOTICE '📊 Run: SELECT * FROM performance_alerts; to check for issues';
  RAISE NOTICE '🔍 Run: SELECT * FROM get_optimization_suggestions(); for recommendations';
  RAISE NOTICE '⚡ Performance monitoring views created: query_performance_stats, index_usage_stats, table_performance_overview';
END $$; 