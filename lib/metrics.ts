/**
 * Student Metrics — tracks progress, engagement, streaks, and mastery.
 *
 * All writes use the service-role client (server-side) so RLS doesn't block.
 * Read functions use the anon client (client-side safe) with permissive RLS.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  StudentMetric,
  DailyActivity,
  DashboardSummary,
  StudentStreak,
  MasteryLevel,
} from '@/types'

// ── Clients ─────────────────────────────────────────────────────────

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

function getAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

// ── Mastery calculation ─────────────────────────────────────────────

function computeMastery(metric: Partial<StudentMetric>): {
  mastery_level: MasteryLevel
  mastery_pct: number
} {
  const completion = metric.completion_pct ?? 0
  const quizAvg = metric.quiz_score_avg ?? 0

  // Weighted: 40 % completion, 60 % quiz performance
  const pct = Math.round(completion * 0.4 + quizAvg * 0.6)

  let level: MasteryLevel = 'not_started'
  if (pct >= 90) level = 'mastered'
  else if (pct >= 70) level = 'proficient'
  else if (pct >= 45) level = 'developing'
  else if (pct > 0) level = 'beginner'

  return { mastery_level: level, mastery_pct: pct }
}

// ── Write helpers (server-side) ─────────────────────────────────────

/**
 * Record that a lesson was completed (or re-attempted).
 * Called from the coaching API after a lesson is generated & viewed.
 */
