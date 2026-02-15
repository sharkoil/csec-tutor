'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Tip categories ───────────────────────────────────────────────────────────

interface StudyTip {
  emoji: string
  title: string
  body: string
  category: 'study' | 'anxiety' | 'exam-prep'
}

const STUDY_TIPS: StudyTip[] = [
  // ── Best practices for studying ──────────────────────────────────
  {
    emoji: '🧠',
    title: 'Space Your Study Sessions',
    body: 'Studying a little every day beats cramming the night before. Your brain forms stronger memories when you spread learning over time.',
    category: 'study',
  },
  {
    emoji: '✍️',
    title: 'Teach What You Learn',
    body: 'Explain a concept to a friend, stuffed animal, or even an empty chair. If you can teach it clearly, you truly understand it.',
    category: 'study',
  },
  {
    emoji: '📝',
    title: 'Use Active Recall',
    body: 'Close your notes and try to write down everything you remember. This is far more effective than re-reading the same pages.',
    category: 'study',
  },
  {
    emoji: '🎯',
    title: 'Set Small, Clear Goals',
    body: 'Instead of "study Math," try "complete 5 algebra problems." Small wins keep you motivated and on track.',
    category: 'study',
  },
  {
    emoji: '🔄',
    title: 'Mix Up Your Subjects',
    body: 'Switching between topics during a study session (interleaving) helps your brain make connections and improves long-term retention.',
    category: 'study',
  },
  {
    emoji: '📖',
    title: 'Summarise in Your Own Words',
    body: 'After reading a section, write a 2-3 sentence summary without looking. This forces your brain to process, not just passively scan.',
    category: 'study',
  },
  {
    emoji: '🗂️',
    title: 'Use Flashcards Wisely',
    body: 'Put the question on one side and the answer on the other. Focus more time on cards you get wrong — that\'s where the growth is.',
    category: 'study',
  },
  {
    emoji: '⏰',
    title: 'Try the Pomodoro Technique',
    body: 'Study for 25 minutes, then take a 5-minute break. After 4 rounds, take a longer 15-minute break. It keeps your focus sharp.',
    category: 'study',
  },

  // ── Exam anxiety relief ──────────────────────────────────────────
  {
    emoji: '🌬️',
    title: 'Deep Breathing Helps',
    body: 'Breathe in for 4 counts, hold for 4, breathe out for 4. This activates your calm nervous system and reduces exam jitters.',
    category: 'anxiety',
  },
  {
    emoji: '💪',
    title: 'You Are More Prepared Than You Think',
    body: 'Anxiety makes you feel unprepared, but the fact that you\'re studying right now means you\'re already ahead. Trust your effort.',
    category: 'anxiety',
  },
  {
    emoji: '🧘',
    title: 'Visualise Success',
    body: 'Close your eyes for 30 seconds and picture yourself calmly writing your answers. Positive visualisation lowers stress hormones.',
    category: 'anxiety',
  },
  {
    emoji: '🌙',
    title: 'Sleep Is Your Superpower',
    body: 'Your brain consolidates memories while you sleep. A good night\'s rest before an exam is worth more than an extra hour of cramming.',
    category: 'anxiety',
  },
  {
    emoji: '🤗',
    title: 'It\'s OK to Feel Nervous',
    body: 'A little anxiety actually boosts performance — it means you care. The goal is to manage it, not eliminate it completely.',
    category: 'anxiety',
  },
  {
    emoji: '💧',
    title: 'Stay Hydrated & Eat Well',
    body: 'Your brain is 75% water. Dehydration impairs focus and memory. Drink water regularly and eat a balanced meal before exams.',
    category: 'anxiety',
  },
  {
    emoji: '🎵',
    title: 'Use Calming Music',
    body: 'Listening to calm, instrumental music before studying can lower cortisol levels and help you focus. Save the dancehall for after!',
    category: 'anxiety',
  },

  // ── Exam prep & test taking ──────────────────────────────────────
  {
    emoji: '📋',
    title: 'Read Every Question Twice',
    body: 'Many marks are lost from misreading questions. Underline key words like "explain," "compare," "state," or "calculate" before answering.',
    category: 'exam-prep',
  },
  {
    emoji: '⏱️',
    title: 'Budget Your Time',
    body: 'Check how many marks each question is worth and allocate time proportionally. Don\'t spend 20 minutes on a 2-mark question.',
    category: 'exam-prep',
  },
  {
    emoji: '✅',
    title: 'Answer What You Know First',
    body: 'Skip tough questions and come back to them. Answering easier questions first builds confidence and ensures you collect easy marks.',
    category: 'exam-prep',
  },
  {
    emoji: '📐',
    title: 'Show Your Working',
    body: 'In CSEC, method marks can save you even if your final answer is wrong. Always show your steps — examiners look for process.',
    category: 'exam-prep',
  },
  {
    emoji: '🔍',
    title: 'Check Command Words',
    body: '"State" = short answer. "Explain" = give a reason why. "Discuss" = pros and cons. Matching your answer style to the command word earns full marks.',
    category: 'exam-prep',
  },
  {
    emoji: '📊',
    title: 'Use Past Papers',
    body: 'Past papers are the best predictor of what you\'ll see on exam day. Practice under timed conditions to build speed and confidence.',
    category: 'exam-prep',
  },
  {
    emoji: '🔢',
    title: 'Check Units & Labels',
    body: 'In Science and Math, forgetting units (kg, m/s², mol/dm³) can cost you marks. Always include them in your final answer.',
    category: 'exam-prep',
  },
  {
    emoji: '✏️',
    title: 'Review Before Submitting',
    body: 'If you finish early, go back and check your answers. Look for silly mistakes, missing units, and unanswered questions.',
    category: 'exam-prep',
  },
]

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<StudyTip['category'], { label: string; color: string }> = {
  study:       { label: 'Study Tip',          color: 'bg-blue-100 text-blue-700' },
  anxiety:     { label: 'Exam Anxiety Relief', color: 'bg-green-100 text-green-700' },
  'exam-prep': { label: 'Exam Prep',          color: 'bg-purple-100 text-purple-700' },
}

