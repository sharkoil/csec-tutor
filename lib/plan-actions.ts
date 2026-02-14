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

/**
 * Server action to save a plan using service role
 * This bypasses RLS restrictions that prevent anon users from inserting
 */
export async function savePlanAction(
  planData: Omit<StudyPlan, 'id'>
): Promise<StudyPlan | null> {
  try {
    console.log('[savePlanAction] Saving plan:', { subject: planData.subject, topics: planData.topics.length })

    const { data, error } = await supabaseAdmin
      .from('study_plans')
      .insert(planData)
      .select()
      .single()

    if (error) {
      console.error('[savePlanAction] Insert error:', error)
      throw error
    }

    console.log('[savePlanAction] Plan saved successfully:', data.id)

    // Create progress entries
    const progressEntries = planData.topics.map(topic => ({
      user_id: planData.user_id,
      plan_id: data.id,
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

    return data as StudyPlan
  } catch (error) {
    console.error('[savePlanAction] Failed:', error)
    return null
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
    // If localStorage ID, return null to trigger fallback
    if (planId.startsWith('plan_') || planId.startsWith('user_')) {
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
