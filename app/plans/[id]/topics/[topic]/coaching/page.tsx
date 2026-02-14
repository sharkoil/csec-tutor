'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, BookOpen, Lightbulb, Target, CheckCircle, GraduationCap, PenTool, Clock, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Zap, Eye, EyeOff } from 'lucide-react'
import { fetchPlan as fetchPlanFromStorage, fetchTopicProgress, saveProgress } from '@/lib/plan-storage'
import { renderMathInText, containsMath } from '@/components/math-renderer'

// Enhanced CoachingResponse with narrative content and fallback info
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
  // New textbook format fields
  narrativeContent?: string
  model?: string
  isFallback?: boolean
}

/**
 * Collapsible answer reveal toggle.
 * Answers are hidden by default — the student clicks to reveal them.
 */
function AnswerReveal({ children, label = 'Show Answer' }: { children: React.ReactNode; label?: string }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="my-4">
      <button
        onClick={() => setRevealed(!revealed)}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-200 border shadow-sm
          ${revealed
            ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 hover:border-gray-400'
          }`}
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {revealed ? 'Hide Answer' : label}
      </button>
      {revealed && (
        <div className="mt-3 pl-1 border-l-4 border-green-300">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Premium markdown renderer with question format detection
 * 
 * Detects the Question Format Library patterns (blockquote-based questions,
 * answer cards, worked examples, comparisons) and renders them as styled
 * interactive cards. Falls back to standard markdown for non-question content.
 */
function renderMarkdown(markdown: string): React.ReactNode {
  if (!markdown) return null
  
  const lines = markdown.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeContent: string[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let blockquoteLines: string[] = []
  let answerKeyElements: React.ReactNode[] = []
  let collectingAnswerKey = false

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul'
      elements.push(
        <ListTag key={`list-${elements.length}`} className={listType === 'ol' ? 'list-decimal list-inside space-y-2 my-4' : 'list-disc list-inside space-y-2 my-4'}>
          {listItems.map((item, i) => (
            <li key={i} className="text-gray-700 leading-relaxed">{formatInline(item)}</li>
          ))}
        </ListTag>
      )
      listItems = []
      listType = null
    }
  }

  /**
   * Detect what kind of question card a blockquote represents
   */
  const detectBlockquoteType = (content: string): 'mcq' | 'truefalse' | 'fillin' | 'shortanswer' | 'error' | 'rewrite' | 'worked' | 'practice-set' | 'extended' | 'comparison' | 'plain' => {
    const lower = content.toLowerCase()
    if (lower.includes('**worked example') || lower.includes('**problem:') && lower.includes('**step 1:')) return 'worked'
    if (lower.includes('**practice problem 1') || lower.includes('📋 **answer key')) return 'practice-set'
    if (lower.includes('❌ **incorrect:') && lower.includes('✅ **correct:')) return 'comparison'
    if (lower.includes('*(multiple choice') || (lower.includes('- (a)') && lower.includes('- (b)'))) return 'mcq'
    if (lower.includes('*(true or false)') || lower.includes('*(true/false)')) return 'truefalse'
    if (lower.includes('*(fill in the blank)') || lower.includes('______')) return 'fillin'
    if (lower.includes('*(error identification)') || lower.includes('find and correct')) return 'error'
    if (lower.includes('*(rewrite)') || lower.includes('rewrite the following')) return 'rewrite'
    if (lower.includes('*(extended response') || lower.includes('**model answer:**') || lower.includes('📝 **examiner notes:**')) return 'extended'
    if (lower.includes('*(short answer') || lower.includes('✅ **answer:**')) return 'shortanswer'
    return 'plain'
  }

  /**
   * Get visual theme for each question type
   */
  const getCardTheme = (type: string): { border: string; bg: string; icon: string; label: string; headerBg: string } => {
    switch (type) {
      case 'mcq': return { border: 'border-blue-300', bg: 'bg-blue-50', icon: '🔵', label: 'Multiple Choice', headerBg: 'bg-blue-100' }
      case 'truefalse': return { border: 'border-purple-300', bg: 'bg-purple-50', icon: '⚖️', label: 'True or False', headerBg: 'bg-purple-100' }
      case 'fillin': return { border: 'border-teal-300', bg: 'bg-teal-50', icon: '✏️', label: 'Fill in the Blank', headerBg: 'bg-teal-100' }
      case 'shortanswer': return { border: 'border-indigo-300', bg: 'bg-indigo-50', icon: '📝', label: 'Short Answer', headerBg: 'bg-indigo-100' }
      case 'error': return { border: 'border-orange-300', bg: 'bg-orange-50', icon: '🔍', label: 'Error Identification', headerBg: 'bg-orange-100' }
      case 'rewrite': return { border: 'border-cyan-300', bg: 'bg-cyan-50', icon: '🔄', label: 'Rewrite', headerBg: 'bg-cyan-100' }
      case 'worked': return { border: 'border-emerald-400', bg: 'bg-emerald-50', icon: '🧑‍🏫', label: 'Worked Example', headerBg: 'bg-emerald-100' }
      case 'practice-set': return { border: 'border-amber-300', bg: 'bg-amber-50', icon: '✏️', label: 'Practice Problems', headerBg: 'bg-amber-100' }
      case 'extended': return { border: 'border-rose-300', bg: 'bg-rose-50', icon: '📄', label: 'Extended Response', headerBg: 'bg-rose-100' }
      case 'comparison': return { border: 'border-yellow-300', bg: 'bg-yellow-50', icon: '⚡', label: 'Correct vs Incorrect', headerBg: 'bg-yellow-100' }
      default: return { border: 'border-gray-300', bg: 'bg-gray-50', icon: '💬', label: '', headerBg: 'bg-gray-100' }
    }
  }

  /**
   * Render individual lines within a question card (answers, steps, options, annotations)
   */
  const renderCardLines = (rawLines: string[], type: string): React.ReactNode => {
    const contentElements: React.ReactNode[] = []

    for (let j = 0; j < rawLines.length; j++) {
      const line = rawLines[j]

      // Answer line — green highlight box
      if (line.match(/^✅\s*\*\*Answer:?\*\*/i)) {
        contentElements.push(
          <div key={`answer-${j}`} className="lesson-answer-card mt-4 mb-2 p-3 bg-green-50 border border-green-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-green-600 text-lg flex-shrink-0 mt-0.5">✅</span>
              <div className="text-green-900 font-medium leading-relaxed">{formatInline(line.replace(/^✅\s*\*\*Answer:?\*\*\s*/i, ''))}</div>
            </div>
          </div>
        )
      }
      // Model answer block
      else if (line.match(/^✅\s*\*\*Model Answer:?\*\*/i)) {
        contentElements.push(
          <div key={`model-${j}`} className="mt-4 mb-2">
            <div className="text-green-700 font-semibold mb-2 flex items-center gap-2">
              <span>✅</span> Model Answer
            </div>
          </div>
        )
      }
      // Key insight — amber callout
      else if (line.match(/^💡\s*\*\*Key Insight:?\*\*/i)) {
        contentElements.push(
          <div key={`insight-${j}`} className="lesson-insight-card mt-3 mb-2 p-3 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 text-lg flex-shrink-0 mt-0.5">💡</span>
              <div className="text-amber-900 leading-relaxed">{formatInline(line.replace(/^💡\s*\*\*Key Insight:?\*\*\s*/i, ''))}</div>
            </div>
          </div>
        )
      }
      // Examiner notes — rose callout
      else if (line.match(/^📝\s*\*\*Examiner Notes?:?\*\*/i)) {
        contentElements.push(
          <div key={`examiner-${j}`} className="mt-3 mb-2 p-3 bg-rose-50 border border-rose-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-rose-600 text-lg flex-shrink-0 mt-0.5">📝</span>
              <div className="text-rose-900 leading-relaxed">{formatInline(line.replace(/^📝\s*\*\*Examiner Notes?:?\*\*\s*/i, ''))}</div>
            </div>
          </div>
        )
      }
      // Annotation lines (📝 italic)
      else if (line.match(/^📝\s*\*/)) {
        contentElements.push(
          <div key={`annotation-${j}`} className="mt-2 mb-1 pl-4 py-1 border-l-2 border-blue-300 text-blue-800 text-sm italic">
            {formatInline(line.replace(/^📝\s*/, ''))}
          </div>
        )
      }
      // Answer key header
      else if (line.match(/^📋\s*\*\*Answer Key:?\*\*/i)) {
        contentElements.push(
          <div key={`ak-header-${j}`} className="mt-6 mb-3 pt-4 border-t-2 border-green-300">
            <div className="text-green-700 font-bold text-lg flex items-center gap-2">
              <span>📋</span> Answer Key
            </div>
          </div>
        )
      }
      // Step lines in worked examples  
      else if (line.match(/^\*\*Step \d+:?\*\*/i)) {
        const stepMatch = line.match(/^\*\*Step (\d+):?\*\*\s*(.*)/i)
        contentElements.push(
          <div key={`step-${j}`} className="lesson-step-card flex items-start gap-3 my-2 pl-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mt-0.5">
              {stepMatch?.[1] || ''}
            </div>
            <div className="text-gray-800 leading-relaxed pt-0.5">{formatInline(stepMatch?.[2] || line)}</div>
          </div>
        )
      }
      // Incorrect comparison
      else if (line.match(/^❌\s*\*\*Incorrect:?\*\*/i)) {
        contentElements.push(
          <div key={`wrong-${j}`} className="mt-3 mb-1 p-3 bg-red-50 border border-red-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-lg flex-shrink-0">❌</span>
              <div className="text-red-900 leading-relaxed">{formatInline(line.replace(/^❌\s*\*\*Incorrect:?\*\*\s*/i, ''))}</div>
            </div>
          </div>
        )
      }
      // Correct comparison
      else if (line.match(/^✅\s*\*\*Correct:?\*\*/i)) {
        contentElements.push(
          <div key={`right-${j}`} className="mt-1 mb-1 p-3 bg-green-50 border border-green-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-green-600 text-lg flex-shrink-0">✅</span>
              <div className="text-green-900 leading-relaxed">{formatInline(line.replace(/^✅\s*\*\*Correct:?\*\*\s*/i, ''))}</div>
            </div>
          </div>
        )
      }
      // Why explanation in comparisons
      else if (line.match(/^💡\s*\*\*Why:?\*\*/i)) {
        contentElements.push(
          <div key={`why-${j}`} className="mt-1 mb-2 p-3 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 text-lg flex-shrink-0">💡</span>
              <div className="text-amber-900 leading-relaxed">{formatInline(line.replace(/^💡\s*\*\*Why:?\*\*\s*/i, ''))}</div>
            </div>
          </div>
        )
      }
      // MCQ options — styled as pill selectors
      else if (line.match(/^- \([A-Da-d]\)\s+/)) {
        const optionMatch = line.match(/^- \(([A-Da-d])\)\s+(.*)/)
        contentElements.push(
          <div key={`opt-${j}`} className="lesson-mcq-option flex items-start gap-3 my-1.5 ml-2 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold border border-gray-300">
              {optionMatch?.[1]?.toUpperCase() || ''}
            </span>
            <span className="text-gray-800 leading-relaxed pt-0.5">{formatInline(optionMatch?.[2] || line)}</span>
          </div>
        )
      }
      // Practice problem header
      else if (line.match(/^\*\*Practice Problem \d+\*\*/i)) {
        contentElements.push(
          <div key={`pp-${j}`} className="mt-4 mb-1 font-semibold text-gray-900">{formatInline(line)}</div>
        )
      }
      // Numbered answer key items (1. Answer...)
      else if (line.match(/^\d+\.\s+/) && type === 'practice-set') {
        contentElements.push(
          <div key={`ak-item-${j}`} className="py-1.5 pl-4 border-l-2 border-green-200 ml-2 my-1 text-gray-800">
            {formatInline(line)}
          </div>
        )
      }
      // Problem statement
      else if (line.match(/^\*\*Problem:?\*\*/i)) {
        contentElements.push(
          <div key={`problem-${j}`} className="mt-2 mb-3 p-3 bg-gray-100 border border-gray-300 rounded-lg font-medium text-gray-900">
            {formatInline(line.replace(/^\*\*Problem:?\*\*\s*/i, ''))}
          </div>
        )
      }
      // Regular list items inside cards
      else if (line.match(/^[-*]\s+/)) {
        contentElements.push(
          <div key={`li-${j}`} className="flex items-start gap-2 my-1 ml-2">
            <span className="text-gray-400 mt-1.5 flex-shrink-0">•</span>
            <span className="text-gray-700 leading-relaxed">{formatInline(line.replace(/^[-*]\s+/, ''))}</span>
          </div>
        )
      }
      // Horizontal rule inside card (separator)
      else if (line.match(/^[-*_]{3,}$/)) {
        contentElements.push(
          <hr key={`hr-${j}`} className="my-4 border-gray-200" />
        )
      }
      // Empty lines
      else if (line.trim() === '') {
        contentElements.push(<div key={`space-${j}`} className="h-2" />)
      }
      // Everything else — paragraph
      else {
        contentElements.push(
          <div key={`p-${j}`} className="text-gray-800 leading-relaxed my-1">{formatInline(line)}</div>
        )
      }
    }

    return contentElements
  }

  /**
   * Render card content with automatic answer reveal toggle.
   * Detects where answers begin and wraps them in a collapsible AnswerReveal.
   */
  const renderCardContent = (rawLines: string[], type: string): React.ReactNode => {
    let answerStart = -1
    for (let j = 0; j < rawLines.length; j++) {
      const ln = rawLines[j]
      if (
        ln.match(/^✅\s*\*\*Answer:?\*\*/i) ||
        ln.match(/^✅\s*\*\*Model Answer:?\*\*/i) ||
        ln.match(/^📋\s*\*\*Answer Key:?\*\*/i)
      ) {
        answerStart = (j > 0 && rawLines[j - 1].match(/^[-*_]{3,}$/)) ? j - 1 : j
        break
      }
      if (type === 'mcq' && ln.match(/^📝\s*\*/)) {
        answerStart = j
        break
      }
    }
    if (answerStart === -1) return renderCardLines(rawLines, type)

    const questionLines = rawLines.slice(0, answerStart)
    const answerLines = rawLines.slice(answerStart)
    const revealLabel = type === 'practice-set' ? 'Show Answer Key' :
                        type === 'extended' ? 'Show Model Answer' : 'Show Answer'

    return (
      <>
        {renderCardLines(questionLines, type)}
        <AnswerReveal label={revealLabel}>
          {renderCardLines(answerLines, type)}
        </AnswerReveal>
      </>
    )
  }

  /**
   * Flush accumulated blockquote lines, detecting question type and rendering as a styled card
   */
  const flushBlockquote = () => {
    if (blockquoteLines.length === 0) return

    const rawContent = blockquoteLines.join('\n')
    const strippedLines = blockquoteLines.map(l => l.replace(/^>\s?/, ''))
    const type = detectBlockquoteType(rawContent)
    const theme = getCardTheme(type)

    if (type === 'plain') {
      // Plain blockquote — render as before
      elements.push(
        <blockquote key={`bq-${elements.length}`} className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-600 bg-blue-50 rounded-r-lg">
          {strippedLines.map((line, i) => (
            <div key={i} className="my-0.5">{formatInline(line)}</div>
          ))}
        </blockquote>
      )
    } else {
      // Styled question card
      elements.push(
        <div key={`card-${elements.length}`} className={`lesson-question-card ${theme.bg} border-2 ${theme.border} rounded-xl my-6 overflow-hidden shadow-sm`}>
          {/* Card type badge */}
          {theme.label && (
            <div className={`${theme.headerBg} px-4 py-2 flex items-center gap-2 border-b ${theme.border}`}>
              <span className="text-lg">{theme.icon}</span>
              <span className="text-sm font-semibold text-gray-700 tracking-wide uppercase">{theme.label}</span>
            </div>
          )}
          {/* Card body */}
          <div className="p-5">
            {renderCardContent(strippedLines, type)}
          </div>
        </div>
      )
    }

    blockquoteLines = []
  }

  const flushAnswerKey = () => {
    if (answerKeyElements.length > 0) {
      elements.push(
        <AnswerReveal key={`reveal-ak-${elements.length}`} label="Show Answer Key">
          <>{answerKeyElements}</>
        </AnswerReveal>
      )
      answerKeyElements = []
    }
    collectingAnswerKey = false
  }

  const formatInline = (text: string): React.ReactNode => {
    // First check if text contains math - if so, process with math renderer
    if (containsMath(text)) {
      return renderMathInText(text)
    }
    
    // Process inline formatting: bold, italic, inline code, links
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    
    // Combined pattern: bold, italic, inline code
    const inlineRegex = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*(.+?)\*|_([^_]+)_/g
    let match
    
    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      if (match[1] || match[2]) {
        // Bold
        parts.push(<strong key={match.index} className="font-semibold text-gray-900">{match[1] || match[2]}</strong>)
      } else if (match[3]) {
        // Inline code
        parts.push(<code key={match.index} className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-sm font-mono text-pink-700">{match[3]}</code>)
      } else if (match[4] || match[5]) {
        // Italic
        parts.push(<em key={match.index} className="italic text-gray-600">{match[4] || match[5]}</em>)
      }
      lastIndex = match.index + match[0].length
    }
    
    if (parts.length > 0) {
      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex))
      }
      return parts
    }
    
    return text
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // === Answer key collection mode ===
    if (collectingAnswerKey) {
      if (line.startsWith('#') || line.startsWith('>') || line.startsWith('```')) {
        flushAnswerKey()
        // Fall through to normal processing
      } else {
        if (line.trim() === '') {
          answerKeyElements.push(<div key={`ak-space-${i}`} className="h-2" />)
        } else if (line.match(/^\d+\.\s+/)) {
          answerKeyElements.push(
            <div key={`ak-item-${i}`} className="py-1.5 pl-4 border-l-2 border-green-200 ml-2 my-1 text-gray-800">
              {formatInline(line)}
            </div>
          )
        } else if (line.match(/^[-*]\s+/)) {
          answerKeyElements.push(
            <div key={`ak-li-${i}`} className="flex items-start gap-2 my-1 ml-6">
              <span className="text-gray-400 mt-1.5 flex-shrink-0">•</span>
              <span className="text-gray-700 leading-relaxed">{formatInline(line.replace(/^[-*]\s+/, ''))}</span>
            </div>
          )
        } else {
          answerKeyElements.push(
            <p key={`ak-p-${i}`} className="pl-4 ml-2 text-gray-700 leading-relaxed">
              {formatInline(line)}
            </p>
          )
        }
        continue
      }
    }

    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushBlockquote()
        elements.push(
          <pre key={`code-${i}`} className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono leading-relaxed">
            <code>{codeContent.join('\n')}</code>
          </pre>
        )
        codeContent = []
        inCodeBlock = false
      } else {
        flushList()
        flushBlockquote()
        inCodeBlock = true
      }
      continue
    }
    
    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }

    // Blockquote accumulation — collect consecutive > lines for card rendering
    if (line.startsWith('>')) {
      flushList()
      blockquoteLines.push(line)
      continue
    } else if (blockquoteLines.length > 0) {
      // End of blockquote block
      flushBlockquote()
    }

    // "Wrong → Right" comparison OUTSIDE blockquotes (in Common Mistakes section)
    if (line.match(/^❌\s*\*\*Incorrect:?\*\*/i)) {
      flushList()
      elements.push(
        <div key={`wrong-${i}`} className="mt-3 mb-1 p-3 bg-red-50 border border-red-300 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg flex-shrink-0">❌</span>
            <div className="text-red-900 leading-relaxed">{formatInline(line.replace(/^❌\s*\*\*Incorrect:?\*\*\s*/i, ''))}</div>
          </div>
        </div>
      )
      continue
    }
    if (line.match(/^✅\s*\*\*Correct:?\*\*/i)) {
      flushList()
      elements.push(
        <div key={`right-${i}`} className="mt-1 mb-1 p-3 bg-green-50 border border-green-300 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-green-600 text-lg flex-shrink-0">✅</span>
            <div className="text-green-900 leading-relaxed">{formatInline(line.replace(/^✅\s*\*\*Correct:?\*\*\s*/i, ''))}</div>
          </div>
        </div>
      )
      continue
    }
    if (line.match(/^💡\s*\*\*Why:?\*\*/i)) {
      flushList()
      elements.push(
        <div key={`why-${i}`} className="mt-1 mb-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 text-lg flex-shrink-0">💡</span>
            <div className="text-amber-900 leading-relaxed">{formatInline(line.replace(/^💡\s*\*\*Why:?\*\*\s*/i, ''))}</div>
          </div>
        </div>
      )
      continue
    }

    // Standalone answer line outside blockquotes — hidden by default
    if (line.match(/^✅\s*\*\*Answer:?\*\*/i)) {
      flushList()
      elements.push(
        <AnswerReveal key={`reveal-answer-${i}`} label="Show Answer">
          <div className="lesson-answer-card p-3 bg-green-50 border border-green-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-green-600 text-lg flex-shrink-0 mt-0.5">✅</span>
              <div className="text-green-900 font-medium leading-relaxed">{formatInline(line.replace(/^✅\s*\*\*Answer:?\*\*\s*/i, ''))}</div>
            </div>
          </div>
        </AnswerReveal>
      )
      continue
    }

    // Key insight outside blockquotes
    if (line.match(/^💡\s*\*\*Key Insight:?\*\*/i)) {
      flushList()
      elements.push(
        <div key={`insight-${i}`} className="lesson-insight-card mt-3 mb-2 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 text-lg flex-shrink-0 mt-0.5">💡</span>
            <div className="text-amber-900 leading-relaxed">{formatInline(line.replace(/^💡\s*\*\*Key Insight:?\*\*\s*/i, ''))}</div>
          </div>
        </div>
      )
      continue
    }

    // Step lines outside blockquotes (in guided practice)
    if (line.match(/^\*\*Step \d+:?\*\*/i)) {
      flushList()
      const stepMatch = line.match(/^\*\*Step (\d+):?\*\*\s*(.*)/i)
      elements.push(
        <div key={`step-${i}`} className="lesson-step-card flex items-start gap-3 my-2 pl-2">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mt-0.5">
            {stepMatch?.[1] || ''}
          </div>
          <div className="text-gray-800 leading-relaxed pt-0.5">{formatInline(stepMatch?.[2] || line)}</div>
        </div>
      )
      continue
    }

    // Answer key header outside blockquotes — start collecting for reveal toggle
    if (line.match(/^📋\s*\*\*Answer Key:?\*\*/i)) {
      flushList()
      collectingAnswerKey = true
      answerKeyElements = []
      answerKeyElements.push(
        <div key={`ak-${i}`} className="mt-2 mb-3 pt-4 border-t-2 border-green-300">
          <div className="text-green-700 font-bold text-lg flex items-center gap-2">
            <span>📋</span> Answer Key
          </div>
        </div>
      )
      continue
    }

    // Annotation lines outside blockquotes
    if (line.match(/^📝\s*.+/)) {
      flushList()
      elements.push(
        <div key={`annot-${i}`} className="mt-2 mb-1 pl-4 py-1.5 border-l-2 border-blue-300 text-blue-800 text-sm italic bg-blue-50 rounded-r-lg">
          {formatInline(line.replace(/^📝\s*/, ''))}
        </div>
      )
      continue
    }

    // Headers
    if (line.startsWith('#### ')) {
      flushList()
      elements.push(<h4 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-3">{formatInline(line.slice(5))}</h4>)
    } else if (line.startsWith('### ')) {
      flushList()
      elements.push(<h3 key={i} className="text-xl font-bold text-gray-900 mt-8 mb-4">{formatInline(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      flushList()
      elements.push(<h2 key={i} className="text-2xl font-bold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">{formatInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      flushList()
      elements.push(<h1 key={i} className="text-3xl font-bold text-gray-900 mt-6 mb-6">{formatInline(line.slice(2))}</h1>)
    }
    // Unordered list
    else if (line.match(/^[-*]\s+/)) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      listItems.push(line.replace(/^[-*]\s+/, ''))
    }
    // Ordered list
    else if (line.match(/^\d+\.\s+/)) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      listItems.push(line.replace(/^\d+\.\s+/, ''))
    }
    // Horizontal rule
    else if (line.match(/^[-*_]{3,}$/)) {
      flushList()
      elements.push(<hr key={i} className="my-8 border-gray-200" />)
    }
    // Empty line
    else if (line.trim() === '') {
      flushList()
    }
    // Table rows (| col | col |)
    else if (line.match(/^\|.+\|$/)) {
      flushList()
      const cells = line.split('|').filter(c => c.trim() !== '')
      // Skip separator rows (|---|---|)
      if (cells.every(c => c.trim().match(/^[-:]+$/))) continue
      const isHeader = i + 1 < lines.length && lines[i + 1]?.match(/^\|[-|: ]+\|$/)
      const gridCols = cells.length <= 2 ? 'grid-cols-2' : cells.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
      elements.push(
        <div key={`tr-${i}`} className={`grid ${gridCols} gap-2 px-3 py-2 border-b border-gray-200 ${isHeader ? 'font-semibold bg-gray-50' : ''}`}>
          {cells.map((cell, ci) => (
            <div key={ci} className="text-sm text-gray-800 px-2">{formatInline(cell.trim())}</div>
          ))}
        </div>
      )
    }
    // Regular paragraph
    else {
      flushList()
      elements.push(<p key={i} className="text-gray-700 leading-relaxed mb-4">{formatInline(line)}</p>)
    }
  }
  
  flushList()
  flushBlockquote()
  flushAnswerKey()
  
  return elements
}

/**
 * Split content into pages based on section headers (## or ###)
 * Each major section becomes a page for easier reading
 */
function paginateContent(markdown: string): string[] {
  if (!markdown) return []
  
  // Split by major headers (## level)
  const sections = markdown.split(/(?=^## )/gm)
  const pages: string[] = []
  let currentPage = ''
  
  for (const section of sections) {
    // If adding this section would make the page too long, start a new page
    // Aim for roughly 800-1200 words per page
    const wordCount = section.split(/\s+/).length
    const currentWordCount = currentPage.split(/\s+/).length
    
    if (currentPage && currentWordCount + wordCount > 1000) {
      pages.push(currentPage.trim())
      currentPage = section
    } else {
      currentPage += '\n\n' + section
    }
  }
  
  if (currentPage.trim()) {
    pages.push(currentPage.trim())
  }
  
  // If we only have 1 page but it's very long, split by ### headers
  if (pages.length === 1 && pages[0].split(/\s+/).length > 1200) {
    const subSections = pages[0].split(/(?=^### )/gm)
    const subPages: string[] = []
    let subCurrentPage = ''
    
    for (const sub of subSections) {
      const wordCount = sub.split(/\s+/).length
      const currentWordCount = subCurrentPage.split(/\s+/).length
      
      if (subCurrentPage && currentWordCount + wordCount > 800) {
        subPages.push(subCurrentPage.trim())
        subCurrentPage = sub
      } else {
        subCurrentPage += '\n\n' + sub
      }
    }
    
    if (subCurrentPage.trim()) {
      subPages.push(subCurrentPage.trim())
    }
    
    return subPages.length > 1 ? subPages : pages
  }
  
  return pages
}

// Loading messages for kids - encouraging and fun
const LOADING_MESSAGES = [
  { text: "Preparing your personalized lesson...", emoji: "📚" },
  { text: "Getting you ready for success!", emoji: "🌟" },
  { text: "Our AI tutor is crafting your content...", emoji: "🤖" },
  { text: "Loading the best examples for you...", emoji: "💡" },
  { text: "Making learning fun and easy...", emoji: "🎯" },
  { text: "Almost there! Great things take time...", emoji: "⏳" },
  { text: "Building your path to excellence...", emoji: "🏆" },
  { text: "Connecting the dots for you...", emoji: "🔗" },
  { text: "You're going to ace this topic!", emoji: "💪" },
  { text: "Putting together something special...", emoji: "✨" },
]

export default function CoachingPage({ params }: { params: Promise<{ id: string; topic: string }> }) {
  const { id: planId, topic: encodedTopic } = use(params)
  const { user, loading } = useAuth()
  const router = useRouter()
  const [plan, setPlan] = useState<any>(null)
  const [coaching, setCoaching] = useState<CoachingResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set([0])) // First example expanded by default
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [isLoadingReview, setIsLoadingReview] = useState(false)
  const [reviewError, setReviewError] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const topic = decodeURIComponent(encodedTopic)
  
  // Cycle through loading messages every 3 seconds
  useEffect(() => {
    if (!isGenerating) return
    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isGenerating])

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
      // Unified fetch: tries Supabase first, falls back to localStorage
      const planData = await fetchPlanFromStorage(user!.id, planId)

      if (!planData) {
        router.push('/dashboard')
        return
      }

      if (!planData.topics.includes(topic)) {
        router.push(`/plans/${planId}`)
        return
      }

      setPlan(planData)

      // Check if coaching is already completed
      const progress = await fetchTopicProgress(user!.id, planId, topic)
      if (progress?.coaching_completed) {
        setIsReviewMode(true)
        loadCachedLesson(planData.subject, planData.wizard_data)
      }
    } catch (error) {
      console.error('Error fetching plan:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Load cached lesson content (for review mode)
   */
  const loadCachedLesson = async (subject: string, wizardData?: any) => {
    setIsLoadingReview(true)
    setReviewError(false)
    try {
      const response = await fetch('/api/ai/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          topic,
          cacheOnly: true,
          userId: user?.id,
          wizardData: wizardData || plan?.wizard_data || undefined
        })
      })

      if (!response.ok) throw new Error('Failed to load cached lesson')

      const coachingData = await response.json()
      if (coachingData.error) throw new Error(coachingData.error)

      setCoaching(coachingData)
    } catch (error) {
      console.error('Error loading cached lesson:', error)
      setReviewError(true)
    } finally {
      setIsLoadingReview(false)
    }
  }

  const generateCoaching = async () => {
    if (!plan) return

    setIsGenerating(true)
    setGenerationError(null)
    try {
      // Call the server-side API route for OpenRouter
      const response = await fetch('/api/ai/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: plan.subject,
          topic,
          userLevel: 'intermediate',
          userId: user?.id,
          wizardData: plan.wizard_data || undefined
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
      setGenerationError('Could not generate the personalized lesson. Please retry.')
    } finally {
      setIsGenerating(false)
    }
  }

  const completeCoaching = async () => {
    try {
      await saveProgress(user!.id, planId, topic, {
        coaching_completed: true,
        practice_completed: false,
        exam_completed: false,
      })
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
            <h2 className="text-3xl font-bold text-gray-900">
              {isReviewMode ? 'Review: ' : ''}Fundamentals Coaching
            </h2>
          </div>
          <p className="text-lg text-gray-600">
            {isReviewMode 
              ? `Reviewing your saved lesson on ${topic}. You can come back here anytime.`
              : `Master the core concepts of ${topic} with personalized AI coaching`
            }
          </p>
        </div>

        {/* Loading state for review mode */}
        {isLoadingReview && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="relative mx-auto w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-25"></div>
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading your lesson...</h3>
              <p className="text-gray-500 text-sm">Retrieving your saved content for {topic}</p>
            </CardContent>
          </Card>
        )}

        {/* Review mode error — offer to regenerate */}
        {reviewError && !coaching && !isGenerating && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <span>Saved Lesson Not Found</span>
              </CardTitle>
              <CardDescription>
                We couldn't load your saved lesson from cache. Review mode now only loads saved lessons
                to avoid unnecessary inference costs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => loadCachedLesson(plan.subject, plan?.wizard_data)} size="lg" className="w-full" variant="outline">
                Retry Loading Saved Lesson
              </Button>
              <p className="text-xs text-gray-500 text-center">
                If this keeps happening, the lessons table may not be set up in Supabase yet.
              </p>
            </CardContent>
          </Card>
        )}

        {generationError && !coaching && !isGenerating && !isLoadingReview && !reviewError && (
          <Card className="border-red-300">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <span>Generation Failed</span>
              </CardTitle>
              <CardDescription>{generationError}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={generateCoaching} size="lg" className="w-full">
                Retry Generating Lesson
              </Button>
            </CardContent>
          </Card>
        )}

        {!coaching && !isGenerating && !isLoadingReview && !reviewError && !generationError && (
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
          <Card className="overflow-hidden">
            <CardContent className="text-center py-12">
              <div className="relative">
                {/* Animated spinner with pulse effect */}
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-25"></div>
                  <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                  </div>
                </div>
                
                {/* Animated message */}
                <div className="h-20 flex flex-col items-center justify-center">
                  <span className="text-4xl mb-3 animate-bounce">
                    {LOADING_MESSAGES[loadingMessageIndex].emoji}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 transition-opacity duration-500">
                    {LOADING_MESSAGES[loadingMessageIndex].text}
                  </h3>
                </div>
                
                {/* Progress dots */}
                <div className="flex justify-center space-x-2 mt-4">
                  {LOADING_MESSAGES.slice(0, 5).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i === loadingMessageIndex % 5 
                          ? 'bg-blue-600 scale-125' 
                          : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
                
                <p className="text-gray-500 text-sm mt-6">
                  This usually takes 30-60 seconds for a complete lesson
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {coaching && (
          <div className="space-y-6">
            {/* Fallback Mode Warning Banner */}
            {coaching.isFallback && (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="flex items-center space-x-3 py-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-amber-800 font-medium">Using Free AI Model</p>
                    <p className="text-amber-700 text-sm">
                      Our premium credits are temporarily exhausted. Content quality may vary slightly.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* NEW: Narrative Textbook Content with Pagination */}
            {coaching.narrativeContent && (() => {
              const pages = paginateContent(coaching.narrativeContent)
              const totalPages = pages.length
              const showPagination = totalPages > 1
              
              return (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <BookOpen className="h-6 w-6 text-blue-600" />
                          <span>Complete Lesson: {topic}</span>
                        </CardTitle>
                        <CardDescription className="flex items-center space-x-2 mt-1">
                          <span>Comprehensive textbook-quality content for CSEC preparation</span>
                          {coaching.model && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              <Zap className="h-3 w-3 mr-1" />
                              AI Generated
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      {showPagination && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span className="font-medium">Part {currentPage} of {totalPages}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Progress bar for pagination */}
                    {showPagination && (
                      <div className="mt-4">
                        <div className="flex space-x-1">
                          {Array.from({ length: totalPages }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i + 1)}
                              className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                                i + 1 === currentPage 
                                  ? 'bg-blue-600' 
                                  : i + 1 < currentPage 
                                    ? 'bg-green-500' 
                                    : 'bg-gray-200 hover:bg-gray-300'
                              }`}
                              title={`Go to part ${i + 1}`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-gray-500">
                          <span>Start</span>
                          <span>Finish</span>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="prose-lesson max-w-none">
                      {renderMarkdown(pages[currentPage - 1] || '')}
                    </div>
                    
                    {/* Pagination Navigation */}
                    {showPagination && (
                      <div className="flex items-center justify-between mt-8 pt-6 border-t">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center space-x-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Previous</span>
                        </Button>
                        
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-600">
                            📖 Part {currentPage} of {totalPages}
                          </span>
                        </div>
                        
                        <Button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="flex items-center space-x-2"
                        >
                          <span>{currentPage === totalPages ? 'Done!' : 'Next'}</span>
                          {currentPage !== totalPages && <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                    
                    {/* Encouraging message when on last page */}
                    {showPagination && currentPage === totalPages && (
                      <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 text-center">
                        <span className="text-2xl">🎉</span>
                        <p className="text-green-800 font-medium mt-2">
                          Great job! You've read through the entire lesson!
                        </p>
                        <p className="text-green-600 text-sm mt-1">
                          Scroll down to mark this coaching complete and move to practice questions.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })()}

            {/* Legacy format: Pacing Notes - Show at top if available (only when no narrative content) */}
            {!coaching.narrativeContent && coaching.pacing_notes && (
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

            {/* Legacy format: Explanation Card (only when no narrative content) */}
            {!coaching.narrativeContent && (
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
            )}

            {/* Graduated Examples - For STEM subjects (legacy format) */}
            {!coaching.narrativeContent && coaching.graduated_examples && coaching.graduated_examples.length > 0 && (
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

            {/* Writing Guidance - For humanities subjects (legacy format) */}
            {!coaching.narrativeContent && coaching.writing_guidance && (
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

            {/* Regular Examples (legacy fallback for when graduated_examples not available) */}
            {!coaching.narrativeContent && (!coaching.graduated_examples || coaching.graduated_examples.length === 0) && coaching.examples.length > 0 && (
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

            {/* Key Points Card (legacy format) */}
            {!coaching.narrativeContent && coaching.key_points.length > 0 && (
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

            {/* Practice Tips Card (legacy format) */}
            {!coaching.narrativeContent && coaching.practice_tips.length > 0 && (
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

            {/* Complete Coaching / Back to Plan Button */}
            <Card>
              <CardContent className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {isReviewMode ? 'Finished Reviewing?' : 'Ready to Move Forward?'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {isReviewMode 
                    ? `You can come back to review this lesson on ${topic} anytime you need a refresher.`
                    : `You've completed the comprehensive coaching for ${topic}. Now it's time to test your knowledge with practice questions.`
                  }
                </p>
                {isReviewMode ? (
                  <Link href={`/plans/${planId}`}>
                    <Button size="lg">Back to Study Plan</Button>
                  </Link>
                ) : (
                  <Button onClick={completeCoaching} size="lg">
                    Complete Coaching & Continue
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}