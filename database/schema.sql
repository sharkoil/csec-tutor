-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create study_plans table
CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create csec_content table with vector support
CREATE TABLE IF NOT EXISTS csec_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('syllabus', 'question', 'explanation', 'example')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create progress table
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES study_plans(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  coaching_completed BOOLEAN DEFAULT FALSE,
  practice_completed BOOLEAN DEFAULT FALSE,
  exam_completed BOOLEAN DEFAULT FALSE,
  practice_score INTEGER CHECK (practice_score >= 0 AND practice_score <= 100),
  exam_score INTEGER CHECK (exam_score >= 0 AND exam_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, plan_id, topic)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_status ON study_plans(status);
CREATE INDEX IF NOT EXISTS idx_csec_content_subject ON csec_content(subject);
CREATE INDEX IF NOT EXISTS idx_csec_content_topic ON csec_content(topic);
CREATE INDEX IF NOT EXISTS idx_csec_content_type ON csec_content(content_type);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_plan_id ON progress(plan_id);

-- Create vector index for similarity search
CREATE INDEX IF NOT EXISTS idx_csec_content_embedding ON csec_content USING ivfflat (embedding vector_cosine_ops);

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_plans_updated_at BEFORE UPDATE ON study_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_updated_at BEFORE UPDATE ON progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create search function for vector similarity
CREATE OR REPLACE FUNCTION search_csec_content(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
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
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE csec_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Study plans policies
CREATE POLICY "Users can view own study plans" ON study_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own study plans" ON study_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study plans" ON study_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own study plans" ON study_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Progress policies
CREATE POLICY "Users can view own progress" ON progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own progress" ON progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON progress
  FOR UPDATE USING (auth.uid() = user_id);

-- CSEC content policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view CSEC content" ON csec_content
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage CSEC content" ON csec_content
  FOR ALL USING (auth.role() = 'service_role');