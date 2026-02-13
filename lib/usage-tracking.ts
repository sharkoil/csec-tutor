import { createClient } from '@supabase/supabase-js'

export interface UsageRecord {
  user_id?: string
  generation_id?: string
  model: string
  action: string
  subject?: string
  topic?: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_credits: number
  latency_ms?: number
  cached_tokens?: number
}

/**
 * Get a server-side Supabase client with the service role key.
 * trackUsage runs inside API routes and needs elevated permissions
 * to INSERT into ai_usage regardless of RLS configuration.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url.includes('placeholder')) return null
  return createClient(url, key)
}

/**
 * Track AI usage for cost monitoring and analytics
 */
export async function trackUsage(record: UsageRecord): Promise<void> {
  try {
    const supabase = getServiceClient()
    if (!supabase) {
      console.warn('Usage tracking skipped: no Supabase client available')
      return
    }

    const { error } = await supabase
      .from('ai_usage')
      .insert({
        user_id: record.user_id || null,
        generation_id: record.generation_id || null,
        model: record.model,
        action: record.action,
        subject: record.subject || null,
        topic: record.topic || null,
        prompt_tokens: record.prompt_tokens,
        completion_tokens: record.completion_tokens,
        total_tokens: record.total_tokens,
        cost_credits: record.cost_credits,
        latency_ms: record.latency_ms || null,
        cached_tokens: record.cached_tokens || 0
      })

    if (error) {
      console.error('Failed to track usage:', error)
    }
  } catch (error) {
    // Don't let tracking failures affect the main request
    console.error('Usage tracking error:', error)
  }
}

/**
 * Extract usage data from OpenRouter response
 */
export function extractUsageFromResponse(response: any, action: string, model: string, subject?: string, topic?: string): UsageRecord {
  const usage = response.usage || {}
  
  return {
    generation_id: response.id,
    model: response.model || model,
    action,
    subject,
    topic,
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || 0,
    total_tokens: usage.total_tokens || 0,
    cost_credits: usage.cost || 0,
    cached_tokens: usage.prompt_tokens_details?.cached_tokens || 0
  }
}

/**
 * Get usage statistics for admin dashboard
 */
export async function getUsageStats(startDate?: Date, endDate?: Date) {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  const end = endDate || new Date()

  const supabase = getServiceClient()
  if (!supabase) throw new Error('No Supabase client available')

  const { data, error } = await supabase.rpc('get_usage_stats', {
    start_date: start.toISOString(),
    end_date: end.toISOString()
  })

  if (error) {
    console.error('Failed to get usage stats:', error)
    throw error
  }

  return data
}

/**
 * Get recent usage records for admin dashboard
 */
export async function getRecentUsage(limit: number = 50) {
  const supabase = getServiceClient()
  if (!supabase) throw new Error('No Supabase client available')

  const { data, error } = await supabase
    .from('ai_usage')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to get recent usage:', error)
    throw error
  }

  return data
}

/**
 * Get OpenRouter credits balance
 */
export async function getOpenRouterCredits(): Promise<{ total_credits: number; total_usage: number } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      console.error('Failed to fetch OpenRouter credits:', response.status)
      return null
    }

    const result = await response.json()
    return result.data
  } catch (error) {
    console.error('Error fetching OpenRouter credits:', error)
    return null
  }
}
