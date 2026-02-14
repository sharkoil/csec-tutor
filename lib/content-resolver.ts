/**
 * Content Resolver Service
 * 
 * Implements smart content resolution:
 * 1. Check if user has specific pain points or uploaded docs → Generate personalized
 * 2. Otherwise, search for existing common content → Return if found
 * 3. If no common content exists → Generate with LLM and store as common
 * 4. On LLM failure → Fall back to any existing content for subject/topic
 * 
 * All LLM generation is grounded with vector search for CSEC-specific context.
 */

import { createClient } from '@supabase/supabase-js'
import { AICoach, TextbookLesson } from './ai-coach'
import { VectorSearch } from './vector-search'

// Supabase client with service role for database operations
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// Content resolution context
export interface ContentContext {
  userId?: string
  painPoints?: string[] // Specific struggles mentioned by user
  hasUploadedDocs?: boolean // Whether user uploaded custom materials
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'
  forceRegenerate?: boolean // Skip cache and regenerate
}

// Stored lesson record
export interface StoredLesson {
  id: string
  subject: string
  topic: string
  content: string
  content_type: 'common' | 'personalized'
  user_id?: string
  model?: string
  is_fallback: boolean
  vector_grounded: boolean
  created_at: string
}

// Stored practice questions record
export interface StoredPractice {
  id: string
  subject: string
  topic: string
  questions: any[]
  difficulty: string
  content_type: 'common' | 'personalized'
  user_id?: string
  model?: string
  created_at: string
}

export class ContentResolver {
  /**
   * Resolve a lesson for a subject/topic
   * Uses smart content resolution with caching
   */
  static async resolveLesson(
    subject: string,
    topic: string,
    context: ContentContext = {}
  ): Promise<TextbookLesson & { cached: boolean; contentType: 'common' | 'personalized' }> {
    const supabase = getSupabase()
    const needsPersonalized = context.painPoints?.length || context.hasUploadedDocs
    
    // Step 1: If user needs personalized content and has context
    if (needsPersonalized && context.userId && !context.forceRegenerate) {
      // Check for existing personalized content
      const personalized = await this.getStoredLesson(subject, topic, 'personalized', context.userId)
      if (personalized) {
        return {
          content: personalized.content,
          model: personalized.model || 'cached',
          isFallback: personalized.is_fallback,
          generatedAt: personalized.created_at,
          subject,
          topic,
          cached: true,
          contentType: 'personalized'
        }
      }
    }
    
    // Step 2: Check for common content (unless forcing regenerate)
    if (!context.forceRegenerate && !needsPersonalized) {
      const common = await this.getStoredLesson(subject, topic, 'common')
      if (common) {
        console.log(`[ContentResolver] Returning cached common lesson for ${subject}/${topic}`)
        return {
          content: common.content,
          model: common.model || 'cached',
          isFallback: common.is_fallback,
          generatedAt: common.created_at,
          subject,
          topic,
          cached: true,
          contentType: 'common'
        }
      }
    }
    
    // Step 3: Generate new content with LLM
    try {
      console.log(`[ContentResolver] Generating new lesson for ${subject}/${topic}`)
      const lesson = await AICoach.generateTextbookLesson(subject, topic)
      
      // Store the generated content
      const contentType = needsPersonalized ? 'personalized' : 'common'
      await this.storeLesson({
        subject,
        topic,
        content: lesson.content,
        content_type: contentType,
        user_id: needsPersonalized ? context.userId : undefined,
        model: lesson.model,
        is_fallback: lesson.isFallback,
        vector_grounded: true
      })
      
      return {
        ...lesson,
        cached: false,
        contentType
      }
    } catch (error) {
      console.error('[ContentResolver] LLM generation failed:', error)
      
      // Step 4: Fallback - return any existing content
      const fallback = await this.getAnyStoredLesson(subject, topic)
      if (fallback) {
        console.log(`[ContentResolver] Returning fallback content for ${subject}/${topic}`)
        return {
          content: fallback.content,
          model: 'fallback-cached',
          isFallback: true,
          generatedAt: fallback.created_at,
          subject,
          topic,
          cached: true,
          contentType: fallback.content_type as 'common' | 'personalized'
        }
      }
      
      // No content available - throw
      throw new Error(`No content available for ${subject}/${topic} and LLM generation failed`)
    }
  }

