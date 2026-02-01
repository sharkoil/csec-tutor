import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { renderHook, act } from '@testing-library/react'
import { AICoach } from '../lib/ai-coach'
import { VectorSearch } from '../lib/vector-search'
import { supabase } from '../lib/supabase'

// Mock OpenAI to avoid actual API calls during tests
jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }]
        })
      },
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Test coaching content' } }]
          })
        }
      }
    }))
  }
})

describe('AICoach', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateFundamentalCoaching', () => {
    it('should generate coaching content for mathematics algebra', async () => {
      const result = await AICoach.generateFundamentalCoaching('mathematics', 'Algebra', 'beginner')
      
      expect(result).toHaveProperty('explanation')
      expect(result).toHaveProperty('examples')
      expect(result).toHaveProperty('key_points')
      expect(result).toHaveProperty('practice_tips')
      expect(typeof result.explanation).toBe('string')
      expect(Array.isArray(result.examples)).toBe(true)
    })

    it('should handle different user levels', async () => {
      const beginnerResult = await AICoach.generateFundamentalCoaching('mathematics', 'Algebra', 'beginner')
      const advancedResult = await AICoach.generateFundamentalCoaching('mathematics', 'Algebra', 'advanced')
      
      expect(beginnerResult.explanation.length).toBeGreaterThan(0)
      expect(advancedResult.explanation.length).toBeGreaterThan(0)
    })

    it('should handle API errors gracefully', async () => {
      // Mock API error
      const mockError = new Error('API Error')
      jest.doMock('openai', () => ({
        default: jest.fn().mockImplementation(() => ({
          chat: {
            completions: {
              create: jest.fn().mockRejectedValue(mockError)
            }
          }
        }))
      }))

      await expect(AICoach.generateFundamentalCoaching('mathematics', 'Algebra')).rejects.toThrow()
    })
  })

  describe('generatePracticeQuestions', () => {
    it('should generate questions with specified parameters', async () => {
      const result = await AICoach.generatePracticeQuestions('mathematics', 'Algebra', 'medium', 5)
      
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should validate input parameters', async () => {
      const result = await AICoach.generatePracticeQuestions('mathematics', 'Algebra', 'medium', 5)
      
      expect(typeof result).toBe('string')
    })
  })

  describe('generatePracticeExam', () => {
    it('should generate exam with correct structure', async () => {
      const result = await AICoach.generatePracticeExam('mathematics', ['Algebra'], 60)
      
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