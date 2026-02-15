/**
 * Study Schedule Generator
 * 
 * Takes wizard data + topic list + progress → generates a week-by-week
 * study calendar with topic assignments, revision blocks, and exam prep.
 */

import { WizardData, Progress } from '@/types'
import { TOPIC_PREREQUISITES, LEARNING_STAGES } from '@/data/subjects'

// ─── Types ───────────────────────────────────────────────────────────────────

export type DepthTier = 'foundational' | 'standard' | 'intensive'

export interface ScheduledTopic {
  topic: string
  depth: DepthTier
  /** Estimated minutes for all 3 stages at this depth */
  estimatedMinutes: number
  /** Which stages are already done */
  completed: {
    coaching: boolean
    practice: boolean
    exam: boolean
  }
}

export interface WeekBlock {
  weekNumber: number
  /** Monday of this week */
  startDate: Date
  endDate: Date
  /** Is this the current week? */
  isCurrent: boolean
  /** Has this week already passed? */
  isPast: boolean
  type: 'study' | 'revision' | 'exam-prep'
  /** Topics assigned to this week */
  topics: ScheduledTopic[]
  /** Suggested daily breakdown */
  dailyPlan: DailySlot[]
  /** Total estimated minutes this week */
  totalMinutes: number
}

export interface DailySlot {
  dayOfWeek: number  // 0=Sun … 6=Sat
  dayName: string
  topic: string
  activity: 'coaching' | 'practice' | 'exam' | 'revision'
  minutes: number
  completed: boolean
}

