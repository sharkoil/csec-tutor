'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, CheckCircle, Sparkles, ArrowRight, MessageSquare, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CSEC_SUBJECTS } from '@/data/subjects'
import { FileUpload } from '@/components/file-upload'
import { PlanAttachment } from '@/types'

type Step = 'describe' | 'subject' | 'topics' | 'review'

interface AnalysisResult {
  suggested_subject: string
  suggested_topics: string[]
  help_areas: string[]
  confidence: number
  reasoning: string
}

export default function NewPlanPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('describe')
  
  // Form state
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<PlanAttachment[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [helpAreas, setHelpAreas] = useState<string[]>([])
  
  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  const subjects = Object.entries(CSEC_SUBJECTS).map(([key, subject]) => ({
    key,
    ...subject
  }))

  const currentSubject = selectedSubject 
    ? CSEC_SUBJECTS[selectedSubject as keyof typeof CSEC_SUBJECTS]
    : null

  const handleAnalyze = async () => {
    if (!description && attachments.length === 0) {
      setError('Please describe what you need help with or upload supporting documents')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/analyze-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          attachments
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed')
      }

      setAnalysisResult(result)
      setHelpAreas(result.help_areas || [])
      
      // Find the subject key from the name
      const subjectKey = Object.keys(CSEC_SUBJECTS).find(
        key => CSEC_SUBJECTS[key as keyof typeof CSEC_SUBJECTS].name === result.suggested_subject
      )
      
      if (subjectKey) {
        setSelectedSubject(subjectKey)
        setSelectedTopics(result.suggested_topics || [])
      }
      
      setCurrentStep('subject')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSkipToManual = () => {
    setCurrentStep('subject')
  }

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    )
  }

  const handleCreatePlan = async () => {
    if (!user || !selectedSubject || selectedTopics.length === 0) {
      return
    }

    setIsCreating(true)
    try {
      const isMockUser = user.id.startsWith('user_')
      
      const planData = {
        user_id: user.id,
        subject: currentSubject?.name || selectedSubject,
        topics: selectedTopics,
        status: 'active' as const,
        description: description || undefined,
        help_areas: helpAreas.length > 0 ? helpAreas : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      if (isMockUser) {
        const mockPlanId = 'plan_' + Math.random().toString(36).substr(2, 9)
        const mockPlan = { id: mockPlanId, ...planData }
        
        const existingPlans = JSON.parse(localStorage.getItem('csec_mock_plans') || '[]')
        existingPlans.push(mockPlan)
        localStorage.setItem('csec_mock_plans', JSON.stringify(existingPlans))
        
        router.push(`/plans/${mockPlanId}`)
        return
      }

      const { data, error } = await supabase
        .from('study_plans')
        .insert(planData)
        .select()
        .single()

      if (error) throw error

      const progressEntries = selectedTopics.map(topic => ({
        user_id: user.id,
        plan_id: data.id,
        topic,
        coaching_completed: false,
        practice_completed: false,
        exam_completed: false
      }))

      await supabase.from('progress').insert(progressEntries)
      router.push(`/plans/${data.id}`)
    } catch (error) {
      console.error('Error creating study plan:', error)
      
      // Fallback to localStorage
      const mockPlanId = 'plan_' + Math.random().toString(36).substr(2, 9)
      const mockPlan = {
        id: mockPlanId,
        user_id: user.id,
        subject: currentSubject?.name || selectedSubject,
        topics: selectedTopics,
        status: 'active',
        description,
        help_areas: helpAreas,
        attachments,
        created_at: new Date().toISOString()
      }
      
      const existingPlans = JSON.parse(localStorage.getItem('csec_mock_plans') || '[]')
      existingPlans.push(mockPlan)
      localStorage.setItem('csec_mock_plans', JSON.stringify(existingPlans))
      router.push(`/plans/${mockPlanId}`)
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const stepNumber = currentStep === 'describe' ? 1 : currentStep === 'subject' ? 2 : currentStep === 'topics' ? 3 : 4

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Create Study Plan</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {['Describe', 'Subject', 'Topics', 'Review'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index + 1 < stepNumber ? 'bg-green-600 text-white' :
                  index + 1 === stepNumber ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1 < stepNumber ? <CheckCircle className="h-5 w-5" /> : index + 1}
                </div>
                <span className={`ml-2 text-sm ${index + 1 === stepNumber ? 'font-semibold' : 'text-gray-500'}`}>
                  {step}
                </span>
                {index < 3 && <div className="w-16 h-0.5 mx-4 bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Describe */}
        {currentStep === 'describe' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                What do you need help with?
              </h2>
              <p className="text-gray-600">
                Describe your study goals, challenges, or the topics you're struggling with. 
                You can also upload past exams, notes, or any documents to help us understand your needs better.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                  Describe Your Needs
                </CardTitle>
                <CardDescription>
                  Tell us about what you want to learn or improve
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Example: I'm having trouble with algebra, especially solving quadratic equations and factoring. I also struggle with word problems involving functions..."
                  className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-purple-600" />
                  Supporting Documents (Optional)
                </CardTitle>
                <CardDescription>
                  Upload past exams, notes, or any documents that show what you need help with
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  files={attachments}
                  onFilesChange={setAttachments}
                  userId={user.id}
                  maxFiles={5}
                />
              </CardContent>
            </Card>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleSkipToManual}>
                Skip to Manual Selection
              </Button>
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze & Suggest
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Subject Selection */}
        {currentStep === 'subject' && (
          <div className="space-y-6">
            {analysisResult && analysisResult.confidence > 0.5 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-900">
                    <Sparkles className="h-5 w-5 mr-2" />
                    AI Suggestion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-blue-800 mb-2">{analysisResult.reasoning}</p>
                  <p className="text-sm text-blue-600">
                    Confidence: {Math.round(analysisResult.confidence * 100)}%
                  </p>
                </CardContent>
              </Card>
            )}

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Subject</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map((subject) => (
                  <Card
                    key={subject.key}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedSubject === subject.key
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedSubject(subject.key)
                      // Keep AI-suggested topics if same subject, otherwise clear
                      if (analysisResult?.suggested_subject !== subject.name) {
                        setSelectedTopics([])
                      }
                    }}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{subject.name}</CardTitle>
                      <CardDescription>{subject.code}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600">{subject.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('describe')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep('topics')} 
                disabled={!selectedSubject}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Topic Selection */}
        {currentStep === 'topics' && currentSubject && (
          <div className="space-y-6">
            {helpAreas.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-yellow-900">Focus Areas Identified</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {helpAreas.map((area, index) => (
                      <li key={index} className="text-yellow-800 text-sm flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-yellow-600" />
                        {area}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{currentSubject.name} Topics</CardTitle>
                <CardDescription>
                  Choose the topics you want to include in your study plan
                  {analysisResult && ' (AI suggestions pre-selected)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  {currentSubject.topics.map((topic) => (
                    <div
                      key={topic}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedTopics.includes(topic)
                          ? 'bg-blue-50 border-blue-300'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleTopicToggle(topic)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{topic}</span>
                        {selectedTopics.includes(topic) && (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('subject')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep('review')} 
                disabled={selectedTopics.length === 0}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 'review' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Your Study Plan</CardTitle>
                <CardDescription>
                  Confirm your selections before creating your personalized study plan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Subject</span>
                    <p className="font-semibold">{currentSubject?.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Topics</span>
                    <p className="font-semibold">{selectedTopics.length} selected</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Estimated Duration</span>
                    <p className="font-semibold">{selectedTopics.length * 2} weeks</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Attachments</span>
                    <p className="font-semibold">{attachments.length} files</p>
                  </div>
                </div>

                {description && (
                  <div>
                    <span className="text-sm text-gray-500">Your Description</span>
                    <p className="text-sm bg-gray-50 p-3 rounded-lg mt-1">{description}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-gray-500">Selected Topics</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedTopics.map(topic => (
                      <span key={topic} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                {helpAreas.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500">Focus Areas</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {helpAreas.map((area, index) => (
                        <span key={index} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('topics')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleCreatePlan} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Study Plan'
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}