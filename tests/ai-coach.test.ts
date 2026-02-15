import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { AICoach } from '../lib/ai-coach'

// Mock vector-search to avoid Supabase calls
jest.mock('../lib/vector-search', () => ({
  VectorSearch: {
    searchSimilarContent: jest.fn().mockResolvedValue([
      { content: 'Sample CSEC content for testing' }
    ])
  }
}))

// Mock usage-tracking to avoid DB calls
jest.mock('../lib/usage-tracking', () => ({
  trackUsage: jest.fn(),
  extractUsageFromResponse: jest.fn().mockReturnValue({
    model: 'test-model', action: 'test', prompt_tokens: 10,
    completion_tokens: 20, total_tokens: 30, cost_credits: 0.001
  }),
  checkDailyBudget: jest.fn().mockResolvedValue({ allowed: true, spent: 0, budget: 10 })
}))

// Mock model-config to avoid credit checks and API calls
jest.mock('../lib/model-config', () => ({
  MODELS: {
    LESSON: 'openai/gpt-4.1-mini',
    LESSON_HQ: 'openai/gpt-4.1',
    STRUCTURED: 'openai/gpt-4o-mini',
    UTILITY: 'openai/gpt-4o-mini',
    FREE_FALLBACK: 'meta-llama/llama-3.3-70b-instruct:free',
    CREDIT_THRESHOLD: 0.10
  },
  TOKEN_BUDGETS: {
    lesson: { input: 2500, output: 6000 },
    practice: { input: 1200, output: 2000 },
    exam: { input: 1500, output: 4000 },
    chat: { input: 2000, output: 600 },
    study_guide: { input: 1000, output: 1500 },
    plan_analysis: { input: 2000, output: 800 },
  },
  callWithFallback: jest.fn().mockImplementation(async (fn: (model: string) => Promise<any>, _tier: string) => {
    const result = await fn('openai/gpt-4.1-mini')
    return { result, model: 'openai/gpt-4.1-mini', isFallback: false }
  }),
  getOpenRouterCredits: jest.fn().mockResolvedValue({ total: 10, used: 1, remaining: 9 }),
  getModelForTask: jest.fn().mockResolvedValue({ model: 'openai/gpt-4.1-mini', isFallback: false })
}))

// Mock OpenAI constructor
const mockCreate = jest.fn().mockResolvedValue({
  id: 'gen-123',
  model: 'openai/gpt-4.1-mini',
  choices: [{ message: { content: '## CONCEPTUAL FOUNDATION\nTest coaching content\n\n## KEY POINTS TO MEMORIZE\n- Point 1\n- Point 2\n\n## PRACTICE STRATEGY\n- Tip 1\n\n## PACING YOUR LEARNING\nStudy plan content' } }],
  usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
})

jest.mock('openai', () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args: any[]) => mockCreate(...args)
      }
    }
  }))
  return {
    __esModule: true,
    default: MockOpenAI
  }
})

describe('AICoach', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, OPENROUTER_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateFundamentalCoaching', () => {
    it('should generate coaching content for mathematics algebra', async () => {
      const result = await AICoach.generateFundamentalCoaching('Mathematics', 'Algebra', 'beginner')
      
      expect(result).toHaveProperty('explanation')
      expect(result).toHaveProperty('examples')
      expect(result).toHaveProperty('key_points')
      expect(result).toHaveProperty('practice_tips')
      expect(typeof result.explanation).toBe('string')
      expect(Array.isArray(result.examples)).toBe(true)
    })

    it('should handle different user levels', async () => {
      const beginnerResult = await AICoach.generateFundamentalCoaching('Mathematics', 'Algebra', 'beginner')
      const advancedResult = await AICoach.generateFundamentalCoaching('Mathematics', 'Algebra', 'advanced')
      
      expect(beginnerResult.explanation.length).toBeGreaterThan(0)
      expect(advancedResult.explanation.length).toBeGreaterThan(0)
    })

    it('should handle API errors gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'))

      await expect(AICoach.generateFundamentalCoaching('Mathematics', 'Algebra')).rejects.toThrow()
    })
  })

  describe('generatePracticeQuestions', () => {
    it('should generate questions with specified parameters', async () => {
      const result = await AICoach.generatePracticeQuestions('Mathematics', 'Algebra', 'medium', 5)
      
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should validate input parameters', async () => {
      const result = await AICoach.generatePracticeQuestions('Mathematics', 'Algebra', 'medium', 5)
      
      expect(typeof result).toBe('string')
    })
  })

  describe('generatePracticeExam', () => {
    it('should generate exam with correct structure', async () => {
      const result = await AICoach.generatePracticeExam('Mathematics', ['Algebra'], 60)
      
      expect(result).toHaveProperty('exam_content')
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('topics')
      expect(result).toHaveProperty('total_marks')
      expect(result.duration).toBe(60)
      expect(result.topics).toEqual(['Algebra'])
      expect(result.total_marks).toBe(100)
    })
  })
})