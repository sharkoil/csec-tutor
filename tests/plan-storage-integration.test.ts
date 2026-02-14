/**
 * Integration tests for plan-storage.ts with server actions
 * 
 * Tests the complete flow from savePlan through server actions to localStorage fallback
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock localStorage
const localStore: Record<string, string> = {}
const localStorageMock = {
  getItem: jest.fn((key: string) => localStore[key] ?? null),
  setItem: jest.fn((key: string, val: string) => { localStore[key] = val }),
  removeItem: jest.fn((key: string) => { delete localStore[key] }),
  clear: jest.fn(() => { Object.keys(localStore).forEach(k => delete localStore[k]) }),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// Mock plan-actions module
const mockSavePlanAction = jest.fn()
const mockFetchPlanAction = jest.fn()
const mockFetchPlansAction = jest.fn()

jest.mock('@/lib/plan-actions', () => ({
  savePlanAction: (...args: any[]) => mockSavePlanAction(...args),
  fetchPlanAction: (...args: any[]) => mockFetchPlanAction(...args),
  fetchPlansAction: (...args: any[]) => mockFetchPlansAction(...args),
}))

import {
  savePlan,
  fetchPlan,
  fetchPlans,
  fetchProgress,
  fetchTopicProgress,
  saveProgress,
} from '@/lib/plan-storage'

describe('plan-storage: Integration with Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStore['csec_mock_plans'] = undefined as any
    localStore['csec_mock_progress'] = undefined as any
  })

  describe('savePlan', () => {
    it('saves to database via server action when successful', async () => {
      const planData = {
        user_id: 'user-123',
        subject: 'Math',
        topics: ['Algebra'],
        status: 'active' as const,
        created_at: '2026-02-14T00:00:00Z',
        updated_at: '2026-02-14T00:00:00Z',
      }

      mockSavePlanAction.mockResolvedValue({
        id: 'uuid-123',
        ...planData,
      })

      const result = await savePlan(planData)

      expect(result.id).toBe('uuid-123')
      expect(mockSavePlanAction).toHaveBeenCalledWith(planData)
      // Should NOT save to localStorage when DB succeeds
      expect(localStore['csec_mock_plans']).toBeUndefined()
    })

    it('falls back to localStorage when server action fails', async () => {
      const planData = {
        user_id: 'user-123',
        subject: 'Math',
        topics: ['Algebra'],
        status: 'active' as const,
        created_at: '2026-02-14T00:00:00Z',
        updated_at: '2026-02-14T00:00:00Z',
      }

      mockSavePlanAction.mockRejectedValue(new Error('Server error'))

      const result = await savePlan(planData)

      expect(result.id).toMatch(/^plan_/)
      // Should be saved to localStorage
      expect(localStore['csec_mock_plans']).toBeDefined()
      const stored = JSON.parse(localStore['csec_mock_plans'])
      expect(stored).toHaveLength(1)
      expect(stored[0].subject).toBe('Math')
    })

    it('falls back to localStorage when server action returns null', async () => {
      const planData = {
        user_id: 'user-123',
        subject: 'Biology',
        topics: ['Cells'],
        status: 'active' as const,
        created_at: '2026-02-14T00:00:00Z',
        updated_at: '2026-02-14T00:00:00Z',
      }

      mockSavePlanAction.mockResolvedValue(null)

      const result = await savePlan(planData)

      expect(result.id).toMatch(/^plan_/)
      expect(localStore['csec_mock_plans']).toBeDefined()
    })
  })

  describe('fetchPlan', () => {
    it('fetches from database via server action when available', async () => {
      const testPlan = {
        id: 'uuid-123',
        user_id: 'user-123',
        subject: 'History',
        topics: ['Ancient Rome'],
        status: 'active' as const,
        created_at: '2026-02-14T00:00:00Z',
        updated_at: '2026-02-14T00:00:00Z',
      }

      mockFetchPlanAction.mockResolvedValue(testPlan)

      const result = await fetchPlan('user-123', 'uuid-123')

      expect(result).toEqual(testPlan)
      expect(mockFetchPlanAction).toHaveBeenCalledWith('user-123', 'uuid-123')
    })

    it('skips server action for localStorage IDs', async () => {
      // Pre-populate localStorage
      localStore['csec_mock_plans'] = JSON.stringify([
        {
          id: 'plan_abc123',
          user_id: 'user-123',
          subject: 'Math',
          topics: ['Algebra'],
          status: 'active',
          created_at: '2026-02-14T00:00:00Z',
          updated_at: '2026-02-14T00:00:00Z',
        }
      ])

      const result = await fetchPlan('user-123', 'plan_abc123')

      expect(result?.id).toBe('plan_abc123')
      // Server action should NOT be called for localStorage IDs
      expect(mockFetchPlanAction).not.toHaveBeenCalled()
    })

    it('falls back to localStorage when server action fails', async () => {
      localStore['csec_mock_plans'] = JSON.stringify([
        {
          id: 'uuid-broken',
          user_id: 'user-123',
          subject: 'Physics',
          topics: ['Mechanics'],
          status: 'active',
          created_at: '2026-02-14T00:00:00Z',
          updated_at: '2026-02-14T00:00:00Z',
        }
      ])

      mockFetchPlanAction.mockRejectedValue(new Error('DB error'))

      const result = await fetchPlan('user-123', 'uuid-broken')

      expect(result?.subject).toBe('Physics')
    })

    it('returns null when not found anywhere', async () => {
      mockFetchPlanAction.mockResolvedValue(null)

      const result = await fetchPlan('user-123', 'nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('fetchPlans', () => {
    it('fetches from database when available', async () => {
      const plans = [
        {
          id: 'uuid-1',
          user_id: 'user-123',
          subject: 'Math',
          topics: ['Algebra'],
          status: 'active' as const,
          created_at: '2026-02-14T00:00:00Z',
          updated_at: '2026-02-14T00:00:00Z',
        },
        {
          id: 'uuid-2',
          user_id: 'user-123',
          subject: 'Biology',
          topics: ['Cells'],
          status: 'active' as const,
          created_at: '2026-02-14T00:00:00Z',
          updated_at: '2026-02-14T00:00:00Z',
        },
      ]

      mockFetchPlansAction.mockResolvedValue(plans)

      const result = await fetchPlans('user-123')

      expect(result).toHaveLength(2)
      expect(result[0].subject).toBe('Math')
    })

    it('falls back to localStorage when server action fails', async () => {
      localStore['csec_mock_plans'] = JSON.stringify([
        {
          id: 'plan_local123',
          user_id: 'user-123',
          subject: 'English',
          topics: ['Literature'],
          status: 'active',
          created_at: '2026-02-14T00:00:00Z',
          updated_at: '2026-02-14T00:00:00Z',
        }
      ])

      mockFetchPlansAction.mockRejectedValue(new Error('Server issue'))

      const result = await fetchPlans('user-123')

      expect(result).toHaveLength(1)
      expect(result[0].subject).toBe('English')
    })
  })

  describe('fetchTopicProgress', () => {
    it('skips server for localStorage plan IDs', async () => {
      localStore['csec_mock_progress'] = JSON.stringify({
        'plan_abc123_Algebra': {
          coaching_completed: true,
          practice_completed: false,
          exam_completed: false,
        }
      })

      const result = await fetchTopicProgress('user-123', 'plan_abc123', 'Algebra')

      expect(result.coaching_completed).toBe(true)
    })

    it('returns defaults for missing progress', async () => {
      const result = await fetchTopicProgress('user-123', 'uuid-999', 'UnknownTopic')

      expect(result.coaching_completed).toBe(false)
      expect(result.practice_completed).toBe(false)
    })
  })

  describe('saveProgress', () => {
    it('saves directly to localStorage for localStorage plan IDs', async () => {
      await saveProgress('user-123', 'plan_abc123', 'Algebra', {
        coaching_completed: true,
      })

      const stored = JSON.parse(localStore['csec_mock_progress'] || '{}')
      expect(stored['plan_abc123_Algebra'].coaching_completed).toBe(true)
    })

    it('merges with existing progress', async () => {
      localStore['csec_mock_progress'] = JSON.stringify({
        'plan_xyz_Math': {
          coaching_completed: true,
          practice_completed: false,
        }
      })

      await saveProgress('user-123', 'plan_xyz', 'Math', {
        practice_completed: true,
      })

      const stored = JSON.parse(localStore['csec_mock_progress'])
      expect(stored['plan_xyz_Math'].coaching_completed).toBe(true)
      expect(stored['plan_xyz_Math'].practice_completed).toBe(true)
    })
  })

  describe('End-to-End: Complete Plan Flow with Fallback', () => {
    it('creates plan, fetches it, saves progress via localStorage fallback', async () => {
      const planData = {
        user_id: 'user-final-test',
        subject: 'Mathematics',
        topics: ['Algebra', 'Geometry'],
        status: 'active' as const,
        created_at: '2026-02-14T00:00:00Z',
        updated_at: '2026-02-14T00:00:00Z',
      }

      // Step 1: Server action fails, falls back to localStorage
      mockSavePlanAction.mockRejectedValue(new Error('Supabase down'))
      
      const savedPlan = await savePlan(planData)
      expect(savedPlan.id).toMatch(/^plan_/)

      // Step 2: Fetch the plan back
      const fetchedPlan = await fetchPlan('user-final-test', savedPlan.id)
      expect(fetchedPlan).not.toBeNull()
      expect(fetchedPlan?.subject).toBe('Mathematics')

      // Step 3: Save progress for a topic
      await saveProgress('user-final-test', savedPlan.id, 'Algebra', {
        coaching_completed: true,
        practice_completed: false,
      })

      // Step 4: Fetch progress
      const progress = await fetchTopicProgress('user-final-test', savedPlan.id, 'Algebra')
      expect(progress.coaching_completed).toBe(true)
      expect(progress.practice_completed).toBe(false)

      // Step 5: Update progress
      await saveProgress('user-final-test', savedPlan.id, 'Algebra', {
        practice_completed: true,
      })

      const updatedProgress = await fetchTopicProgress('user-final-test', savedPlan.id, 'Algebra')
      expect(updatedProgress.coaching_completed).toBe(true)
      expect(updatedProgress.practice_completed).toBe(true)
    })
  })
})
