-- Content Persistence Tables
-- Run this in Supabase SQL Editor to add content caching tables

-- ============================================
-- 0. DROP EXISTING TABLES (if upgrading)
-- ============================================
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS practice_questions CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;

-- ============================================
-- 1. LESSONS TABLE - Cached textbook lessons
-- ============================================
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'common' CHECK (content_type IN ('common', 'personalized')),
  user_id UUID NULL,
  model TEXT,
  is_fallback BOOLEAN DEFAULT FALSE,
  vector_grounded BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_lessons_subject_topic ON lessons(subject, topic);
CREATE INDEX IF NOT EXISTS idx_lessons_content_type ON lessons(content_type);
CREATE INDEX IF NOT EXISTS idx_lessons_user_id ON lessons(user_id) WHERE user_id IS NOT NULL;

-- Unique constraints using partial indexes (PostgreSQL 14 compatible)
-- Common content: one per subject/topic (user_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_unique_common 
  ON lessons(subject, topic, content_type) WHERE user_id IS NULL;
-- Personalized content: one per subject/topic/user
CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_unique_personalized 
  ON lessons(subject, topic, content_type, user_id) WHERE user_id IS NOT NULL;

-- ============================================
-- 2. PRACTICE_QUESTIONS TABLE - Cached quiz questions
-- ============================================
CREATE TABLE practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  questions JSONB NOT NULL, -- Array of question objects
  difficulty TEXT DEFAULT 'mixed' CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
  content_type TEXT DEFAULT 'common' CHECK (content_type IN ('common', 'personalized')),
  user_id UUID NULL,
  model TEXT,
  question_count INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_practice_subject_topic ON practice_questions(subject, topic);
CREATE INDEX IF NOT EXISTS idx_practice_content_type ON practice_questions(content_type);
CREATE INDEX IF NOT EXISTS idx_practice_user_id ON practice_questions(user_id) WHERE user_id IS NOT NULL;

-- Unique constraints using partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_unique_common 
  ON practice_questions(subject, topic, difficulty, content_type) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_unique_personalized 
  ON practice_questions(subject, topic, difficulty, content_type, user_id) WHERE user_id IS NOT NULL;

-- ============================================
-- 3. EXAMS TABLE - Cached practice exams
-- ============================================
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  exam_content JSONB NOT NULL, -- Full exam structure
  duration_minutes INTEGER DEFAULT 60,
  total_marks INTEGER DEFAULT 100,
  content_type TEXT DEFAULT 'common' CHECK (content_type IN ('common', 'personalized')),
  user_id UUID NULL,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(subject);
CREATE INDEX IF NOT EXISTS idx_exams_content_type ON exams(content_type);
CREATE INDEX IF NOT EXISTS idx_exams_user_id ON exams(user_id) WHERE user_id IS NOT NULL;

-- ============================================
-- 4. USER_PREFERENCES TABLE - Pain points and context
-- ============================================
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  pain_points TEXT[], -- Areas user is struggling with
  learning_style TEXT, -- 'visual', 'reading', 'practice', etc.
  difficulty_preference TEXT DEFAULT 'medium',
  has_uploaded_docs BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, subject)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id ON user_preferences(user_id);

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Lessons: Everyone can read common, users can read their own personalized
CREATE POLICY "Anyone can read common lessons" ON lessons
  FOR SELECT USING (content_type = 'common');

CREATE POLICY "Users can read their personalized lessons" ON lessons
  FOR SELECT USING (content_type = 'personalized' AND auth.uid() = user_id);

CREATE POLICY "Service role can manage all lessons" ON lessons
  FOR ALL USING (auth.role() = 'service_role');

-- Practice Questions: Same pattern
CREATE POLICY "Anyone can read common practice questions" ON practice_questions
  FOR SELECT USING (content_type = 'common');

CREATE POLICY "Users can read their personalized practice questions" ON practice_questions
  FOR SELECT USING (content_type = 'personalized' AND auth.uid() = user_id);

CREATE POLICY "Service role can manage all practice questions" ON practice_questions
  FOR ALL USING (auth.role() = 'service_role');

-- Exams: Same pattern
CREATE POLICY "Anyone can read common exams" ON exams
  FOR SELECT USING (content_type = 'common');

CREATE POLICY "Users can read their personalized exams" ON exams
  FOR SELECT USING (content_type = 'personalized' AND auth.uid() = user_id);

CREATE POLICY "Service role can manage all exams" ON exams
  FOR ALL USING (auth.role() = 'service_role');

-- User Preferences: Users can only access their own
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all preferences" ON user_preferences
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to get or create common lesson
CREATE OR REPLACE FUNCTION get_common_lesson(
  p_subject TEXT,
  p_topic TEXT
) RETURNS TABLE(
  id UUID,
  content TEXT,
  model TEXT,
  is_fallback BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.content, l.model, l.is_fallback, l.created_at
  FROM lessons l
  WHERE l.subject = p_subject 
    AND l.topic = p_topic 
    AND l.content_type = 'common'
  LIMIT 1;
END;
$$;

-- Function to get common practice questions
CREATE OR REPLACE FUNCTION get_common_practice(
  p_subject TEXT,
  p_topic TEXT,
  p_difficulty TEXT DEFAULT 'mixed'
) RETURNS TABLE(
  id UUID,
  questions JSONB,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT pq.id, pq.questions, pq.model, pq.created_at
  FROM practice_questions pq
  WHERE pq.subject = p_subject 
    AND pq.topic = p_topic 
    AND pq.difficulty = p_difficulty
    AND pq.content_type = 'common'
  LIMIT 1;
END;
$$;

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on lessons
DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on user_preferences
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. SUMMARY
-- ============================================
-- Tables created:
--   - lessons: Cached textbook lessons (common + personalized)
--   - practice_questions: Cached quiz questions
--   - exams: Cached full practice exams
--   - user_preferences: User pain points and learning preferences
--
-- Usage:
--   1. Check for existing common content first
--   2. If not found, generate with LLM and store as common
--   3. For personalized content, associate with user_id
--   4. Use vector_grounded flag to track if content used RAG
