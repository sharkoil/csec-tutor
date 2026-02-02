'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, BookOpen, Lightbulb, Target, CheckCircle, GraduationCap, PenTool, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Enhanced CoachingResponse with graduated examples and writing guidance
interface GraduatedExample {
  difficulty: 'easy' | 'easy-medium' | 'medium' | 'medium-hard' | 'hard'
  problem: string
  step_by_step_solution: string
  key_insight: string
  common_mistakes: string[]
}

interface WritingGuidance {
  essay_structure: {
    introduction_template: string
    body_paragraph_template: string
    conclusion_template: string
    transition_phrases: string[]
  }
  argument_building: string[]
  evidence_usage: string[]
  marking_scheme_tips: string[]
}

interface CoachingResponse {
  explanation: string
  examples: string[]
  key_points: string[]
  practice_tips: string[]
  graduated_examples?: GraduatedExample[]
  writing_guidance?: WritingGuidance
  pacing_notes?: string
}

export default function CoachingPage({ params }: { params: Promise<{ id: string; topic: string }> }) {
  const { id: planId, topic: encodedTopic } = use(params)
  const { user, loading } = useAuth()
  const router = useRouter()
  const [plan, setPlan] = useState<any>(null)
  const [coaching, setCoaching] = useState<CoachingResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set([0])) // First example expanded by default
  const topic = decodeURIComponent(encodedTopic)

  // Helper to get difficulty badge color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-300'
      case 'easy-medium': return 'bg-lime-100 text-lime-800 border-lime-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'medium-hard': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'hard': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '⭐ Easy - Confidence Builder'
      case 'easy-medium': return '⭐⭐ Easy-Medium - Building Skills'
      case 'medium': return '⭐⭐⭐ Medium - Core CSEC Level'
      case 'medium-hard': return '⭐⭐⭐⭐ Medium-Hard - Challenge Level'
      case 'hard': return '⭐⭐⭐⭐⭐ Hard - Distinction Level'
      default: return difficulty
    }
  }

  const toggleExample = (index: number) => {
    setExpandedExamples(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && planId) {
      fetchPlan()
    }
  }, [user, planId])

  const fetchPlan = async () => {
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

        setPlan(mockPlan)
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('study_plans')
        .select('*')
        .eq('id', planId)
        .eq('user_id', user?.id)
        .single()

      if (error) throw error

      if (!data.topics.includes(topic)) {
        router.push(`/plans/${planId}`)
        return
      }

      setPlan(data)

      // Check if coaching is already completed
      const { data: progressData } = await supabase
        .from('progress')
        .select('*')
        .eq('plan_id', planId)
        .eq('user_id', user?.id)
        .eq('topic', topic)
        .single()

      if (progressData?.coaching_completed) {
        router.push(`/plans/${planId}`)
      }
    } catch (error) {
      console.error('Error fetching plan:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const generateCoaching = async () => {
    if (!plan) return

    setIsGenerating(true)
    try {
      // Call the server-side API route for OpenRouter
      const response = await fetch('/api/ai/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: plan.subject,
          topic,
          userLevel: 'intermediate'
        })
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const coachingData = await response.json()
      
      if (coachingData.error) {
        throw new Error(coachingData.error)
      }

      setCoaching(coachingData)
    } catch (error) {
      console.error('Error generating coaching:', error)
      // Provide demo fallback content when AI is unavailable
      setCoaching({
        explanation: `Welcome to the fundamentals of ${topic}!\n\nThis topic is an essential part of your CSEC ${plan.subject} curriculum. Understanding ${topic} will help you build a strong foundation for more advanced concepts.\n\nKey areas covered include the basic principles, common applications, and problem-solving techniques used in CSEC examinations.`,
        examples: [
          `Example 1: A typical CSEC question on ${topic} might ask you to identify key components or solve a basic problem.`,
          `Example 2: You may be asked to apply ${topic} concepts to real-world Caribbean scenarios.`,
          `Example 3: Past papers often include questions that combine ${topic} with related topics from the syllabus.`
        ],
        key_points: [
          `Understand the fundamental definitions and terminology of ${topic}`,
          'Practice regularly with past CSEC examination questions',
          'Pay attention to the mark scheme and how answers should be structured',
          'Connect concepts to everyday Caribbean life for better retention',
          'Review worked examples before attempting practice problems'
        ],
        practice_tips: [
          `Start with the basics and gradually increase difficulty as you become more confident with ${topic}.`,
          'Time yourself when practicing to simulate exam conditions.',
          'Create summary notes and revision cards for quick review before exams.'
        ]
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const completeCoaching = async () => {
    try {
      // Check if this is a mock user
      const isMockUser = user?.id.startsWith('user_')

      if (isMockUser) {
        // For mock users, store progress in localStorage
        const mockProgress = JSON.parse(localStorage.getItem('csec_mock_progress') || '{}')
        const key = `${planId}_${topic}`
        mockProgress[key] = {
          coaching_completed: true,
          practice_completed: false,
          exam_completed: false
        }
        localStorage.setItem('csec_mock_progress', JSON.stringify(mockProgress))
        router.push(`/plans/${planId}`)
        return
      }

      const { error } = await supabase
        .from('progress')
        .upsert({
          user_id: user?.id,
          plan_id: planId,
          topic,
          coaching_completed: true,
          practice_completed: false,
          exam_completed: false
        }, {
          onConflict: 'user_id,plan_id,topic'
        })

      if (error) throw error

      router.push(`/plans/${planId}`)
    } catch (error) {
      console.error('Error completing coaching:', error)
    }
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
                {plan.subject} - {topic}
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <h2 className="text-3xl font-bold text-gray-900">Fundamentals Coaching</h2>
          </div>
          <p className="text-lg text-gray-600">
            Master the core concepts of {topic} with personalized AI coaching
          </p>
        </div>

        {!coaching && !isGenerating && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="h-6 w-6 text-yellow-500" />
                <span>Ready to Learn?</span>
              </CardTitle>
              <CardDescription>
                Our AI coach will create personalized learning content based on CSEC curriculum
                and your learning style.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={generateCoaching} size="lg" className="w-full">
                Generate Coaching Content
              </Button>
            </CardContent>
          </Card>
        )}

        {isGenerating && (
          <Card>
            <CardContent className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generating Your Personalized Coaching
              </h3>
              <p className="text-gray-600">
                Our AI is analyzing CSEC materials and creating content tailored for you...
              </p>
            </CardContent>
          </Card>
        )}

        {coaching && (
          <div className="space-y-6">
            {/* Pacing Notes - Show at top if available */}
            {coaching.pacing_notes && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span>Study Pacing Guide</span>
                  </CardTitle>
                  <CardDescription>
                    Spread your learning across multiple sessions for better retention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    {coaching.pacing_notes.split('\n').map((line, index) => (
                      <p key={index} className="mb-2">{line}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Explanation Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span>Core Concepts</span>
                </CardTitle>
                <CardDescription>
                  Deep understanding of {topic} fundamentals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {coaching.explanation.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-3">{paragraph}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Graduated Examples - For STEM subjects */}
            {coaching.graduated_examples && coaching.graduated_examples.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <GraduationCap className="h-5 w-5 text-purple-600" />
                    <span>5 Worked Examples (Easy → Hard)</span>
                  </CardTitle>
                  <CardDescription>
                    Master the concept step-by-step with graduated difficulty
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {coaching.graduated_examples.map((example, index) => (
                      <div key={index} className={`border rounded-lg overflow-hidden ${getDifficultyColor(example.difficulty)}`}>
                        <button
                          onClick={() => toggleExample(index)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-opacity-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(example.difficulty)}`}>
                              Example {index + 1}
                            </span>
                            <span className="font-medium text-sm">
                              {getDifficultyLabel(example.difficulty)}
                            </span>
                          </div>
                          {expandedExamples.has(index) ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                        
                        {expandedExamples.has(index) && (
                          <div className="p-4 bg-white border-t space-y-4">
                            {/* Problem */}
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                <Target className="h-4 w-4 mr-2 text-blue-600" />
                                Problem
                              </h4>
                              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                                {example.problem}
                              </div>
                            </div>
                            
                            {/* Step-by-Step Solution */}
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                Step-by-Step Solution
                              </h4>
                              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="prose prose-sm max-w-none">
                                  {example.step_by_step_solution.split('\n').map((step, i) => (
                                    <p key={i} className="mb-2 text-sm">{step}</p>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* Key Insight */}
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                <Lightbulb className="h-4 w-4 mr-2 text-yellow-600" />
                                Key Insight
                              </h4>
                              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm">
                                {example.key_insight}
                              </div>
                            </div>
                            
                            {/* Common Mistakes */}
                            {example.common_mistakes && example.common_mistakes.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                  <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                                  Common Mistakes to Avoid
                                </h4>
                                <div className="space-y-2">
                                  {example.common_mistakes.map((mistake, i) => (
                                    <div key={i} className="p-2 bg-red-50 rounded border border-red-200 text-sm flex items-start">
                                      <span className="text-red-500 mr-2">✗</span>
                                      {mistake}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Writing Guidance - For humanities subjects */}
            {coaching.writing_guidance && (
              <>
                {/* Essay Structure */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <PenTool className="h-5 w-5 text-indigo-600" />
                      <span>Essay Structure Guide</span>
                    </CardTitle>
                    <CardDescription>
                      Templates and techniques for high-scoring responses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Introduction Template */}
                      <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <h4 className="font-semibold text-indigo-900 mb-2">📝 Introduction Template</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {coaching.writing_guidance.essay_structure.introduction_template}
                        </p>
                      </div>
                      
                      {/* Body Paragraph Template */}
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2">📝 Body Paragraph Template (PEEL)</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {coaching.writing_guidance.essay_structure.body_paragraph_template}
                        </p>
                      </div>
                      
                      {/* Conclusion Template */}
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-900 mb-2">📝 Conclusion Template</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {coaching.writing_guidance.essay_structure.conclusion_template}
                        </p>
                      </div>
                      
                      {/* Transition Phrases */}
                      {coaching.writing_guidance.essay_structure.transition_phrases.length > 0 && (
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <h4 className="font-semibold text-gray-900 mb-3">🔗 Useful Transition Phrases</h4>
                          <div className="flex flex-wrap gap-2">
                            {coaching.writing_guidance.essay_structure.transition_phrases.map((phrase, i) => (
                              <span key={i} className="px-3 py-1 bg-white rounded-full text-sm border shadow-sm">
                                {phrase}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Argument Building & Evidence */}
                {coaching.writing_guidance.argument_building.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Target className="h-5 w-5 text-orange-600" />
                        <span>Building Strong Arguments</span>
                      </CardTitle>
                      <CardDescription>
                        How to construct persuasive, well-evidenced responses
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-3">
                        {coaching.writing_guidance.argument_building.map((point, index) => (
                          <div key={index} className="flex items-start space-x-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <span className="flex-shrink-0 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-sm">{point}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Marking Scheme Tips */}
                {coaching.writing_guidance.marking_scheme_tips.length > 0 && (
                  <Card className="border-green-200">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span>Marking Scheme Insights</span>
                      </CardTitle>
                      <CardDescription>
                        Understand how CSEC examiners award marks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {coaching.writing_guidance.marking_scheme_tips.map((tip, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{tip}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Regular Examples (fallback for when graduated_examples not available) */}
            {(!coaching.graduated_examples || coaching.graduated_examples.length === 0) && coaching.examples.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <span>Practical Examples</span>
                  </CardTitle>
                  <CardDescription>
                    Real-world examples from CSEC examinations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {coaching.examples.map((example, index) => (
                      <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <div className="prose prose-sm max-w-none">
                            {example.split('\n').map((line, i) => (
                              <p key={i} className="mb-2">{line}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Points Card */}
            {coaching.key_points.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    <span>Key Points to Memorize</span>
                  </CardTitle>
                  <CardDescription>
                    Essential concepts for exam success
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-3">
                    {coaching.key_points.map((point, index) => (
                      <div key={index} className="flex items-start space-x-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{point}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Practice Tips Card */}
            {coaching.practice_tips.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    <span>Study Tips & Strategies</span>
                  </CardTitle>
                  <CardDescription>
                    Effective study techniques for mastering {topic}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {coaching.practice_tips.map((tip, index) => (
                      <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-sm">{tip}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Complete Coaching Button */}
            <Card>
              <CardContent className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to Move Forward?
                </h3>
                <p className="text-gray-600 mb-4">
                  You've completed the comprehensive coaching for {topic}. 
                  Now it's time to test your knowledge with practice questions.
                </p>
                <Button onClick={completeCoaching} size="lg">
                  Complete Coaching & Continue
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}