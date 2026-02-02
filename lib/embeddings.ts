/**
 * Embedding service with multiple provider options
 * Primary: Voyage AI (requires free API key - https://www.voyageai.com)
 * Fallback: Jina AI (requires API key - https://jina.ai)
 * Last resort: Deterministic pseudo-embedding for development
 * 
 * To get free API keys:
 * - Voyage AI: https://dash.voyageai.com (200M tokens/month free)
 * - Jina AI: https://jina.ai/api-dashboard/key-manager
 */

// Variable dimension - Voyage voyage-3-lite is 512, Jina v2-small is 512
// We'll store whatever dimension we get and handle it dynamically
const DEFAULT_EMBEDDING_DIMENSION = 512

// API endpoints
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const JINA_API_URL = 'https://api.jina.ai/v1/embeddings'

export interface EmbeddingResult {
  embedding: number[]
  dimension: number
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // Clean and truncate text
  const cleanText = text.trim().slice(0, 2000)
  
  // Try Voyage AI first (best quality, generous free tier)
  const voyageKey = process.env.VOYAGE_API_KEY
  if (voyageKey) {
    try {
      const response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${voyageKey}`
        },
        body: JSON.stringify({
          model: 'voyage-3-lite',
          input: [cleanText]
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.data && result.data[0] && result.data[0].embedding) {
          return result.data[0].embedding
        }
      } else {
        const errorText = await response.text()
        console.warn('Voyage AI error:', response.status, errorText)
      }
    } catch (error) {
      console.warn('Voyage AI embedding failed:', error)
    }
  }
  
  // Try Jina AI as fallback
  const jinaKey = process.env.JINA_API_KEY
  if (jinaKey) {
    try {
      const response = await fetch(JINA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jinaKey}`
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v2-small-en',
          input: [cleanText],
          normalized: true
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.data && result.data[0] && result.data[0].embedding) {
          return result.data[0].embedding
        }
      } else {
        const errorText = await response.text()
        console.warn('Jina AI error:', response.status, errorText)
      }
    } catch (error) {
      console.warn('Jina AI embedding failed:', error)
    }
  }
  
  // Try HuggingFace as last API option
  const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
  if (hfToken) {
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hfToken}`
        },
        body: JSON.stringify({
          inputs: cleanText,
          options: { wait_for_model: true }
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        const embedding = Array.isArray(result[0]) ? result[0] : result
        if (Array.isArray(embedding) && embedding.length > 0) {
          return embedding
        }
      }
    } catch (error) {
      console.warn('HuggingFace embedding failed:', error)
    }
  }
  
  // Last resort: deterministic pseudo-embedding for development
  console.warn('No embedding API key available - using fallback pseudo-embedding')
  console.warn('For production, add VOYAGE_API_KEY (free at https://dash.voyageai.com)')
  return generateFallbackEmbedding(cleanText)
}

/**
 * Fallback embedding using deterministic hash-based vectors
 * This provides consistent embeddings for the same text but with
 * less semantic accuracy than real embeddings
 */
function generateFallbackEmbedding(text: string): number[] {
  const embedding: number[] = new Array(DEFAULT_EMBEDDING_DIMENSION).fill(0)
  
  // Create a deterministic pseudo-embedding based on text content
  const words = text.toLowerCase().split(/\s+/)
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    for (let j = 0; j < word.length; j++) {
      const charCode = word.charCodeAt(j)
      const idx = (charCode * (i + 1) * (j + 1)) % DEFAULT_EMBEDDING_DIMENSION
      embedding[idx] += 1 / (1 + Math.log(i + 1))
    }
  }
  
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude
    }
  }
  
  return embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Process in batches to avoid rate limits
  const batchSize = 10
  const results: number[][] = []
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(generateEmbedding))
    results.push(...batchResults)
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  return results
}

export const EMBEDDING_CONFIG = {
  model: 'voyage-3-lite (512d) / jina-v2-small (512d)',
  dimension: DEFAULT_EMBEDDING_DIMENSION
}
