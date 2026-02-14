/**
 * Plan Storage — unified data layer for study plans and progress.
 *
 * Strategy: **always** try Supabase first, then fall back to localStorage.
 * This makes the app resilient to Supabase being misconfigured or down.
 * The old `startsWith('user_')` check is removed everywhere — storage
 * decisions are based on whether the DB call succeeds, not on user-ID shape.
 */

import { supabase } from '@/lib/supabase'
import { StudyPlan, Progress } from '@/types'

// ── localStorage helpers ────────────────────────────────────────────────

const PLANS_KEY = 'csec_mock_plans'
const PROGRESS_KEY = 'csec_mock_progress'

function getLocalPlans(): StudyPlan[] {
  try {
    return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]')
  } catch {
    return []
  }
}

function setLocalPlans(plans: StudyPlan[]): void {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans))
}

function getLocalProgressMap(): Record<string, Partial<Progress>> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')
  } catch {
    return {}
  }
}

function setLocalProgressMap(map: Record<string, Partial<Progress>>): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
}

function progressKey(planId: string, topic: string) {
  return `${planId}_${topic}`
}

function generateLocalId(): string {
  return 'plan_' + Math.random().toString(36).substr(2, 9)
}

/**
 * Check if an ID is a localStorage-generated ID (not a UUID)
 */
