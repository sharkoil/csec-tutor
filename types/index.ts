export interface User {
  id: string
  email: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface StudyPlan {
  id: string
  user_id: string
  subject: string
  topics: string[]
  status: 'active' | 'completed' | 'paused'
  created_at: string
  updated_at: string
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