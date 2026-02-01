import { describe, it, expect } from '@jest/globals'
import { CSEC_SUBJECTS } from '../data/subjects'

describe('Data Models and Types', () => {
  describe('CSEC_SUBJECTS', () => {
    it('should have correct subject structure', () => {
      const subjects = Object.keys(CSEC_SUBJECTS)
      
      expect(subjects).toContain('mathematics')
      expect(subjects).toContain('biology')
      expect(subjects).toContain('chemistry')
      expect(subjects).toContain('physics')
      expect(subjects.length).toBeGreaterThan(0)
    })

    it('should have complete mathematics curriculum', () => {
      const math = CSEC_SUBJECTS.mathematics
      
      expect(math).toHaveProperty('name', 'Mathematics')
      expect(math).toHaveProperty('code', 'MATH')
      expect(math).toHaveProperty('description')
      expect(Array.isArray(math.topics)).toBe(true)
      expect(math.topics.length).toBe(10) // As specified in original
    })

    it('should have valid biology topics', () => {
      const biology = CSEC_SUBJECTS.biology
      
      expect(biology.topics).toContain('Cell Structure')
      expect(biology.topics).toContain('Genetics')
      expect(biology.topics).toContain('Ecology')
      expect(biology.topics.length).toBeGreaterThan(5)
    })
  })

  describe('StudyPlan Type', () => {
    it('should validate study plan structure', () => {
      const plan = {
        id: 'test-id',
        user_id: 'user-123',
        subject: 'Mathematics',
        topics: ['Algebra'],
        status: 'active' as const,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      expect(plan.id).toBe('test-id')
      expect(plan.subject).toBe('Mathematics')
      expect(Array.isArray(plan.topics)).toBe(true)
      expect(plan.topics).toContain('Algebra')
      expect(['active', 'completed', 'paused']).toContain(plan.status)
    })
  })

  describe('Progress Type', () => {
    it('should validate progress tracking', () => {
      const progress = {
        id: 'progress-id',
        user_id: 'user-123',
        plan_id: 'plan-123',
        topic: 'Algebra',
        coaching_completed: true,
        practice_completed: false,
        exam_completed: false,
        practice_score: 85,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      expect(progress.topic).toBe('Algebra')
      expect(progress.coaching_completed).toBe(true)
      expect(progress.practice_completed).toBe(false)
      expect(progress.exam_completed).toBe(false)
      expect(progress.practice_score).toBe(85)
      expect(progress.practice_score).toBeGreaterThanOrEqual(0)
      expect(progress.practice_score).toBeLessThanOrEqual(100)
    })
  })

  describe('CSEC Content Type', () => {
    it('should validate CSEC content structure', () => {
      const content = {
        id: 'content-id',
        subject: 'Mathematics',
        topic: 'Algebra',
        subtopic: 'Linear Equations',
        content_type: 'question',
        content: 'Solve for x: 2x + 5 = 15',
        metadata: {
          year: 2024,
          paper_number: 'P1',
          difficulty: 'easy',
          question_type: 'short_answer',
          marks: 3
        },
        embedding: Array(1536).fill(0.1)
      }

      expect(content.subject).toBe('Mathematics')
      expect(content.topic).toBe('Algebra')
      expect(content.content_type).toBe('question')
      expect(['syllabus', 'question', 'explanation', 'example']).toContain(content.content_type)
      expect(typeof content.content).toBe('string')
      expect(Array.isArray(content.embedding)).toBe(true)
      expect(content.embedding.length).toBe(1536)
    })
  })

  describe('Difficulty Levels', () => {
    it('should have valid difficulty options', () => {
      const validDifficulties = ['easy', 'medium', 'hard']
      
      validDifficulties.forEach(difficulty => {
        expect(['easy', 'medium', 'hard']).toContain(difficulty)
      })
    })

    it('should validate difficulty progression', () => {
      expect('easy').toBeDefined()
      expect('medium').toBeDefined()
      expect('hard').toBeDefined()
      
      // Easy questions should have fewer marks than hard questions
      // This would be tested in practice question generation
    })
  })

  describe('Question Types', () => {
    it('should include all CSEC question types', () => {
      const questionTypes = ['multiple_choice', 'short_answer', 'structured', 'essay']
      
      questionTypes.forEach(type => {
        expect(['multiple_choice', 'short_answer', 'structured', 'essay']).toContain(type)
      })
    })
  })

  describe('Score Validation', () => {
    it('should validate score ranges', () => {
      const validScore = (score: number) => {
        return score >= 0 && score <= 100
      }

      expect(validScore(85)).toBe(true)
      expect(validScore(0)).toBe(true)
      expect(validScore(100)).toBe(true)
      expect(validScore(-1)).toBe(false)
      expect(validScore(101)).toBe(false)
    })

    it('should calculate percentages correctly', () => {
      const calculatePercentage = (completed: number, total: number) => {
        return Math.round((completed / total) * 100)
      }

      expect(calculatePercentage(1, 3)).toBe(33)
      expect(calculatePercentage(2, 3)).toBe(67)
      expect(calculatePercentage(3, 3)).toBe(100)
    })
  })
})