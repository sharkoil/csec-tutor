'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, CheckCircle, Sparkles, ArrowRight, MessageSquare, FileText, GraduationCap, Target, Clock, Calendar, BarChart3, AlertTriangle, BookOpen } from 'lucide-react'
import { savePlan } from '@/lib/plan-storage'
import { CSEC_SUBJECTS, TOPIC_PREREQUISITES, TOPIC_SUBTOPICS, getPrerequisites, getSubtopics } from '@/data/subjects'
import { FileUpload } from '@/components/file-upload'
import { PlanAttachment, WizardData } from '@/types'

// ── Step Types ──────────────────────────────────────────────────────────────

type Step = 'describe' | 'subject' | 'topics' | 'proficiency' | 'preferences' | 'review'
type ConfidenceLevel = 'no_exposure' | 'struggling' | 'some_knowledge' | 'confident'
type TargetGrade = 'grade_1' | 'grade_2' | 'grade_3'
type ExamTimeline = 'may_june' | 'january' | 'no_exam'
type LearningStyle = 'theory_first' | 'practice_first' | 'blended'

const STEP_LABELS = ['Describe', 'Subject', 'Topics', 'Assess', 'Schedule', 'Review'] as const

// ── UI Constants ────────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; color: string; activeColor: string; description: string }> = {
  no_exposure: {
    label: "Haven't covered this",
    color: 'border-gray-200 text-gray-500 hover:border-gray-300',
    activeColor: 'bg-gray-100 border-gray-400 text-gray-800 ring-2 ring-gray-300',
    description: 'No prior exposure',
  },
  struggling: {
    label: "I'm struggling",
    color: 'border-gray-200 text-gray-500 hover:border-red-200',
    activeColor: 'bg-red-50 border-red-400 text-red-800 ring-2 ring-red-300',
    description: 'Studied but finding it difficult',
  },
  some_knowledge: {
    label: 'I know some',
    color: 'border-gray-200 text-gray-500 hover:border-amber-200',
    activeColor: 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-300',
    description: 'Partial understanding',
  },
  confident: {
    label: "I've got this",
    color: 'border-gray-200 text-gray-500 hover:border-green-200',
    activeColor: 'bg-green-50 border-green-400 text-green-800 ring-2 ring-green-300',
    description: 'Strong understanding',
  },
}

const GRADE_OPTIONS = [
  { value: 'grade_3' as TargetGrade, label: 'Grade III', sublabel: 'Pass', pct: '50–59%', color: 'border-sky-300 bg-sky-50', ring: 'ring-sky-400' },
  { value: 'grade_2' as TargetGrade, label: 'Grade II', sublabel: 'Good', pct: '60–74%', color: 'border-indigo-300 bg-indigo-50', ring: 'ring-indigo-400' },
  { value: 'grade_1' as TargetGrade, label: 'Grade I', sublabel: 'Top marks', pct: '75–100%', color: 'border-violet-300 bg-violet-50', ring: 'ring-violet-400' },
]

const LEVEL_OPTIONS = [
  { value: 'beginner' as const, label: 'Starting from scratch', desc: 'New to most topics — need foundational teaching from the ground up', icon: '🌱' },
  { value: 'intermediate' as const, label: 'I know the basics', desc: 'Some knowledge — need structured practice and deeper understanding', icon: '📗' },
  { value: 'advanced' as const, label: 'Strong foundation', desc: 'Solid understanding — focused on exam technique and challenging problems', icon: '🚀' },
]

const EXAM_OPTIONS = [
  { value: 'may_june' as ExamTimeline, label: 'May/June 2026', desc: 'Standard school sitting', color: 'border-red-400 bg-red-50' },
  { value: 'january' as ExamTimeline, label: 'January 2027', desc: 'Re-sit or private candidate', color: 'border-orange-400 bg-orange-50' },
  { value: 'no_exam' as ExamTimeline, label: 'No exam deadline', desc: 'Learning at my own pace', color: 'border-teal-400 bg-teal-50' },
]

const SESSION_OPTIONS = [
  { value: 15, label: '15–20 min', desc: 'Quick sessions' },
  { value: 30, label: '30–45 min', desc: 'Standard' },
  { value: 60, label: '60+ min', desc: 'Deep study' },
]

