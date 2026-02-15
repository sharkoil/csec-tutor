-- Student Metrics & Analytics Tables
-- Run this in Supabase SQL Editor to enable the metrics/analytics pipeline
--
-- Tables created:
--   1. student_metrics  — per-topic mastery, completion, quiz scores
--   2. daily_activity   — daily engagement tracking (streaks, study time)
--   3. quiz_results     — individual quiz attempt records
--   4. student_dashboard_summary — materialized view for fast dashboard loads
--
-- This migration is IDEMPOTENT — safe to run multiple times.

-- ============================================
-- 1. STUDENT_METRICS — per-topic tracking
-- ============================================
CREATE TABLE IF NOT EXISTS student_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,

  -- Completion
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  lessons_total INTEGER NOT NULL DEFAULT 1,
  completion_pct INTEGER NOT NULL DEFAULT 0,

  -- Performance
  quiz_score_avg INTEGER NOT NULL DEFAULT 0,
  quiz_attempts INTEGER NOT NULL DEFAULT 0,
  best_quiz_score INTEGER NOT NULL DEFAULT 0,
  problems_attempted INTEGER NOT NULL DEFAULT 0,
  problems_correct INTEGER NOT NULL DEFAULT 0,

  -- Mastery
  mastery_level TEXT NOT NULL DEFAULT 'not_started'
    CHECK (mastery_level IN ('not_started', 'beginner', 'developing', 'proficient', 'mastered')),
  mastery_pct INTEGER NOT NULL DEFAULT 0,

  -- Engagement
  total_time_minutes INTEGER NOT NULL DEFAULT 0,
  lesson_retry_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE,

  -- Trends
  score_trend INTEGER NOT NULL DEFAULT 0,
  predicted_grade TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One metrics row per user/plan/topic
  UNIQUE(user_id, plan_id, topic)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_metrics_user_id ON student_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_student_metrics_plan_id ON student_metrics(plan_id);
CREATE INDEX IF NOT EXISTS idx_student_metrics_mastery ON student_metrics(mastery_level);
CREATE INDEX IF NOT EXISTS idx_student_metrics_updated ON student_metrics(updated_at DESC);

-- ============================================
-- 2. DAILY_ACTIVITY — engagement & streak tracking
-- ============================================
CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_date DATE NOT NULL,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  quizzes_taken INTEGER NOT NULL DEFAULT 0,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  subjects_studied TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One row per user per day
  UNIQUE(user_id, activity_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_id ON daily_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity(activity_date DESC);

-- ============================================
-- 3. QUIZ_RESULTS — individual quiz attempts
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER,
  questions JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_plan_id ON quiz_results(plan_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_created ON quiz_results(created_at DESC);

-- ============================================
-- 4. DASHBOARD SUMMARY VIEW
-- ============================================
-- Materialized view for fast dashboard loads.
-- The metrics.ts code queries `student_dashboard_summary`.
-- Using a regular view (not materialized) so it's always fresh.

DROP VIEW IF EXISTS student_dashboard_summary;

CREATE VIEW student_dashboard_summary AS
SELECT
  sm.user_id,
  COUNT(DISTINCT sm.subject)::INTEGER AS subjects_count,
  COUNT(DISTINCT sm.topic)::INTEGER AS topics_count,
  COALESCE(ROUND(AVG(sm.completion_pct)), 0)::INTEGER AS avg_completion,
  COALESCE(ROUND(AVG(sm.mastery_pct)), 0)::INTEGER AS avg_mastery,
  COALESCE(ROUND(AVG(NULLIF(sm.quiz_score_avg, 0))), 0)::INTEGER AS avg_quiz_score,
  COALESCE(SUM(sm.total_time_minutes), 0)::INTEGER AS total_study_minutes,
  COALESCE(SUM(sm.lessons_completed), 0)::INTEGER AS total_lessons_done,
  MAX(sm.last_activity_at)::TEXT AS last_active,
  (
    SELECT COUNT(DISTINCT da.activity_date)::INTEGER
    FROM daily_activity da
    WHERE da.user_id = sm.user_id
      AND da.activity_date >= CURRENT_DATE - INTERVAL '30 days'
  ) AS days_active_30d
FROM student_metrics sm
GROUP BY sm.user_id;

-- ============================================
-- 5. TRIGGERS
-- ============================================
-- Reuse the existing update_updated_at_column() function

DROP TRIGGER IF EXISTS update_student_metrics_updated_at ON student_metrics;
CREATE TRIGGER update_student_metrics_updated_at
  BEFORE UPDATE ON student_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. RLS POLICIES
-- ============================================
ALTER TABLE student_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

-- Permissive policies (matching the pattern in fix-rls-policies.sql)
-- In production, restrict to auth.uid() = user_id

-- student_metrics
DROP POLICY IF EXISTS "Allow reading student_metrics" ON student_metrics;
DROP POLICY IF EXISTS "Allow inserting student_metrics" ON student_metrics;
DROP POLICY IF EXISTS "Allow updating student_metrics" ON student_metrics;

CREATE POLICY "Allow reading student_metrics" ON student_metrics
  FOR SELECT USING (true);

CREATE POLICY "Allow inserting student_metrics" ON student_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow updating student_metrics" ON student_metrics
  FOR UPDATE USING (true);

-- daily_activity
DROP POLICY IF EXISTS "Allow reading daily_activity" ON daily_activity;
DROP POLICY IF EXISTS "Allow inserting daily_activity" ON daily_activity;
DROP POLICY IF EXISTS "Allow updating daily_activity" ON daily_activity;

CREATE POLICY "Allow reading daily_activity" ON daily_activity
  FOR SELECT USING (true);

CREATE POLICY "Allow inserting daily_activity" ON daily_activity
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow updating daily_activity" ON daily_activity
  FOR UPDATE USING (true);

-- quiz_results
DROP POLICY IF EXISTS "Allow reading quiz_results" ON quiz_results;
DROP POLICY IF EXISTS "Allow inserting quiz_results" ON quiz_results;

CREATE POLICY "Allow reading quiz_results" ON quiz_results
  FOR SELECT USING (true);

CREATE POLICY "Allow inserting quiz_results" ON quiz_results
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 7. SUMMARY
-- ============================================
-- After running this migration:
--   - student_metrics: per-topic mastery tracking (upserted by lib/metrics.ts)
--   - daily_activity: daily engagement rows (upserted by bumpDailyActivity)
--   - quiz_results: individual quiz attempt log
--   - student_dashboard_summary: auto-computed view for /api/metrics?view=summary
--   - All RLS policies set to permissive (demo mode)
--   - Triggers configured for updated_at on student_metrics
