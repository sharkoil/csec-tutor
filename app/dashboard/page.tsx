'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, Plus, BookOpen, Play, Award, Zap, Clock, TrendingUp, ArrowRight, CheckCircle, Flame, Target, BarChart3, AlertTriangle } from 'lucide-react'
import { fetchPlans as fetchPlansFromStorage } from '@/lib/plan-storage'
import { StudyPlan, DashboardSummary, StudentStreak, StudentMetric } from '@/types'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [streak, setStreak] = useState<StudentStreak | null>(null)
  const [atRiskTopics, setAtRiskTopics] = useState<StudentMetric[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchStudyPlans()
      fetchMetrics()
    }
  }, [user])

  const fetchStudyPlans = async () => {
    try {
      const plans = await fetchPlansFromStorage(user!.id)
      setStudyPlans(plans)
    } catch (error) {
      console.error('Error fetching study plans:', error)
      setStudyPlans([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMetrics = async () => {
    try {
      const [summaryRes, atRiskRes] = await Promise.all([
        fetch(`/api/metrics?userId=${user!.id}&view=summary`),
        fetch(`/api/metrics?userId=${user!.id}&view=at-risk`),
      ])
      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setSummary(data.summary)
        setStreak(data.streak)
      }
      if (atRiskRes.ok) {
        const data = await atRiskRes.json()
        setAtRiskTopics(data.topics ?? [])
      }
    } catch (err) {
      console.error('Error fetching metrics:', err)
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const totalPlans = studyPlans.length
  const activePlans = studyPlans.filter(plan => plan.status === 'active').length
  const completedPlans = studyPlans.filter(plan => plan.status === 'completed').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />

      {/* Welcome Section */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                Welcome back, {user.name || user.email?.split('@')[0]}! 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                Continue your CSEC exam preparation journey
              </p>
            </div>
            <Link href="/plans/new">
              <Button size="lg" className="whitespace-nowrap">
                <Plus className="h-5 w-5 mr-2" />
                New Study Plan
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Card className="border-border/50 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="font-medium">Streak</CardDescription>
                  <div className="text-3xl font-bold text-primary mt-1">
                    {streak?.current ?? 0}
                    <span className="text-base font-normal text-muted-foreground ml-1">days</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Flame className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="font-medium">Lessons Done</CardDescription>
                  <div className="text-3xl font-bold text-secondary mt-1">
                    {summary?.total_lessons_done ?? 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/10">
                  <BookOpen className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="font-medium">Avg. Mastery</CardDescription>
                  <div className="text-3xl font-bold text-accent mt-1">
                    {summary?.avg_mastery ?? 0}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-accent/10">
                  <Target className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="font-medium">Study Time</CardDescription>
                  <div className="text-3xl font-bold text-foreground/70 mt-1">
                    {summary?.total_study_minutes
                      ? summary.total_study_minutes >= 60
                        ? `${Math.round(summary.total_study_minutes / 60)}h`
                        : `${summary.total_study_minutes}m`
                      : '0m'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <Clock className="h-6 w-6 text-foreground/70" />
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* At-Risk Topics Alert */}
        {atRiskTopics.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5 mb-8">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg">Topics Needing Attention</CardTitle>
              </div>
              <CardDescription>
                These topics are below your target level — focus extra time here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {atRiskTopics.slice(0, 6).map((t) => (
                  <Badge key={t.id} variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                    {t.subject} — {t.topic} ({t.mastery_pct}%)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Your Study Plans Section */}
        <div>
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Your Study Plans</h2>
            <p className="text-muted-foreground">
              {studyPlans.length === 0 
                ? 'Create your first study plan to get started' 
                : `You have ${totalPlans} study plan${totalPlans !== 1 ? 's' : ''}`}
            </p>
          </div>

          {studyPlans.length === 0 ? (
            <Card className="border-2 border-dashed border-border/40">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No study plans yet</h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  Create your first personalized CSEC study plan and start your journey to exam success
                </p>
                <Link href="/plans/new">
                  <Button size="lg" className="gap-2">
                    <Plus className="h-5 w-5" />
                    Create Your First Plan
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {studyPlans.map((plan) => {
                const completionPct = summary?.avg_completion ?? 0
                const statusConfig = {
                  active: { 
                    badge: 'success',
                    label: 'In Progress',
                    icon: Play
                  },
                  completed: { 
                    badge: 'info',
                    label: 'Completed',
                    icon: CheckCircle
                  },
                  paused: { 
                    badge: 'warning',
                    label: 'Paused',
                    icon: Clock
                  }
                }
                const config = statusConfig[plan.status as keyof typeof statusConfig] || statusConfig.active
                const StatusIcon = config.icon

                return (
                  <Card key={plan.id} className="border-border/50 overflow-hidden hover:shadow-xl hover:border-border transition-all duration-300 group">
                    {/* Status Bar */}
                    <div className={`h-1 bg-gradient-to-r ${
                      plan.status === 'active' ? 'from-secondary to-secondary/50' :
                      plan.status === 'completed' ? 'from-accent to-accent/50' :
                      'from-amber-400 to-amber-400/50'
                    }`} />

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {plan.subject}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {plan.topics?.length || 0} topics selected
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Topics */}
                      <div className="mb-6">
                        <div className="flex flex-wrap gap-2">
                          {plan.topics?.slice(0, 3).map((topic, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                          {plan.topics && plan.topics.length > 3 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              +{plan.topics.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-medium text-muted-foreground">Progress</p>
                          <p className="text-xs font-semibold text-foreground">{completionPct}%</p>
                        </div>
                        <Progress value={completionPct} max={100} variant="default" size="md" />
                      </div>

                      {/* Action */}
                      <Link href={`/plans/${plan.id}`} className="w-full">
                        <Button variant="outline" className="w-full group/btn">
                          Continue Learning
                          <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {studyPlans.length > 0 && (
          <div className="mt-16 p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/40">
            <h3 className="text-xl font-bold text-foreground mb-4">Quick Actions</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <Link href="/plans/new" className="group">
                <Button variant="outline" className="w-full justify-start group-hover:border-primary group-hover:text-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  New Study Plan
                </Button>
              </Link>
              <Button variant="outline" className="w-full justify-start cursor-not-allowed opacity-50">
                <Zap className="h-4 w-4 mr-2" />
                Quick Review
              </Button>
              <Button variant="outline" className="w-full justify-start cursor-not-allowed opacity-50">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}