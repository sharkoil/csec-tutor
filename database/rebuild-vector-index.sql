-- Fix Vector Index for Large Table
-- Run this in Supabase SQL Editor

-- Step 1: Drop the old (broken) index
DROP INDEX IF EXISTS idx_csec_content_embedding;

-- Step 2: For ~94K rows, use lists = sqrt(94000) ≈ 307
-- IVFFlat needs lists roughly equal to sqrt(num_rows) for optimal performance
CREATE INDEX idx_csec_content_embedding 
ON csec_content 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 300);

-- Step 3: Analyze the table to update statistics
ANALYZE csec_content;

-- Step 4: Check index status
SELECT 
    indexrelname as index_name,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND relname = 'csec_content';
