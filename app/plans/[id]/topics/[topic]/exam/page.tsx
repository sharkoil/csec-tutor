'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, CheckCircle, RotateCcw, Award, FileText, Clock } from 'lucide-react'
import { fetchPlan as fetchPlanFromStorage, fetchTopicProgress, saveProgress } from '@/lib/plan-storage'

interface ExamQuestion {
  id: string
  question: string
  type?: 'multiple_choice' | 'short_answer' | 'structured'
  marks: number
  options?: string[]
  answer?: string
  explanation?: string
}

interface ExamSection {
  name: string
  marks: number
  questions: ExamQuestion[]
}

interface ExamData {
  exam_content: string
  duration: number
  topics: string[]
  total_marks: number
  sections?: ExamSection[]
}

interface UserAnswers {
  [questionId: string]: string
}

export default function ExamPage({ params }: { params: Promise<{ id: string; topic: string }> }) {
  const { id: planId, topic: encodedTopic } = use(params)
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isRetakeMode = searchParams.get('retake') === 'true'
  const [plan, setPlan] = useState<any>(null)
  const [examData, setExamData] = useState<ExamData | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [examCompleted, setExamCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({})
  const [examScore, setExamScore] = useState<number | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [previousScore, setPreviousScore] = useState<number | null>(null)
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
      // Unified fetch: tries Supabase first, falls back to localStorage
      const planData = await fetchPlanFromStorage(user!.id, planId)

      if (!planData || !planData.topics.includes(topic)) {
        router.push(`/plans/${planId}`)
        return
      }

      // Check prerequisite progress
      const progress = await fetchTopicProgress(user!.id, planId, topic)

      if (!progress?.practice_completed) {
        router.push(`/plans/${planId}/topics/${encodeURIComponent(topic)}/practice`)
        return
      }

      // Allow access if in retake mode, even if already completed
      if (progress?.exam_completed && !isRetakeMode) {
        router.push(`/plans/${planId}`)
        return
      }

      // Store previous score if retaking
      if (progress?.exam_score) {
        setPreviousScore(progress.exam_score)
      }

      setPlan(planData)
    } catch (error) {
      console.error('Error fetching plan:', error)
      router.push(`/plans/${planId}`)
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
        headers: { 'Content-Type': 'application/json', ...(user?.id ? { 'x-user-id': user.id } : {}) },
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
      const demoExam: ExamData = {
        exam_content: `CSEC ${plan.subject} Practice Exam - ${topic}\n\nSection A: Multiple Choice (20 marks)\nSection B: Structured Questions (30 marks)\n\nTime Allowed: 30 minutes`,
        duration: 30,
        topics: [topic],
        total_marks: 50,
        sections: [
          {
            name: "Section A: Multiple Choice",
            marks: 20,
            questions: [
              { id: "1", question: `What is the primary focus of ${topic}?`, options: ["Understanding core concepts", "Memorizing formulas only", "Reading without practice", "Ignoring fundamentals"], answer: "A", marks: 2 },
              { id: "2", question: `Which approach is best for mastering ${topic}?`, options: ["Skip practice exercises", "Regular practice and review", "Only read once before exam", "Avoid asking questions"], answer: "B", marks: 2 },
              { id: "3", question: `In CSEC ${plan.subject}, ${topic} is typically tested in:`, options: ["Paper 1 only", "Paper 2 only", "Both Paper 1 and Paper 2", "Neither paper"], answer: "C", marks: 2 },
              { id: "4", question: `What is a key skill required for ${topic}?`, options: ["Critical thinking", "Random guessing", "Avoiding calculations", "Skipping definitions"], answer: "A", marks: 2 },
              { id: "5", question: `How should you approach ${topic} questions in an exam?`, options: ["Rush through quickly", "Read carefully and plan your answer", "Skip if unsure", "Only answer the first part"], answer: "B", marks: 2 },
              { id: "6", question: `Which resource is most helpful for studying ${topic}?`, options: ["Past papers", "Only notes", "No resources needed", "Random websites"], answer: "A", marks: 2 },
              { id: "7", question: `Time management in ${topic} questions means:`, options: ["Spending all time on one question", "Allocating time based on marks", "Ignoring the clock", "Finishing any way possible"], answer: "B", marks: 2 },
              { id: "8", question: `Understanding ${topic} helps with:`, options: ["Only this exam", "Future learning and applications", "Nothing else", "Other subjects only"], answer: "B", marks: 2 },
              { id: "9", question: `A common mistake in ${topic} is:`, options: ["Reading questions carefully", "Rushing without understanding", "Checking your work", "Planning your answer"], answer: "B", marks: 2 },
              { id: "10", question: `To excel in ${topic}, students should:`, options: ["Practice regularly", "Study only before exams", "Ignore difficult parts", "Skip revision"], answer: "A", marks: 2 }
            ]
          },
          {
            name: "Section B: Structured Questions",
            marks: 30,
            questions: [
              { id: "B1", question: `Define ${topic} and explain its importance in ${plan.subject}. Give two examples of how it is applied in the Caribbean context.`, answer: `${topic} is a fundamental concept in ${plan.subject} that involves understanding key principles and their applications. It is important because it forms the basis for more advanced topics and practical applications. Examples in the Caribbean context include real-world applications in local industries and everyday life.`, marks: 10 },
              { id: "B2", question: `Describe the main components or principles of ${topic}. How do these relate to each other?`, answer: `The main components of ${topic} include foundational principles, key relationships, and practical applications. These components are interconnected - understanding the foundational principles helps in grasping the relationships, which in turn enables practical application.`, marks: 10 },
              { id: "B3", question: `A student is having difficulty with ${topic}. What advice would you give them, and what study strategies would you recommend?`, answer: `Advice: 1) Break down the topic into smaller parts. 2) Practice with past papers. 3) Seek help from teachers or peers. Study strategies: Use visual aids, create summary notes, practice regularly, and test yourself with practice questions.`, marks: 10 }
            ]
          }
        ]
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
      // Calculate score for multiple choice questions
      let earnedMarks = 0
      let totalMCMarks = 0
      
      if (examData?.sections) {
        examData.sections.forEach((section, sectionIdx) => {
          section.questions.forEach((q, qIdx) => {
            if (q.options && q.options.length > 0) {
              // Multiple choice - can auto-grade
              totalMCMarks += q.marks
              const userAnswer = userAnswers[`${sectionIdx}-${qIdx}`]
              if (userAnswer === q.answer) {
                earnedMarks += q.marks
              }
            }
          })
        })
      }
      
      // Calculate percentage (MC portion only, structured needs manual review)
      const mcPercentage = totalMCMarks > 0 ? Math.round((earnedMarks / totalMCMarks) * 100) : 0
      
      // Combine MC score + estimate for structured (60-85% average assumption)
      const structuredEstimate = 70
      const finalScore = totalMCMarks > 0 ? mcPercentage : (timeout ? 50 : structuredEstimate)
      
      setExamScore(finalScore)
      setShowResults(true)

      // Save progress via unified data layer
      await saveProgress(user!.id, planId, topic, {
        coaching_completed: true,
        practice_completed: true,
        exam_completed: true,
        exam_score: finalScore,
      })

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
        {/* Previous Score Banner - shown when retaking */}
        {previousScore !== null && !examStarted && (
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

        {!examData && !isGenerating && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-6 w-6 text-purple-600" />
                <span>{isRetakeMode ? 'Ready to Improve Your Score?' : 'Ready for the Final Test?'}</span>
              </CardTitle>
              <CardDescription>
                {isRetakeMode 
                  ? `Retake the ${topic} practice exam to improve your score.`
                  : `Take a comprehensive practice exam for ${topic} based on actual CSEC format.`}
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

        {examStarted && !examCompleted && examData && (
          <div className="space-y-6">
            {/* Timer and Status */}
            <div className="bg-white p-4 rounded-lg shadow-sm border sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-red-600" />
                  <span className="font-semibold text-gray-900">Time Remaining:</span>
                  <span className={`text-lg font-bold ${timeRemaining < 300 ? 'text-red-600 animate-pulse' : 'text-green-600'}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {examData.total_marks} marks • {topic}
                </div>
              </div>
            </div>

            {/* Exam Questions - Interactive */}
            {examData.sections && examData.sections.length > 0 ? (
              <div className="space-y-8">
                {examData.sections.map((section, sectionIdx) => (
                  <Card key={sectionIdx}>
                    <CardHeader className="bg-purple-50 border-b">
                      <CardTitle className="text-lg">{section.name}</CardTitle>
                      <CardDescription>{section.marks} marks</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      {section.questions.map((q, qIdx) => (
                        <div key={q.id || qIdx} className="p-4 border rounded-lg bg-gray-50">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-gray-900">
                              Question {qIdx + 1}
                            </h4>
                            <span className="text-sm text-purple-600 font-medium">
                              [{q.marks} marks]
                            </span>
                          </div>
                          <p className="text-gray-800 mb-4 whitespace-pre-wrap">{q.question}</p>
                          
                          {/* Multiple Choice Options */}
                          {q.options && q.options.length > 0 ? (
                            <div className="space-y-2">
                              {q.options.map((option, optIdx) => {
                                const optionLetter = String.fromCharCode(65 + optIdx)
                                const questionKey = `${sectionIdx}-${qIdx}`
                                const isSelected = userAnswers[questionKey] === optionLetter
                                const isCorrect = showResults && q.answer === optionLetter
                                const isWrong = showResults && isSelected && q.answer !== optionLetter
                                
                                return (
                                  <label
                                    key={optIdx}
                                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                      isCorrect ? 'bg-green-100 border-green-500' :
                                      isWrong ? 'bg-red-100 border-red-500' :
                                      isSelected ? 'bg-purple-100 border-purple-500' : 
                                      'bg-white hover:bg-gray-100'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={questionKey}
                                      value={optionLetter}
                                      checked={isSelected}
                                      onChange={(e) => setUserAnswers(prev => ({
                                        ...prev,
                                        [questionKey]: e.target.value
                                      }))}
                                      disabled={showResults}
                                      className="mr-3"
                                    />
                                    <span className="font-medium mr-2">{optionLetter}.</span>
                                    <span>{option}</span>
                                    {showResults && isCorrect && (
                                      <CheckCircle className="ml-auto h-5 w-5 text-green-600" />
                                    )}
                                  </label>
                                )
                              })}
                            </div>
                          ) : (
                            /* Structured/Short Answer */
                            <textarea
                              className="w-full p-3 border rounded-lg min-h-[120px] focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="Write your answer here..."
                              value={userAnswers[`${sectionIdx}-${qIdx}`] || ''}
                              onChange={(e) => setUserAnswers(prev => ({
                                ...prev,
                                [`${sectionIdx}-${qIdx}`]: e.target.value
                              }))}
                              disabled={showResults}
                            />
                          )}

                          {/* Show answer after submission for structured questions */}
                          {showResults && q.answer && !q.options && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-sm font-semibold text-green-800 mb-1">Model Answer:</p>
                              <p className="text-sm text-green-700 whitespace-pre-wrap">{q.answer}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => submitExam(false)}
                    disabled={isSubmitting}
                    size="lg"
                    className="px-8"
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Exam
                  </Button>
                </div>
              </div>
            ) : (
              /* Fallback: Raw text display */
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
            )}
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
                
                {examScore !== null && (
                  <div className="mb-6">
                    <div className={`text-5xl font-bold mb-2 ${
                      examScore >= 70 ? 'text-green-600' : 
                      examScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {examScore}%
                    </div>
                    <p className="text-gray-600">
                      {examScore >= 70 ? '🎉 Excellent work!' : 
                       examScore >= 50 ? '👍 Good effort! Keep practicing.' : 
                       '📚 More study needed. Review the material and try again.'}
                    </p>
                  </div>
                )}
                
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

              <div className="flex space-x-4 justify-center">
                <Button onClick={() => { setExamCompleted(false); setShowResults(false); setExamStarted(true); }} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Review Answers
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