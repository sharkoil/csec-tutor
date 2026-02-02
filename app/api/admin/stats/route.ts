import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOpenRouterCredits, getRecentUsage } from '@/lib/usage-tracking'
import { cookies } from 'next/headers'

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

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    if (!supabase) {
      return NextResponse.json({ 
        success: true, 
        data: {
          period: { start: new Date().toISOString(), end: new Date().toISOString(), days: 30 },
          credits: { total_credits: 0, total_usage: 0 },
          stats: {
            total_requests: 0,
            total_tokens: 0,
            total_cost: 0,
            by_model: {},
            by_action: {},
            daily_breakdown: []
          },
          recent_usage: [],
          warning: 'Database not configured'
        }
      })
    }

    // Try to get user session from cookies
    const cookieStore = await cookies()
    const authToken = cookieStore.get('sb-access-token')?.value || 
                      cookieStore.get('supabase-auth-token')?.value

    let isAdminUser = false
    
    if (authToken) {
      // Verify the token and get user
      const { data: { user }, error } = await supabase.auth.getUser(authToken)
      if (user && !error) {
        isAdminUser = ADMIN_EMAILS.includes(user.email || '')
      }
    }

    // For development/testing, also allow access via query param or if no auth is set up
    const { searchParams } = new URL(request.url)
    const devAccess = searchParams.get('dev') === 'true'
    
    // In production, require admin auth. In dev, allow access for testing.
    if (!isAdminUser && !devAccess && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get date range from query params
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const endDate = new Date()

    // Try to fetch usage stats - handle missing table gracefully
    let stats = null
    let recentUsage: any[] = []
    
    try {
      // Try to get recent usage
      const { data: usageData, error: usageError } = await supabase
        .from('ai_usage')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100)

      if (!usageError && usageData) {
        recentUsage = usageData.slice(0, 20)
        
        // Calculate stats manually from the data
        const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {}
        const byAction: Record<string, { requests: number; tokens: number; cost: number }> = {}
        const byDate: Record<string, { requests: number; tokens: number; cost: number }> = {}

        let totalTokens = 0
        let totalCost = 0

        for (const record of usageData) {
          totalTokens += record.total_tokens || 0
          totalCost += record.cost_credits || 0

          // By model
          if (!byModel[record.model]) {
            byModel[record.model] = { requests: 0, tokens: 0, cost: 0 }
          }
          byModel[record.model].requests++
          byModel[record.model].tokens += record.total_tokens || 0
          byModel[record.model].cost += record.cost_credits || 0

          // By action
          if (!byAction[record.action]) {
            byAction[record.action] = { requests: 0, tokens: 0, cost: 0 }
          }
          byAction[record.action].requests++
          byAction[record.action].tokens += record.total_tokens || 0
          byAction[record.action].cost += record.cost_credits || 0

          // By date
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
      console.warn('Could not fetch ai_usage table (may not exist yet):', dbError)
    }

    // Fetch OpenRouter credits balance
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
        stats: stats || {
          total_requests: 0,
          total_tokens: 0,
          total_cost: 0,
          by_model: {},
          by_action: {},
          daily_breakdown: []
        },
        recent_usage: recentUsage
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