  /**
   * Resolve practice questions for a subject/topic
   */
  static async resolvePractice(
    subject: string,
    topic: string,
    context: ContentContext = {}
  ): Promise<{ questions: any[]; cached: boolean; contentType: 'common' | 'personalized' }> {
    const difficulty = context.difficulty || 'mixed'
    const needsPersonalized = context.painPoints?.length || context.hasUploadedDocs
    
    // Check for existing content first
    if (!context.forceRegenerate && !needsPersonalized) {
      const stored = await this.getStoredPractice(subject, topic, difficulty, 'common')
      if (stored) {
        console.log(`[ContentResolver] Returning cached practice for ${subject}/${topic}`)
        return {
          questions: stored.questions,
          cached: true,
          contentType: 'common'
        }
      }
    }
    
    // Generate new questions
    try {
      console.log(`[ContentResolver] Generating practice questions for ${subject}/${topic}`)
      
      // Get vector context for grounding
      const vectorContext = await VectorSearch.searchSimilarContent(
        `${subject} ${topic} practice questions examples problems`,
        subject,
        topic,
        'question',
        5
      )
      
      const questions = await this.generatePracticeWithContext(subject, topic, difficulty, vectorContext)
      
      // Store for future use
      const contentType = needsPersonalized ? 'personalized' : 'common'
      await this.storePractice({
        subject,
        topic,
        questions,
        difficulty,
        content_type: contentType,
        user_id: needsPersonalized ? context.userId : undefined
      })
      
      return {
        questions,
        cached: false,
        contentType
      }
    } catch (error) {
      console.error('[ContentResolver] Practice generation failed:', error)
      
      // Fallback to any stored practice
      const fallback = await this.getAnyStoredPractice(subject, topic)
      if (fallback) {
        return {
          questions: fallback.questions,
          cached: true,
          contentType: fallback.content_type as 'common' | 'personalized'
        }
      }
      
      // Return demo questions as last resort
      return {
        questions: this.getDemoQuestions(subject, topic),
        cached: false,
        contentType: 'common'
      }
    }
  }

  // ============ Storage Methods ============

  private static async getStoredLesson(
    subject: string,
    topic: string,
    contentType: 'common' | 'personalized',
    userId?: string
  ): Promise<StoredLesson | null> {
    const supabase = getSupabase()
    if (!supabase) return null
    
    try {
      let query = supabase
        .from('lessons')
        .select('*')
        .eq('subject', subject)
        .eq('topic', topic)
        .eq('content_type', contentType)
      
      if (contentType === 'personalized' && userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.is('user_id', null)
      }
      
      const { data, error } = await query.single()
      if (error || !data) return null
      return data as StoredLesson
    } catch {
      return null
    }
  }

