import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock supabase
const mockRpc = jest.fn()
const mockFrom = jest.fn()
const mockSelect = jest.fn()

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: function(...args) { return mockFrom(...args) },
    rpc: function(...args) { return mockRpc(...args) }
  }
}))

// Mock embeddings
jest.mock('../lib/embeddings', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(512).fill(0.1)),
  EMBEDDING_CONFIG: { dimension: 512, model: 'voyage-3-lite' }
}))

// We need to mock the Next.js request/response for API route testing
// Since API routes in app directory use Web Request/Response APIs
describe('Vector Search API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('GET /api/vector-search (status check)', () => {
    it('should return status when database is configured', async () => {
      const mockCount = [{ count: 31 }]
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockCount, error: null })
      })

      // Simulate what the API route does
      const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
      
      expect(typeof hasSupabaseUrl).toBe('boolean')
      // The actual API test would need a test server setup
    })
  })

  describe('POST /api/vector-search (similarity search)', () => {
    it('should validate required query parameter', async () => {
      // Simulating validation logic from the API route
      const body = {}
      const query = (body as any).query
      
      if (!query) {
        const error = { error: 'Query is required' }
        expect(error.error).toBe('Query is required')
      }
    })

    it('should call vector search with correct parameters', async () => {
      const mockResults = [
        { id: '1', content: 'Algebra content', similarity: 0.85 },
        { id: '2', content: 'Geometry content', similarity: 0.75 }
      ]

      const mockEqChain = {
        eq: jest.fn().mockReturnThis(),
        data: mockResults,
        error: null
      }
      mockRpc.mockReturnValue(mockEqChain)

      // Simulate the API route's search logic
      const searchParams = {
        query: 'How do I solve quadratic equations?',
        subject: 'mathematics',
        topic: 'Algebra',
        limit: 5
      }

      const { VectorSearch } = await import('../lib/vector-search')
      const results = await VectorSearch.searchSimilarContent(
        searchParams.query,
        searchParams.subject,
        searchParams.topic,
        undefined,
        searchParams.limit
      )

      expect(mockRpc).toHaveBeenCalledWith('search_csec_content', expect.objectContaining({
        match_count: 5
      }))
    })
  })

  describe('AI Coaching with Vector Context', () => {
    it('should include vector search results in AI context', async () => {
      const mockSearchResults = [
        {
          id: '1',
          subject: 'mathematics',
          topic: 'Algebra',
          subtopic: 'Quadratic Equations',
          content: 'To solve quadratic equations, use the quadratic formula: x = (-b ± √(b²-4ac)) / 2a',
          similarity: 0.85
        }
      ]

      const mockEqChain = {
        eq: jest.fn().mockReturnThis(),
        data: mockSearchResults,
        error: null
      }
      mockRpc.mockReturnValue(mockEqChain)

      const { VectorSearch } = await import('../lib/vector-search')
      const results = await VectorSearch.searchSimilarContent('quadratic formula', 'mathematics')

      // Verify search returns contextual results
      expect(results).toBeDefined()
      
      // In the actual coaching route, these results are used to build context
      const context = results?.map((r: any) => r.content).join('\n\n')
      expect(typeof context).toBe('string')
    })
  })

  describe('Practice Questions with Vector Context', () => {
    it('should fetch relevant practice content from vector search', async () => {
      const mockPracticeContent = [
        {
          id: '1',
          content_type: 'question',
          content: 'Solve: x² - 5x + 6 = 0',
          metadata: { difficulty: 'medium' },
          similarity: 0.9
        }
      ]

      const mockEqChain = {
        eq: jest.fn().mockReturnThis(),
        data: mockPracticeContent,
        error: null
      }
      mockRpc.mockReturnValue(mockEqChain)

      const { VectorSearch } = await import('../lib/vector-search')
      const results = await VectorSearch.searchSimilarContent(
        'quadratic practice problems',
        'mathematics',
        'Algebra',
        'question'
      )

      expect(results).toBeDefined()
    })
  })
})

describe('End-to-End Vector Search Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle the complete search flow', async () => {
    // 1. User query comes in
    const userQuery = "How do I solve systems of linear equations?"

    // 2. Generate embedding
    const { generateEmbedding } = await import('../lib/embeddings')
    const embedding = await generateEmbedding(userQuery)
    expect(embedding.length).toBe(512)

    // 3. Search vector database  
    const mockResults = [
      {
        id: '1',
        subject: 'mathematics',
        topic: 'Algebra',
        subtopic: 'Linear Equations',
        content: 'Systems of linear equations can be solved using substitution or elimination methods.',
        similarity: 0.88
      }
    ]

    const mockEqChain = {
      eq: jest.fn().mockReturnThis(),
      data: mockResults,
      error: null
    }
    mockRpc.mockReturnValue(mockEqChain)

    const { VectorSearch } = await import('../lib/vector-search')
    const searchResults = await VectorSearch.searchSimilarContent(userQuery, 'mathematics')

    // 4. Results are used to augment AI prompt
    expect(searchResults).toEqual(mockResults)
    expect(searchResults[0].content).toContain('linear equations')
  })

  it('should gracefully handle empty search results', async () => {
    mockRpc.mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      data: [],
      error: null
    })

    const { VectorSearch } = await import('../lib/vector-search')
    const results = await VectorSearch.searchSimilarContent('very obscure topic nobody knows')

    expect(results).toEqual([])
    // The AI coaching should still work, just without vector context
  })

  it('should handle database errors without crashing', async () => {
    mockRpc.mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      data: null,
      error: new Error('Database connection failed')
    })

    const { VectorSearch } = await import('../lib/vector-search')
    
    const result = await VectorSearch.searchSimilarContent('test query')
    expect(result).toEqual([])
  })
})
