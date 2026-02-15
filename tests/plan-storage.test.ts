/**
 * Unit tests for the plan-storage data layer.
 *
 * Verifies the "try Supabase first, fall back to localStorage" strategy
 * that fixes the bounce-back-to-dashboard regression.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock Supabase client
const mockSelect = jest.fn()
const mockInsert = jest.fn()
const mockUpsert = jest.fn()
const mockDelete = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockSingle = jest.fn()

function chainable() {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    upsert: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    single: jest.fn(() => chain),
    // terminal — resolved by individual tests
  }
  return chain
}

let mockChain: any

const mockFrom = jest.fn(() => {
  return mockChain
})

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}))

// Mock plan-actions server actions (used by savePlan, fetchPlan, fetchPlans via dynamic import)
const mockSavePlanAction = jest.fn()
const mockFetchPlanAction = jest.fn()
const mockFetchPlansAction = jest.fn()

jest.mock('@/lib/plan-actions', () => ({
  savePlanAction: (...args: any[]) => mockSavePlanAction(...args),
  fetchPlanAction: (...args: any[]) => mockFetchPlanAction(...args),
  fetchPlansAction: (...args: any[]) => mockFetchPlansAction(...args),
}))

// localStorage mock (already provided by tests/setup.ts, but we need
// working getItem/setItem for these tests)
const localStore: Record<string, string> = {}
const localStorageMock = {
  getItem: jest.fn((key: string) => localStore[key] ?? null),
  setItem: jest.fn((key: string, val: string) => { localStore[key] = val }),
  removeItem: jest.fn((key: string) => { delete localStore[key] }),
  clear: jest.fn(() => { Object.keys(localStore).forEach(k => delete localStore[k]) }),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

import {
  savePlan,
  fetchPlan,
  fetchPlans,
  fetchProgress,
  fetchTopicProgress,
  saveProgress,
} from '@/lib/plan-storage'

// ── Helpers ────────────────────────────────────────────────────────────────

function resetLocalStorage() {
  Object.keys(localStore).forEach(k => delete localStore[k])
  jest.clearAllMocks()
  // Default: server actions throw (simulate Supabase down) so localStorage fallback is used
  mockSavePlanAction.mockResolvedValue(null)
  mockFetchPlanAction.mockResolvedValue(null)
  mockFetchPlansAction.mockResolvedValue([])
}

function makeChainSuccess(returnData: any) {
  const c: any = {}
  c.select = jest.fn(() => c)
  c.insert = jest.fn(() => c)
  c.upsert = jest.fn(() => c)
  c.delete = jest.fn(() => c)
  c.eq = jest.fn(() => c)
  c.order = jest.fn(() => c)
  c.single = jest.fn(() => Promise.resolve({ data: returnData, error: null }))
  // For queries that don't call .single()
  c.then = (resolve: any) => resolve({ data: Array.isArray(returnData) ? returnData : [returnData], error: null })
  return c
}

function makeChainError(errorMsg: string) {
  const c: any = {}
  c.select = jest.fn(() => c)
  c.insert = jest.fn(() => c)
  c.upsert = jest.fn(() => c)
  c.delete = jest.fn(() => c)
  c.eq = jest.fn(() => c)
  c.order = jest.fn(() => c)
  c.single = jest.fn(() => Promise.resolve({ data: null, error: { message: errorMsg, code: '400' } }))
  c.then = (resolve: any) => resolve({ data: null, error: { message: errorMsg, code: '400' } })
  return c
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('plan-storage: savePlan', () => {
  beforeEach(resetLocalStorage)

  it('saves to Supabase when DB is available', async () => {
    const dbPlan = { id: 'uuid-123', user_id: 'u1', subject: 'Math', topics: ['Algebra'], status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' }

    // Mock the server action to return a successful plan
    mockSavePlanAction.mockResolvedValue(dbPlan)

    const result = await savePlan({
      user_id: 'u1',
      subject: 'Math',
      topics: ['Algebra'],
      status: 'active',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    })

    expect(result.id).toBe('uuid-123')
    expect(result.subject).toBe('Math')
    // Should NOT have written to localStorage
    expect(localStore['csec_mock_plans']).toBeUndefined()
  })

  it('falls back to localStorage when Supabase fails', async () => {
    // Server action returns null (DB failure)
    mockSavePlanAction.mockResolvedValue(null)

    const result = await savePlan({
      user_id: 'real-uuid-abc',
      subject: 'Biology',
      topics: ['Cells', 'Ecology'],
      status: 'active',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    })

    expect(result.id).toMatch(/^plan_/)
    expect(result.subject).toBe('Biology')
    expect(result.topics).toEqual(['Cells', 'Ecology'])

    // Should be in localStorage
    const stored = JSON.parse(localStore['csec_mock_plans'])
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(result.id)
  })

  it('preserves wizard_data in localStorage fallback', async () => {
    mockSavePlanAction.mockResolvedValue(null)

    const result = await savePlan({
      user_id: 'real-uuid-abc',
      subject: 'Math',
      topics: ['Algebra'],
      status: 'active',
      wizard_data: {
        target_grade: 'grade_1',
        proficiency_level: 'advanced',
        topic_confidence: { Algebra: 'confident' },
        exam_timeline: 'may_june',
        study_minutes_per_session: 45,
        study_days_per_week: 5,
        learning_style: 'theory_first',
      },
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    } as any)

    const stored = JSON.parse(localStore['csec_mock_plans'])
    expect(stored[0].wizard_data.target_grade).toBe('grade_1')
    expect(stored[0].wizard_data.learning_style).toBe('theory_first')
  })
})

describe('plan-storage: fetchPlan', () => {
  beforeEach(resetLocalStorage)

  it('returns plan from Supabase when available', async () => {
    const dbPlan = { id: 'db-plan-1', user_id: 'u1', subject: 'Chemistry', topics: ['Bonding'] }
    mockFetchPlanAction.mockResolvedValue(dbPlan)

    const result = await fetchPlan('u1', 'db-plan-1')
    expect(result).not.toBeNull()
    expect(result!.subject).toBe('Chemistry')
  })

  it('falls back to localStorage when Supabase fails', async () => {
    // Pre-populate localStorage with a plan
    localStore['csec_mock_plans'] = JSON.stringify([
      { id: 'plan_abc', user_id: 'real-uuid', subject: 'Physics', topics: ['Mechanics'] }
    ])

    mockFetchPlanAction.mockResolvedValue(null)

    const result = await fetchPlan('real-uuid', 'plan_abc')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('plan_abc')
    expect(result!.subject).toBe('Physics')
  })

  it('returns null when plan not found anywhere', async () => {
    mockFetchPlanAction.mockResolvedValue(null)
    const result = await fetchPlan('u1', 'nonexistent')
    expect(result).toBeNull()
  })

  it('finds localStorage plans created by Supabase-fallback savePlan', async () => {
    // Simulate the exact bounce-back scenario:
    // 1. savePlan fails on Supabase → stores in localStorage
    mockSavePlanAction.mockResolvedValue(null)
    const saved = await savePlan({
      user_id: 'real-uuid-xyz',
      subject: 'Math',
      topics: ['Algebra'],
      status: 'active',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    })

    // 2. fetchPlan also fails on Supabase → should find the localStorage plan
    const fetched = await fetchPlan('real-uuid-xyz', saved.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(saved.id)
    expect(fetched!.subject).toBe('Math')
  })
})

describe('plan-storage: fetchPlans', () => {
  beforeEach(resetLocalStorage)

  it('returns plans from Supabase when available', async () => {
    const plans = [
      { id: '1', user_id: 'u1', subject: 'Math' },
      { id: '2', user_id: 'u1', subject: 'English' },
    ]
    mockFetchPlansAction.mockResolvedValue(plans)

    const result = await fetchPlans('u1')
    expect(result).toHaveLength(2)
  })

  it('falls back to localStorage when Supabase fails', async () => {
    localStore['csec_mock_plans'] = JSON.stringify([
      { id: 'plan_a', user_id: 'u2', subject: 'Biology' }
    ])

    // Server action returns empty (DB failure)
    mockFetchPlansAction.mockResolvedValue([])

    const result = await fetchPlans('u2')
    expect(result).toHaveLength(1)
    expect(result[0].subject).toBe('Biology')
  })
})

describe('plan-storage: fetchProgress', () => {
  beforeEach(resetLocalStorage)

  it('returns progress from Supabase when available', async () => {
    const progressData = [
      { id: 'p1', user_id: 'u1', plan_id: 'plan1', topic: 'Algebra', coaching_completed: true, practice_completed: false, exam_completed: false }
    ]
    const c: any = {}
    c.select = jest.fn(() => c)
    c.eq = jest.fn(() => c)
    // After two .eq() calls, resolve
    let eqCount = 0
    c.eq = jest.fn(() => {
      eqCount++
      if (eqCount >= 2) {
        return Promise.resolve({ data: progressData, error: null })
      }
      return c
    })
    mockFrom.mockImplementation(() => c)

    const result = await fetchProgress('u1', 'plan1', ['Algebra'])
    expect(result).toHaveLength(1)
    expect(result[0].coaching_completed).toBe(true)
  })

  it('falls back to localStorage when Supabase fails', async () => {
    localStore['csec_mock_progress'] = JSON.stringify({
      'plan1_Algebra': { coaching_completed: true, practice_completed: true, exam_completed: false, practice_score: 85 }
    })

    const c: any = {}
    c.select = jest.fn(() => c)
    c.eq = jest.fn(() => c)
    let eqCount = 0
    c.eq = jest.fn(() => {
      eqCount++
      if (eqCount >= 2) {
        return Promise.resolve({ data: null, error: { message: '400' } })
      }
      return c
    })
    mockFrom.mockImplementation(() => c)

    const result = await fetchProgress('u1', 'plan1', ['Algebra'])
    expect(result).toHaveLength(1)
    expect(result[0].coaching_completed).toBe(true)
    expect(result[0].practice_completed).toBe(true)
    expect(result[0].practice_score).toBe(85)
  })

  it('returns default progress when nothing exists', async () => {
    mockFrom.mockImplementation(() => makeChainError('400'))

    const result = await fetchProgress('u1', 'plan1', ['Algebra', 'Geometry'])
    expect(result).toHaveLength(2)
    expect(result[0].coaching_completed).toBe(false)
    expect(result[1].coaching_completed).toBe(false)
  })
})

describe('plan-storage: saveProgress', () => {
  beforeEach(resetLocalStorage)

  it('saves to Supabase when available', async () => {
    const c: any = {}
    c.upsert = jest.fn(() => Promise.resolve({ data: null, error: null }))
    mockFrom.mockImplementation(() => c)

    await saveProgress('u1', 'plan1', 'Algebra', { coaching_completed: true })
    expect(c.upsert).toHaveBeenCalled()
  })

  it('falls back to localStorage when Supabase fails', async () => {
    const c: any = {}
    c.upsert = jest.fn(() => Promise.resolve({ data: null, error: { message: '400' } }))
    mockFrom.mockImplementation(() => c)

    await saveProgress('u1', 'plan1', 'Algebra', { coaching_completed: true, practice_completed: false })

    const stored = JSON.parse(localStore['csec_mock_progress'])
    expect(stored['plan1_Algebra'].coaching_completed).toBe(true)
    expect(stored['plan1_Algebra'].practice_completed).toBe(false)
  })

  it('merges with existing localStorage progress', async () => {
    localStore['csec_mock_progress'] = JSON.stringify({
      'plan1_Algebra': { coaching_completed: true }
    })

    const c: any = {}
    c.upsert = jest.fn(() => Promise.resolve({ data: null, error: { message: '400' } }))
    mockFrom.mockImplementation(() => c)

    await saveProgress('u1', 'plan1', 'Algebra', { practice_completed: true, practice_score: 92 })

    const stored = JSON.parse(localStore['csec_mock_progress'])
    expect(stored['plan1_Algebra'].coaching_completed).toBe(true) // preserved
    expect(stored['plan1_Algebra'].practice_completed).toBe(true) // added
    expect(stored['plan1_Algebra'].practice_score).toBe(92) // added
  })
})

describe('plan-storage: fetchTopicProgress', () => {
  beforeEach(resetLocalStorage)

  it('returns progress from Supabase when available', async () => {
    const progressData = { coaching_completed: true, practice_completed: true, exam_completed: false }
    const c: any = {}
    c.select = jest.fn(() => c)
    c.eq = jest.fn(() => c)
    // After three .eq() calls, resolve via single()
    let eqCount = 0
    c.eq = jest.fn(() => {
      eqCount++
      if (eqCount >= 3) {
        c.single = jest.fn(() => Promise.resolve({ data: progressData, error: null }))
      }
      return c
    })
    c.single = jest.fn(() => Promise.resolve({ data: progressData, error: null }))
    mockFrom.mockImplementation(() => c)

    const result = await fetchTopicProgress('u1', 'plan1', 'Algebra')
    expect(result.coaching_completed).toBe(true)
    expect(result.practice_completed).toBe(true)
  })

  it('falls back to localStorage on Supabase failure', async () => {
    localStore['csec_mock_progress'] = JSON.stringify({
      'plan1_Algebra': { coaching_completed: true, practice_completed: false, exam_completed: false }
    })

    const c: any = {}
    c.select = jest.fn(() => c)
    c.eq = jest.fn(() => c)
    c.single = jest.fn(() => Promise.resolve({ data: null, error: { message: '400' } }))
    mockFrom.mockImplementation(() => c)

    const result = await fetchTopicProgress('u1', 'plan1', 'Algebra')
    expect(result.coaching_completed).toBe(true)
  })

  it('returns defaults when nothing found', async () => {
    const c: any = {}
    c.select = jest.fn(() => c)
    c.eq = jest.fn(() => c)
    c.single = jest.fn(() => Promise.resolve({ data: null, error: { message: '400' } }))
    mockFrom.mockImplementation(() => c)

    const result = await fetchTopicProgress('u1', 'plan1', 'Nonexistent')
    expect(result.coaching_completed).toBe(false)
    expect(result.practice_completed).toBe(false)
    expect(result.exam_completed).toBe(false)
  })
})

describe('plan-storage: end-to-end localStorage fallback scenario', () => {
  beforeEach(resetLocalStorage)

  it('plan created via fallback is retrievable via fallback fetch — preventing the bounce-back bug', async () => {
    // All server action calls fail (simulating the 400 errors seen in production)
    mockSavePlanAction.mockResolvedValue(null)
    mockFetchPlanAction.mockResolvedValue(null)
    mockFetchPlansAction.mockResolvedValue([])
    mockFrom.mockImplementation(() => makeChainError('400 Bad Request'))

    // Step 1: User creates a plan (Supabase fails → localStorage)
    const createdPlan = await savePlan({
      user_id: '81cd5c8c-cce5-42e2-ab21-ccd3ff94830b', // real UUID
      subject: 'Mathematics',
      topics: ['Algebra', 'Geometry'],
      status: 'active',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    })

    expect(createdPlan.id).toMatch(/^plan_/)

    // Step 2: Plan detail page fetches the plan (Supabase fails → localStorage)
    const fetchedPlan = await fetchPlan(
      '81cd5c8c-cce5-42e2-ab21-ccd3ff94830b',
      createdPlan.id
    )

    // THIS IS THE KEY ASSERTION: the plan MUST be found, not null
    // Before the fix, this returned null and caused router.push('/dashboard')
    expect(fetchedPlan).not.toBeNull()
    expect(fetchedPlan!.id).toBe(createdPlan.id)
    expect(fetchedPlan!.subject).toBe('Mathematics')
    expect(fetchedPlan!.topics).toEqual(['Algebra', 'Geometry'])

    // Step 3: Progress is retrievable too
    const progress = await fetchProgress(
      '81cd5c8c-cce5-42e2-ab21-ccd3ff94830b',
      createdPlan.id,
      ['Algebra', 'Geometry']
    )
    expect(progress).toHaveLength(2)
    expect(progress[0].coaching_completed).toBe(false)

    // Step 4: Saving progress works
    await saveProgress(
      '81cd5c8c-cce5-42e2-ab21-ccd3ff94830b',
      createdPlan.id,
      'Algebra',
      { coaching_completed: true }
    )

    // Step 5: Progress is retrievable after save
    const updatedProgress = await fetchTopicProgress(
      '81cd5c8c-cce5-42e2-ab21-ccd3ff94830b',
      createdPlan.id,
      'Algebra'
    )
    expect(updatedProgress.coaching_completed).toBe(true)

    // Step 6: Dashboard lists the plan
    const allPlans = await fetchPlans('81cd5c8c-cce5-42e2-ab21-ccd3ff94830b')
    expect(allPlans.length).toBeGreaterThanOrEqual(1)
    expect(allPlans.some(p => p.id === createdPlan.id)).toBe(true)
  })
})
