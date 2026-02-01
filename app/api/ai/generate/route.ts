import { NextRequest, NextResponse } from 'next/server'
import { VectorSearch } from '@/lib/vector-search'
import { AICoach } from '@/lib/ai-coach'

export async function POST(request: NextRequest) {
  try {
    const { action, subject, topic, userLevel, difficulty, count } = await request.json()
    
    switch (action) {
      case 'coaching':
        const coaching = await AICoach.generateFundamentalCoaching(
          subject,
          topic,
          userLevel
        )
        return NextResponse.json({ success: true, data: coaching })
        
      case 'practice-questions':
        const questions = await AICoach.generatePracticeQuestions(
          subject,
          topic,
          difficulty || 'medium',
          count || 5
        )
        return NextResponse.json({ success: true, data: questions })
        
      case 'practice-exam':
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