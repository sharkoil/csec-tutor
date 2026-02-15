'use client'

import { useState } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  Play,
  Award,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StudySchedule, WeekBlock, DailySlot, DepthTier } from '@/lib/study-schedule'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeekRange(start: Date, end: Date): string {
  const s = formatDate(start)
  const e = formatDate(end)
  return `${s} – ${e}`
}

const DEPTH_COLORS: Record<DepthTier, { bg: string; text: string; dot: string }> = {
  foundational: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  standard:     { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  intensive:    { bg: 'bg-purple-50',  text: 'text-purple-700', dot: 'bg-purple-400' },
}

const ACTIVITY_ICON: Record<DailySlot['activity'], typeof BookOpen> = {
  coaching: BookOpen,
  practice: Play,
  exam: Award,
  revision: RefreshCw,
}

const ACTIVITY_LABEL: Record<DailySlot['activity'], string> = {
  coaching: 'Coaching',
  practice: 'Practice',
  exam: 'Exam Prep',
  revision: 'Revision',
}

const WEEK_TYPE_STYLE: Record<WeekBlock['type'], { border: string; badge: string; label: string }> = {
  study:     { border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',   label: 'Study' },
  revision:  { border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700', label: 'Revision' },
  'exam-prep': { border: 'border-red-200',  badge: 'bg-red-100 text-red-700',     label: 'Exam Prep' },
}

// ─── Component ───────────────────────────────────────────────────────────────

interface StudyCalendarProps {
  schedule: StudySchedule
  onTopicClick?: (topic: string) => void
}

export default function StudyCalendar({ schedule, onTopicClick }: StudyCalendarProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(() => {
    const currentWeek = schedule.weeks.find(w => w.isCurrent)
    return currentWeek?.weekNumber ?? (schedule.weeks[0]?.weekNumber ?? null)
  })

  const toggleWeek = (weekNum: number) => {
    setExpandedWeek(prev => prev === weekNum ? null : weekNum)
  }

  // Find current week index for scroll indicator
  const currentWeekIdx = schedule.weeks.findIndex(w => w.isCurrent)

  return (
    <div className="space-y-6">
      {/* Schedule Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Calendar className="h-5 w-5 text-blue-600" />}
          label="Total Weeks"
          value={`${schedule.totalWeeks}`}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-green-600" />}
          label="Weekly Time"
          value={`${schedule.minutesPerWeek} min`}
        />
        <SummaryCard
          icon={<Target className="h-5 w-5 text-purple-600" />}
          label={schedule.examDate ? 'Until Exam' : 'Topics / Week'}
          value={schedule.examDate ? `${schedule.weeksUntilExam} wks` : `~${schedule.topicsPerWeek}`}
        />
        <SummaryCard
          icon={<RefreshCw className="h-5 w-5 text-amber-600" />}
          label="Revision Weeks"
          value={`${schedule.revisionWeeks}`}
        />
      </div>

      {/* Exam countdown banner */}
      {schedule.examDate && schedule.weeksUntilExam <= 8 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span>
            Your exam is in <strong>{schedule.weeksUntilExam} week{schedule.weeksUntilExam !== 1 ? 's' : ''}</strong>
            {' '}({schedule.examDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).
            Stay on track!
          </span>
        </div>
      )}

      {/* Timeline progress dots */}
      <div className="flex items-center gap-1 px-1 overflow-x-auto pb-2">
        {schedule.weeks.map((week, i) => {
          const allDone = week.topics.every(t => t.completed.coaching && t.completed.practice && t.completed.exam)
          return (
            <button
              key={week.weekNumber}
              onClick={() => toggleWeek(week.weekNumber)}
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                ${week.isCurrent
                  ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-600 text-white scale-125'
                  : week.isPast && allDone
                    ? 'bg-green-500 text-white'
                    : week.isPast
                      ? 'bg-gray-300 text-gray-600'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }
              `}
              title={`Week ${week.weekNumber} — ${formatWeekRange(week.startDate, week.endDate)}`}
            >
              {week.weekNumber}
            </button>
          )
        })}
      </div>

      {/* Week Cards */}
      <div className="space-y-3">
        {schedule.weeks.map((week) => {
          const isExpanded = expandedWeek === week.weekNumber
          const style = WEEK_TYPE_STYLE[week.type]
          const allDone = week.topics.every(t => t.completed.coaching && t.completed.practice && t.completed.exam)

          return (
            <div
              key={week.weekNumber}
              className={`rounded-xl border-2 transition-all ${style.border} ${
                week.isCurrent ? 'shadow-lg shadow-blue-100' : ''
              } ${week.isPast && allDone ? 'opacity-60' : ''}`}
            >
              {/* Week header — always visible */}
              <button
                onClick={() => toggleWeek(week.weekNumber)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/50 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
                    ${week.isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {week.weekNumber}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {formatWeekRange(week.startDate, week.endDate)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                        {style.label}
                      </span>
                      {week.isCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-600 text-white">
                          This Week
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {week.topics.map(t => t.topic).join(' · ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {allDone && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  <span className="text-xs text-gray-400">{week.totalMinutes} min</span>
                  {isExpanded ? (
                    <ChevronLeft className="h-4 w-4 text-gray-400 rotate-90" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  {/* Topic pills */}
                  <div className="flex flex-wrap gap-2">
                    {week.topics.map(t => {
                      const dc = DEPTH_COLORS[t.depth]
                      return (
                        <button
                          key={t.topic}
                          onClick={() => onTopicClick?.(t.topic)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${dc.bg} ${dc.text} hover:opacity-80`}
                        >
                          <span className={`w-2 h-2 rounded-full ${dc.dot}`} />
                          {t.topic}
                          {t.completed.coaching && t.completed.practice && t.completed.exam && (
                            <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Daily breakdown */}
                  {week.dailyPlan.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Daily Plan
                      </h4>
                      <div className="grid gap-1.5">
                        {week.dailyPlan.map((slot, i) => {
                          const Icon = ACTIVITY_ICON[slot.activity]
                          return (
                            <div
                              key={i}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                                ${slot.completed ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'}`}
                            >
                              <span className="w-16 text-xs font-medium text-gray-500 flex-shrink-0">
                                {slot.dayName.slice(0, 3)}
                              </span>
                              <Icon className={`h-4 w-4 flex-shrink-0 ${slot.completed ? 'text-green-600' : 'text-gray-400'}`} />
                              <span className="font-medium truncate">{slot.topic}</span>
                              <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                                {ACTIVITY_LABEL[slot.activity]} · {slot.minutes} min
                              </span>
                              {slot.completed && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Depth legend for this week */}
                  <div className="flex items-center gap-4 pt-1 text-[11px] text-gray-400">
                    {(['foundational', 'standard', 'intensive'] as DepthTier[]).map(d => {
                      if (!week.topics.some(t => t.depth === d)) return null
                      const dc = DEPTH_COLORS[d]
                      return (
                        <span key={d} className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${dc.dot}`} />
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Small Helpers ───────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3">
      {icon}
      <div>
        <div className="text-lg font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-[11px] text-gray-500 leading-tight">{label}</div>
      </div>
    </div>
  )
}
