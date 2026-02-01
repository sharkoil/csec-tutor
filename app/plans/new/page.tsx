'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CSEC_SUBJECTS } from '@/data/subjects'

export default function NewPlanPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!loading) {
      setIsReady(true)
      if (!user) {
        router.push('/auth')
      }
    }
  }, [user, loading, router])

  const subjects = Object.entries(CSEC_SUBJECTS).map(([key, subject]) => ({
    key,
    ...subject
  }))

  const currentSubject = selectedSubject 
    ? CSEC_SUBJECTS[selectedSubject as keyof typeof CSEC_SUBJECTS]
    : null

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
      // Check if this is a mock user (for development/testing)
      const isMockUser = user.id.startsWith('user_')
      
      if (isMockUser) {
        // For mock users, create in-memory study plan and redirect
        const mockPlanId = 'plan_' + Math.random().toString(36).substr(2, 9)
        
        // Store mock plan data in localStorage for later retrieval
        const mockPlan = {
          id: mockPlanId,
          user_id: user.id,
          subject: currentSubject?.name || selectedSubject,
          topics: selectedTopics,
          status: 'active',
          created_at: new Date().toISOString()
        }
        
        // Get existing plans from localStorage
        const existingPlans = JSON.parse(localStorage.getItem('csec_mock_plans') || '[]')
        existingPlans.push(mockPlan)
        localStorage.setItem('csec_mock_plans', JSON.stringify(existingPlans))
        
        console.log('Created mock study plan:', mockPlanId)
        router.push(`/plans/${mockPlanId}`)
        return
      }

      // For real Supabase users, insert into database
      const { data, error } = await supabase
        .from('study_plans')
        .insert({
          user_id: user.id,
          subject: currentSubject?.name || selectedSubject,
          topics: selectedTopics,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase insert error:', error)
        throw error
      }

      // Create progress entries for each selected topic
      const progressEntries = selectedTopics.map(topic => ({
        user_id: user.id,
        plan_id: data.id,
        topic,
        coaching_completed: false,
        practice_completed: false,
        exam_completed: false
      }))

      const { error: progressError } = await supabase
        .from('progress')
        .insert(progressEntries)

      if (progressError) {
        console.error('Progress insert error:', progressError)
        throw progressError
      }

      router.push(`/plans/${data.id}`)
    } catch (error) {
      console.error('Error creating study plan:', error)
      
      // Fallback: Store in localStorage if Supabase fails
      const mockPlanId = 'plan_' + Math.random().toString(36).substr(2, 9)
      const mockPlan = {
        id: mockPlanId,
        user_id: user.id,
        subject: currentSubject?.name || selectedSubject,
        topics: selectedTopics,
        status: 'active',
        created_at: new Date().toISOString()
      }
      
      try {
        const existingPlans = JSON.parse(localStorage.getItem('csec_mock_plans') || '[]')
        existingPlans.push(mockPlan)
        localStorage.setItem('csec_mock_plans', JSON.stringify(existingPlans))
        console.log('Created fallback study plan:', mockPlanId)
        router.push(`/plans/${mockPlanId}`)
      } catch (localStorageError) {
        alert(`Failed to create study plan: ${error instanceof Error ? error.message : String(error)}`)
      }
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
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Create Your Personalized Study Plan
          </h2>
          <p className="text-gray-600">
            Select a subject and choose the topics you want to focus on. 
            We'll create a customized learning path for you.
          </p>
        </div>

        {/* Subject Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Step 1: Choose Your Subject</h3>
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
                  setSelectedTopics([])
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

        {/* Topic Selection */}
        {currentSubject && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Step 2: Select Topics to Study
            </h3>
            <Card>
              <CardHeader>
                <CardTitle>{currentSubject.name} Topics</CardTitle>
                <CardDescription>
                  Choose the topics you want to include in your study plan
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
          </div>
        )}

        {/* Summary and Create Button */}
        {selectedSubject && selectedTopics.length > 0 && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Study Plan Summary</CardTitle>
                <CardDescription>
                  Review your selections before creating your study plan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <span className="font-semibold">Subject:</span> {currentSubject?.name}
                  </div>
                  <div>
                    <span className="font-semibold">Topics Selected:</span> {selectedTopics.length}
                  </div>
                  <div>
                    <span className="font-semibold">Estimated Duration:</span>{' '}
                    {selectedTopics.length * 2} weeks
                  </div>
                  <Button
                    onClick={handleCreatePlan}
                    disabled={isCreating}
                    className="w-full"
                  >
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Study Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedSubject && selectedTopics.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-600">
                Please select at least one topic to create your study plan
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}