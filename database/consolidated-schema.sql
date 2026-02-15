-- ============================================================
-- CSEC Tutor — Consolidated Database Schema (v2)
-- ============================================================
-- Merge of: schema.sql, add-metrics-tables.sql, add-content-tables.sql,
--   add-missing-columns.sql, add-wizard-data.sql, admin-schema.sql,
--   fix-rls-policies.sql, fix-user-id-type.sql, migrate-to-384-dim.sql,
--   rebuild-vector-index.sql, update-rls.sql
--
-- This file is the SINGLE SOURCE OF TRUTH for the database schema.
-- Individual migration files are kept for history only.
-- This script is IDEMPOTENT — safe to run multiple times.
-- ============================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. UTILITY FUNCTION (used by triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  description TEXT,
  help_areas TEXT[],
  attachments JSONB DEFAULT '[]',
  wizard_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES study_plans(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  coaching_completed BOOLEAN DEFAULT FALSE,
  practice_completed BOOLEAN DEFAULT FALSE,
  exam_completed BOOLEAN DEFAULT FALSE,
  practice_score INTEGER CHECK (practice_score >= 0 AND practice_score <= 100),
  exam_score INTEGER CHECK (exam_score >= 0 AND exam_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id, topic)
);

-- ============================================================
-- 3. VECTOR CONTENT TABLE (384-dim, all-MiniLM-L6-v2)
-- ============================================================

CREATE TABLE IF NOT EXISTS csec_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('syllabus','question','explanation','example')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. METRICS TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS student_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  lessons_total INTEGER NOT NULL DEFAULT 1,
  completion_pct INTEGER NOT NULL DEFAULT 0,
  quiz_score_avg INTEGER NOT NULL DEFAULT 0,
  quiz_attempts INTEGER NOT NULL DEFAULT 0,
  best_quiz_score INTEGER NOT NULL DEFAULT 0,
  problems_attempted INTEGER NOT NULL DEFAULT 0,
  problems_correct INTEGER NOT NULL DEFAULT 0,
  mastery_level TEXT NOT NULL DEFAULT 'not_started'
    CHECK (mastery_level IN ('not_started','beginner','developing','proficient','mastered')),
  mastery_pct INTEGER NOT NULL DEFAULT 0,
  total_time_minutes INTEGER NOT NULL DEFAULT 0,
  lesson_retry_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  score_trend INTEGER NOT NULL DEFAULT 0,
  predicted_grade TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id, topic)
);

CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_date DATE NOT NULL,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  quizzes_taken INTEGER NOT NULL DEFAULT 0,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  subjects_studied TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_date)
);

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. CONTENT CACHE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'common' CHECK (content_type IN ('common','personalized')),
  user_id UUID,
  model TEXT,
  is_fallback BOOLEAN DEFAULT FALSE,
  vector_grounded BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  questions JSONB NOT NULL,
  difficulty TEXT DEFAULT 'mixed' CHECK (difficulty IN ('easy','medium','hard','mixed')),
  content_type TEXT DEFAULT 'common' CHECK (content_type IN ('common','personalized')),
  user_id UUID,
  model TEXT,
  question_count INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  exam_content JSONB NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  total_marks INTEGER DEFAULT 100,
  content_type TEXT DEFAULT 'common' CHECK (content_type IN ('common','personalized')),
  user_id UUID,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  pain_points TEXT[],
  learning_style TEXT,
  difficulty_preference TEXT DEFAULT 'medium',
  has_uploaded_docs BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject)
);

-- ============================================================
-- 6. AI USAGE TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  generation_id TEXT,
  model TEXT NOT NULL,
  action TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_credits DECIMAL(12,8) NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  cached_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. INDEXES
-- ============================================================

-- Core
CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_status ON study_plans(status);
CREATE INDEX IF NOT EXISTS idx_study_plans_wizard_data ON study_plans USING GIN (wizard_data);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_plan_id ON progress(plan_id);

