# Vector Database Setup Guide

This guide walks you through setting up the vector database in Supabase for the CSEC Tutor application.

## Overview

The vector database enables semantic search across CSEC content, allowing the AI to retrieve relevant syllabus content, past paper questions, and explanations to provide more accurate, curriculum-aligned responses.

## Prerequisites

1. A Supabase account (free tier works)
2. Access to the Supabase SQL Editor
3. A free embedding API key from one of these providers:
   - **Voyage AI** (recommended): https://dash.voyageai.com - 200M tokens/month free
   - **Jina AI**: https://jina.ai/api-dashboard/key-manager
4. Your `.env.local` configured with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `VOYAGE_API_KEY` or `JINA_API_KEY` (for embeddings)

## Step 1: Enable the pgvector Extension

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following SQL:

```sql
-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;
```

## Step 2: Create the Content Table

Run this SQL to create the table for storing CSEC content with embeddings:

```sql
-- Create csec_content table with vector support
CREATE TABLE IF NOT EXISTS csec_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('syllabus', 'question', 'explanation', 'example')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(512), -- Voyage AI / Jina embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_csec_content_subject ON csec_content(subject);
CREATE INDEX IF NOT EXISTS idx_csec_content_topic ON csec_content(topic);
CREATE INDEX IF NOT EXISTS idx_csec_content_type ON csec_content(content_type);
```

## Step 3: Create the Vector Index

This index enables fast similarity searches:

```sql
-- Create vector index for similarity search (requires sufficient data)
-- Note: This may fail if the table is empty. Run after populating data.
CREATE INDEX IF NOT EXISTS idx_csec_content_embedding 
ON csec_content 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Note:** The ivfflat index requires at least 100 rows. If you have fewer rows, use this simpler index instead:

```sql
-- Alternative: HNSW index (works with any number of rows)
CREATE INDEX IF NOT EXISTS idx_csec_content_embedding 
ON csec_content 
USING hnsw (embedding vector_cosine_ops);
```

## Step 4: Create the Search Function

This function performs vector similarity search:

```sql
-- Create search function for vector similarity
CREATE OR REPLACE FUNCTION search_csec_content(
  query_embedding vector(512),
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
```

## Step 5: Set Up Row Level Security (Optional)

For public content that all users can read:

```sql
-- Enable RLS
ALTER TABLE csec_content ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read content
CREATE POLICY "Users can read CSEC content" ON csec_content
  FOR SELECT USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage content" ON csec_content
  FOR ALL USING (auth.role() = 'service_role');
```

## Step 6: Populate the Database with Content

Run the population script to add CSEC content with embeddings:

```bash
cd csec-tutor
npx ts-node --esm scripts/populate-vectors.ts
```

Or use the npm script:

```bash
npm run populate-vectors
```

**Note:** The script uses Voyage AI for embeddings. With a free API key (200M tokens/month), expect ~21 second delays between items due to rate limits (3 requests/minute without payment method).

## Verification

### Check if the table was created:

```sql
SELECT COUNT(*) FROM csec_content;
```

### Test the search function:

```sql
-- First, get a sample embedding from existing content
SELECT embedding FROM csec_content LIMIT 1;

-- Then test with that embedding (replace with actual embedding)
SELECT * FROM search_csec_content(
  (SELECT embedding FROM csec_content LIMIT 1),
  0.5,
  5
);
```

### Check via API:

```bash
curl http://localhost:3000/api/vector-search
```

Response should show:
```json
{
  "status": "ok",
  "configured": true,
  "content_count": 25
}
```

## Troubleshooting

### "relation csec_content does not exist"
Run Step 2 to create the table.

### "function search_csec_content does not exist"
Run Step 4 to create the search function.

### "could not access file 'vector'"
The pgvector extension isn't available. Ensure you're on a Supabase plan that supports extensions, or run Step 1.

### Embedding dimension mismatch
Ensure the embedding dimension (512) matches what's in the database. Voyage AI's `voyage-3-lite` model produces 512-dimensional vectors.

### Empty search results
1. Check that content exists: `SELECT COUNT(*) FROM csec_content WHERE embedding IS NOT NULL;`
2. Lower the match_threshold: Try 0.3 instead of 0.5
3. Run the population script to add content

## Adding More Content

You can add custom content:

```sql
-- Insert content (embedding will need to be generated by the application)
INSERT INTO csec_content (subject, topic, subtopic, content_type, content, metadata)
VALUES (
  'Mathematics',
  'Algebra',
  'Polynomials',
  'syllabus',
  'Students should be able to add, subtract, and multiply polynomials...',
  '{"year": 2024}'
);
```

Then use the application's embedding service to update with embeddings, or use the populate script which handles this automatically.

## Complete SQL Script

For convenience, here's all the SQL in one block:

```sql
-- 1. Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create table
CREATE TABLE IF NOT EXISTS csec_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('syllabus', 'question', 'explanation', 'example')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(512),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_csec_content_subject ON csec_content(subject);
CREATE INDEX IF NOT EXISTS idx_csec_content_topic ON csec_content(topic);
CREATE INDEX IF NOT EXISTS idx_csec_content_type ON csec_content(content_type);
CREATE INDEX IF NOT EXISTS idx_csec_content_embedding ON csec_content USING hnsw (embedding vector_cosine_ops);

-- 4. Create search function
CREATE OR REPLACE FUNCTION search_csec_content(
  query_embedding vector(512),
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

-- 5. Enable RLS
ALTER TABLE csec_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read CSEC content" ON csec_content
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage content" ON csec_content
  FOR ALL USING (auth.role() = 'service_role');
```

Copy and paste this entire block into the Supabase SQL Editor and run it.
