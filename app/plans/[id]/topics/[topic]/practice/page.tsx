'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, CheckCircle, Play, RotateCcw } from 'lucide-react'
import StudyTipsSlider from '@/components/study-tips-slider'
import { fetchPlan as fetchPlanFromStorage, fetchTopicProgress, saveProgress } from '@/lib/plan-storage'

interface PracticeQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'short_answer' | 'structured'
  marks: number
  options?: string[]
  answer?: string
  explanation?: string
}

export default function PracticePage({ params }: { params: Promise<{ id: string; topic: string }> }) {
  const { id: planId, topic: encodedTopic } = use(params)
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReviewMode = searchParams.get('review') === 'true'
  const [plan, setPlan] = useState<any>(null)
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [showResults, setShowResults] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const topic = decodeURIComponent(encodedTopic)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && planId) {
      fetchPlanAndCheckPrerequisites()
    }
  }, [user, planId])

  const fetchPlanAndCheckPrerequisites = async () => {
    try {
      // Unified fetch: tries Supabase first, falls back to localStorage
      const planData = await fetchPlanFromStorage(user!.id, planId)

      if (!planData || !planData.topics.includes(topic)) {
        router.push(`/plans/${planId}`)
        return
      }

      // Check prerequisite progress
      const progress = await fetchTopicProgress(user!.id, planId, topic)

      if (!progress?.coaching_completed) {
        router.push(`/plans/${planId}/topics/${encodeURIComponent(topic)}/coaching`)
        return
      }

      // Allow access if in review mode, even if already completed
      if (progress?.practice_completed && !isReviewMode) {
        router.push(`/plans/${planId}`)
        return
      }

      // Store previous score if reviewing
      if (progress?.practice_score) {
        setPreviousScore(progress.practice_score)
      }

      setPlan(planData)
    } catch (error) {
      console.error('Error fetching plan:', error)
      router.push(`/plans/${planId}`)
    } finally {
      setIsLoading(false)
    }
  }

  const generateQuestions = async () => {
    if (!plan) return

    setIsGenerating(true)
    try {
      // Call the server-side API route for OpenRouter
      const response = await fetch('/api/ai/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(user?.id ? { 'x-user-id': user.id } : {}) },
        body: JSON.stringify({
          subject: plan.subject,
          topic,
          difficulty: 'medium',
          count: 5
        })
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const data = await response.json()
      
      if (data.error || !data.questions?.length) {
        throw new Error(data.error || 'No questions generated')
      }

      setQuestions(data.questions)
    } catch (error) {
      console.error('Error generating questions:', error)
      // Provide demo fallback questions when AI is unavailable
      const demoQuestions: PracticeQuestion[] = [
        {
          id: '1',
          question: `Which of the following best describes a key principle of ${topic}?`,
          type: 'multiple_choice',
          marks: 2,
          options: [
            "It involves systematic problem-solving approaches",
            "It requires understanding of fundamental concepts",
            "It builds upon previously learned material",
            "All of the above"
          ],
          answer: "All of the above",
          explanation: `${topic} encompasses multiple important principles: it requires systematic approaches to solve problems effectively, builds on fundamental concepts you must understand thoroughly, and connects to previously learned material. This holistic understanding is crucial for CSEC success.`
        },
        {
          id: '2',
          question: `In CSEC ${plan.subject}, how is ${topic} typically applied?`,
          type: 'multiple_choice',
          marks: 2,
          options: [
            "Through practical examples and calculations",
            "By memorizing formulas only",
            "Through theoretical discussion only",
            "None of the above"
          ],
          answer: "Through practical examples and calculations",
          explanation: `CSEC emphasizes practical application of knowledge. ${topic} is best learned and demonstrated through working examples and performing calculations, not just memorization. Examiners want to see that you can apply concepts to real problems.`
        },
        {
          id: '3',
          question: `What is an important consideration when solving ${topic} problems in CSEC exams?`,
          type: 'multiple_choice',
          marks: 2,
          options: [
            "Speed is more important than accuracy",
            "Show all working to gain method marks",
            "Skip difficult questions entirely",
            "Only write the final answer"
          ],
          answer: "Show all working to gain method marks",
          explanation: `In CSEC exams, partial credit (method marks) is awarded for showing your working, even if the final answer is incorrect. This is especially important for ${topic} questions where the process matters as much as the result. Never skip working!`
        },
        {
          id: '4',
          question: `Briefly explain one key concept from ${topic} that you find important for CSEC preparation.`,
          type: 'short_answer',
          marks: 4,
          answer: `A comprehensive explanation covering ${topic} concepts and their application in CSEC ${plan.subject}.`,
          explanation: `For short answer questions like this, CSEC examiners look for: clear identification of a concept, accurate explanation of what it means, and an example of how it applies to ${plan.subject}. Structure your answer with these elements to maximize marks.`
        }
      ]
      setQuestions(demoQuestions)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const submitQuiz = async () => {
    setIsSubmitting(true)
    try {
      // Calculate score
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
      const obtainedMarks = questions.reduce((sum, q) => {
        const userAnswer = userAnswers[q.id]
        const isCorrect = userAnswer?.toLowerCase().trim() === q.answer?.toLowerCase().trim()
        return sum + (isCorrect ? q.marks : 0)
      }, 0)
      const score = Math.round((obtainedMarks / totalMarks) * 100)

      // Save progress via unified data layer
      await saveProgress(user!.id, planId, topic, {
        coaching_completed: true,
        practice_completed: true,
        exam_completed: false,
        practice_score: score,
      })

      setShowResults(true)
    } catch (error) {
      console.error('Error submitting quiz:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetQuiz = () => {
    setCurrentQuestionIndex(0)
    setUserAnswers({})
    setShowResults(false)
  }

  const calculateScore = () => {
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
    const obtainedMarks = questions.reduce((sum, q) => {
      const userAnswer = userAnswers[q.id]
      const isCorrect = userAnswer?.toLowerCase().trim() === q.answer?.toLowerCase().trim()
      return sum + (isCorrect ? q.marks : 0)
    }, 0)
    return Math.round((obtainedMarks / totalMarks) * 100)
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

  const currentQuestion = questions[currentQuestionIndex]

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
                {plan.subject} - {topic} Practice
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Previous Score Banner - shown when practicing again */}
        {previousScore !== null && !questions.length && !isGenerating && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-blue-900">📊 Previous Attempt</h4>
                <p className="text-sm text-blue-700">Your last score was <span className="font-bold">{previousScore}%</span></p>
              </div>
              <div className="text-2xl font-bold text-blue-600">{previousScore}%</div>
            </div>
          </div>
        )}

        {!questions.length && !isGenerating && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-6 w-6 text-green-600" />
                <span>{isReviewMode ? 'Practice Again?' : 'Ready to Practice?'}</span>
              </CardTitle>
              <CardDescription>
                {isReviewMode
                  ? `Practice more ${topic} questions to reinforce your learning.`
                  : `Test your knowledge of ${topic} with AI-generated practice questions based on CSEC past papers and curriculum.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={generateQuestions} size="lg" className="w-full">
                {isReviewMode ? 'Generate New Questions' : 'Generate Practice Questions'}
              </Button>
            </CardContent>
          </Card>
        )}

        {isGenerating && (
          <Card>
            <CardContent className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generating Practice Questions
              </h3>
              <p className="text-gray-600">
                Creating questions based on CSEC curriculum and past papers...
              </p>

              <StudyTipsSlider />
            </CardContent>
          </Card>
        )}

        {questions.length > 0 && !showResults && (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-sm font-medium text-gray-600">
                  {questions.reduce((sum, q) => sum + q.marks, 0)} marks total
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Question Card */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Question {currentQuestionIndex + 1}</CardTitle>
                    <CardDescription>{currentQuestion.marks} marks</CardDescription>
                  </div>
                  <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {currentQuestion.type.replace('_', ' ')}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg font-medium">{currentQuestion.question}</p>

                {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          userAnswers[currentQuestion.id] === option
                            ? 'bg-blue-50 border-blue-300'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handleAnswerChange(currentQuestion.id, option)}
                      >
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            value={option}
                            checked={userAnswers[currentQuestion.id] === option}
                            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                            className="text-blue-600"
                          />
                          <span>{option}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'short_answer' && (
                  <textarea
                    className="w-full p-3 border rounded-lg"
                    rows={4}
                    placeholder="Enter your answer here..."
                    value={userAnswers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  />
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>

              {currentQuestionIndex < questions.length - 1 ? (
                <Button
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  disabled={!userAnswers[currentQuestion.id]}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={submitQuiz}
                  disabled={Object.keys(userAnswers).length !== questions.length || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Quiz
                </Button>
              )}
            </div>
          </div>
        )}

        {showResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <span>Practice Complete!</span>
              </CardTitle>
              <CardDescription>
                Here's how you performed on the practice questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {calculateScore()}%
                </div>
                <div className="text-lg text-gray-600">Score</div>
              </div>

              <div className="space-y-4">
                {questions.map((question, index) => {
                  const userAnswer = userAnswers[question.id]
                  const isCorrect = userAnswer?.toLowerCase().trim() === question.answer?.toLowerCase().trim()
                  
                  return (
                    <div key={question.id} className={`p-4 rounded-lg border-2 ${
                      isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}>
                      <div className="flex items-start space-x-3 mb-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isCorrect ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                          {isCorrect ? '✓' : '✗'}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-2">Question {index + 1}: {question.question}</p>
                          <div className="text-sm space-y-1">
                            <p className={userAnswer === question.answer ? 'text-green-700' : 'text-red-700'}>
                              <span className="font-medium">Your answer:</span> {userAnswer || 'Not answered'}
                            </p>
                            {!isCorrect && (
                              <p className="text-green-700">
                                <span className="font-medium">Correct answer:</span> {question.answer}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Explanation Section */}
                      {question.explanation && (
                        <div className="ml-11 mt-3 p-3 bg-white rounded-lg border border-gray-200">
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                            Explanation
                          </p>
                          <p className="text-sm text-gray-700">{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex space-x-4">
                <Button onClick={resetQuiz} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Link href={`/plans/${planId}`}>
                  <Button>Back to Study Plan</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}