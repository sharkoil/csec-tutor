-- Update RLS policies to allow content insertion

-- Drop existing policies that might be blocking
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can view CSEC content" ON csec_content;
DROP POLICY IF EXISTS "Service role can manage CSEC content" ON csec_content;

-- Create new, more permissive policies
CREATE POLICY "Users can view own profile" ON users
  FOR ALL
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view CSEC content" ON csec_content
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage CSEC content" ON csec_content
  FOR ALL
  USING (auth.role() = 'service_role');

-- Also update progress and study plans policies
DROP POLICY IF EXISTS "Users can manage own study plans" ON study_plans;
DROP POLICY IF EXISTS "Users can manage own progress" ON progress;

CREATE POLICY "Users can manage own study plans" ON study_plans
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own progress" ON progress
  FOR ALL
  USING (auth.uid() = user_id);