'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MCQOption {
  letter: string   // 'A', 'B', 'C', 'D'
  text: string     // raw text after the letter
}

interface InteractiveMCQProps {
  /** All lines inside the blockquote (already stripped of >) */
  questionLines: string[]
  /** Lines after the answer divider (✅ Answer, 📝 annotation, etc.) */
  answerLines: string[]
  /** The card theme styling */
  theme: { border: string; bg: string; icon: string; label: string; headerBg: string }
  /** Render inline markdown (bold, italic, math, etc.) */
  formatInline: (text: string) => React.ReactNode
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the correct answer letter from the answer section */
function extractCorrectAnswer(answerLines: string[]): string | null {
  for (const line of answerLines) {
    // Match patterns like:
    //   ✅ **Answer:** (B) ...
    //   ✅ **Answer:** B
    //   📝 *The answer is (C)*
    //   The correct answer is (A)
    const m = line.match(/\(([A-Da-d])\)/)
    if (m) return m[1].toUpperCase()

    // Bare letter: "✅ **Answer:** B"
    const m2 = line.match(/Answer:?\*\*\s*([A-Da-d])\b/i)
    if (m2) return m2[1].toUpperCase()
  }
  return null
}

/** Parse MCQ option lines into structured data */
function parseOptions(lines: string[]): { options: MCQOption[]; otherLines: string[] } {
  const options: MCQOption[] = []
  const otherLines: string[] = []

  for (const line of lines) {
    const m = line.match(/^- \(([A-Da-d])\)\s+(.*)/)
    if (m) {
      options.push({ letter: m[1].toUpperCase(), text: m[2] })
    } else {
      otherLines.push(line)
    }
  }

  return { options, otherLines }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InteractiveMCQ({
  questionLines,
  answerLines,
  theme,
  formatInline,
}: InteractiveMCQProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)

  const correctAnswer = extractCorrectAnswer(answerLines)
  const { options, otherLines: questionTextLines } = parseOptions(questionLines)
  const answered = selected !== null
  const isCorrect = answered && selected === correctAnswer

  const handleSelect = (letter: string) => {
    if (answered) return // lock after first selection
    setSelected(letter)
    // Auto-reveal explanation after a brief delay
    setTimeout(() => setShowExplanation(true), 600)
  }

  const getOptionStyle = (letter: string) => {
    if (!answered) {
      return 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
    }
    if (letter === correctAnswer) {
      return 'bg-green-50 border-green-400 ring-2 ring-green-200'
    }
    if (letter === selected && letter !== correctAnswer) {
      return 'bg-red-50 border-red-400 ring-2 ring-red-200'
    }
    return 'bg-gray-50 border-gray-200 opacity-50'
  }

  const getLetterStyle = (letter: string) => {
    if (!answered) {
      return 'bg-gray-100 text-gray-700 border-gray-300'
    }
    if (letter === correctAnswer) {
      return 'bg-green-600 text-white border-green-600'
    }
    if (letter === selected && letter !== correctAnswer) {
      return 'bg-red-500 text-white border-red-500'
    }
    return 'bg-gray-100 text-gray-400 border-gray-200'
  }

  return (
    <div className={`lesson-question-card ${theme.bg} border-2 ${theme.border} rounded-xl my-6 overflow-hidden shadow-sm`}>
      {/* Card header */}
      <div className={`${theme.headerBg} px-4 py-2 flex items-center gap-2 border-b ${theme.border}`}>
        <span className="text-lg">{theme.icon}</span>
        <span className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
          {theme.label}
        </span>
        {answered && (
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
            isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
          }`}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-5">
        {/* Question text (everything that isn't an option) */}
        {questionTextLines.map((line, i) => {
          if (line.trim() === '') return <div key={`qs-${i}`} className="h-2" />
          return (
            <div key={`qs-${i}`} className="text-gray-800 leading-relaxed my-1">
              {formatInline(line)}
            </div>
          )
        })}

        {/* Interactive options */}
        <div className="mt-4 space-y-2">
          {options.map((opt) => (
            <button
              key={opt.letter}
              onClick={() => handleSelect(opt.letter)}
              disabled={answered}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all duration-200 text-left ${getOptionStyle(opt.letter)}`}
            >
              <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${getLetterStyle(opt.letter)}`}>
                {answered && opt.letter === correctAnswer ? (
                  <CheckCircle className="h-5 w-5" />
                ) : answered && opt.letter === selected ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  opt.letter
                )}
              </span>
              <span className={`leading-relaxed pt-1 ${
                answered && opt.letter === correctAnswer ? 'text-green-900 font-medium' :
                answered && opt.letter === selected ? 'text-red-900 line-through' :
                answered ? 'text-gray-400' : 'text-gray-800'
              }`}>
                {formatInline(opt.text)}
              </span>
            </button>
          ))}
        </div>

        {/* Explanation (auto-reveals or manual toggle) */}
        {answerLines.length > 0 && (
          <div className="mt-4">
            {!answered ? (
              // Before answering — allow peeking
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-200 border shadow-sm
                  ${showExplanation
                    ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
              >
                {showExplanation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showExplanation ? 'Hide Answer' : 'Show Answer'}
              </button>
            ) : !showExplanation ? (
              <button
                onClick={() => setShowExplanation(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 shadow-sm transition-colors"
              >
                <Eye className="h-4 w-4" />
                Show Explanation
              </button>
            ) : null}

            {showExplanation && (
              <div className="mt-3 pl-3 border-l-4 border-green-300 space-y-1">
                {answerLines.map((line, i) => {
                  if (line.trim() === '') return <div key={`expl-${i}`} className="h-2" />
                  // Answer line
                  if (line.match(/^✅\s*\*\*Answer:?\*\*/i)) {
                    return (
                      <div key={`expl-${i}`} className="p-2 bg-green-50 border border-green-300 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-green-600 text-lg flex-shrink-0">✅</span>
                          <div className="text-green-900 font-medium leading-relaxed">
                            {formatInline(line.replace(/^✅\s*\*\*Answer:?\*\*\s*/i, ''))}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  // Annotation
                  if (line.match(/^📝\s*/)) {
                    return (
                      <div key={`expl-${i}`} className="pl-4 py-1 border-l-2 border-blue-300 text-blue-800 text-sm italic">
                        {formatInline(line.replace(/^📝\s*/, ''))}
                      </div>
                    )
                  }
                  // Key insight
                  if (line.match(/^💡\s*\*\*Key Insight:?\*\*/i)) {
                    return (
                      <div key={`expl-${i}`} className="p-2 bg-amber-50 border border-amber-300 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-amber-600 text-lg">💡</span>
                          <div className="text-amber-900 leading-relaxed">
                            {formatInline(line.replace(/^💡\s*\*\*Key Insight:?\*\*\s*/i, ''))}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  // HR
                  if (line.match(/^[-*_]{3,}$/)) return <hr key={`expl-${i}`} className="my-3 border-gray-200" />
                  // Default
                  return (
                    <div key={`expl-${i}`} className="text-gray-700 leading-relaxed my-0.5">
                      {formatInline(line)}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
