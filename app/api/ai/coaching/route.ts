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

type CacheScope = {
  contentType: 'common' | 'personalized'
  userId: string | null
}

type WizardData = {
  target_grade?: string
  proficiency_level?: string
  topic_confidence?: Record<string, string>
  learning_style?: string
}

const LESSON_PROMPT_VERSION = 'v2-12-section'

function buildWizardSignature(wizardData?: WizardData): string {
  if (!wizardData) return 'no-wizard'

  const normalized = {
    target_grade: wizardData.target_grade || 'unknown',
    proficiency_level: wizardData.proficiency_level || 'unknown',
    learning_style: wizardData.learning_style || 'blended',
    topic_confidence: wizardData.topic_confidence || {}
  }

  return JSON.stringify(normalized)
}

function serializeCachedContent(content: string, wizardData?: WizardData): string {
  const metadata = {
    v: LESSON_PROMPT_VERSION,
    w: buildWizardSignature(wizardData)
  }
  return `<!-- LESSON_CACHE_META:${JSON.stringify(metadata)} -->\n${content}`
}

function parseCachedContent(content: string): { cleanContent: string; version: string | null; wizardSignature: string | null } {
  const match = content.match(/^<!--\s*LESSON_CACHE_META:(.*?)\s*-->\n?/)
  if (!match) {
    return { cleanContent: content, version: null, wizardSignature: null }
  }

  try {
    const parsed = JSON.parse(match[1]) as { v?: string; w?: string }
    return {
      cleanContent: content.replace(/^<!--\s*LESSON_CACHE_META:.*?\s*-->\n?/, ''),
      version: parsed.v || null,
      wizardSignature: parsed.w || null
    }
  } catch {
    return { cleanContent: content, version: null, wizardSignature: null }
  }
}

async function getScopedCachedLesson(subject: string, topic: string, scope: CacheScope): Promise<{
  content: string
  model: string
  is_fallback: boolean
  created_at: string
} | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  try {
    let query = supabase
      .from('lessons')
      .select('content, model, is_fallback, created_at')
      .eq('subject', subject)
      .eq('topic', topic)
      .eq('content_type', scope.contentType)
      .order('created_at', { ascending: false })
      .limit(1)

    if (scope.contentType === 'personalized' && scope.userId) {
      query = query.eq('user_id', scope.userId)
    } else {
      query = query.is('user_id', null)
    }

    const { data, error } = await query
    if (error || !data || data.length === 0) return null
    return data[0]
  } catch {
    return null
  }
}

function shouldUseCachedLesson(
  rawContent: string,
  wizardData?: WizardData
): { ok: boolean; content: string } {
  const parsed = parseCachedContent(rawContent)

  // If metadata is missing, this is legacy/stale cache from earlier prompt versions.
  if (!parsed.version || !parsed.wizardSignature) {
    return { ok: false, content: parsed.cleanContent }
  }

  if (parsed.version !== LESSON_PROMPT_VERSION) {
    return { ok: false, content: parsed.cleanContent }
  }

  const expectedSignature = buildWizardSignature(wizardData)
  if (parsed.wizardSignature !== expectedSignature) {
    return { ok: false, content: parsed.cleanContent }
  }

  return { ok: true, content: parsed.cleanContent }
}

/**
 * Cache a generated lesson
 */
async function cacheLesson(lesson: TextbookLesson, scope: CacheScope, wizardData?: WizardData): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  
  try {
    // Replace existing row for this exact cache scope
    let deleteQuery = supabase
      .from('lessons')
      .delete()
      .eq('subject', lesson.subject)
      .eq('topic', lesson.topic)
      .eq('content_type', scope.contentType)

    if (scope.contentType === 'personalized' && scope.userId) {
      deleteQuery = deleteQuery.eq('user_id', scope.userId)
    } else {
      deleteQuery = deleteQuery.is('user_id', null)
    }

    const { error: deleteError } = await deleteQuery
    if (deleteError) throw deleteError

    const { error } = await supabase
      .from('lessons')
      .insert({
        subject: lesson.subject,
        topic: lesson.topic,
        content: serializeCachedContent(lesson.content, wizardData),
        content_type: scope.contentType,
        user_id: scope.userId,
        model: lesson.model,
        is_fallback: lesson.isFallback,
        created_at: lesson.generatedAt,
        updated_at: lesson.generatedAt
      })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Failed to cache lesson:', error)
    throw error
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

    const { subject, topic, format = 'textbook', refresh = false, cacheOnly = false, wizardData, userId } = await request.json()

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required' },
        { status: 400 }
      )
    }

    // Use the new textbook lesson generator (default)
    if (format === 'textbook') {
      // User-scoped cache prevents stale generic lessons from overriding wizard-driven quality
      const scope: CacheScope = userId
        ? { contentType: 'personalized', userId }
        : { contentType: 'common', userId: null }

      // Check cache first (unless refresh requested)
      if (!refresh) {
        const cached = await getScopedCachedLesson(subject, topic, scope)
        if (cached) {
          const cacheCheck = shouldUseCachedLesson(cached.content, wizardData)
          if (!cacheCheck.ok) {
            if (cacheOnly) {
              return NextResponse.json(
                { error: 'Cached lesson does not match current learning profile' },
                { status: 404 }
              )
            }
          } else {
          console.log(`Returning cached lesson for ${subject}/${topic}`)
          return NextResponse.json({
            narrativeContent: cacheCheck.content,
            model: cached.model,
            isFallback: cached.is_fallback,
            generatedAt: cached.created_at,
            cached: true,
            
            // Legacy fields
            explanation: cacheCheck.content,
            examples: [],
            key_points: [],
            practice_tips: [],
            pacing_notes: ''
          })
          }
        }

        // In review mode, never regenerate if cache is missing
        if (cacheOnly) {
          return NextResponse.json(
            { error: 'Cached lesson not found' },
            { status: 404 }
          )
        }
      }
      
      // Generate new lesson
      const lesson: TextbookLesson = await AICoach.generateTextbookLesson(subject, topic, wizardData)
      
      // Persist cache before returning so review mode is reliable and inference is not wasted
      await cacheLesson(lesson, scope, wizardData)
      
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
