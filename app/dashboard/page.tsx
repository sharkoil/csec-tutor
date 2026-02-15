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
import { Loader2, Plus, BookOpen, Play, Award, Zap, Clock, TrendingUp, ArrowRight, CheckCircle, Flame, Target, BarChart3, AlertTriangle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { fetchPlans as fetchPlansFromStorage, fetchProgress as fetchProgressFromStorage } from '@/lib/plan-storage'
import { StudyPlan, Progress as ProgressData, DashboardSummary, StudentStreak, StudentMetric } from '@/types'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([])
  const [planProgress, setPlanProgress] = useState<Record<string, ProgressData[]>>({})
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({})
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
      // Auto-expand all plans and fetch progress for each
      const expanded: Record<string, boolean> = {}
      const progressMap: Record<string, ProgressData[]> = {}
      await Promise.all(
        plans.map(async (plan) => {
          expanded[plan.id] = true
          try {
            const prog = await fetchProgressFromStorage(user!.id, plan.id, plan.topics)
            progressMap[plan.id] = prog
          } catch {
            progressMap[plan.id] = []
          }
        })
      )
      setExpandedPlans(expanded)
      setPlanProgress(progressMap)
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

  const getTopicProgress = (planId: string, topic: string): ProgressData | null => {
    const prog = planProgress[planId]
    if (!prog) return null
    return prog.find(p => p.topic === topic) || null
  }

  /** Return the best direct link for a topic based on its progress */
  const getTopicLink = (planId: string, topic: string): string => {
    const base = `/plans/${planId}/topics/${encodeURIComponent(topic)}`
    const prog = getTopicProgress(planId, topic)
    if (!prog) return `${base}/coaching`
    if (prog.exam_completed) return `${base}/coaching` // completed — link to review
    if (prog.practice_completed) return `${base}/exam`
    if (prog.coaching_completed) return `${base}/practice`
    return `${base}/coaching`
  }

  /** Return a label + icon for the topic's current state */
  const getTopicState = (planId: string, topic: string) => {
    const prog = getTopicProgress(planId, topic)
    if (!prog || (!prog.coaching_completed && !prog.practice_completed && !prog.exam_completed)) {
      return { label: 'Start', icon: Sparkles, color: 'text-primary', bg: 'bg-primary/10' }
    }
    if (prog.exam_completed) {
      return { label: `${prog.exam_score ?? 0}%`, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' }
    }
    if (prog.practice_completed) {
      return { label: 'Exam', icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' }
    }
    if (prog.coaching_completed) {
      return { label: 'Practice', icon: Play, color: 'text-blue-600', bg: 'bg-blue-50' }
    }
    return { label: 'Start', icon: Sparkles, color: 'text-primary', bg: 'bg-primary/10' }
  }

  const toggleExpanded = (planId: string) => {
    setExpandedPlans(prev => ({ ...prev, [planId]: !prev[planId] }))
  }

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
                const progArr = planProgress[plan.id] || []
                const totalSteps = (plan.topics?.length || 0) * 3
                const completedSteps = progArr.reduce((acc, p) => {
                  return acc + (p.coaching_completed ? 1 : 0) + (p.practice_completed ? 1 : 0) + (p.exam_completed ? 1 : 0)
                }, 0)
                const completionPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
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
                      {/* Expand/Collapse Toggle */}
                      <button
                        onClick={() => toggleExpanded(plan.id)}
                        className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
                      >
                        <span>{plan.topics?.length || 0} Topics</span>
                        {expandedPlans[plan.id] ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {/* Topic Links */}
                      {expandedPlans[plan.id] && (
                        <div className="space-y-2 mb-6">
                          {plan.topics?.map((topic, index) => {
                            const state = getTopicState(plan.id, topic)
                            const StateIcon = state.icon
                            const prog = getTopicProgress(plan.id, topic)
                            const stepsComplete = prog
                              ? [prog.coaching_completed, prog.practice_completed, prog.exam_completed].filter(Boolean).length
                              : 0

                            return (
                              <Link
                                key={index}
                                href={getTopicLink(plan.id, topic)}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors group/topic"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`flex items-center justify-center h-7 w-7 rounded-full ${state.bg} shrink-0`}>
                                    <StateIcon className={`h-3.5 w-3.5 ${state.color}`} />
                                  </div>
                                  <span className="text-sm font-medium text-foreground truncate group-hover/topic:text-primary transition-colors">
                                    {topic}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Mini step dots */}
                                  <div className="flex gap-1">
                                    <div className={`h-1.5 w-1.5 rounded-full ${prog?.coaching_completed ? 'bg-green-500' : 'bg-gray-300'}`} title="Coaching" />
                                    <div className={`h-1.5 w-1.5 rounded-full ${prog?.practice_completed ? 'bg-green-500' : 'bg-gray-300'}`} title="Practice" />
                                    <div className={`h-1.5 w-1.5 rounded-full ${prog?.exam_completed ? 'bg-green-500' : 'bg-gray-300'}`} title="Exam" />
                                  </div>
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover/topic:text-primary group-hover/topic:translate-x-0.5 transition-all" />
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      )}

                      {/* Collapsed topic badges */}
                      {!expandedPlans[plan.id] && (
                        <div className="mb-6">
                          <div className="flex flex-wrap gap-2">
                            {plan.topics?.slice(0, 3).map((topic, index) => (
                              <Link key={index} href={getTopicLink(plan.id, topic)}>
                                <Badge variant="outline" className="text-xs hover:bg-primary/10 hover:border-primary/30 cursor-pointer transition-colors">
                                  {topic}
                                </Badge>
                              </Link>
                            ))}
                            {plan.topics && plan.topics.length > 3 && (
                              <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                                onClick={(e) => { e.preventDefault(); toggleExpanded(plan.id) }}
                              >
                                +{plan.topics.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

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
                          View Full Plan
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