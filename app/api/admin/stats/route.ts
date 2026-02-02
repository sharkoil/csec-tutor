import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getOpenRouterCredits, getRecentUsage } from '@/lib/usage-tracking'

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return data.role === 'admin'
}

export async function GET(request: NextRequest) {
  try {
    // Get user from session (simplified - in production use proper auth)
    const authHeader = request.headers.get('authorization')
    const userId = request.headers.get('x-user-id')

    // For now, also allow API key auth for testing
    if (!userId && !authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If userId provided, check admin status
    if (userId) {
      const admin = await isAdmin(userId)
      if (!admin) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
      }
    }

    // Get date range from query params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const endDate = new Date()

    // Fetch usage stats from database
    const { data: usageStats, error: statsError } = await supabase.rpc('get_usage_stats', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    })

    // Fetch recent usage records
    const recentUsage = await getRecentUsage(20)

    // Fetch OpenRouter credits balance
    const credits = await getOpenRouterCredits()

    // If RPC doesn't exist yet, fallback to basic query
    let stats = usageStats
    if (statsError) {
      console.warn('get_usage_stats RPC not available, using fallback:', statsError.message)
      
      // Fallback: direct query
      const { data: usageData } = await supabase
        .from('ai_usage')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })

      if (usageData) {
        // Calculate stats manually
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
          const date = record.created_at.split('T')[0]
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
          daily_breakdown: Object.entries(byDate).map(([date, data]) => ({ date, ...data }))
        }
      }
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
        recent_usage: recentUsage || []
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
