-- Fix: Change user_id columns from UUID to TEXT
-- Reason: Supabase Auth user IDs may not be valid UUID format
-- This migration allows any string format for user IDs

-- First, drop the foreign key constraints
ALTER TABLE study_plans DROP CONSTRAINT IF EXISTS study_plans_user_id_fkey;
ALTER TABLE progress DROP CONSTRAINT IF EXISTS progress_user_id_fkey;
ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_user_id_fkey;

-- Change user_id type from UUID to TEXT
ALTER TABLE study_plans ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE progress ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE ai_usage ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE lessons ALTER COLUMN user_id TYPE TEXT;

-- Re-add foreign key constraints (optional - comment out if you want to allow any user_id)
-- ALTER TABLE study_plans ADD CONSTRAINT study_plans_user_id_fkey 
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE progress ADD CONSTRAINT progress_user_id_fkey 
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update example: If you want to maintain referential integrity, also change users table
-- ALTER TABLE users ALTER COLUMN id TYPE TEXT;