// ─── Component ────────────────────────────────────────────────────────────────

/** 
 * Auto-advancing carousel of study tips shown during loading screens.
 * Cycles through tips from all 3 categories, auto-advancing every 6 seconds.
 */
export default function StudyTipsSlider() {
  // Shuffle tips once on mount so the order varies each time
  const [tips] = useState<StudyTip[]>(() => {
    const shuffled = [...STUDY_TIPS]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  })

  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right'>('right')

  const goNext = useCallback(() => {
    setDirection('right')
    setCurrent((prev) => (prev + 1) % tips.length)
  }, [tips.length])

  const goPrev = useCallback(() => {
    setDirection('left')
    setCurrent((prev) => (prev - 1 + tips.length) % tips.length)
  }, [tips.length])

  // Auto-advance every 6 seconds unless paused
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(goNext, 6000)
    return () => clearInterval(timer)
  }, [isPaused, goNext])

  const tip = tips[current]
  const cat = CATEGORY_LABELS[tip.category]

  return (
    <div
      className="w-full max-w-lg mx-auto mt-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Card */}
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Category ribbon */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cat.color}`}>
            {cat.label}
          </span>
          <span className="text-xs text-gray-400 tabular-nums">
            {current + 1} / {tips.length}
          </span>
        </div>

        {/* Tip body */}
        <div
          key={current}
          className="px-5 pb-5 animate-in fade-in slide-in-from-right-2 duration-300"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl flex-shrink-0 mt-0.5">{tip.emoji}</span>
            <div>
              <h4 className="font-semibold text-gray-900 text-[15px] leading-snug mb-1">
                {tip.title}
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                {tip.body}
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
            style={{ width: `${((current + 1) / tips.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Navigation arrows */}
      <div className="flex items-center justify-center gap-3 mt-3">
        <button
          onClick={goPrev}
          className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Previous tip"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Dot indicators — show 5 around current */}
        <div className="flex items-center gap-1.5">
          {tips.slice(0, 5).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === current % 5
                  ? 'bg-blue-600 scale-150'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to tip ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Next tip"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
