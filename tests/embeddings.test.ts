import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Embeddings Service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    mockFetch.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateEmbedding', () => {
    it('should use local /api/embed endpoint', async () => {
      const mockEmbedding = new Array(384).fill(0.1)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding })
      })

      const { generateEmbedding } = await import('../lib/embeddings')
      const result = await generateEmbedding('test query')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/embed'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
      expect(result).toEqual(mockEmbedding)
      expect(result.length).toBe(384)
    })

    it('should fall back to pseudo-embedding when /api/embed fails', async () => {
      // /api/embed fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error'
      })

      const { generateEmbedding } = await import('../lib/embeddings')
      const result = await generateEmbedding('test query')

      // Should fall back to pseudo-embedding (384 dims)
      expect(result.length).toBe(384)
      // Should be normalized (magnitude close to 1)
      const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0))
      expect(magnitude).toBeCloseTo(1, 5)
    })

    it('should use fallback pseudo-embedding when network errors occur', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { generateEmbedding } = await import('../lib/embeddings')
      const result = await generateEmbedding('test query for fallback')

      // Should return a 384-dimension embedding
      expect(result.length).toBe(384)
      // Should be normalized (magnitude close to 1)
      const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0))
      expect(magnitude).toBeCloseTo(1, 5)
    })

    it('should produce deterministic fallback embeddings for same input', async () => {
      // Both calls fail to trigger fallback
      mockFetch.mockRejectedValue(new Error('No endpoint'))

      const { generateEmbedding } = await import('../lib/embeddings')
      
      const result1 = await generateEmbedding('identical query')
      const result2 = await generateEmbedding('identical query')

      expect(result1).toEqual(result2)
    })

    it('should produce different fallback embeddings for different inputs', async () => {
      mockFetch.mockRejectedValue(new Error('No endpoint'))

      const { generateEmbedding } = await import('../lib/embeddings')
      
      const result1 = await generateEmbedding('query about algebra')
      const result2 = await generateEmbedding('query about geometry')

      expect(result1).not.toEqual(result2)
    })

    it('should truncate text to 2000 characters', async () => {
      const mockEmbedding = new Array(384).fill(0.1)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding })
      })

      const longText = 'a'.repeat(5000)
      const { generateEmbedding } = await import('../lib/embeddings')
      await generateEmbedding(longText)

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(calledBody.text.length).toBe(2000)
    })
  })

  describe('generateEmbeddings (batch)', () => {
    it('should process multiple texts', async () => {
      mockFetch.mockRejectedValue(new Error('No endpoint'))

      const { generateEmbeddings } = await import('../lib/embeddings')
      const texts = ['text 1', 'text 2', 'text 3']
      const results = await generateEmbeddings(texts)

      expect(results.length).toBe(3)
      results.forEach(embedding => {
        expect(embedding.length).toBe(384)
      })
    })
  })

  describe('EMBEDDING_CONFIG', () => {
    it('should export correct configuration', async () => {
      const { EMBEDDING_CONFIG } = await import('../lib/embeddings')

      expect(EMBEDDING_CONFIG.dimension).toBe(384)
      expect(EMBEDDING_CONFIG.model).toContain('all-MiniLM-L6-v2')
    })
  })
})