function isLocalStorageId(id: string): boolean {
  return id.startsWith('plan_') || id.startsWith('user_')
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Save a new study plan.
 * Uses server action with service role to bypass RLS restrictions,
 * then falls back to localStorage if that fails.
 */
export async function savePlan(
  planData: Omit<StudyPlan, 'id'>
): Promise<StudyPlan> {
  try {
    // Dynamically import server action
    const { savePlanAction } = await import('@/lib/plan-actions')
    const result = await savePlanAction(planData)
    
    if (result) {
      console.log('[plan-storage] Plan saved to Supabase:', result.id)
      return result
    }
  } catch (err) {
    console.warn('[plan-storage] Server action failed, falling back to localStorage:', err)
  }

  // Fallback: localStorage
  console.log('[plan-storage] Using localStorage fallback')
  const localId = generateLocalId()
  const localPlan: StudyPlan = { id: localId, ...planData } as StudyPlan
  const existing = getLocalPlans()
  existing.push(localPlan)
  setLocalPlans(existing)
  return localPlan
}

/**
 * Fetch all study plans for a user.
 * Uses server action first, falls back to localStorage.
 */
export async function fetchPlans(userId: string): Promise<StudyPlan[]> {
  try {
    const { fetchPlansAction } = await import('@/lib/plan-actions')
    const dbPlans = await fetchPlansAction(userId)
    if (dbPlans.length > 0) {
      console.log('[plan-storage] Loaded plans from Supabase:', dbPlans.length)
      return dbPlans
    }
  } catch (err) {
    console.warn('[plan-storage] Server action failed, using localStorage:', err)
  }

  // Fallback: localStorage
  const local = getLocalPlans()
  console.log('[plan-storage] Loaded plans from localStorage:', local.length)
  return local
}

/**
 * Fetch a single plan by ID.
 * Uses server action, falls back to localStorage. Returns null if not found.
 */
export async function fetchPlan(
  userId: string,
  planId: string
): Promise<StudyPlan | null> {
  // If this is a localStorage ID (starts with "plan_"), skip server call
  if (isLocalStorageId(planId)) {
    console.log('[plan-storage] Detected localStorage ID, using local storage only')
    const local = getLocalPlans()
    return local.find(p => p.id === planId) || null
  }

  // Try server action first
  try {
    const { fetchPlanAction } = await import('@/lib/plan-actions')
    const plan = await fetchPlanAction(userId, planId)
    if (plan) {
      console.log('[plan-storage] Loaded plan from Supabase:', planId)
      return plan
    }
  } catch (err) {
    console.warn('[plan-storage] Server action failed, checking localStorage:', err)
  }

  // Fallback: localStorage
  const local = getLocalPlans()
  return local.find(p => p.id === planId) || null
}

/**
 * Fetch progress entries for a plan.
 * Tries Supabase, falls back to localStorage.
 */
export async function fetchProgress(
  userId: string,
  planId: string,
  topics: string[]
): Promise<Progress[]> {
  // If this is a localStorage plan ID, skip Supabase
  if (isLocalStorageId(planId)) {
    const progressMap = getLocalProgressMap()
    return topics.map(topic => {
      const key = progressKey(planId, topic)
      const saved = progressMap[key]
      return {
        id: `progress_${topic}`,
        user_id: userId,
        plan_id: planId,
        topic,
        coaching_completed: saved?.coaching_completed || false,
        practice_completed: saved?.practice_completed || false,
        exam_completed: saved?.exam_completed || false,
        practice_score: saved?.practice_score,
        exam_score: saved?.exam_score,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Progress
    })
  }

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('progress')
      .select('*')
      .eq('plan_id', planId)
      .eq('user_id', userId)

    if (error) throw error
    if (data && data.length > 0) return data as Progress[]
  } catch (err) {
    console.warn('Supabase fetchProgress failed, falling back to localStorage:', err)
  }

  // Fallback: build progress from localStorage
  const progressMap = getLocalProgressMap()
  return topics.map(topic => {
    const key = progressKey(planId, topic)
    const saved = progressMap[key]
    return {
      id: `progress_${topic}`,
      user_id: userId,
      plan_id: planId,
      topic,
      coaching_completed: saved?.coaching_completed || false,
      practice_completed: saved?.practice_completed || false,
      exam_completed: saved?.exam_completed || false,
      practice_score: saved?.practice_score,
      exam_score: saved?.exam_score,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Progress
  })
}

/**
 * Fetch progress for a single topic.
 * Tries Supabase, falls back to localStorage.
 */
export async function fetchTopicProgress(
  userId: string,
  planId: string,
  topic: string
): Promise<Partial<Progress>> {
  // If this is a localStorage plan ID, skip Supabase to avoid UUID errors
  if (isLocalStorageId(planId)) {
    const progressMap = getLocalProgressMap()
    const key = progressKey(planId, topic)
    return progressMap[key] || {
      coaching_completed: false,
      practice_completed: false,
      exam_completed: false,
    }
  }

  // Try Supabase
  try {
    const { data, error } = await supabase
      .from('progress')
      .select('*')
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .eq('topic', topic)
      .single()

    if (error) throw error
    if (data) return data as Progress
  } catch (err) {
    console.warn('Supabase fetchTopicProgress failed, falling back to localStorage:', err)
  }

  // Fallback
  const progressMap = getLocalProgressMap()
  const key = progressKey(planId, topic)
  return progressMap[key] || {
    coaching_completed: false,
    practice_completed: false,
    exam_completed: false,
  }
}

/**
 * Save / upsert progress for a topic.
 * Tries Supabase, falls back to localStorage.
 */
export async function saveProgress(
  userId: string,
  planId: string,
  topic: string,
  update: Partial<Progress>
): Promise<void> {
  // If this is a localStorage plan ID, save directly to localStorage
  if (isLocalStorageId(planId)) {
    const progressMap = getLocalProgressMap()
    const key = progressKey(planId, topic)
    progressMap[key] = {
      ...(progressMap[key] || {}),
      ...update,
    }
    setLocalProgressMap(progressMap)
    return
  }

  // Try Supabase
  try {
    const { error } = await supabase
      .from('progress')
      .upsert(
        {
          user_id: userId,
          plan_id: planId,
          topic,
          ...update,
        },
        { onConflict: 'user_id,plan_id,topic' }
      )

    if (error) throw error
    return // success
  } catch (err) {
    console.warn('Supabase saveProgress failed, falling back to localStorage:', err)
  }

  // Fallback: localStorage
  const progressMap = getLocalProgressMap()
  const key = progressKey(planId, topic)
  progressMap[key] = {
    ...(progressMap[key] || {}),
    ...update,
  }
  setLocalProgressMap(progressMap)
}
