-- Admin and Usage Tracking Schema for CSEC Tutor
-- Run this in Supabase SQL Editor to enable admin dashboard
-- NOTE: Run this AFTER your main Supabase auth is set up

-- Create usage tracking table for AI inference costs
-- This table tracks all AI API calls for cost monitoring
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Optional reference to auth.users
  generation_id TEXT, -- OpenRouter generation ID for debugging
  model TEXT NOT NULL, -- e.g., 'anthropic/claude-sonnet-4-20250514'
  action TEXT NOT NULL, -- e.g., 'coaching', 'practice-questions', 'practice-exam'
  subject TEXT, -- e.g., 'Mathematics'
  topic TEXT, -- e.g., 'Algebra'
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_credits DECIMAL(12, 8) NOT NULL DEFAULT 0, -- Cost in USD/credits
  latency_ms INTEGER, -- Response time in milliseconds
  cached_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_action ON ai_usage(action);

-- Allow public read for now (the API handles auth)
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (admin check is done in API)
CREATE POLICY "Allow read ai_usage" ON ai_usage
  FOR SELECT USING (true);

-- Allow inserts from the application
CREATE POLICY "Allow insert ai_usage" ON ai_usage
  FOR INSERT WITH CHECK (true);

-- Optional: Create a function to get aggregated stats
CREATE OR REPLACE FUNCTION get_usage_stats(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
  total_requests BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL,
  by_model JSONB,
  by_action JSONB,
  daily_breakdown JSONB
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT * FROM ai_usage 
    WHERE created_at >= start_date AND created_at <= end_date
  ),
  model_stats AS (
    SELECT COALESCE(jsonb_object_agg(
      model, 
      jsonb_build_object(
        'requests', count,
        'tokens', tokens,
        'cost', cost
      )
    ), '{}'::jsonb) as data
    FROM (
      SELECT model, COUNT(*) as count, SUM(total_tokens) as tokens, SUM(cost_credits) as cost
      FROM filtered GROUP BY model
    ) m
  ),
  action_stats AS (
    SELECT COALESCE(jsonb_object_agg(
      action,
      jsonb_build_object(
        'requests', count,
        'tokens', tokens,
        'cost', cost
      )
    ), '{}'::jsonb) as data
    FROM (
      SELECT action, COUNT(*) as count, SUM(total_tokens) as tokens, SUM(cost_credits) as cost
      FROM filtered GROUP BY action
    ) a
  ),
  daily_stats AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'date', date,
        'requests', count,
        'tokens', tokens,
        'cost', cost
      ) ORDER BY date DESC
    ), '[]'::jsonb) as data
    FROM (
      SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total_tokens) as tokens, SUM(cost_credits) as cost
      FROM filtered GROUP BY DATE(created_at)
    ) d
  )
  SELECT 
    (SELECT COUNT(*) FROM filtered)::BIGINT,
    (SELECT COALESCE(SUM(total_tokens), 0) FROM filtered)::BIGINT,
    (SELECT COALESCE(SUM(cost_credits), 0) FROM filtered),
    (SELECT data FROM model_stats),
    (SELECT data FROM action_stats),
    (SELECT data FROM daily_stats);
END;
$$;
