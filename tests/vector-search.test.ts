import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { VectorSearch } from '../lib/vector-search'
import { supabase } from '../lib/supabase'

// Mock supabase
jest.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockReturnThis()
    }
  }
})

describe('VectorSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('addContent', () => {
    it('should add content with embedding', async () => {
      const mockContent = {
        subject: 'mathematics',
        topic: 'Algebra',
        subtopic: 'Linear Equations',
        content_type: 'question',
        content: 'Test question',
        metadata: { difficulty: 'easy' }
      }

      // Mock embedding generation
      jest.doMock('openai', () => ({
        default: jest.fn().mockImplementation(() => ({
          embeddings: {
            create: jest.fn().mockResolvedValue({
              data: [{ embedding: Array(1536).fill(0.1) }]
            })
          }
        }))
      }))

      // Mock database insert
      const mockInsert = jest.fn().mockResolvedValue({
        data: { id: 'test-id', ...mockContent }
      })
      
      supabase.from = jest.fn().mockReturnValue({
        insert: mockInsert,
        single: jest.fn().mockReturnThis()
      })

      const result = await VectorSearch.addContent(mockContent)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockContent,
          embedding: expect.any(Array)
        })
      )
      
      expect(result).toEqual(expect.objectContaining({ id: 'test-id' }))
    })

    it('should handle embedding generation errors', async () => {
      const mockContent = {
        subject: 'mathematics',
        topic: 'Algebra',
        content_type: 'question',
        content: 'Test question'
      }

      // Mock embedding error
      jest.doMock('openai', () => ({
        default: jest.fn().mockImplementation(() => ({
          embeddings: {
            create: jest.fn().mockRejectedValue(new Error('Embedding failed'))
          }
        }))
      }))

      await expect(VectorSearch.addContent(mockContent)).rejects.toThrow('Embedding failed')
    })
  })

  describe('searchSimilarContent', () => {
    it('should search content by similarity', async () => {
      const mockResults = [
        { id: '1', subject: 'mathematics', topic: 'Algebra', content: 'Test content 1' },
        { id: '2', subject: 'mathematics', topic: 'Algebra', content: 'Test content 2' }
      ]

      const mockRpc = jest.fn().mockImplementation(() => 
        mockResults
      )
      supabase.rpc = mockRpc
      supabase.from = jest.fn().mockReturnThis()

      const result = await VectorSearch.searchSimilarContent('test query', 'mathematics', 'Algebra')

      expect(mockRpc).toHaveBeenCalledWith('search_csec_content', {
        query_embedding: expect.any(Array),
        match_threshold: 0.7,
        match_count: 5
      })

      expect(result).toEqual(mockResults)
    })

    it('should handle search with filters', async () => {
      const mockResults = [{ id: '1', subject: 'mathematics', content: 'Filtered content' }]
      const mockRpc = jest.fn().mockResolvedValue(mockResults)
      supabase.rpc = mockRpc
      supabase.from = jest.fn().mockImplementation((table: string) => ({
        eq: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      }))

      await VectorSearch.searchSimilarContent('query', 'mathematics', 'Algebra', 'question', 3)

      expect(mockRpc).toHaveBeenCalledWith('search_csec_content', expect.any(Object))
    })
  })

  describe('getContentByTopic', () => {
    it('should retrieve content by subject and topic', async () => {
      const mockContent = [
        { id: '1', subject: 'mathematics', topic: 'Algebra', content: 'Topic content' }
      ]

      const mockSelect = jest.fn().mockResolvedValue({ data: mockContent })
      supabase.from = jest.fn().mockReturnValue({
        select: mockSelect,
        order: jest.fn().mockReturnThis()
      })
      const mockSelect = jest.fn().mockReturnThis()

      const result = await VectorSearch.getContentByTopic('mathematics', 'Algebra')

      expect(supabase.from).toHaveBeenCalledWith('csec_content')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(mockSelect).toHaveBeenCalledWith('subject', 'mathematics')
      expect(mockSelect).toHaveBeenCalledWith('topic', 'Algebra')
      expect(mockSelect).toHaveBeenCalledWith('created_at', { ascending: true })
    })
  })

  describe('getSubjects and getTopics', () => {
    it('should retrieve unique subjects', async () => {
      const mockData = [
        { subject: 'mathematics' },
        { subject: 'biology' },
        { subject: 'mathematics' }
      ]

      const mockSelect = jest.fn().mockResolvedValue({ data: mockData })
      supabase.from = jest.fn().mockReturnValue({
        select: mockSelect,
        order: jest.fn().mockReturnThis()
      })
      const mockSelect = jest.fn().mockReturnThis()

      const subjects = await VectorSearch.getSubjects()

      expect(subjects).toEqual(['mathematics', 'biology'])
    })

    it('should retrieve topics for specific subject', async () => {
      const mockData = [
        { topic: 'Algebra' },
        { topic: 'Geometry' },
        { topic: 'Algebra' }
      ]

      const mockSelect = jest.fn().mockResolvedValue({ data: mockData })
      supabase.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis()
      })
      const mockSelect = jest.fn().mockReturnThis()

      const topics = await VectorSearch.getTopics('mathematics')

      expect(supabase.from).toHaveBeenCalledWith('csec_content')
      expect(mockSelect).toHaveBeenCalledWith('topic')
      expect(mockSelect).toHaveBeenCalledWith('subject', 'mathematics')
      expect(topics).toEqual(['Algebra', 'Geometry'])
    })
  })
})