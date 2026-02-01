'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, CheckCircle, RotateCcw, Award, FileText, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ExamQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'short_answer' | 'structured'
  marks: number
  options?: string[]
  answer?: string
  explanation?: string
}

interface ExamData {
  exam_content: string
  duration: number
  topics: string[]
  total_marks: number
}

export default function ExamPage({ params }: { params: Promise<{ id: string; topic: string }> }) {
  const { id: planId, topic: encodedTopic } = use(params)
  const { user, loading } = useAuth()
  const router = useRouter()
  const [plan, setPlan] = useState<any>(null)
  const [examData, setExamData] = useState<ExamData | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [examCompleted, setExamCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const topic = decodeURIComponent(encodedTopic)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (user && planId) {
      fetchPlanAndCheckPrerequisites()
    }
  }, [user, planId])

  useEffect(() => {
    if (examStarted && !examCompleted && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1)
      }, 1000)
      timerRef.current = timer
      return () => clearTimeout(timer)
    } else if (timeRemaining === 0 && examStarted && !examCompleted) {
      submitExam(true) // Auto-submit when time expires
    }
  }, [examStarted, examCompleted, timeRemaining])

  const fetchPlanAndCheckPrerequisites = async () => {
    try {
      // Check if this is a mock user (for development/testing)
      const isMockUser = user?.id.startsWith('user_')

      if (isMockUser) {
        // For mock users, load from localStorage
        const mockPlans = JSON.parse(localStorage.getItem('csec_mock_plans') || '[]')
        const mockPlan = mockPlans.find((p: any) => p.id === planId)

        if (!mockPlan || !mockPlan.topics.includes(topic)) {
          router.push(`/plans/${planId}`)
          return
        }

        // Check mock progress
        const mockProgress = JSON.parse(localStorage.getItem('csec_mock_progress') || '{}')
        const progressKey = `${planId}_${topic}`
        const progress = mockProgress[progressKey]

        if (!progress?.practice_completed) {
          router.push(`/plans/${planId}/topics/${encodeURIComponent(topic)}/practice`)
          return
        }

        if (progress?.exam_completed) {
          router.push(`/plans/${planId}`)
          return
        }

        setPlan(mockPlan)
        setIsLoading(false)
        return
      }

      const { data: planData, error: planError } = await supabase
        .from('study_plans')
        .select('*')
        .eq('id', planId)
        .eq('user_id', user?.id)
        .single()

      if (planError) throw planError

      if (!planData.topics.includes(topic)) {
        router.push(`/plans/${planId}`)
        return
      }

      // Check if practice is completed
      const { data: progressData } = await supabase
        .from('progress')
        .select('*')
        .eq('plan_id', planId)
        .eq('user_id', user?.id)
        .eq('topic', topic)
        .single()

      if (!progressData?.practice_completed) {
        router.push(`/plans/${planId}/topics/${encodeURIComponent(topic)}/practice`)
        return
      }

      if (progressData?.exam_completed) {
        router.push(`/plans/${planId}`)
        return
      }

      setPlan(planData)
    } catch (error) {
      console.error('Error fetching plan:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const generateExam = async () => {
    if (!plan) return

    setIsGenerating(true)
    try {
      // Call the server-side API route for OpenRouter
      const response = await fetch('/api/ai/exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: plan.subject,
          topics: [topic],
          duration: 30
        })
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const examContent = await response.json()
      
      if (examContent.error) {
        throw new Error(examContent.error)
      }

      setExamData(examContent)
      setTimeRemaining(examContent.duration * 60) // Convert to seconds
    } catch (error) {
      console.error('Error generating exam:', error)
      // Provide demo fallback exam when AI is unavailable
      const demoExam = {
        exam_content: `CSEC ${plan.subject} Practice Exam - ${topic}\n\nSection A: Multiple Choice (20 marks)\nSection B: Structured Questions (30 marks)\n\nTime Allowed: 30 minutes`,
        duration: 30,
        topics: [topic],
        total_marks: 50
      }
      setExamData(demoExam)
      setTimeRemaining(demoExam.duration * 60)
    } finally {
      setIsGenerating(false)
    }
  }

  const startExam = () => {
    setExamStarted(true)
    setTimeRemaining((examData?.duration || 60) * 60)
  }

  const submitExam = async (timeout = false) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      // For demo purposes, we'll simulate a score
      const score = timeout ? 60 : Math.floor(Math.random() * 30) + 60 // 60-90%

      // Check if this is a mock user
      const isMockUser = user?.id.startsWith('user_')

      if (isMockUser) {
        // For mock users, store progress in localStorage
        const mockProgress = JSON.parse(localStorage.getItem('csec_mock_progress') || '{}')
        const key = `${planId}_${topic}`
        mockProgress[key] = {
          ...mockProgress[key],
          coaching_completed: true,
          practice_completed: true,
          exam_completed: true,
          exam_score: score
        }
        localStorage.setItem('csec_mock_progress', JSON.stringify(mockProgress))
        setExamCompleted(true)
        setIsSubmitting(false)
        return
      }

      // Update progress
      const { error } = await supabase
        .from('progress')
        .upsert({
          user_id: user?.id,
          plan_id: planId,
          topic,
          coaching_completed: true,
          practice_completed: true,
          exam_completed: true,
          exam_score: score
        }, {
          onConflict: 'user_id,plan_id,topic'
        })

      if (error) throw error

      setExamCompleted(true)
    } catch (error) {
      console.error('Error submitting exam:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
              <Link href={`/plans/${planId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Plan
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                {plan.subject} - {topic} Exam
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!examData && !isGenerating && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-6 w-6 text-purple-600" />
                <span>Ready for the Final Test?</span>
              </CardTitle>
              <CardDescription>
                Take a comprehensive practice exam for {topic} based on actual CSEC format.
                This will test your understanding of all concepts covered.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">Exam Details:</h4>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Duration: 30 minutes</li>
                    <li>• Total marks: 100</li>
                    <li>• Mix of question types (MCQ, short answer, structured)</li>
                    <li>• Based on CSEC past papers</li>
                    <li>• Topics covered: {topic}</li>
                  </ul>
                </div>
                
                <Button onClick={generateExam} size="lg" className="w-full">
                  Generate Practice Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isGenerating && (
          <Card>
            <CardContent className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generating Practice Exam
              </h3>
              <p className="text-gray-600">
                Creating a comprehensive exam based on CSEC curriculum and past papers...
              </p>
            </CardContent>
          </Card>
        )}

        {examData && !examStarted && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-6 w-6 text-purple-600" />
                <span>Practice Exam Ready</span>
              </CardTitle>
              <CardDescription>
                Your personalized {topic} practice exam has been generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold">Duration</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{examData.duration} minutes</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Award className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold">Total Marks</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{examData.total_marks}</p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-900 mb-2">Important Instructions:</h4>
                <ul className="space-y-1 text-sm text-yellow-800">
                  <li>• Read all questions carefully before answering</li>
                  <li>• Manage your time wisely - {examData.duration} minutes total</li>
                  <li>• Answer all questions to the best of your ability</li>
                  <li>• The exam will auto-submit when time expires</li>
                  <li>• Make sure you have a stable internet connection</li>
                </ul>
              </div>

              <Button onClick={startExam} size="lg" className="w-full">
                Start Practice Exam
              </Button>
            </CardContent>
          </Card>
        )}

        {examStarted && !examCompleted && (
          <div className="space-y-6">
            {/* Timer and Status */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-red-600" />
                  <span className="font-semibold text-gray-900">Time Remaining:</span>
                  <span className={`text-lg font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {examData.total_marks} marks • {topic}
                </div>
              </div>
            </div>

            {/* Exam Content */}
            <Card>
              <CardHeader>
                <CardTitle>{plan.subject} - {topic} Practice Exam</CardTitle>
                <CardDescription>
                  Read all questions carefully and answer to the best of your ability
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap bg-gray-50 p-6 rounded-lg border">
                    {examData.exam_content}
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => submitExam(false)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Exam
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {examCompleted && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <span>Exam Completed!</span>
              </CardTitle>
              <CardDescription>
                Congratulations on completing your {topic} practice exam
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="py-8">
                <Award className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Well Done!
                </h3>
                <p className="text-lg text-gray-600 mb-4">
                  You have successfully completed the {topic} practice exam
                </p>
                <p className="text-sm text-gray-500">
                  Your results have been saved and you can now proceed to other topics
                  or review your performance in the study plan.
                </p>
              </div>

              <div className="flex space-x-4">
                <Button onClick={() => window.print()} variant="outline">
                  Print Results
                </Button>
                <Link href={`/plans/${planId}`}>
                  <Button size="lg">Back to Study Plan</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}