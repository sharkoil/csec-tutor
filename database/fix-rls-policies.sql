-- Simplify RLS policies for study_plans table
-- Run this in Supabase SQL Editor

-- Drop existing study_plans policies
DROP POLICY IF EXISTS "Users can view own study plans" ON study_plans;
DROP POLICY IF EXISTS "Users can create own study plans" ON study_plans;
DROP POLICY IF EXISTS "Users can update own study plans" ON study_plans;
DROP POLICY IF EXISTS "Users can delete own study plans" ON study_plans;

-- Create simplified policies that allow anon users and regular users
-- Anon users creating plans without authentication
CREATE POLICY IF NOT EXISTS "Allow creating plans" ON study_plans
  FOR INSERT
  WITH CHECK (true);

-- Anyone can view plans (for demo purposes)
-- In production, restrict to auth.uid() = user_id
CREATE POLICY IF NOT EXISTS "Allow viewing all plans" ON study_plans
  FOR SELECT
  USING (true);

-- Allow updates
CREATE POLICY IF NOT EXISTS "Allow updating plans" ON study_plans
  FOR UPDATE
  USING (true);

-- Allow deletes
CREATE POLICY IF NOT EXISTS "Allow deleting plans" ON study_plans
  FOR DELETE
  USING (true);

-- Also simplify progress table RLS
DROP POLICY IF EXISTS "Users can view own progress" ON progress;
DROP POLICY IF EXISTS "Users can create own progress" ON progress;
DROP POLICY IF EXISTS "Users can update own progress" ON progress;

CREATE POLICY IF NOT EXISTS "Allow creating progress" ON progress
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow viewing progress" ON progress
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow updating progress" ON progress
  FOR UPDATE
  USING (true);
