import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { VectorSearch } from '../lib/vector-search'

// Mock supabase
const mockFrom = jest.fn()
const mockRpc = jest.fn()
const mockSelect = jest.fn()
const mockInsert = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockSingle = jest.fn()

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: function(...args) { return mockFrom(...args) },
    rpc: function(...args) { return mockRpc(...args) }
  }
}))

// Mock embeddings to avoid API calls in tests
jest.mock('../lib/embeddings', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(512).fill(0.1))
}))

describe('VectorSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock chain setup
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      eq: mockEq,
      order: mockOrder
    })
    mockInsert.mockReturnValue({
      select: mockSelect
    })
    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      single: mockSingle
    })
    mockEq.mockReturnValue({
      eq: mockEq,
      order: mockOrder
    })
    mockOrder.mockReturnValue({
      data: [],
      error: null
    })
  })

  describe('generateEmbedding', () => {
    it('should generate 512-dimension embedding', async () => {
      const embedding = await VectorSearch.generateEmbedding('test text')
      
      expect(embedding.length).toBe(512)
      expect(embedding.every(v => typeof v === 'number')).toBe(true)
    })
  })

  describe('addContent', () => {
    it('should add content with embedding to database', async () => {
      const mockContent = {
        subject: 'mathematics',
        topic: 'Algebra',
        subtopic: 'Linear Equations',
        content_type: 'question' as const,
        content: 'Solve 2x + 5 = 15',
        metadata: { difficulty: 'easy' }
      }

      const mockResponse = { id: 'test-id', ...mockContent }
      mockSingle.mockResolvedValue({ data: mockResponse, error: null })

      const result = await VectorSearch.addContent(mockContent)

      expect(mockFrom).toHaveBeenCalledWith('csec_content')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'mathematics',
          topic: 'Algebra',
          content: 'Solve 2x + 5 = 15',
          embedding: expect.any(Array)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should throw error on database failure', async () => {
      const mockContent = {
        subject: 'mathematics',
        topic: 'Algebra',
        subtopic: 'Test',
        content_type: 'question' as const,
        content: 'Test'
      }

      mockSingle.mockResolvedValue({ data: null, error: new Error('Database error') })

      await expect(VectorSearch.addContent(mockContent)).rejects.toThrow('Database error')
    })
  })

  describe('searchSimilarContent', () => {
    it('should search content using similarity function', async () => {
      const mockResults = [
        { id: '1', subject: 'mathematics', topic: 'Algebra', content: 'Content 1', similarity: 0.85 },
        { id: '2', subject: 'mathematics', topic: 'Algebra', content: 'Content 2', similarity: 0.75 }
      ]

      mockRpc.mockReturnValue({
        eq: mockEq,
        data: mockResults,
        error: null
      })
      mockEq.mockReturnValue({
        eq: mockEq,
        data: mockResults, 
        error: null
      })

      const result = await VectorSearch.searchSimilarContent('quadratic equations')

      expect(mockRpc).toHaveBeenCalledWith('search_csec_content', {
        query_embedding: expect.any(Array),
        match_threshold: 0.7,
        match_count: 5
      })
      expect(result).toEqual(mockResults)
    })

    it('should apply subject and topic filters', async () => {
      const mockResults = [{ id: '1', content: 'Filtered result' }]
      
      const mockEqChain = {
        eq: jest.fn().mockReturnThis(),
        data: mockResults,
        error: null
      }
      mockRpc.mockReturnValue(mockEqChain)

      await VectorSearch.searchSimilarContent(
        'test query',
        'mathematics',
        'Algebra',
        'question',
        10
      )

      expect(mockRpc).toHaveBeenCalledWith('search_csec_content', {
        query_embedding: expect.any(Array),
        match_threshold: 0.7,
        match_count: 10
      })
    })

    it('should throw error on search failure', async () => {
      mockRpc.mockReturnValue({
        eq: mockEq,
        data: null,
        error: new Error('Search failed')
      })
      mockEq.mockReturnValue({
        eq: mockEq,
        data: null,
        error: new Error('Search failed')
      })

      const result = await VectorSearch.searchSimilarContent('query')
      expect(result).toEqual([])
    })
  })

  describe('getContentByTopic', () => {
    it('should retrieve content filtered by subject and topic', async () => {
      const mockContent = [
        { id: '1', subject: 'mathematics', topic: 'Algebra', content: 'Content' }
      ]

      mockOrder.mockReturnValue({ data: mockContent, error: null })

      const result = await VectorSearch.getContentByTopic('mathematics', 'Algebra')

      expect(mockFrom).toHaveBeenCalledWith('csec_content')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(result).toEqual(mockContent)
    })
  })

  describe('getSubjects', () => {
    it('should retrieve unique subjects', async () => {
      const mockData = [
        { subject: 'mathematics' },
        { subject: 'english' },
        { subject: 'mathematics' }
      ]

      mockOrder.mockReturnValue({ data: mockData, error: null })

      const subjects = await VectorSearch.getSubjects()

      expect(mockFrom).toHaveBeenCalledWith('csec_content')
      expect(mockSelect).toHaveBeenCalledWith('subject')
      expect(subjects).toEqual(['mathematics', 'english'])
    })

    it('should handle empty results', async () => {
      mockOrder.mockReturnValue({ data: [], error: null })

      const subjects = await VectorSearch.getSubjects()

      expect(subjects).toEqual([])
    })
  })

  describe('getTopics', () => {
    it('should retrieve unique topics for a subject', async () => {
      const mockData = [
        { topic: 'Algebra' },
        { topic: 'Geometry' },
        { topic: 'Algebra' }
      ]

      mockOrder.mockReturnValue({ data: mockData, error: null })

      const topics = await VectorSearch.getTopics('mathematics')

      expect(mockFrom).toHaveBeenCalledWith('csec_content')
      expect(mockSelect).toHaveBeenCalledWith('topic')
      expect(topics).toEqual(['Algebra', 'Geometry'])
    })
  })
})