export interface StudySchedule {
  weeks: WeekBlock[]
  totalWeeks: number
  examDate: Date | null
  weeksUntilExam: number
  revisionWeeks: number
  topicsPerWeek: number
  minutesPerWeek: number
  /** Topics ordered by prerequisite dependencies */
  orderedTopics: ScheduledTopic[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGE_MINUTES = {
  coaching: LEARNING_STAGES.fundamentals.estimated_time,  // 45
  practice: LEARNING_STAGES.practice.estimated_time,       // 30
  exam: LEARNING_STAGES.exam.estimated_time,               // 60
}
const BASE_TOPIC_MINUTES = STAGE_MINUTES.coaching + STAGE_MINUTES.practice + STAGE_MINUTES.exam // 135

const DEPTH_MULTIPLIER: Record<DepthTier, number> = {
  foundational: 1.8,  // more time — needs deeper coverage
  standard: 1.0,
  intensive: 0.7,     // already confident — faster
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve the exam date from wizard timeline */
function resolveExamDate(timeline: WizardData['exam_timeline']): Date | null {
  const now = new Date()
  const year = now.getFullYear()

  if (timeline === 'may_june') {
    // CSEC May/June sitting — exams typically start mid-May
    const examDate = new Date(year, 4, 12) // May 12
    // If we're past May, it's next year's sitting
    if (now > examDate) return new Date(year + 1, 4, 12)
    return examDate
  }
  if (timeline === 'january') {
    // January sitting — exams in early January
    const examDate = new Date(year, 0, 10) // Jan 10
    if (now > examDate) return new Date(year + 1, 0, 10)
    return examDate
  }
  return null // no_exam — no deadline
}

/** Get the Monday of the week containing a date */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust to Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Get depth tier for a topic based on confidence + target grade */
function getDepthTier(
  topic: string,
  confidence: WizardData['topic_confidence'],
  targetGrade: WizardData['target_grade']
): DepthTier {
  const conf = confidence[topic] || 'some_knowledge'
  if (conf === 'no_exposure' || conf === 'struggling') {
    return targetGrade === 'grade_3' ? 'standard' : 'foundational'
  }
  if (conf === 'some_knowledge') return 'standard'
  return targetGrade === 'grade_1' ? 'standard' : 'intensive'
}

/**
 * Topological sort: orders topics so prerequisites come first.
 * Falls back to original order for subjects without prerequisite data.
 */
function topologicalSort(topics: string[], subjectKey: string): string[] {
  const prereqs = TOPIC_PREREQUISITES[subjectKey] || {}
  const graph = new Map<string, string[]>()
  const topicSet = new Set(topics)

  for (const t of topics) {
    // Only include prerequisites that are in the selected topic list
    const deps = (prereqs[t] || []).filter(d => topicSet.has(d))
    graph.set(t, deps)
  }

  const visited = new Set<string>()
  const result: string[] = []

  function visit(node: string) {
    if (visited.has(node)) return
    visited.add(node)
    for (const dep of graph.get(node) || []) {
      visit(dep)
    }
    result.push(node)
  }

  for (const t of topics) {
    visit(t)
  }

  return result
}

/** Pick N study days spread across the week (prefer weekdays) */
function pickStudyDays(count: number): number[] {
  // Preference order: Mon, Wed, Fri, Tue, Thu, Sat, Sun
  const preferred = [1, 3, 5, 2, 4, 6, 0]
  return preferred.slice(0, Math.min(count, 7))
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export function generateStudySchedule(
  subject: string,
  topics: string[],
  wizardData: WizardData,
  progress: Progress[]
): StudySchedule {
  const now = new Date()
  const thisMonday = getMonday(now)
  const examDate = resolveExamDate(wizardData.exam_timeline)

  // 1. Resolve subject key for prerequisite lookup
  const subjectKey = subject.toLowerCase().replace(/\s+/g, '_')

  // 2. Sort topics by prerequisites
  const ordered = topologicalSort(topics, subjectKey)

  // 3. Build scheduled topics with depth + progress
  const progressMap = new Map(progress.map(p => [p.topic, p]))
  const scheduledTopics: ScheduledTopic[] = ordered.map(topic => {
    const depth = getDepthTier(topic, wizardData.topic_confidence, wizardData.target_grade)
    const p = progressMap.get(topic)
    return {
      topic,
      depth,
      estimatedMinutes: Math.round(BASE_TOPIC_MINUTES * DEPTH_MULTIPLIER[depth]),
      completed: {
        coaching: p?.coaching_completed ?? false,
        practice: p?.practice_completed ?? false,
        exam: p?.exam_completed ?? false,
      },
    }
  })

  // 4. Calculate time budget
  const minutesPerSession = wizardData.study_minutes_per_session
  const daysPerWeek = wizardData.study_days_per_week
  const minutesPerWeek = minutesPerSession * daysPerWeek
  const studyDays = pickStudyDays(daysPerWeek)

  // 5. Calculate available weeks
  let totalAvailableWeeks: number
  if (examDate) {
    const msUntilExam = examDate.getTime() - thisMonday.getTime()
    totalAvailableWeeks = Math.max(1, Math.floor(msUntilExam / (7 * 24 * 60 * 60 * 1000)))
  } else {
    // No exam — estimate based on content volume
    const totalMinutes = scheduledTopics.reduce((s, t) => s + t.estimatedMinutes, 0)
    totalAvailableWeeks = Math.max(4, Math.ceil(totalMinutes / minutesPerWeek) + 2)
  }

  // Reserve revision weeks (10-15% of total, min 1 if ≥ 6 weeks)
  const revisionWeeks = totalAvailableWeeks >= 6
    ? Math.max(1, Math.min(3, Math.round(totalAvailableWeeks * 0.12)))
    : 0
  const studyWeeksAvailable = totalAvailableWeeks - revisionWeeks

  // 6. Distribute topics across study weeks
  //    Pack topics into weeks based on time budget
  const weeks: WeekBlock[] = []
  let topicIndex = 0

  for (let w = 0; w < studyWeeksAvailable && topicIndex < scheduledTopics.length; w++) {
    const weekStart = new Date(thisMonday)
    weekStart.setDate(weekStart.getDate() + w * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const weekTopics: ScheduledTopic[] = []
    let weekMinutes = 0

    // Fill this week with topics until budget is reached
    while (topicIndex < scheduledTopics.length) {
      const topic = scheduledTopics[topicIndex]
      // If adding this topic busts the budget AND we already have at least 1, stop
      if (weekMinutes + topic.estimatedMinutes > minutesPerWeek * 1.2 && weekTopics.length > 0) {
        break
      }
      weekTopics.push(topic)
      weekMinutes += topic.estimatedMinutes
      topicIndex++
    }

    // Generate daily slots for this week
    const dailyPlan = generateDailyPlan(weekTopics, studyDays, minutesPerSession)

    weeks.push({
      weekNumber: w + 1,
      startDate: weekStart,
      endDate: weekEnd,
      isCurrent: weekStart <= now && now <= weekEnd,
      isPast: weekEnd < now,
      type: 'study',
      topics: weekTopics,
      dailyPlan,
      totalMinutes: weekMinutes,
    })
  }

  // If we still have unplaced topics, squeeze them into the last week or add a week
  while (topicIndex < scheduledTopics.length) {
    const lastWeek = weeks[weeks.length - 1]
    if (lastWeek && lastWeek.topics.length < 3) {
      const t = scheduledTopics[topicIndex]
      lastWeek.topics.push(t)
      lastWeek.totalMinutes += t.estimatedMinutes
      lastWeek.dailyPlan = generateDailyPlan(lastWeek.topics, studyDays, minutesPerSession)
      topicIndex++
    } else {
      // Add an extra week
      const w = weeks.length
      const weekStart = new Date(thisMonday)
      weekStart.setDate(weekStart.getDate() + w * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const remaining = scheduledTopics.slice(topicIndex, topicIndex + 2)
      topicIndex += remaining.length
      weeks.push({
        weekNumber: w + 1,
        startDate: weekStart,
        endDate: weekEnd,
        isCurrent: false,
        isPast: false,
        type: 'study',
        topics: remaining,
        dailyPlan: generateDailyPlan(remaining, studyDays, minutesPerSession),
        totalMinutes: remaining.reduce((s, t) => s + t.estimatedMinutes, 0),
      })
    }
  }

  // 7. Add revision weeks
  // Find weak topics (not completed, or low confidence) for revision
  const weakTopics = scheduledTopics.filter(t =>
    !t.completed.coaching || !t.completed.practice ||
    t.depth === 'foundational'
  )

  for (let r = 0; r < revisionWeeks; r++) {
    const w = weeks.length
    const weekStart = new Date(thisMonday)
    weekStart.setDate(weekStart.getDate() + w * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    // Cycle through weak topics for revision
    const revTopics = weakTopics.length > 0
      ? weakTopics.slice(r * 3, r * 3 + 3).concat(
          weakTopics.length <= 3 ? [] : weakTopics.slice(0, Math.min(2, weakTopics.length))
        ).slice(0, 3)
      : scheduledTopics.slice(0, 3) // fallback to first 3

    const dailyPlan = generateRevisionDailyPlan(revTopics, studyDays, minutesPerSession)

    weeks.push({
      weekNumber: w + 1,
      startDate: weekStart,
      endDate: weekEnd,
      isCurrent: weekStart <= now && now <= weekEnd,
      isPast: weekEnd < now,
      type: r === revisionWeeks - 1 && examDate ? 'exam-prep' : 'revision',
      topics: revTopics.map(t => ({ ...t })),
      dailyPlan,
      totalMinutes: minutesPerWeek,
    })
  }

  // Recalculate isCurrent for all weeks
  for (const week of weeks) {
    week.isCurrent = week.startDate <= now && now <= week.endDate
  }

  const topicsPerWeek = studyWeeksAvailable > 0
    ? Math.round(scheduledTopics.length / studyWeeksAvailable * 10) / 10
    : scheduledTopics.length

  return {
    weeks,
    totalWeeks: weeks.length,
    examDate,
    weeksUntilExam: examDate
      ? Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : 0,
    revisionWeeks,
    topicsPerWeek,
    minutesPerWeek,
    orderedTopics: scheduledTopics,
  }
}

// ─── Daily Plan Builders ─────────────────────────────────────────────────────

function generateDailyPlan(
  topics: ScheduledTopic[],
  studyDays: number[],
  minutesPerSession: number
): DailySlot[] {
  const slots: DailySlot[] = []
  if (topics.length === 0 || studyDays.length === 0) return slots

  // Expand topics into activity slots: coaching → practice → exam
  const activities: { topic: string; activity: DailySlot['activity']; minutes: number; completed: boolean }[] = []
  for (const t of topics) {
    const depthMult = DEPTH_MULTIPLIER[t.depth]
    activities.push({
      topic: t.topic,
      activity: 'coaching',
      minutes: Math.round(STAGE_MINUTES.coaching * depthMult),
      completed: t.completed.coaching,
    })
    activities.push({
      topic: t.topic,
      activity: 'practice',
      minutes: Math.round(STAGE_MINUTES.practice * depthMult),
      completed: t.completed.practice,
    })
    activities.push({
      topic: t.topic,
      activity: 'exam',
      minutes: Math.round(STAGE_MINUTES.exam * depthMult),
      completed: t.completed.exam,
    })
  }

  // Assign activities to study days, roughly filling each day's session
  let actIdx = 0
  for (const dayOfWeek of studyDays) {
    if (actIdx >= activities.length) break
    const act = activities[actIdx]
    slots.push({
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      topic: act.topic,
      activity: act.activity,
      minutes: Math.min(act.minutes, minutesPerSession),
      completed: act.completed,
    })
    actIdx++
  }

  // If more activities than days, wrap around
  while (actIdx < activities.length) {
    const dayOfWeek = studyDays[actIdx % studyDays.length]
    const act = activities[actIdx]
    slots.push({
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      topic: act.topic,
      activity: act.activity,
      minutes: Math.min(act.minutes, minutesPerSession),
      completed: act.completed,
    })
    actIdx++
  }

  return slots
}

function generateRevisionDailyPlan(
  topics: ScheduledTopic[],
  studyDays: number[],
  minutesPerSession: number
): DailySlot[] {
  const slots: DailySlot[] = []
  for (let i = 0; i < studyDays.length && i < topics.length * 2; i++) {
    const t = topics[i % topics.length]
    slots.push({
      dayOfWeek: studyDays[i % studyDays.length],
      dayName: DAY_NAMES[studyDays[i % studyDays.length]],
      topic: t.topic,
      activity: 'revision',
      minutes: minutesPerSession,
      completed: false,
    })
  }
  return slots
}
