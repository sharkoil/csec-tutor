'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw, DollarSign, Zap, Clock, BarChart3, Users, BookOpen } from 'lucide-react'
import Link from 'next/link'

interface UsageStats {
  period: {
    start: string
    end: string
    days: number
  }
  credits: {
    total_credits: number
    total_usage: number
  }
  stats: {
    total_requests: number
    total_tokens: number
    total_cost: number
    by_model: Record<string, { requests: number; tokens: number; cost: number }>
    by_action: Record<string, { requests: number; tokens: number; cost: number }>
    daily_breakdown: Array<{ date: string; requests: number; tokens: number; cost: number }>
  }
  recent_usage: Array<{
    id: string
    model: string
    action: string
    subject: string
    topic: string
    total_tokens: number
    cost_credits: number
    latency_ms: number
    created_at: string
  }>
  user_stats: {
    total_users: number
    total_plans: number
    active_plans: number
    users_with_plans: number
    per_user_usage: Array<{
      user_id: string
      email: string
      plans: number
      requests: number
      tokens: number
      cost: number
    }>
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/stats?days=${days}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch stats')
      }
      
      setStats(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [days])

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return tokens.toString()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700">Access Denied</CardTitle>
              <CardDescription className="text-red-600">{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const remainingCredits = (stats?.credits.total_credits || 0) - (stats?.credits.total_usage || 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">AI Usage & Cost Tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <Button onClick={fetchStats} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User & Plan Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Total Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">
                {stats?.user_stats?.total_users || 0}
              </div>
              <p className="text-xs text-blue-600">
                {stats?.user_stats?.users_with_plans || 0} with study plans
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Study Plans</CardTitle>
              <BookOpen className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">
                {stats?.user_stats?.total_plans || 0}
              </div>
              <p className="text-xs text-purple-600">
                {stats?.user_stats?.active_plans || 0} active
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700">OpenRouter Credits</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">
                {formatCost(remainingCredits)}
              </div>
              <p className="text-xs text-green-600">
                {formatCost(stats?.credits.total_usage || 0)} used of {formatCost(stats?.credits.total_credits || 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">AI Requests</CardTitle>
              <Zap className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">
                {stats?.stats.total_requests || 0}
              </div>
              <p className="text-xs text-orange-600">
                {formatTokens(stats?.stats.total_tokens || 0)} tokens used
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">OpenRouter Credits</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCost(remainingCredits)}
              </div>
              <p className="text-xs text-gray-500">
                {formatCost(stats?.credits.total_usage || 0)} used of {formatCost(stats?.credits.total_credits || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Period Cost</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(stats?.stats.total_cost || 0)}
              </div>
              <p className="text-xs text-gray-500">Last {days} days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Requests</CardTitle>
              <Zap className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.stats.total_requests || 0}</div>
              <p className="text-xs text-gray-500">AI generations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Tokens</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTokens(stats?.stats.total_tokens || 0)}</div>
              <p className="text-xs text-gray-500">Prompt + completion</p>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown by Model and Action */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Usage by Model</CardTitle>
              <CardDescription>Cost and token breakdown per AI model</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats?.stats.by_model || {}).map(([model, data]) => (
                  <div key={model} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{model}</p>
                      <p className="text-xs text-gray-500">{data.requests} requests</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCost(data.cost)}</p>
                      <p className="text-xs text-gray-500">{formatTokens(data.tokens)} tokens</p>
                    </div>
                  </div>
                ))}
                {Object.keys(stats?.stats.by_model || {}).length === 0 && (
                  <p className="text-gray-500 text-center py-4">No usage data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage by Action</CardTitle>
              <CardDescription>Cost breakdown by feature used</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats?.stats.by_action || {}).map(([action, data]) => (
                  <div key={action} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm capitalize">{action.replace(/-/g, ' ')}</p>
                      <p className="text-xs text-gray-500">{data.requests} requests</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCost(data.cost)}</p>
                      <p className="text-xs text-gray-500">{formatTokens(data.tokens)} tokens</p>
                    </div>
                  </div>
                ))}
                {Object.keys(stats?.stats.by_action || {}).length === 0 && (
                  <p className="text-gray-500 text-center py-4">No usage data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Recent AI Requests</CardTitle>
            <CardDescription>Latest inference calls with cost and latency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Time</th>
                    <th className="text-left py-2 px-2">Action</th>
                    <th className="text-left py-2 px-2">Model</th>
                    <th className="text-left py-2 px-2">Subject</th>
                    <th className="text-right py-2 px-2">Tokens</th>
                    <th className="text-right py-2 px-2">Cost</th>
                    <th className="text-right py-2 px-2">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recent_usage || []).map((usage) => (
                    <tr key={usage.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 text-gray-500">{formatDate(usage.created_at)}</td>
                      <td className="py-2 px-2 capitalize">{usage.action.replace(/-/g, ' ')}</td>
                      <td className="py-2 px-2 font-mono text-xs">{usage.model}</td>
                      <td className="py-2 px-2">{usage.subject || '-'}</td>
                      <td className="py-2 px-2 text-right">{formatTokens(usage.total_tokens)}</td>
                      <td className="py-2 px-2 text-right">{formatCost(usage.cost_credits)}</td>
                      <td className="py-2 px-2 text-right text-gray-500">
                        {usage.latency_ms ? `${usage.latency_ms}ms` : '-'}
                      </td>
                    </tr>
                  ))}
                  {(stats?.recent_usage || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No recent usage data. AI requests will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Daily Breakdown */}
        {(stats?.stats.daily_breakdown?.length || 0) > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Daily Usage</CardTitle>
              <CardDescription>Cost and request volume by day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.stats.daily_breakdown?.slice(0, 14).map((day) => (
                  <div key={day.date} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{day.date}</span>
                    <div className="flex gap-6 text-sm">
                      <span className="text-gray-500">{day.requests} requests</span>
                      <span className="text-gray-500">{formatTokens(day.tokens)} tokens</span>
                      <span className="font-medium">{formatCost(day.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Per-User Usage */}
        {(stats?.user_stats?.per_user_usage?.length || 0) > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Usage By User</CardTitle>
              <CardDescription>Top users by AI cost this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">User</th>
                      <th className="text-right py-2 px-2">Plans</th>
                      <th className="text-right py-2 px-2">Requests</th>
                      <th className="text-right py-2 px-2">Tokens</th>
                      <th className="text-right py-2 px-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.user_stats?.per_user_usage?.map((user) => (
                      <tr key={user.user_id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-mono text-xs">{user.email}</td>
                        <td className="py-2 px-2 text-right">{user.plans}</td>
                        <td className="py-2 px-2 text-right">{user.requests}</td>
                        <td className="py-2 px-2 text-right">{formatTokens(user.tokens)}</td>
                        <td className="py-2 px-2 text-right font-medium">{formatCost(user.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
