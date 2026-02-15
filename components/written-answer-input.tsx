'use client'

import { useState, useRef } from 'react'
import { Loader2, CheckCircle, XCircle, AlertTriangle, Send, RotateCcw } from 'lucide-react'

/**
 * WrittenAnswerInput — textarea + LLM grading for short answer / extended response questions.
 * 
 * Rendered inside coaching page question cards for non-MCQ question types.
 * Calls /api/ai/grade-answer to evaluate student answers against model answers.
 */

interface GradingResult {
  score: number
  maxScore: number
  feedback: string
  strengths: string[]
  improvements: string[]
  missingPoints: string[]
}

interface WrittenAnswerInputProps {
  /** The question text (plain text, stripped of markdown) */
  question: string
  /** The model answer text (optional — if available from the lesson content) */
  modelAnswer?: string
  /** Max marks for this question */
  marks?: number
  /** Subject name for context */
  subject?: string
  /** Topic name for context */
  topic?: string
  /** Question type — controls textarea size */
  type: 'shortanswer' | 'extended'
}

export default function WrittenAnswerInput({
  question,
  modelAnswer,
  marks = 10,
  subject,
  topic,
  type,
}: WrittenAnswerInputProps) {
  const [answer, setAnswer] = useState('')
  const [grading, setGrading] = useState<GradingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const minRows = type === 'extended' ? 8 : 4
  const placeholder = type === 'extended'
    ? 'Write your extended response here. Aim for a well-structured answer with an introduction, body paragraphs, and conclusion...'
    : 'Type your answer here...'

  const handleSubmit = async () => {
    if (!answer.trim() || loading) return

    setLoading(true)
    setError(null)
    setGrading(null)

    try {
      const res = await fetch('/api/ai/grade-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          modelAnswer: modelAnswer || '',
          studentAnswer: answer,
          marks,
          subject,
          topic,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Grading failed (${res.status})`)
      }

      const result = await res.json()
      setGrading(result)
    } catch (err: any) {
      setError(err.message || 'Failed to grade answer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setGrading(null)
    setError(null)
    textareaRef.current?.focus()
  }

  const scorePercent = grading ? (grading.score / grading.maxScore) * 100 : 0
  const scoreColor = scorePercent >= 70 ? 'text-green-700' : scorePercent >= 40 ? 'text-amber-700' : 'text-red-700'
  const scoreBg = scorePercent >= 70 ? 'bg-green-50 border-green-200' : scorePercent >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

  return (
    <div className="mt-4 space-y-3">
      {/* Divider */}
      <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide font-semibold">
        <span className="flex-1 border-t border-gray-200" />
        <span>✍️ Your Answer</span>
        <span className="flex-1 border-t border-gray-200" />
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        disabled={loading}
        className="w-full p-3 border border-gray-300 rounded-lg text-gray-800 bg-white
                   placeholder:text-gray-400 resize-y focus:outline-none focus:ring-2
                   focus:ring-blue-400 focus:border-blue-400 disabled:opacity-50
                   disabled:bg-gray-50 transition-colors text-sm leading-relaxed"
      />

      {/* Submit / retry buttons */}
      <div className="flex items-center gap-3">
        {!grading ? (
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-white bg-blue-600 rounded-lg hover:bg-blue-700
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                       shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Grading...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit for Grading
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200
                       transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        )}

        {marks && (
          <span className="text-xs text-gray-400">
            {marks} mark{marks > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grading result */}
      {grading && (
        <div className={`rounded-lg border-2 ${scoreBg} overflow-hidden`}>
          {/* Score header */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-inherit">
            <div className="flex items-center gap-2">
              {scorePercent >= 70 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : scorePercent >= 40 ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`text-lg font-bold ${scoreColor}`}>
                {grading.score}/{grading.maxScore}
              </span>
            </div>
            <span className={`text-sm font-medium ${scoreColor}`}>
              {scorePercent >= 70 ? 'Well Done!' : scorePercent >= 40 ? 'Fair Attempt' : 'Needs Improvement'}
            </span>
          </div>

          {/* Feedback body */}
          <div className="p-4 space-y-3">
            {/* Overall feedback */}
            {grading.feedback && (
              <p className="text-sm text-gray-700 leading-relaxed">{grading.feedback}</p>
            )}

            {/* Strengths */}
            {grading.strengths?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-1.5">
                  ✅ Strengths
                </h4>
                <ul className="space-y-1">
                  {grading.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements */}
            {grading.improvements?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1.5">
                  💡 Areas to Improve
                </h4>
                <ul className="space-y-1">
                  {grading.improvements.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing points */}
            {grading.missingPoints?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1.5">
                  📝 Key Points Missed
                </h4>
                <ul className="space-y-1">
                  {grading.missingPoints.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
