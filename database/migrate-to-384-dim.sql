-- Migration: Update vector dimension from 512 to 384
-- Run this in Supabase SQL Editor BEFORE running bulk_populate_vectors.py
--
-- This migration converts the database from Voyage AI/Jina embeddings (512-dim)
-- to sentence-transformers local embeddings (384-dim)
--
-- WARNING: This will DELETE all existing content. Back up first if needed.

BEGIN;

-- 1. Drop existing function (depends on old dimension)
DROP FUNCTION IF EXISTS search_csec_content;

-- 2. Drop existing indexes
DROP INDEX IF EXISTS idx_csec_content_embedding;

-- 3. Truncate existing content (can't convert dimensions in-place)
TRUNCATE TABLE csec_content;

-- 4. Alter column to new dimension
ALTER TABLE csec_content 
ALTER COLUMN embedding TYPE vector(384);

-- 5. Recreate vector index (HNSW works with any row count)
CREATE INDEX idx_csec_content_embedding 
ON csec_content 
USING hnsw (embedding vector_cosine_ops);

-- 6. Recreate search function with new dimension
CREATE OR REPLACE FUNCTION search_csec_content(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  subject TEXT,
  topic TEXT,
  subtopic TEXT,
  content_type TEXT,
  content TEXT,
  metadata JSONB,
  similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.subject,
    c.topic,
    c.subtopic,
    c.content_type,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM csec_content c
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMIT;

-- Verification
SELECT 'Migration complete. New vector dimension: 384' as status;
