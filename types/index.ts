export interface User {
  id: string
  email: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface WizardData {
  target_grade: 'grade_1' | 'grade_2' | 'grade_3'
  proficiency_level: 'beginner' | 'intermediate' | 'advanced'
  topic_confidence: Record<string, 'no_exposure' | 'struggling' | 'some_knowledge' | 'confident'>
  exam_timeline: 'may_june' | 'january' | 'no_exam'
  study_minutes_per_session: number
  study_days_per_week: number
  learning_style: 'theory_first' | 'practice_first' | 'blended'
}

export interface StudyPlan {
  id: string
  user_id: string
  subject: string
  topics: string[]
  status: 'active' | 'completed' | 'paused'
  description?: string
  help_areas?: string[]
  attachments?: PlanAttachment[]
  wizard_data?: WizardData
  created_at: string
  updated_at: string
}

export interface PlanAttachment {
  name: string
  url: string
  type: string
  size: number
}

export interface CSECContent {
  id: string
  subject: string
  topic: string
  subtopic: string
  content_type: 'syllabus' | 'question' | 'explanation' | 'example'
  content: string
  metadata: {
    year?: number
    paper_number?: number
    difficulty?: 'easy' | 'medium' | 'hard'
    question_type?: string
    marks?: number
  }
  embedding: number[]
  created_at: string
}

export interface Progress {
  id: string
  user_id: string
  plan_id: string
  topic: string
  coaching_completed: boolean
  practice_completed: boolean
  exam_completed: boolean
  practice_score?: number
  exam_score?: number
  created_at: string
  updated_at: string
}

export interface CoachingSession {
  planId: string
  topic: string
  explanation: string
  examples: string[]
  key_points: string[]
  practice_tips: string[]
}

export interface PracticeQuestion {
  id?: string
  question: string
  type: 'multiple_choice' | 'short_answer' | 'structured' | 'essay'
  marks: number
  difficulty: 'easy' | 'medium' | 'hard'
  options?: string[]
  answer?: string
  explanation?: string
}

export interface PracticeExam {
  id?: string
  title: string
  subject: string
  topics: string[]
  duration: number
  total_marks: number
  questions: PracticeQuestion[]
  instructions: string
  answer_key: {
    question_id: string
    answer: string
    marks: number
    explanation?: string
  }[]
}

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export interface LearningProgress {
  topic: string
  coaching_completed: boolean
  practice_completed: boolean
  exam_completed: boolean
  practice_score?: number
  exam_score?: number
  last_activity: string
}

export interface Subject {
  name: string
  code: string
  description: string
  topics: string[]
}

export interface LearningPath {
  subject: string
  topics: LearningTopic[]
  estimated_weeks: number
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
}

export interface LearningTopic {
  name: string
  description: string
  subtopics: string[]
  estimated_hours: number
  prerequisites?: string[]
}

export interface QuizResult {
  topic: string
  score: number
  total_marks: number
  answers: {
    question_id: string
    user_answer: string
    correct_answer: string
    is_correct: boolean
    marks_obtained: number
  }[]
  time_taken: number
  completed_at: string
}

// ── Metrics & Analytics ─────────────────────────────────────────────

export type MasteryLevel = 'not_started' | 'beginner' | 'developing' | 'proficient' | 'mastered'

export interface StudentMetric {
  id: string
  user_id: string
  plan_id: string
  subject: string
  topic: string

  // Completion
  lessons_completed: number
  lessons_total: number
  completion_pct: number

  // Performance
  quiz_score_avg: number
  quiz_attempts: number
  best_quiz_score: number
  problems_attempted: number
  problems_correct: number

  // Mastery
  mastery_level: MasteryLevel
  mastery_pct: number

  // Engagement
  total_time_minutes: number
  lesson_retry_count: number
  last_activity_at: string | null

  // Trends
  score_trend: number
  predicted_grade: string | null

  created_at: string
  updated_at: string
}

export interface DailyActivity {
  id: string
  user_id: string
  activity_date: string
  lessons_completed: number
  quizzes_taken: number
  time_spent_minutes: number
  subjects_studied: string[]
  created_at: string
}

export interface DBQuizResult {
  id: string
  user_id: string
  plan_id: string
  subject: string
  topic: string
  score: number
  total_questions: number
  correct_answers: number
  time_taken_seconds: number | null
  questions: unknown[]
  created_at: string
}

export interface DashboardSummary {
  user_id: string
  subjects_count: number
  topics_count: number
  avg_completion: number
  avg_mastery: number
  avg_quiz_score: number
  total_study_minutes: number
  total_lessons_done: number
  last_active: string | null
  days_active_30d: number
}

export interface StudentStreak {
  current: number
  longest: number
  today_active: boolean
}