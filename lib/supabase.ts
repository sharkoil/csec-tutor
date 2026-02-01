import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          updated_at?: string
        }
      }
      study_plans: {
        Row: {
          id: string
          user_id: string
          subject: string
          topics: string[]
          status: 'active' | 'completed' | 'paused'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          topics: string[]
          status?: 'active' | 'completed' | 'paused'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          topics?: string[]
          status?: 'active' | 'completed' | 'paused'
          updated_at?: string
        }
      }
      csec_content: {
        Row: {
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
        Insert: {
          id?: string
          subject: string
          topic: string
          subtopic: string
          content_type: 'syllabus' | 'question' | 'explanation' | 'example'
          content: string
          metadata?: {
            year?: number
            paper_number?: number
            difficulty?: 'easy' | 'medium' | 'hard'
            question_type?: string
            marks?: number
          }
          embedding: number[]
          created_at?: string
        }
        Update: {
          id?: string
          subject?: string
          topic?: string
          subtopic?: string
          content_type?: 'syllabus' | 'question' | 'explanation' | 'example'
          content?: string
          metadata?: {
            year?: number
            paper_number?: number
            difficulty?: 'easy' | 'medium' | 'hard'
            question_type?: string
            marks?: number
          }
          embedding?: number[]
        }
      }
      progress: {
        Row: {
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
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          topic: string
          coaching_completed?: boolean
          practice_completed?: boolean
          exam_completed?: boolean
          practice_score?: number
          exam_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          topic?: string
          coaching_completed?: boolean
          practice_completed?: boolean
          exam_completed?: boolean
          practice_score?: number
          exam_score?: number
          updated_at?: string
        }
      }
    }
  }
}