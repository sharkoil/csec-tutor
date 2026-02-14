-- Add missing columns to study_plans table
-- Run this in Supabase SQL Editor to fix schema mismatch

ALTER TABLE study_plans 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS help_areas TEXT[],
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS wizard_data JSONB DEFAULT '{}';

-- Create index for wizard_data queries
CREATE INDEX IF NOT EXISTS idx_study_plans_wizard_data ON study_plans USING GIN (wizard_data);

COMMENT ON COLUMN study_plans.description IS 'User description of their goals and challenges';
COMMENT ON COLUMN study_plans.help_areas IS 'Topics the user needs help with';
COMMENT ON COLUMN study_plans.attachments IS 'Uploaded files and past papers';
COMMENT ON COLUMN study_plans.wizard_data IS 'Wizard configuration: target_grade, proficiency_level, learning_style, etc.';