export async function recordLessonComplete(params: {
  userId: string
  planId: string
  subject: string
  topic: string
  timeSpentMinutes: number
  isRetry?: boolean
}): Promise<void> {
  const supabase = getServiceClient()
  if (!supabase) return

  const { userId, planId, subject, topic, timeSpentMinutes, isRetry } = params

  try {
    // Upsert student_metrics row
    const { data: existing } = await supabase
      .from('student_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('topic', topic)
      .maybeSingle()

    const prev = (existing as StudentMetric | null) ?? {
      lessons_completed: 0,
      lessons_total: 1,
      completion_pct: 0,
      quiz_score_avg: 0,
      quiz_attempts: 0,
      best_quiz_score: 0,
      problems_attempted: 0,
      problems_correct: 0,
      total_time_minutes: 0,
      lesson_retry_count: 0,
      score_trend: 0,
    }

    const lessonsCompleted = (prev.lessons_completed ?? 0) + (isRetry ? 0 : 1)
    const lessonsTotal = Math.max(prev.lessons_total ?? 1, lessonsCompleted)
    const completionPct = lessonsTotal > 0 ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0
    const retryCount = (prev.lesson_retry_count ?? 0) + (isRetry ? 1 : 0)
    const totalTime = (prev.total_time_minutes ?? 0) + timeSpentMinutes

    const mastery = computeMastery({
      completion_pct: completionPct,
      quiz_score_avg: prev.quiz_score_avg ?? 0,
    })

    const row = {
      user_id: userId,
      plan_id: planId,
      subject,
      topic,
      lessons_completed: lessonsCompleted,
      lessons_total: lessonsTotal,
      completion_pct: completionPct,
      total_time_minutes: totalTime,
      lesson_retry_count: retryCount,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...mastery,
    }

    if (existing) {
      await supabase
        .from('student_metrics')
        .update(row)
        .eq('id', existing.id)
    } else {
      await supabase.from('student_metrics').insert(row)
    }

    // Also bump daily_activity
    await bumpDailyActivity(supabase, userId, { lessonsCompleted: 1, timeSpentMinutes, subject })
  } catch (err) {
    console.error('[metrics] recordLessonComplete failed:', err)
  }
}

/**
 * Record a quiz / practice result.
 */
export async function recordQuizResult(params: {
  userId: string
  planId: string
  subject: string
  topic: string
  score: number
  totalQuestions: number
  correctAnswers: number
  timeTakenSeconds?: number
  questions?: unknown[]
}): Promise<void> {
  const supabase = getServiceClient()
  if (!supabase) return

  const {
    userId, planId, subject, topic,
    score, totalQuestions, correctAnswers,
    timeTakenSeconds, questions,
  } = params

  try {
    // Insert quiz result
    await supabase.from('quiz_results').insert({
      user_id: userId,
      plan_id: planId,
      subject,
      topic,
      score,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      time_taken_seconds: timeTakenSeconds ?? null,
      questions: questions ?? [],
    })

    // Update student_metrics
    const { data: existing } = await supabase
      .from('student_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('topic', topic)
      .maybeSingle()

    const prev = (existing as StudentMetric | null)

    const quizAttempts = (prev?.quiz_attempts ?? 0) + 1
    const prevAvg = prev?.quiz_score_avg ?? 0
    const newAvg = quizAttempts === 1
      ? score
      : Math.round(((prevAvg * (quizAttempts - 1)) + score) / quizAttempts)
    const bestScore = Math.max(prev?.best_quiz_score ?? 0, score)
    const problemsAttempted = (prev?.problems_attempted ?? 0) + totalQuestions
    const problemsCorrect = (prev?.problems_correct ?? 0) + correctAnswers
    const scoreTrend = score - prevAvg // positive = improving

    const mastery = computeMastery({
      completion_pct: prev?.completion_pct ?? 0,
      quiz_score_avg: newAvg,
    })

    const updates = {
      quiz_score_avg: newAvg,
      quiz_attempts: quizAttempts,
      best_quiz_score: bestScore,
      problems_attempted: problemsAttempted,
      problems_correct: problemsCorrect,
      score_trend: scoreTrend,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...mastery,
    }

    if (existing) {
      await supabase.from('student_metrics').update(updates).eq('id', existing.id)
    } else {
      await supabase.from('student_metrics').insert({
        user_id: userId,
        plan_id: planId,
        subject,
        topic,
        ...updates,
      })
    }

    // Bump daily activity
    await bumpDailyActivity(supabase, userId, { quizzesTaken: 1, subject })
  } catch (err) {
    console.error('[metrics] recordQuizResult failed:', err)
  }
}

// ── Daily activity ──────────────────────────────────────────────────

async function bumpDailyActivity(
  supabase: SupabaseClient,
  userId: string,
  bump: { lessonsCompleted?: number; quizzesTaken?: number; timeSpentMinutes?: number; subject?: string },
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  try {
    const { data: existing } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('activity_date', today)
      .maybeSingle()

    if (existing) {
      const subjects = new Set<string>(existing.subjects_studied || [])
      if (bump.subject) subjects.add(bump.subject)

      await supabase
        .from('daily_activity')
        .update({
          lessons_completed: (existing.lessons_completed ?? 0) + (bump.lessonsCompleted ?? 0),
          quizzes_taken: (existing.quizzes_taken ?? 0) + (bump.quizzesTaken ?? 0),
          time_spent_minutes: (existing.time_spent_minutes ?? 0) + (bump.timeSpentMinutes ?? 0),
          subjects_studied: Array.from(subjects),
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('daily_activity').insert({
        user_id: userId,
        activity_date: today,
        lessons_completed: bump.lessonsCompleted ?? 0,
        quizzes_taken: bump.quizzesTaken ?? 0,
        time_spent_minutes: bump.timeSpentMinutes ?? 0,
        subjects_studied: bump.subject ? [bump.subject] : [],
      })
    }
  } catch (err) {
    console.error('[metrics] bumpDailyActivity failed:', err)
  }
}

// ── Read helpers (client-safe) ──────────────────────────────────────

/**
 * Fetch the dashboard summary view for a user.
 */
export async function getDashboardSummary(userId: string): Promise<DashboardSummary | null> {
  const supabase = getAnonClient()
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('student_dashboard_summary')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data as DashboardSummary | null
  } catch (err) {
    console.error('[metrics] getDashboardSummary failed:', err)
    return null
  }
}

/**
 * Fetch per-topic metrics for a specific plan.
 */
export async function getPlanMetrics(userId: string, planId: string): Promise<StudentMetric[]> {
  const supabase = getAnonClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('student_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .order('topic')

    if (error) throw error
    return (data ?? []) as StudentMetric[]
  } catch (err) {
    console.error('[metrics] getPlanMetrics failed:', err)
    return []
  }
}

/**
 * Fetch all metrics for a user across all plans.
 */
export async function getAllMetrics(userId: string): Promise<StudentMetric[]> {
  const supabase = getAnonClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('student_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as StudentMetric[]
  } catch (err) {
    console.error('[metrics] getAllMetrics failed:', err)
    return []
  }
}

/**
 * Calculate the student's current streak from daily_activity.
 */
export async function getStreak(userId: string): Promise<StudentStreak> {
  const supabase = getAnonClient()
  if (!supabase) return { current: 0, longest: 0, today_active: false }

  try {
    const { data, error } = await supabase
      .from('daily_activity')
      .select('activity_date')
      .eq('user_id', userId)
      .order('activity_date', { ascending: false })
      .limit(365)

    if (error || !data || data.length === 0) {
      return { current: 0, longest: 0, today_active: false }
    }

    const dates = data.map((d: { activity_date: string }) => d.activity_date)
    const today = new Date().toISOString().slice(0, 10)
    const todayActive = dates[0] === today

    // Calculate current streak
    let current = 0
    const startDate = new Date(todayActive ? today : dates[0])
    for (const dateStr of dates) {
      const expected = new Date(startDate)
      expected.setDate(expected.getDate() - current)
      if (dateStr === expected.toISOString().slice(0, 10)) {
        current++
      } else {
        break
      }
    }

    // If today is not active but yesterday was the last day, streak is still valid
    if (!todayActive) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      if (dates[0] !== yesterday.toISOString().slice(0, 10)) {
        current = 0 // streak broken
      }
    }

    // Calculate longest streak
    let longest = 0
    let streak = 1
    for (let i = 1; i < dates.length; i++) {
      const d1 = new Date(dates[i - 1])
      const d2 = new Date(dates[i])
      const diffDays = Math.round((d1.getTime() - d2.getTime()) / (86400000))
      if (diffDays === 1) {
        streak++
      } else {
        longest = Math.max(longest, streak)
        streak = 1
      }
    }
    longest = Math.max(longest, streak, current)

    return { current, longest, today_active: todayActive }
  } catch (err) {
    console.error('[metrics] getStreak failed:', err)
    return { current: 0, longest: 0, today_active: false }
  }
}

/**
 * Get recent daily activity for a user (for charts).
 */
export async function getRecentActivity(userId: string, days: number = 30): Promise<DailyActivity[]> {
  const supabase = getAnonClient()
  if (!supabase) return []

  try {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', userId)
      .gte('activity_date', since.toISOString().slice(0, 10))
      .order('activity_date', { ascending: true })

    if (error) throw error
    return (data ?? []) as DailyActivity[]
  } catch (err) {
    console.error('[metrics] getRecentActivity failed:', err)
    return []
  }
}

/**
 * Get topics that are at risk (below passing threshold).
 */
export async function getAtRiskTopics(userId: string): Promise<StudentMetric[]> {
  const supabase = getAnonClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('student_metrics')
      .select('*')
      .eq('user_id', userId)
      .or('mastery_level.eq.not_started,mastery_level.eq.beginner')
      .order('mastery_pct', { ascending: true })

    if (error) throw error
    return (data ?? []) as StudentMetric[]
  } catch (err) {
    console.error('[metrics] getAtRiskTopics failed:', err)
    return []
  }
}
