import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin Dashboard API - v1.1.0 - Added user/plan tracking
// Admin emails that have access
const ADMIN_EMAILS = ['sharkoil@gmail.com']

// Get supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key || url.includes('placeholder')) {
    return null
  }
  
  return createClient(url, key)
}

// Get OpenRouter credits balance
async function getOpenRouterCredits(): Promise<{ total_credits: number; total_usage: number } | null> {
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

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // Get query params
    const { searchParams } = new URL(request.url)
    const devAccess = searchParams.get('dev') === 'true'
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const endDate = new Date()

    // Basic response structure
    let stats = {
      total_requests: 0,
      total_tokens: 0,
      total_cost: 0,
      by_model: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      by_action: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      daily_breakdown: [] as Array<{ date: string; requests: number; tokens: number; cost: number }>
    }
    let recentUsage: any[] = []
    let userStats = {
      total_users: 0,
      total_plans: 0,
      active_plans: 0,
      users_with_plans: 0,
      per_user_usage: [] as Array<{ user_id: string; email: string; plans: number; requests: number; tokens: number; cost: number }>
    }

    // Try to fetch from database if configured
    if (supabase) {
      try {
        const { data: usageData, error: usageError } = await supabase
          .from('ai_usage')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(100)

        if (!usageError && usageData) {
          recentUsage = usageData.slice(0, 20)
          
          const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {}
          const byAction: Record<string, { requests: number; tokens: number; cost: number }> = {}
          const byDate: Record<string, { requests: number; tokens: number; cost: number }> = {}

          let totalTokens = 0
          let totalCost = 0

          for (const record of usageData) {
            totalTokens += record.total_tokens || 0
            totalCost += record.cost_credits || 0

            if (!byModel[record.model]) {
              byModel[record.model] = { requests: 0, tokens: 0, cost: 0 }
            }
            byModel[record.model].requests++
            byModel[record.model].tokens += record.total_tokens || 0
            byModel[record.model].cost += record.cost_credits || 0

            if (!byAction[record.action]) {
              byAction[record.action] = { requests: 0, tokens: 0, cost: 0 }
            }
            byAction[record.action].requests++
            byAction[record.action].tokens += record.total_tokens || 0
            byAction[record.action].cost += record.cost_credits || 0

            const date = record.created_at?.split('T')[0] || 'unknown'
            if (!byDate[date]) {
              byDate[date] = { requests: 0, tokens: 0, cost: 0 }
            }
            byDate[date].requests++
            byDate[date].tokens += record.total_tokens || 0
            byDate[date].cost += record.cost_credits || 0
          }

          stats = {
            total_requests: usageData.length,
            total_tokens: totalTokens,
            total_cost: totalCost,
            by_model: byModel,
            by_action: byAction,
            daily_breakdown: Object.entries(byDate)
              .map(([date, data]) => ({ date, ...data }))
              .sort((a, b) => b.date.localeCompare(a.date))
          }
        }
      } catch (dbError) {
        console.warn('Could not fetch ai_usage table:', dbError)
      }

      // Fetch user and plan statistics
      try {
        // Get total users from Supabase Auth
        const { count: userCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
        userStats.total_users = userCount || 0

        // Get plans stats
        const { data: plansData } = await supabase
          .from('study_plans')
          .select('user_id, status')
        
        if (plansData) {
          userStats.total_plans = plansData.length
          userStats.active_plans = plansData.filter(p => p.status === 'active').length
          const uniqueUsersWithPlans = new Set(plansData.map(p => p.user_id))
          userStats.users_with_plans = uniqueUsersWithPlans.size
        }

        // Get per-user usage from ai_usage table
        const { data: userUsageData } = await supabase
          .from('ai_usage')
          .select('user_id, total_tokens, cost_credits')
          .gte('created_at', startDate.toISOString())
        
        if (userUsageData && userUsageData.length > 0) {
          const userAgg: Record<string, { requests: number; tokens: number; cost: number }> = {}
          
          for (const record of userUsageData) {
            const uid = record.user_id || 'anonymous'
            if (!userAgg[uid]) {
              userAgg[uid] = { requests: 0, tokens: 0, cost: 0 }
            }
            userAgg[uid].requests++
            userAgg[uid].tokens += record.total_tokens || 0
            userAgg[uid].cost += record.cost_credits || 0
          }

          // Get plan counts per user
          const userPlans: Record<string, number> = {}
          if (plansData) {
            for (const plan of plansData) {
              const uid = plan.user_id || 'anonymous'
              userPlans[uid] = (userPlans[uid] || 0) + 1
            }
          }

          userStats.per_user_usage = Object.entries(userAgg)
            .map(([user_id, data]) => ({
              user_id,
              email: user_id === 'anonymous' ? 'Anonymous' : user_id.substring(0, 8) + '...',
              plans: userPlans[user_id] || 0,
              ...data
            }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 20)
        }
      } catch (userError) {
        console.warn('Could not fetch user stats:', userError)
      }
    }

    // Fetch OpenRouter credits
    let credits = null
    try {
      credits = await getOpenRouterCredits()
    } catch (creditsError) {
      console.warn('Could not fetch OpenRouter credits:', creditsError)
    }

    return NextResponse.json({
      success: true,
      data: {
        period: { start: startDate.toISOString(), end: endDate.toISOString(), days },
        credits: credits || { total_credits: 0, total_usage: 0 },
        stats,
        recent_usage: recentUsage,
        user_stats: userStats
      }
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch admin stats' },
      { status: 500 }
    )
  }
}
