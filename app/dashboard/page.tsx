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
import { Loader2, Plus, BookOpen, Play, Award, Zap, Clock, TrendingUp, ArrowRight, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { StudyPlan } from '@/types'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchStudyPlans()
    }
  }, [user])

  const fetchStudyPlans = async () => {
    try {
      // For mock users, generate sample study plans
      if (user?.id.startsWith('user_')) {
        // Check if mock plans already exist in localStorage
        const existingPlans = localStorage.getItem('csec_mock_plans')
        if (existingPlans) {
          setStudyPlans(JSON.parse(existingPlans))
          setIsLoading(false)
          return
        }

        // Generate sample plans and store them
        const samplePlans = [
          {
            id: 'plan_1',
            user_id: user.id,
            subject: 'Mathematics',
            topics: ['Algebra', 'Geometry', 'Trigonometry', 'Calculus'],
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'plan_2',
            user_id: user.id,
            subject: 'English A',
            topics: ['Literature', 'Writing', 'Communication'],
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
        
        // Store in localStorage for other pages to access
        localStorage.setItem('csec_mock_plans', JSON.stringify(samplePlans))
        setStudyPlans(samplePlans)
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('study_plans')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setStudyPlans(data || [])
    } catch (error) {
      console.error('Error fetching study plans:', error)
      // Fallback to empty plans on error
      setStudyPlans([])
    } finally {
      setIsLoading(false)
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
                  <CardDescription className="font-medium">Total Plans</CardDescription>
                  <div className="text-3xl font-bold text-primary mt-1">{totalPlans}</div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="font-medium">In Progress</CardDescription>
                  <div className="text-3xl font-bold text-secondary mt-1">{activePlans}</div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/10">
                  <Play className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="font-medium">Completed</CardDescription>
                  <div className="text-3xl font-bold text-accent mt-1">{completedPlans}</div>
                </div>
                <div className="p-3 rounded-lg bg-accent/10">
                  <CheckCircle className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="font-medium">Topics Learned</CardDescription>
                  <div className="text-3xl font-bold text-foreground/70 mt-1">
                    {studyPlans.reduce((sum, plan) => sum + (plan.topics?.length || 0), 0)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <TrendingUp className="h-6 w-6 text-foreground/70" />
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

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
                const progress = Math.floor(Math.random() * 100)
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
                          <p className="text-xs font-semibold text-foreground">{progress}%</p>
                        </div>
                        <Progress value={progress} max={100} variant="default" size="md" />
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
                <TrendingUp className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}