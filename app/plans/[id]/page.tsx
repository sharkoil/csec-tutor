'use client'

import { useState, useEffect, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, BookOpen, Play, Award, CheckCircle, Sparkles, CalendarDays, LayoutGrid } from 'lucide-react'
import { fetchPlan as fetchPlanFromStorage, fetchProgress as fetchProgressFromStorage } from '@/lib/plan-storage'
import { StudyPlan, Progress, WizardData } from '@/types'
import { generateStudySchedule } from '@/lib/study-schedule'
import StudyCalendar from '@/components/study-calendar'

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = use(params)
  const { user, loading } = useAuth()
  const router = useRouter()
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [progress, setProgress] = useState<Progress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<'calendar' | 'topics'>('calendar')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && planId) {
      fetchPlanAndProgress()
    }
  }, [user, planId])

  const fetchPlanAndProgress = async () => {
    try {
      // Unified fetch: tries Supabase first, falls back to localStorage
      const planData = await fetchPlanFromStorage(user!.id, planId)

      if (!planData) {
        console.error('Plan not found in Supabase or localStorage')
        router.push('/dashboard')
        return
      }

      const progressData = await fetchProgressFromStorage(user!.id, planId, planData.topics)

      setPlan(planData)
      setProgress(progressData)
    } catch (error) {
      console.error('Error fetching plan:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const getProgressForTopic = (topic: string) => {
    return progress.find(p => p.topic === topic) || {
      id: '',
      user_id: user?.id || '',
      plan_id: planId,
      topic,
      coaching_completed: false,
      practice_completed: false,
      exam_completed: false,
      practice_score: undefined,
      exam_score: undefined,
      created_at: '',
      updated_at: ''
    }
  }

  const getOverallProgress = () => {
    if (!plan) return 0
    const totalSteps = plan.topics.length * 3 // coaching, practice, exam for each topic
    const completedSteps = progress.reduce((acc, p) => {
      return acc + 
        (p.coaching_completed ? 1 : 0) +
        (p.practice_completed ? 1 : 0) +
        (p.exam_completed ? 1 : 0)
    }, 0)
    return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  }

  // Generate study schedule from wizard data
  const schedule = useMemo(() => {
    if (!plan?.wizard_data) return null
    return generateStudySchedule(plan.subject, plan.topics, plan.wizard_data, progress)
  }, [plan, progress])

  // Navigate to topic's coaching page when clicked in calendar
  const handleTopicClick = (topic: string) => {
    if (!plan) return
    router.push(`/plans/${plan.id}/topics/${encodeURIComponent(topic)}/coaching`)
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user || !plan) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">{plan.subject}</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Plan Overview */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{plan.subject}</h2>
              <p className="text-gray-600 mb-4">
                {plan.topics.length} topics in your study plan
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{getOverallProgress()}%</div>
              <div className="text-sm text-gray-600">Overall Progress</div>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${getOverallProgress()}%` }}
            ></div>
          </div>
        </div>

        {/* View Toggle */}
        {schedule && (
          <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setView('topics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'topics'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              All Topics
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Study Calendar
            </button>
          </div>
        )}

        {/* Calendar View */}
        {schedule && view === 'calendar' && (
          <div className="mb-8">
            <StudyCalendar schedule={schedule} onTopicClick={handleTopicClick} />
          </div>
        )}

        {/* Topics Grid */}
        <div className={`grid lg:grid-cols-3 gap-6 ${schedule && view === 'calendar' ? 'hidden' : ''}`}>
          {plan.topics.map((topic) => {
            const topicProgress = getProgressForTopic(topic)
            const topicPercentage = [
              topicProgress.coaching_completed,
              topicProgress.practice_completed,
              topicProgress.exam_completed
            ].filter(Boolean).length / 3 * 100

            return (
              <Card key={topic} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{topic}</CardTitle>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-green-600">
                        {Math.round(topicPercentage)}%
                      </div>
                      <div className="text-xs text-gray-600">Complete</div>
                    </div>
                  </div>
                  <CardDescription>
                    Track your progress through coaching, practice, and exams
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Steps */}
                  <div className="space-y-3">
                    {/* Coaching Step */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <BookOpen className={`h-5 w-5 ${
                          topicProgress.coaching_completed ? 'text-green-600' : 'text-gray-400'
                        }`} />
                        <div>
                          <div className="font-medium text-sm">Fundamentals Coaching</div>
                          <div className="text-xs text-gray-600">Learn the basics</div>
                        </div>
                      </div>
                      {topicProgress.coaching_completed ? (
                        <Link href={`/plans/${plan.id}/topics/${encodeURIComponent(topic)}/coaching`}>
                          <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            Review Lesson
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/plans/${plan.id}/topics/${encodeURIComponent(topic)}/coaching`}>
                          <Button size="sm">
                            <Sparkles className="h-4 w-4 mr-1.5" />
                            Generate Lesson
                          </Button>
                        </Link>
                      )}
                    </div>

                    {/* Practice Step */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <Play className={`h-5 w-5 ${
                          topicProgress.practice_completed ? 'text-green-600' : 'text-gray-400'
                        }`} />
                        <div>
                          <div className="font-medium text-sm">Practice Questions</div>
                          <div className="text-xs text-gray-600">
                            {topicProgress.practice_completed && topicProgress.practice_score !== undefined
                              ? `Score: ${topicProgress.practice_score}%`
                              : 'Test your knowledge'}
                          </div>
                        </div>
                      </div>
                      {topicProgress.practice_completed ? (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <Link href={`/plans/${plan.id}/topics/${encodeURIComponent(topic)}/practice?review=true`}>
                            <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700">
                              Practice Again
                            </Button>
                          </Link>
                        </div>
                      ) : topicProgress.coaching_completed ? (
                        <Link href={`/plans/${plan.id}/topics/${encodeURIComponent(topic)}/practice`}>
                          <Button size="sm" variant="outline">Start</Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" disabled>Locked</Button>
                      )}
                    </div>

                    {/* Exam Step */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <Award className={`h-5 w-5 ${
                          topicProgress.exam_completed ? 'text-green-600' : 'text-gray-400'
                        }`} />
                        <div>
                          <div className="font-medium text-sm">Practice Exam</div>
                          <div className="text-xs text-gray-600">
                            {topicProgress.exam_completed && topicProgress.exam_score !== undefined
                              ? `Score: ${topicProgress.exam_score}%`
                              : 'Final assessment'}
                          </div>
                        </div>
                      </div>
                      {topicProgress.exam_completed ? (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <Link href={`/plans/${plan.id}/topics/${encodeURIComponent(topic)}/exam?retake=true`}>
                            <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700">
                              Retake
                            </Button>
                          </Link>
                        </div>
                      ) : topicProgress.practice_completed ? (
                        <Link href={`/plans/${plan.id}/topics/${encodeURIComponent(topic)}/exam`}>
                          <Button size="sm">Take Exam</Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" disabled>Locked</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}