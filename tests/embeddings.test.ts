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
    it('should use Voyage AI when API key is available', async () => {
      process.env.VOYAGE_API_KEY = 'test-voyage-key'
      
      const mockEmbedding = new Array(512).fill(0.1)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      })

      const { generateEmbedding } = await import('../lib/embeddings')
      const result = await generateEmbedding('test query')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.voyageai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-voyage-key'
          })
        })
      )
      expect(result).toEqual(mockEmbedding)
      expect(result.length).toBe(512)
    })

    it('should fall back to Jina AI if Voyage fails', async () => {
      process.env.VOYAGE_API_KEY = 'test-voyage-key'
      process.env.JINA_API_KEY = 'test-jina-key'
      
      const mockEmbedding = new Array(512).fill(0.2)
      
      // Voyage fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited'
      })
      
      // Jina succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      })

      const { generateEmbedding } = await import('../lib/embeddings')
      const result = await generateEmbedding('test query')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockEmbedding)
    })

    it('should use fallback pseudo-embedding when no API keys available', async () => {
      delete process.env.VOYAGE_API_KEY
      delete process.env.JINA_API_KEY
      delete process.env.HUGGINGFACE_API_KEY
      delete process.env.HF_TOKEN

      const { generateEmbedding } = await import('../lib/embeddings')
      const result = await generateEmbedding('test query for fallback')

      // Should return a 512-dimension embedding
      expect(result.length).toBe(512)
      // Should be normalized (magnitude close to 1)
      const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0))
      expect(magnitude).toBeCloseTo(1, 5)
    })

    it('should produce deterministic fallback embeddings for same input', async () => {
      delete process.env.VOYAGE_API_KEY
      delete process.env.JINA_API_KEY
      delete process.env.HUGGINGFACE_API_KEY

      const { generateEmbedding } = await import('../lib/embeddings')
      
      const result1 = await generateEmbedding('identical query')
      const result2 = await generateEmbedding('identical query')

      expect(result1).toEqual(result2)
    })

    it('should produce different fallback embeddings for different inputs', async () => {
      delete process.env.VOYAGE_API_KEY
      delete process.env.JINA_API_KEY
      delete process.env.HUGGINGFACE_API_KEY

      const { generateEmbedding } = await import('../lib/embeddings')
      
      const result1 = await generateEmbedding('query about algebra')
      const result2 = await generateEmbedding('query about geometry')

      expect(result1).not.toEqual(result2)
    })

    it('should truncate text to 2000 characters', async () => {
      process.env.VOYAGE_API_KEY = 'test-voyage-key'
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(512).fill(0.1) }]
        })
      })

      const longText = 'a'.repeat(5000)
      const { generateEmbedding } = await import('../lib/embeddings')
      await generateEmbedding(longText)

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(calledBody.input[0].length).toBe(2000)
    })

    it('should handle network errors gracefully', async () => {
      process.env.VOYAGE_API_KEY = 'test-voyage-key'
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { generateEmbedding } = await import('../lib/embeddings')
      const result = await generateEmbedding('test query')

      // Should fall back to pseudo-embedding
      expect(result.length).toBe(512)
    })
  })

  describe('generateEmbeddings (batch)', () => {
    it('should process multiple texts', async () => {
      delete process.env.VOYAGE_API_KEY
      delete process.env.JINA_API_KEY

      const { generateEmbeddings } = await import('../lib/embeddings')
      const texts = ['text 1', 'text 2', 'text 3']
      const results = await generateEmbeddings(texts)

      expect(results.length).toBe(3)
      results.forEach(embedding => {
        expect(embedding.length).toBe(512)
      })
    })
  })

  describe('EMBEDDING_CONFIG', () => {
    it('should export correct configuration', async () => {
      const { EMBEDDING_CONFIG } = await import('../lib/embeddings')

      expect(EMBEDDING_CONFIG.dimension).toBe(512)
      expect(EMBEDDING_CONFIG.model).toContain('voyage-3-lite')
    })
  })
})
