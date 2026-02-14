import { NextRequest, NextResponse } from 'next/server'
import {
  getDashboardSummary,
  getPlanMetrics,
  getAllMetrics,
  getStreak,
  getRecentActivity,
  getAtRiskTopics,
  recordLessonComplete,
  recordQuizResult,
} from '@/lib/metrics'

/**
 * GET /api/metrics?userId=...&planId=...&view=summary|plan|streak|activity|at-risk
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const planId = searchParams.get('planId')
  const view = searchParams.get('view') || 'summary'

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  try {
    switch (view) {
      case 'summary': {
        const [summary, streak] = await Promise.all([
          getDashboardSummary(userId),
          getStreak(userId),
        ])
        return NextResponse.json({ summary, streak })
      }
      case 'plan': {
        if (!planId) {
          return NextResponse.json({ error: 'planId is required for plan view' }, { status: 400 })
        }
        const metrics = await getPlanMetrics(userId, planId)
        return NextResponse.json({ metrics })
      }
      case 'all': {
        const metrics = await getAllMetrics(userId)
        return NextResponse.json({ metrics })
      }
      case 'streak': {
        const streak = await getStreak(userId)
        return NextResponse.json({ streak })
      }
      case 'activity': {
        const days = parseInt(searchParams.get('days') || '30', 10)
        const activity = await getRecentActivity(userId, days)
        return NextResponse.json({ activity })
      }
      case 'at-risk': {
        const topics = await getAtRiskTopics(userId)
        return NextResponse.json({ topics })
      }
      default:
        return NextResponse.json({ error: `Unknown view: ${view}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[Metrics API] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}

/**
 * POST /api/metrics — record a lesson completion or quiz result.
 *
 * Body: { type: 'lesson' | 'quiz', ... }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type } = body

    if (type === 'lesson') {
      const { userId, planId, subject, topic, timeSpentMinutes, isRetry } = body
      if (!userId || !planId || !subject || !topic) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      await recordLessonComplete({
        userId,
        planId,
        subject,
        topic,
        timeSpentMinutes: timeSpentMinutes || 0,
        isRetry: isRetry || false,
      })
      return NextResponse.json({ ok: true })
    }

    if (type === 'quiz') {
      const {
        userId, planId, subject, topic,
        score, totalQuestions, correctAnswers,
        timeTakenSeconds, questions,
      } = body
      if (!userId || !planId || !subject || !topic || score == null) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      await recordQuizResult({
        userId,
        planId,
        subject,
        topic,
        score,
        totalQuestions: totalQuestions || 0,
        correctAnswers: correctAnswers || 0,
        timeTakenSeconds,
        questions,
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
  } catch (err) {
    console.error('[Metrics API] POST error:', err)
    return NextResponse.json({ error: 'Failed to record metric' }, { status: 500 })
  }
}
