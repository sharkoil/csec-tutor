-- Admin and Usage Tracking Schema
-- Run this in Supabase SQL Editor to add admin functionality

-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create usage tracking table for AI inference costs
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  generation_id TEXT, -- OpenRouter generation ID
  model TEXT NOT NULL,
  action TEXT NOT NULL, -- coaching, practice-questions, practice-exam, vector-search
  subject TEXT,
  topic TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_credits DECIMAL(12, 8) NOT NULL DEFAULT 0, -- Cost in OpenRouter credits
  latency_ms INTEGER, -- Response time in milliseconds
  cached_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_action ON ai_usage(action);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);

-- Create aggregated daily usage view for faster dashboard queries
CREATE OR REPLACE VIEW daily_usage_summary AS
SELECT 
  DATE(created_at) as date,
  model,
  action,
  COUNT(*) as request_count,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_credits) as total_cost,
  AVG(latency_ms) as avg_latency_ms
FROM ai_usage
GROUP BY DATE(created_at), model, action
ORDER BY date DESC, model, action;

-- Create function to get usage stats for a date range
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
    SELECT jsonb_object_agg(
      model, 
      jsonb_build_object(
        'requests', count,
        'tokens', tokens,
        'cost', cost
      )
    ) as data
    FROM (
      SELECT model, COUNT(*) as count, SUM(total_tokens) as tokens, SUM(cost_credits) as cost
      FROM filtered GROUP BY model
    ) m
  ),
  action_stats AS (
    SELECT jsonb_object_agg(
      action,
      jsonb_build_object(
        'requests', count,
        'tokens', tokens,
        'cost', cost
      )
    ) as data
    FROM (
      SELECT action, COUNT(*) as count, SUM(total_tokens) as tokens, SUM(cost_credits) as cost
      FROM filtered GROUP BY action
    ) a
  ),
  daily_stats AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', date,
        'requests', count,
        'tokens', tokens,
        'cost', cost
      ) ORDER BY date DESC
    ) as data
    FROM (
      SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total_tokens) as tokens, SUM(cost_credits) as cost
      FROM filtered GROUP BY DATE(created_at)
    ) d
  )
  SELECT 
    (SELECT COUNT(*) FROM filtered)::BIGINT,
    (SELECT COALESCE(SUM(total_tokens), 0) FROM filtered)::BIGINT,
    (SELECT COALESCE(SUM(cost_credits), 0) FROM filtered),
    (SELECT COALESCE(data, '{}'::jsonb) FROM model_stats),
    (SELECT COALESCE(data, '{}'::jsonb) FROM action_stats),
    (SELECT COALESCE(data, '[]'::jsonb) FROM daily_stats);
END;
$$;

-- Enable RLS on ai_usage
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Only admins can view all usage data
CREATE POLICY "Admins can view all usage" ON ai_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role can insert usage data (from API)
CREATE POLICY "Service role can insert usage" ON ai_usage
  FOR INSERT WITH CHECK (true);

-- Elevate sharkoil@gmail.com to admin
UPDATE users SET role = 'admin' WHERE email = 'sharkoil@gmail.com';

-- If user doesn't exist yet, create a function to auto-elevate on signup
CREATE OR REPLACE FUNCTION elevate_admin_users()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'sharkoil@gmail.com' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-elevate admin users on insert
DROP TRIGGER IF EXISTS auto_elevate_admin ON users;
CREATE TRIGGER auto_elevate_admin
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION elevate_admin_users();