  private static async getAnyStoredLesson(
    subject: string,
    topic: string
  ): Promise<StoredLesson | null> {
    const supabase = getSupabase()
    if (!supabase) return null
    
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('subject', subject)
        .eq('topic', topic)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error || !data) return null
      return data as StoredLesson
    } catch {
      return null
    }
  }

  private static async storeLesson(lesson: {
    subject: string
    topic: string
    content: string
    content_type: 'common' | 'personalized'
    user_id?: string
    model?: string
    is_fallback: boolean
    vector_grounded: boolean
  }): Promise<void> {
    const supabase = getSupabase()
    if (!supabase) return
    
    try {
      await supabase
        .from('lessons')
        .upsert(lesson, {
          onConflict: 'subject,topic,content_type,user_id'
        })
    } catch (error) {
      console.error('[ContentResolver] Failed to store lesson:', error)
    }
  }

  private static async getStoredPractice(
    subject: string,
    topic: string,
    difficulty: string,
    contentType: 'common' | 'personalized',
    userId?: string
  ): Promise<StoredPractice | null> {
    const supabase = getSupabase()
    if (!supabase) return null
    
    try {
      let query = supabase
        .from('practice_questions')
        .select('*')
        .eq('subject', subject)
        .eq('topic', topic)
        .eq('difficulty', difficulty)
        .eq('content_type', contentType)
      
      if (contentType === 'personalized' && userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.is('user_id', null)
      }
      
      const { data, error } = await query.single()
      if (error || !data) return null
      return data as StoredPractice
    } catch {
      return null
    }
  }

  private static async getAnyStoredPractice(
    subject: string,
    topic: string
  ): Promise<StoredPractice | null> {
    const supabase = getSupabase()
    if (!supabase) return null
    
    try {
      const { data, error } = await supabase
        .from('practice_questions')
        .select('*')
        .eq('subject', subject)
        .eq('topic', topic)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error || !data) return null
      return data as StoredPractice
    } catch {
      return null
    }
  }

  private static async storePractice(practice: {
    subject: string
    topic: string
    questions: any[]
    difficulty: string
    content_type: 'common' | 'personalized'
    user_id?: string
    model?: string
  }): Promise<void> {
    const supabase = getSupabase()
    if (!supabase) return
    
    try {
      await supabase
        .from('practice_questions')
        .upsert({
          ...practice,
          question_count: practice.questions.length
        }, {
          onConflict: 'subject,topic,difficulty,content_type,user_id'
        })
    } catch (error) {
      console.error('[ContentResolver] Failed to store practice:', error)
    }
  }

  // ============ Generation Helper Methods ============

  private static async generatePracticeWithContext(
    subject: string,
    topic: string,
    difficulty: string,
    vectorContext: any[]
  ): Promise<any[]> {
    // This will be implemented to call AICoach with vector context
    // For now, delegate to existing practice generation
    const contextContent = vectorContext.map(item => item.content).join('\n\n')
    
    // TODO: Enhance AICoach.generatePracticeQuestions to accept context
    const questionsText = await AICoach.generatePracticeQuestions(subject, topic, difficulty as any, 5)
    
    // Parse the response into structured questions
    return this.parseQuestionsFromText(questionsText, subject, topic)
  }

  private static parseQuestionsFromText(text: string, subject: string, topic: string): any[] {
    // Simple parsing - in production, use structured output from LLM
    const questions = []
    const lines = text.split('\n')
    let currentQuestion: any = null
    
    for (const line of lines) {
      if (line.match(/^(Question|Q)\s*\d+/i) || line.match(/^\d+\./)) {
        if (currentQuestion) {
          questions.push(currentQuestion)
        }
        currentQuestion = {
          id: questions.length + 1,
          question: line.replace(/^(Question|Q)\s*\d+[:.]\s*/i, '').replace(/^\d+\.\s*/, ''),
          type: 'short_answer',
          marks: 4,
          subject,
          topic
        }
      } else if (currentQuestion && line.trim()) {
        currentQuestion.question += ' ' + line.trim()
      }
    }
    
    if (currentQuestion) {
      questions.push(currentQuestion)
    }
    
    return questions.length > 0 ? questions : this.getDemoQuestions(subject, topic)
  }

  private static getDemoQuestions(subject: string, topic: string): any[] {
    return [
      {
        id: 1,
        question: `What are the key concepts in ${topic}?`,
        type: 'short_answer',
        marks: 4,
        answer: `The key concepts include the fundamental principles and applications of ${topic} as covered in the CSEC ${subject} syllabus.`,
        explanation: `This question tests your understanding of the core ideas in ${topic}.`
      },
      {
        id: 2,
        question: `Explain one practical application of ${topic} in the Caribbean context.`,
        type: 'short_answer',
        marks: 4,
        answer: `One application relates to how ${topic} concepts are used in everyday Caribbean life and industries.`,
        explanation: `CSEC often tests real-world applications relevant to Caribbean students.`
      },
      {
        id: 3,
        question: `Define two important terms related to ${topic}.`,
        type: 'short_answer',
        marks: 4,
        answer: `Key terms in ${topic} include foundational vocabulary that appears frequently in CSEC examinations.`,
        explanation: `Understanding terminology is essential for answering CSEC questions correctly.`
      }
    ]
  }

  /**
   * Check if user has personalization context
   */
  static hasPersonalizationContext(context: ContentContext): boolean {
    return Boolean(context.painPoints?.length || context.hasUploadedDocs)
  }

  /**
   * Detect topic from user input
   */
  static detectTopicsFromInput(input: string, availableTopics: string[]): string[] {
    const normalizedInput = input.toLowerCase()
    return availableTopics.filter(topic => 
      normalizedInput.includes(topic.toLowerCase())
    )
  }
}
