import { NextRequest, NextResponse } from 'next/server'
import { AICoach, TextbookLesson } from '@/lib/ai-coach'

/**
 * Coaching API Route - Generates deep textbook-quality lessons
 * 
 * Uses tiered model selection with automatic free model fallback
 * when paid credits are exhausted.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const { subject, topic, format = 'textbook' } = await request.json()

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required' },
        { status: 400 }
      )
    }

    // Use the new textbook lesson generator (default)
    if (format === 'textbook') {
      const lesson: TextbookLesson = await AICoach.generateTextbookLesson(subject, topic)
      
      return NextResponse.json({
        // New textbook format
        narrativeContent: lesson.content,
        model: lesson.model,
        isFallback: lesson.isFallback,
        generatedAt: lesson.generatedAt,
        
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