const STYLE_OPTIONS = [
  { value: 'theory_first' as LearningStyle, label: 'Explain first, then practice', desc: 'Understand the theory before trying problems', icon: '📖' },
  { value: 'practice_first' as LearningStyle, label: 'Let me try first, then explain', desc: 'Learn by attempting problems first', icon: '✏️' },
  { value: 'blended' as LearningStyle, label: 'Mix of both', desc: 'Alternate between explanations and practice', icon: '🔄' },
]

// ── Analysis Result ─────────────────────────────────────────────────────────

interface AnalysisResult {
  suggested_subject: string
  suggested_topics: string[]
  help_areas: string[]
  confidence: number
  reasoning: string
}

// ── Component ───────────────────────────────────────────────────────────────

export default function NewPlanPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('describe')

  // Step 1: Describe
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<PlanAttachment[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  // Step 2: Subject
  const [selectedSubject, setSelectedSubject] = useState<string>('')

  // Step 3: Topics
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [helpAreas, setHelpAreas] = useState<string[]>([])

  // Step 4: Proficiency Assessment (NEW)
  const [targetGrade, setTargetGrade] = useState<TargetGrade>('grade_3')
  const [proficiencyLevel, setProficiencyLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [topicConfidence, setTopicConfidence] = useState<Record<string, ConfidenceLevel>>({})

  // Step 5: Study Preferences (NEW)
  const [examTimeline, setExamTimeline] = useState<ExamTimeline>('may_june')
  const [studyMinutes, setStudyMinutes] = useState<number>(30)
  const [studyDays, setStudyDays] = useState<number>(3)
  const [learningStyle, setLearningStyle] = useState<LearningStyle>('blended')

  // General UI
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  // ── Derived Data ────────────────────────────────────────────────────────

  const subjects = Object.entries(CSEC_SUBJECTS).map(([key, subject]) => ({ key, ...subject }))

  const currentSubject = selectedSubject
    ? CSEC_SUBJECTS[selectedSubject as keyof typeof CSEC_SUBJECTS]
    : null

  const stepIndex = STEP_LABELS.indexOf(
    currentStep === 'describe' ? 'Describe'
      : currentStep === 'subject' ? 'Subject'
      : currentStep === 'topics' ? 'Topics'
      : currentStep === 'proficiency' ? 'Assess'
      : currentStep === 'preferences' ? 'Schedule'
      : 'Review'
  )

  // ── Depth Calculation ───────────────────────────────────────────────────

  const getDepthTier = (topic: string): 'foundational' | 'standard' | 'intensive' => {
    const confidence = topicConfidence[topic] || 'some_knowledge'
    if (confidence === 'no_exposure' || confidence === 'struggling') {
      return targetGrade === 'grade_3' ? 'standard' : 'foundational'
    }
    if (confidence === 'some_knowledge') return 'standard'
    return targetGrade === 'grade_1' ? 'standard' : 'intensive'
  }

  const getEstimatedWeeks = (): number => {
    const multiplier: Record<string, number> = { foundational: 2.5, standard: 1.5, intensive: 1 }
    const raw = selectedTopics.reduce((sum, t) => sum + multiplier[getDepthTier(t)], 0)
    const pacing = studyDays >= 5 ? 0.7 : studyDays >= 3 ? 1 : 1.5
    return Math.max(1, Math.round(raw * pacing))
  }

  const getMissingPrerequisites = (): { topic: string; missing: string[] }[] => {
    if (!selectedSubject) return []
    const result: { topic: string; missing: string[] }[] = []
    for (const topic of selectedTopics) {
      const prereqs = getPrerequisites(selectedSubject, topic)
      const missing = prereqs.filter(p => {
        // Missing if: not in selected topics, or selected but confidence is no_exposure
        return !selectedTopics.includes(p) || topicConfidence[p] === 'no_exposure'
      })
      if (missing.length > 0) result.push({ topic, missing })
    }
    return result
  }

  const getExpandableTopics = (): { topic: string; subtopics: string[] }[] => {
    if (!selectedSubject) return []
    return selectedTopics
      .filter(t => getDepthTier(t) === 'foundational')
      .map(t => ({ topic: t, subtopics: getSubtopics(selectedSubject, t) }))
      .filter(entry => entry.subtopics.length > 0)
  }

  const depthColors: Record<string, string> = {
    foundational: 'bg-red-100 text-red-800 border-red-200',
    standard: 'bg-blue-100 text-blue-800 border-blue-200',
    intensive: 'bg-green-100 text-green-800 border-green-200',
  }

  // ── Handlers ────────────────────────────────────────────────────────────

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
        headers: { 'Content-Type': 'application/json', ...(user?.id ? { 'x-user-id': user.id } : {}) },
        body: JSON.stringify({ description, attachments })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Analysis failed')

      setAnalysisResult(result)
      setHelpAreas(result.help_areas || [])

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

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    )
  }

  const handleGoToProficiency = () => {
    // Initialize confidence for newly-selected topics
    const updated = { ...topicConfidence }
    for (const t of selectedTopics) {
      if (!(t in updated)) updated[t] = 'some_knowledge'
    }
    // Remove de-selected topics
    for (const key of Object.keys(updated)) {
      if (!selectedTopics.includes(key)) delete updated[key]
    }
    setTopicConfidence(updated)
    setCurrentStep('proficiency')
  }

  const handleCreatePlan = async () => {
    if (!user || !selectedSubject || selectedTopics.length === 0) return

    setIsCreating(true)
    try {
      const wizardData: WizardData = {
        target_grade: targetGrade,
        proficiency_level: proficiencyLevel,
        topic_confidence: topicConfidence,
        exam_timeline: examTimeline,
        study_minutes_per_session: studyMinutes,
        study_days_per_week: studyDays,
        learning_style: learningStyle,
      }

      const planData = {
        user_id: user.id,
        subject: currentSubject?.name || selectedSubject,
        topics: selectedTopics,
        status: 'active' as const,
        description: description || undefined,
        help_areas: helpAreas.length > 0 ? helpAreas : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        wizard_data: wizardData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // savePlan tries Supabase first, falls back to localStorage on failure
      const saved = await savePlan(planData)
      router.push(`/plans/${saved.id}`)
    } catch (error) {
      console.error('Error creating study plan:', error)
      setError('Failed to create study plan. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  // ── Loading / Auth Gate ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  if (!user) return null

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Nav ─────────────────────────────────────────────── */}
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

        {/* ── Progress Stepper ──────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  i < stepIndex ? 'bg-green-600 text-white'
                    : i === stepIndex ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {i < stepIndex ? <CheckCircle className="h-5 w-5" /> : i + 1}
                </div>
                <span className={`ml-1.5 text-sm hidden sm:inline ${i === stepIndex ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`w-6 sm:w-10 h-0.5 mx-1 sm:mx-2 ${i < stepIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            STEP 1 — Describe
           ═══════════════════════════════════════════════════════ */}
        {currentStep === 'describe' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">What do you need help with?</h2>
              <p className="text-gray-600">
                Describe your study goals, challenges, or the topics you&apos;re struggling with.
                You can also upload past exams, notes, or any documents.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                  Describe Your Needs
                </CardTitle>
                <CardDescription>Tell us about what you want to learn or improve</CardDescription>
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
                <CardDescription>Upload past exams, notes, or documents that show what you need help with</CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload files={attachments} onFilesChange={setAttachments} userId={user.id} maxFiles={5} />
              </CardContent>
            </Card>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('subject')}>
                Skip to Manual Selection
              </Button>
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Analyze &amp; Suggest</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STEP 2 — Subject Selection
           ═══════════════════════════════════════════════════════ */}
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
                  <p className="text-sm text-blue-600">Confidence: {Math.round(analysisResult.confidence * 100)}%</p>
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
                      if (analysisResult?.suggested_subject !== subject.name) setSelectedTopics([])
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
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
              <Button onClick={() => setCurrentStep('topics')} disabled={!selectedSubject}>
                Continue<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STEP 3 — Topic Selection
           ═══════════════════════════════════════════════════════ */}
        {currentStep === 'topics' && currentSubject && (
          <div className="space-y-6">
            {helpAreas.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-yellow-900">Focus Areas Identified</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {helpAreas.map((area, i) => (
                      <li key={i} className="text-yellow-800 text-sm flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-yellow-600" />{area}
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
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
              <Button onClick={handleGoToProficiency} disabled={selectedTopics.length === 0}>
                Continue<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STEP 4 — Proficiency Assessment (NEW)
           ═══════════════════════════════════════════════════════ */}
        {currentStep === 'proficiency' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Let&apos;s assess your level</h2>
              <p className="text-gray-600">
                This helps us create a plan that&apos;s the right depth for you — not too basic, not too advanced.
              </p>
            </div>

            {/* Target Grade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2 text-blue-600" />
                  What grade are you aiming for?
                </CardTitle>
                <CardDescription>This determines how deep each topic goes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {GRADE_OPTIONS.map(g => (
                    <button
                      key={g.value}
                      onClick={() => setTargetGrade(g.value)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                        targetGrade === g.value
                          ? `${g.color} ring-2 ring-offset-2 ${g.ring} shadow-md`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-lg font-bold">{g.label}</div>
                      <div className="text-sm font-medium text-gray-600">{g.sublabel}</div>
                      <div className="text-xs text-gray-500 mt-1">{g.pct}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Overall Level */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                  How would you describe your overall level?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {LEVEL_OPTIONS.map(level => (
                    <button
                      key={level.value}
                      onClick={() => setProficiencyLevel(level.value)}
                      className={`w-full text-left p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        proficiencyLevel === level.value
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{level.icon}</span>
                        <div>
                          <div className="font-medium">{level.label}</div>
                          <div className="text-sm text-gray-600">{level.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Per-Topic Confidence */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <GraduationCap className="h-5 w-5 mr-2 text-purple-600" />
                  Rate your confidence in each topic
                </CardTitle>
                <CardDescription>
                  Be honest — this helps target exactly where you need the most support
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {selectedTopics.map(topic => (
                    <div key={topic} className="space-y-2">
                      <div className="font-medium text-sm text-gray-800">{topic}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {(Object.entries(CONFIDENCE_CONFIG) as [ConfidenceLevel, typeof CONFIDENCE_CONFIG[ConfidenceLevel]][]).map(([level, cfg]) => (
                          <button
                            key={level}
                            onClick={() => setTopicConfidence(prev => ({ ...prev, [topic]: level }))}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                              topicConfidence[topic] === level ? cfg.activeColor : cfg.color
                            }`}
                          >
                            {cfg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('topics')}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
              <Button onClick={() => setCurrentStep('preferences')}>
                Continue<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STEP 5 — Study Preferences (NEW)
           ═══════════════════════════════════════════════════════ */}
        {currentStep === 'preferences' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Set your study schedule</h2>
              <p className="text-gray-600">
                We&apos;ll pace your plan based on your availability and exam timeline.
              </p>
            </div>

            {/* Exam Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-red-600" />
                  When is your exam?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {EXAM_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setExamTimeline(opt.value)}
                      className={`w-full text-left p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        examTimeline === opt.value
                          ? `${opt.color} shadow-sm`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-sm text-gray-600">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Session Length */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-amber-600" />
                  How long can you study per session?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {SESSION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setStudyMinutes(opt.value)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                        studyMinutes === opt.value
                          ? 'border-amber-400 bg-amber-50 shadow-sm ring-2 ring-amber-300 ring-offset-1'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-lg font-bold">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Days Per Week */}
            <Card>
              <CardHeader>
                <CardTitle>How many days per week can you study?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <button
                      key={d}
                      onClick={() => setStudyDays(d)}
                      className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${
                        studyDays === d
                          ? 'bg-blue-600 text-white shadow-md scale-110'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 text-center mt-3">
                  {studyDays} day{studyDays > 1 ? 's' : ''} per week &middot; ~{studyDays * studyMinutes} minutes total
                </p>
              </CardContent>
            </Card>

            {/* Learning Style */}
            <Card>
              <CardHeader>
                <CardTitle>How do you prefer to learn?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {STYLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setLearningStyle(opt.value)}
                      className={`w-full text-left p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        learningStyle === opt.value
                          ? 'border-green-400 bg-green-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{opt.icon}</span>
                        <div>
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-sm text-gray-600">{opt.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('proficiency')}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
              <Button onClick={() => setCurrentStep('review')}>
                Continue<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STEP 6 — Review & Confirm
           ═══════════════════════════════════════════════════════ */}
        {currentStep === 'review' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Personalized Study Plan</h2>
              <p className="text-gray-600">
                We&apos;ve crafted a plan based on your level, goals, and schedule. Review and confirm.
              </p>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-lg font-bold text-blue-700">{currentSubject?.name}</div>
                <div className="text-xs text-blue-600 mt-1">Subject</div>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 text-center">
                <div className="text-lg font-bold text-indigo-700">
                  {GRADE_OPTIONS.find(g => g.value === targetGrade)?.label}
                </div>
                <div className="text-xs text-indigo-600 mt-1">Target</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <div className="text-lg font-bold text-amber-700">{getEstimatedWeeks()} weeks</div>
                <div className="text-xs text-amber-600 mt-1">Estimated</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-lg font-bold text-green-700">{selectedTopics.length} topics</div>
                <div className="text-xs text-green-600 mt-1">Selected</div>
              </div>
            </div>

            {/* Prerequisite Warnings */}
            {getMissingPrerequisites().length > 0 && (
              <Card className="border-amber-300 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-amber-900 text-base">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Prerequisite Gaps Detected
                  </CardTitle>
                  <CardDescription className="text-amber-700">
                    Some topics depend on others you haven&apos;t selected or lack confidence in.
                    We recommend adding them for a stronger foundation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getMissingPrerequisites().map(({ topic, missing }) => (
                      <div key={topic} className="text-sm">
                        <span className="font-medium text-amber-900">{topic}</span>
                        <span className="text-amber-700"> needs: </span>
                        {missing.map((m, i) => (
                          <button
                            key={m}
                            onClick={() => {
                              if (!selectedTopics.includes(m)) {
                                setSelectedTopics(prev => [...prev, m])
                                setTopicConfidence(prev => ({ ...prev, [m]: 'no_exposure' }))
                              }
                            }}
                            className="inline-flex items-center px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-xs font-medium hover:bg-amber-300 transition-colors mr-1"
                          >
                            + {m}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Topic Depth Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2 text-blue-600" />
                  Topic Breakdown
                </CardTitle>
                <CardDescription>Each topic&apos;s depth is calibrated to your confidence level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedTopics.map(topic => {
                    const confidence = topicConfidence[topic] || 'some_knowledge'
                    const depth = getDepthTier(topic)
                    const confCfg = CONFIDENCE_CONFIG[confidence]
                    const subtopics = getExpandableTopics().find(e => e.topic === topic)?.subtopics || []

                    return (
                      <div key={topic} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{topic}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${confCfg.activeColor}`}>
                              {confCfg.label}
                            </span>
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${depthColors[depth]}`}>
                            {depth.charAt(0).toUpperCase() + depth.slice(1)}
                          </span>
                        </div>
                        {subtopics.length > 0 && (
                          <div className="mt-2 pl-4 border-l-2 border-red-200">
                            <p className="text-xs text-red-700 font-medium mb-1">
                              Expanded into {subtopics.length} focused sub-lessons:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {subtopics.map(st => (
                                <span key={st} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                                  {st}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Schedule Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Your Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Exam: </span>
                    <span className="font-medium">
                      {examTimeline === 'may_june' ? 'May/June 2026' : examTimeline === 'january' ? 'January 2027' : 'No deadline'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Sessions: </span>
                    <span className="font-medium">{studyMinutes} min × {studyDays} days/week</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Learning style: </span>
                    <span className="font-medium">
                      {learningStyle === 'theory_first' ? 'Theory first' : learningStyle === 'practice_first' ? 'Practice first' : 'Blended'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Level: </span>
                    <span className="font-medium capitalize">{proficiencyLevel}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{description}</p>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('preferences')}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
              <Button onClick={handleCreatePlan} disabled={isCreating} size="lg" className="px-8">
                {isCreating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Plan...</>
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
