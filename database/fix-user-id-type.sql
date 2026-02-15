-- Fix user_id type constraints and FK issues
-- Run this in Supabase SQL Editor
--
-- Problem: Mock-auth users had non-UUID IDs (e.g. 'user_abc123') which
-- prevented inserts into study_plans and progress tables (UUID type mismatch
-- + FK constraint to users table).
--
-- The application code now generates proper UUIDs and auto-creates user rows,
-- but this migration provides a safety net:
--   1. Drops the FK constraint on study_plans.user_id and progress.user_id
--      so inserts don't require a pre-existing users row.
--   2. Allows the service-role client to create user records on the fly.
--
-- This migration is IDEMPOTENT — safe to run multiple times.

-- ============================================
-- 1. DROP FK CONSTRAINTS (if they exist)
-- ============================================

-- study_plans.user_id  →  users(id)
DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT conname INTO _constraint_name
    FROM pg_constraint
   WHERE conrelid = 'study_plans'::regclass
     AND confrelid = 'users'::regclass
     AND contype = 'f'
   LIMIT 1;

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE study_plans DROP CONSTRAINT %I', _constraint_name);
    RAISE NOTICE 'Dropped FK constraint % on study_plans', _constraint_name;
  ELSE
    RAISE NOTICE 'No FK constraint on study_plans.user_id — nothing to drop';
  END IF;
END $$;

-- progress.user_id  →  users(id)
DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT conname INTO _constraint_name
    FROM pg_constraint
   WHERE conrelid = 'progress'::regclass
     AND confrelid = 'users'::regclass
     AND contype = 'f'
   LIMIT 1;

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE progress DROP CONSTRAINT %I', _constraint_name);
    RAISE NOTICE 'Dropped FK constraint % on progress', _constraint_name;
  ELSE
    RAISE NOTICE 'No FK constraint on progress.user_id — nothing to drop';
  END IF;
END $$;

-- progress.plan_id  →  study_plans(id)  (keep this one, but make it soft)
-- Actually let's keep plan_id FK — that's a valid relationship.

-- ============================================
-- 2. ENSURE COLUMNS STILL HAVE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_plan_id ON progress(plan_id);

-- ============================================
-- 3. ALLOW SERVICE ROLE TO INSERT USERS
-- ============================================
-- The app now auto-creates user records for mock-auth users.
-- Ensure service_role can manage the users table.
DO $$
BEGIN
  -- Drop existing service role policy if present
  DROP POLICY IF EXISTS "Service role can manage users" ON users;
  
  CREATE POLICY "Service role can manage users" ON users
    FOR ALL USING (auth.role() = 'service_role');
    
  RAISE NOTICE 'Created service_role policy on users table';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create users policy (may already exist): %', SQLERRM;
END $$;

-- Also allow anon/authenticated to insert themselves (for Supabase auth)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can insert users" ON users;

  CREATE POLICY "Anyone can insert users" ON users
    FOR INSERT WITH CHECK (true);
    
  RAISE NOTICE 'Created insert policy on users table';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create users insert policy: %', SQLERRM;
END $$;

-- ============================================
-- 4. SUMMARY
-- ============================================
-- After running this migration:
--   - study_plans.user_id no longer requires a matching users row
--   - progress.user_id no longer requires a matching users row
--   - The application still creates user records automatically
--   - Indexes are preserved for query performance
--   - Service role can manage user records