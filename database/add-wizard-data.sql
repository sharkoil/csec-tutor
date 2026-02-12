-- Add wizard_data JSONB column to study_plans
-- Stores proficiency assessment and study preferences from the plan creation wizard
--
-- Structure:
-- {
--   "target_grade": "grade_1" | "grade_2" | "grade_3",
--   "proficiency_level": "beginner" | "intermediate" | "advanced",
--   "topic_confidence": { "Algebra": "struggling", "Geometry": "confident", ... },
--   "exam_timeline": "may_june" | "january" | "no_exam",
--   "study_minutes_per_session": 15 | 30 | 60,
--   "study_days_per_week": 1-7,
--   "learning_style": "theory_first" | "practice_first" | "blended"
-- }

ALTER TABLE study_plans
ADD COLUMN IF NOT EXISTS wizard_data JSONB DEFAULT NULL;

-- Also add columns that the app already inserts but may not exist in schema
ALTER TABLE study_plans
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

ALTER TABLE study_plans
ADD COLUMN IF NOT EXISTS help_areas TEXT[] DEFAULT NULL;

ALTER TABLE study_plans
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- Create index for querying by proficiency level
CREATE INDEX IF NOT EXISTS idx_study_plans_wizard_grade
ON study_plans ((wizard_data->>'target_grade'));
