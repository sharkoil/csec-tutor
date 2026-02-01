-- Disable RLS temporarily and insert demo content
-- Run this in Supabase SQL Editor

-- Step 1: Disable RLS on csec_content table
ALTER TABLE csec_content DISABLE ROW LEVEL SECURITY;

-- Step 2: Insert demo Mathematics content
INSERT INTO csec_content (subject, topic, subtopic, content_type, content, metadata, embedding) VALUES
(
  'mathematics',
  'Algebra',
  'Linear Equations',
  'syllabus',
  'Students should be able to solve linear equations in one variable, including equations with brackets and fractions. They should understand the concept of solution and be able to verify solutions by substitution.',
  '{"difficulty": "medium"}',
  '[0.1, 0.1, 0.1, ...]'  -- Dummy embedding
);

INSERT INTO csec_content (subject, topic, subtopic, content_type, content, metadata, embedding) VALUES
(
  'mathematics',
  'Algebra',
  'Linear Equations',
  'question',
  'Solve the equation 3x + 7 = 22. Show all working steps.',
  '{"year": 2024, "paper_number": "P1", "difficulty": "easy", "question_type": "short_answer", "marks": 3}',
  '[0.2, 0.2, 0.2, ...]'
);

INSERT INTO csec_content (subject, topic, subtopic, content_type, content, metadata, embedding) VALUES
(
  'mathematics',
  'Algebra',
  'Linear Equations',
  'explanation',
  'To solve 3x + 7 = 22, first subtract 7 from both sides: 3x = 15. Then divide both sides by 3: x = 5.',
  '{"difficulty": "easy"}',
  '[0.15, 0.15, 0.15, ...]'
);

-- Step 3: Insert demo Biology content
INSERT INTO csec_content (subject, topic, subtopic, content_type, content, metadata, embedding) VALUES
(
  'biology',
  'Cell Structure',
  'Cell Organelles',
  'syllabus',
  'Students should understand the structure and function of various cell organelles including nucleus, mitochondria, chloroplasts, ribosomes, and cell membrane.',
  '{"difficulty": "medium"}',
  '[0.1, 0.1, 0.1, ...]'
);

INSERT INTO csec_content (subject, topic, subtopic, content_type, content, metadata, embedding) VALUES
(
  'biology',
  'Cell Structure',
  'Cell Organelles',
  'question',
  'Describe the function of mitochondria in a cell.',
  '{"year": 2024, "paper_number": "P2", "difficulty": "medium", "question_type": "structured", "marks": 4}',
  '[0.25, 0.25, 0.25, ...]'
);

-- Step 4: Re-enable RLS with permissive policies
ALTER TABLE csec_content ENABLE ROW LEVEL SECURITY;

-- Step 5: Create permissive policies for content access
DROP POLICY IF EXISTS "Authenticated users can view CSEC content" ON csec_content;

CREATE POLICY "Enable read access for authenticated users" ON csec_content
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Step 6: Verify content was added
SELECT 
  subject,
  topic,
  content_type,
  COUNT(*) as count
FROM csec_content 
GROUP BY subject, topic, content_type
ORDER BY subject, topic, content_type;