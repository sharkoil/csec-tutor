'use server'

import { createClient } from '@supabase/supabase-js'
import { StudyPlan } from '@/types'

// Service role client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

/** Check whether a string is a valid UUID. */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Ensure a row exists in the `users` table for the given user_id.
 * Mock-auth users don't have DB records, so we create one on-the-fly
 * using the service-role client (bypasses RLS).
 */
async function ensureUserExists(userId: string): Promise<boolean> {
  if (!isValidUUID(userId)) {
    console.error('[ensureUserExists] user_id is not a valid UUID:', userId)
    return false
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existing) return true

    // Create a placeholder user record so FK constraints pass
    const { error } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: `student-${userId.substring(0, 8)}@csec-tutor.local`,
        name: 'Student',
      })

    if (error) {
      // 23505 = unique violation — another request created the row first; that's fine
      if (error.code === '23505') return true
      console.error('[ensureUserExists] Insert failed:', error)
      return false
    }

    console.log('[ensureUserExists] Created user record for', userId)
    return true
  } catch (err) {
    console.error('[ensureUserExists] Error:', err)
    return false
  }
}

/**
 * Server action to save a plan using service role.
 * This bypasses RLS restrictions that prevent anon users from inserting.
 *
 * Key fixes:
 *  - Validates that user_id is a proper UUID (auth now generates them).
 *  - Ensures a `users` row exists so the FK constraint succeeds.
 *  - Strips fields the DB may not have yet (belt-and-suspenders).
 */
export async function savePlanAction(
  planData: Omit<StudyPlan, 'id'>
): Promise<StudyPlan | null> {
  try {
    console.log('[savePlanAction] Saving plan:', {
      subject: planData.subject,
      topics: planData.topics.length,
      user_id: planData.user_id,
    })

    // 1. Validate user_id
    if (!isValidUUID(planData.user_id)) {
      console.error('[savePlanAction] Rejecting non-UUID user_id:', planData.user_id)
      return null
    }

    // 2. Ensure user record exists (FK constraint)
    const userReady = await ensureUserExists(planData.user_id)
    if (!userReady) {
      console.error('[savePlanAction] Could not ensure user record — falling back')
      return null
    }

    // 3. Build the row, including optional columns that may or may not exist
    //    Supabase will ignore unknown columns gracefully with service role.
    const row: Record<string, unknown> = {
      user_id: planData.user_id,
      subject: planData.subject,
      topics: planData.topics,
      status: planData.status || 'active',
      created_at: planData.created_at,
      updated_at: planData.updated_at,
    }

    // Optional columns added by add-missing-columns.sql / add-wizard-data.sql
    if (planData.description) row.description = planData.description
    if (planData.help_areas && planData.help_areas.length > 0) row.help_areas = planData.help_areas
    if (planData.attachments && planData.attachments.length > 0) row.attachments = planData.attachments
    if (planData.wizard_data) row.wizard_data = planData.wizard_data

    // 4. Insert
    const { data, error } = await supabaseAdmin
      .from('study_plans')
      .insert(row)
      .select()
      .single()

    if (error) {
      console.error('[savePlanAction] Insert error:', error)

      // If optional columns don't exist, retry with only core columns
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.log('[savePlanAction] Retrying with core columns only')
        const coreRow = {
          user_id: planData.user_id,
          subject: planData.subject,
          topics: planData.topics,
          status: planData.status || 'active',
          created_at: planData.created_at,
          updated_at: planData.updated_at,
        }
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('study_plans')
          .insert(coreRow)
          .select()
          .single()

        if (retryError) {
          console.error('[savePlanAction] Core-only insert also failed:', retryError)
          throw retryError
        }

        console.log('[savePlanAction] Plan saved (core columns) successfully:', retryData.id)
        await createProgressEntries(planData.user_id, retryData.id, planData.topics)
        return retryData as StudyPlan
      }

      throw error
    }

    console.log('[savePlanAction] Plan saved successfully:', data.id)

    // 5. Create progress entries
    await createProgressEntries(planData.user_id, data.id, planData.topics)

    return data as StudyPlan
  } catch (error) {
    console.error('[savePlanAction] Failed:', error)
    return null
  }
}

/**
 * Create progress entries for each topic in the plan.
 */
async function createProgressEntries(userId: string, planId: string, topics: string[]): Promise<void> {
  const progressEntries = topics.map(topic => ({
    user_id: userId,
    plan_id: planId,
    topic,
    coaching_completed: false,
    practice_completed: false,
    exam_completed: false,
  }))

  const { error: progressError } = await supabaseAdmin
    .from('progress')
    .insert(progressEntries)

  if (progressError) {
    console.error('[savePlanAction] Progress insert error:', progressError)
  }
}

/**
 * Server action to fetch a plan
 */
export async function fetchPlanAction(
  userId: string,
  planId: string
): Promise<StudyPlan | null> {
  try {
    // If either ID is not a UUID, skip DB lookup (will fall back to localStorage)
    if (!isValidUUID(userId) || !isValidUUID(planId)) {
      return null
    }

    const { data, error } = await supabaseAdmin
      .from('study_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.warn('[fetchPlanAction] Error:', error)
      return null
    }

    return data as StudyPlan
  } catch (error) {
    console.error('[fetchPlanAction] Failed:', error)
    return null
  }
}

/**
 * Server action to fetch all plans for a user
 */
export async function fetchPlansAction(userId: string): Promise<StudyPlan[]> {
  try {
    if (!isValidUUID(userId)) {
      return []
    }

    const { data, error } = await supabaseAdmin
      .from('study_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[fetchPlansAction] Error:', error)
      return []
    }

    return (data || []) as StudyPlan[]
  } catch (error) {
    console.error('[fetchPlansAction] Failed:', error)
    return []
  }
}
