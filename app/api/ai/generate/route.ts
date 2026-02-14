import { NextRequest, NextResponse } from 'next/server'
import { VectorSearch } from '@/lib/vector-search'
import { AICoach } from '@/lib/ai-coach'
import { ContentResolver, ContentContext } from '@/lib/content-resolver'

export async function POST(request: NextRequest) {
  try {
    const { 
      action, 
      subject, 
      topic, 
      userLevel, 
      difficulty, 
      count,
      userId,
      painPoints,
      forceRegenerate 
    } = await request.json()
    
    // Build content context for smart resolution
    const context: ContentContext = {
      userId,
      painPoints,
      difficulty,
      forceRegenerate
    }
    
    switch (action) {
      case 'coaching':
      case 'lesson':
        // Use ContentResolver for smart caching + generation
        const lesson = await ContentResolver.resolveLesson(subject, topic, context)
        return NextResponse.json({ 
          success: true, 
          data: {
            content: lesson.content,
            model: lesson.model,
            isFallback: lesson.isFallback,
            cached: lesson.cached,
            contentType: lesson.contentType
          }
        })
        
      case 'practice-questions':
        // Use ContentResolver for smart practice resolution
        const practice = await ContentResolver.resolvePractice(subject, topic, context)
        return NextResponse.json({ 
          success: true, 
          data: {
            questions: practice.questions,
            cached: practice.cached,
            contentType: practice.contentType
          }
        })
        
      case 'practice-exam':
        // Exams are always generated fresh (time-sensitive)
        const exam = await AICoach.generatePracticeExam(
          subject,
          [topic],
          30 // 30 minutes
        )
        return NextResponse.json({ success: true, data: exam })
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('AI Generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate content' },
      { status: 500 }
    )
  }
}