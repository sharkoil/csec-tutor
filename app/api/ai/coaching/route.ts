import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AICoach, TextbookLesson } from '@/lib/ai-coach'

/**
 * Coaching API Route - Generates deep textbook-quality lessons
 * 
 * Uses tiered model selection with automatic free model fallback
 * when paid credits are exhausted.
 * 
 * Caches generated lessons in the `lessons` table to avoid regenerating.
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

/**
 * Check for cached lesson
 */
async function getCachedLesson(subject: string, topic: string): Promise<{
  content: string
  model: string
  is_fallback: boolean
  created_at: string
} | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('content, model, is_fallback, created_at')
      .eq('subject', subject)
      .eq('topic', topic)
      .single()
    
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

/**
 * Cache a generated lesson
 */
async function cacheLesson(lesson: TextbookLesson): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  
  try {
    await supabase
      .from('lessons')
      .upsert({
        subject: lesson.subject,
        topic: lesson.topic,
        content: lesson.content,
        model: lesson.model,
        is_fallback: lesson.isFallback,
        created_at: lesson.generatedAt
      }, {
        onConflict: 'subject,topic'
      })
  } catch (error) {
    console.error('Failed to cache lesson:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const { subject, topic, format = 'textbook', refresh = false } = await request.json()

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required' },
        { status: 400 }
      )
    }

    // Use the new textbook lesson generator (default)
    if (format === 'textbook') {
      // Check cache first (unless refresh requested)
      if (!refresh) {
        const cached = await getCachedLesson(subject, topic)
        if (cached) {
          console.log(`Returning cached lesson for ${subject}/${topic}`)
          return NextResponse.json({
            narrativeContent: cached.content,
            model: cached.model,
            isFallback: cached.is_fallback,
            generatedAt: cached.created_at,
            cached: true,
            
            // Legacy fields
            explanation: cached.content,
            examples: [],
            key_points: [],
            practice_tips: [],
            pacing_notes: ''
          })
        }
      }
      
      // Generate new lesson
      const lesson: TextbookLesson = await AICoach.generateTextbookLesson(subject, topic)
      
      // Cache the lesson (async, don't wait)
      cacheLesson(lesson).catch(err => console.error('Cache error:', err))
      
      return NextResponse.json({
        // New textbook format
        narrativeContent: lesson.content,
        model: lesson.model,
        isFallback: lesson.isFallback,
        generatedAt: lesson.generatedAt,
        cached: false,
        
        // Legacy fields for backward compatibility
        explanation: lesson.content,
        examples: [],
        key_points: [],
        practice_tips: [],
        pacing_notes: ''
      })
    }

    // Legacy format (for backward compatibility)
    const { subject: subj, topic: top, userLevel = 'intermediate' } = await request.json()
    const coaching = await AICoach.generateFundamentalCoaching(subj, top, userLevel)
    return NextResponse.json(coaching)
    
  } catch (error) {
    console.error('Coaching API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate coaching content' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check credit status
 */
export async function GET() {
  try {
    const status = await AICoach.getCreditStatus()
    return NextResponse.json(status)
  } catch {
    return NextResponse.json({ hasCredits: true, remaining: 0, isFallbackMode: false })
  }
}