-- Vector content
CREATE INDEX IF NOT EXISTS idx_csec_content_subject ON csec_content(subject);
CREATE INDEX IF NOT EXISTS idx_csec_content_topic ON csec_content(topic);
CREATE INDEX IF NOT EXISTS idx_csec_content_type ON csec_content(content_type);

-- Metrics
CREATE INDEX IF NOT EXISTS idx_student_metrics_user_id ON student_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_student_metrics_plan_id ON student_metrics(plan_id);
CREATE INDEX IF NOT EXISTS idx_student_metrics_mastery ON student_metrics(mastery_level);
CREATE INDEX IF NOT EXISTS idx_student_metrics_updated ON student_metrics(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_id ON daily_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_plan_id ON quiz_results(plan_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_created ON quiz_results(created_at DESC);

-- Content cache
CREATE INDEX IF NOT EXISTS idx_lessons_subject_topic ON lessons(subject, topic);
CREATE INDEX IF NOT EXISTS idx_lessons_content_type ON lessons(content_type);
CREATE INDEX IF NOT EXISTS idx_practice_subject_topic ON practice_questions(subject, topic);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(subject);
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id ON user_preferences(user_id);

-- Usage
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_action ON ai_usage(action);

-- ============================================================
-- 8. VECTOR SEARCH FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION search_csec_content(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE(
  id UUID, subject TEXT, topic TEXT, subtopic TEXT,
  content_type TEXT, content TEXT, metadata JSONB, similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.subject, c.topic, c.subtopic, c.content_type,
         c.content, c.metadata,
         1 - (c.embedding <=> query_embedding) as similarity
  FROM csec_content c
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 9. USAGE STATS FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION get_usage_stats(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  total_requests BIGINT, total_tokens BIGINT, total_cost DECIMAL,
  by_model JSONB, by_action JSONB, daily_breakdown JSONB
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT * FROM ai_usage WHERE created_at >= start_date AND created_at <= end_date
  ),
  model_stats AS (
    SELECT COALESCE(jsonb_object_agg(a.model, jsonb_build_object('requests',cnt,'tokens',tok,'cost',cst)),'{}'::jsonb) as data
    FROM (SELECT a2.model, COUNT(*) cnt, SUM(a2.total_tokens) tok, SUM(a2.cost_credits) cst FROM filtered a2 GROUP BY a2.model) a
  ),
  action_stats AS (
    SELECT COALESCE(jsonb_object_agg(b.action, jsonb_build_object('requests',cnt,'tokens',tok,'cost',cst)),'{}'::jsonb) as data
    FROM (SELECT b2.action, COUNT(*) cnt, SUM(b2.total_tokens) tok, SUM(b2.cost_credits) cst FROM filtered b2 GROUP BY b2.action) b
  ),
  daily AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('date',d.dt,'requests',cnt,'tokens',tok,'cost',cst) ORDER BY d.dt DESC),'[]'::jsonb) as data
    FROM (SELECT DATE(d2.created_at) dt, COUNT(*) cnt, SUM(d2.total_tokens) tok, SUM(d2.cost_credits) cst FROM filtered d2 GROUP BY DATE(d2.created_at)) d
  )
  SELECT
    (SELECT COUNT(*) FROM filtered)::BIGINT,
    (SELECT COALESCE(SUM(f.total_tokens),0) FROM filtered f)::BIGINT,
    (SELECT COALESCE(SUM(f.cost_credits),0) FROM filtered f),
    (SELECT data FROM model_stats),
    (SELECT data FROM action_stats),
    (SELECT data FROM daily);
END;
$$;

-- ============================================================
-- 10. DASHBOARD VIEW
-- ============================================================

DROP VIEW IF EXISTS student_dashboard_summary;
CREATE VIEW student_dashboard_summary AS
SELECT
  sm.user_id,
  COUNT(DISTINCT sm.subject)::INTEGER AS subjects_count,
  COUNT(DISTINCT sm.topic)::INTEGER AS topics_count,
  COALESCE(ROUND(AVG(sm.completion_pct)),0)::INTEGER AS avg_completion,
  COALESCE(ROUND(AVG(sm.mastery_pct)),0)::INTEGER AS avg_mastery,
  COALESCE(ROUND(AVG(NULLIF(sm.quiz_score_avg,0))),0)::INTEGER AS avg_quiz_score,
  COALESCE(SUM(sm.total_time_minutes),0)::INTEGER AS total_study_minutes,
  COALESCE(SUM(sm.lessons_completed),0)::INTEGER AS total_lessons_done,
  MAX(sm.last_activity_at)::TEXT AS last_active,
  (SELECT COUNT(DISTINCT da.activity_date)::INTEGER FROM daily_activity da
   WHERE da.user_id = sm.user_id AND da.activity_date >= CURRENT_DATE - INTERVAL '30 days') AS days_active_30d
FROM student_metrics sm
GROUP BY sm.user_id;

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_plans_updated_at ON study_plans;
CREATE TRIGGER update_study_plans_updated_at BEFORE UPDATE ON study_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_progress_updated_at ON progress;
CREATE TRIGGER update_progress_updated_at BEFORE UPDATE ON progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_metrics_updated_at ON student_metrics;
CREATE TRIGGER update_student_metrics_updated_at BEFORE UPDATE ON student_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 12. ROW LEVEL SECURITY (permissive for demo mode)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE csec_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Permissive policies (demo mode — tighten for production)
-- Each table: SELECT true, INSERT true, UPDATE true

-- users
DROP POLICY IF EXISTS "Allow all users" ON users;
CREATE POLICY "Allow all users" ON users FOR ALL USING (true) WITH CHECK (true);

-- study_plans
DROP POLICY IF EXISTS "Allow all study_plans" ON study_plans;
CREATE POLICY "Allow all study_plans" ON study_plans FOR ALL USING (true) WITH CHECK (true);

-- progress
DROP POLICY IF EXISTS "Allow all progress" ON progress;
CREATE POLICY "Allow all progress" ON progress FOR ALL USING (true) WITH CHECK (true);

-- csec_content
DROP POLICY IF EXISTS "Allow all csec_content" ON csec_content;
CREATE POLICY "Allow all csec_content" ON csec_content FOR ALL USING (true) WITH CHECK (true);

-- student_metrics
DROP POLICY IF EXISTS "Allow all student_metrics" ON student_metrics;
CREATE POLICY "Allow all student_metrics" ON student_metrics FOR ALL USING (true) WITH CHECK (true);

-- daily_activity
DROP POLICY IF EXISTS "Allow all daily_activity" ON daily_activity;
CREATE POLICY "Allow all daily_activity" ON daily_activity FOR ALL USING (true) WITH CHECK (true);

-- quiz_results
DROP POLICY IF EXISTS "Allow all quiz_results" ON quiz_results;
CREATE POLICY "Allow all quiz_results" ON quiz_results FOR ALL USING (true) WITH CHECK (true);

-- lessons
DROP POLICY IF EXISTS "Allow all lessons" ON lessons;
CREATE POLICY "Allow all lessons" ON lessons FOR ALL USING (true) WITH CHECK (true);

-- practice_questions
DROP POLICY IF EXISTS "Allow all practice_questions" ON practice_questions;
CREATE POLICY "Allow all practice_questions" ON practice_questions FOR ALL USING (true) WITH CHECK (true);

-- exams
DROP POLICY IF EXISTS "Allow all exams" ON exams;
CREATE POLICY "Allow all exams" ON exams FOR ALL USING (true) WITH CHECK (true);

-- user_preferences
DROP POLICY IF EXISTS "Allow all user_preferences" ON user_preferences;
CREATE POLICY "Allow all user_preferences" ON user_preferences FOR ALL USING (true) WITH CHECK (true);

-- ai_usage
DROP POLICY IF EXISTS "Allow all ai_usage" ON ai_usage;
CREATE POLICY "Allow all ai_usage" ON ai_usage FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- END OF CONSOLIDATED SCHEMA
-- ============================================================

