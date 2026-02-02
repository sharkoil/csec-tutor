/**
 * Embedding service - Local-first with API fallbacks
 * 
 * Primary: Local embeddings via /api/embed (sentence-transformers all-MiniLM-L6-v2, 384-dim)
 * Fallback: Deterministic pseudo-embedding for development
 * 
 * The local endpoint uses @xenova/transformers which is the same model
 * used by bulk_populate_vectors.py, ensuring dimension compatibility.
 */

// Local embeddings with sentence-transformers all-MiniLM-L6-v2 (384 dimensions)
const DEFAULT_EMBEDDING_DIMENSION = 384

export interface EmbeddingResult {
  embedding: number[]
  dimension: number
}

/**
 * Get the base URL for API calls (works in both server and client contexts)
 */
function getBaseUrl(): string {
  // Server-side: use localhost
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  }
  // Client-side: use relative URL
  return ''
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // Clean and truncate text
  const cleanText = text.trim().slice(0, 2000)
  
  // Try local embedding endpoint first (matches stored vectors exactly)
  try {
    const baseUrl = getBaseUrl()
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: cleanText })
    })
    
    if (response.ok) {
      const result = await response.json()
      if (result.embedding && result.embedding.length === 384) {
        return result.embedding
      }
    } else {
      console.warn('Local embedding failed:', response.status)
    }
  } catch (error) {
    console.warn('Local embedding endpoint error:', error)
  }
  
  // Fallback: deterministic pseudo-embedding
  console.warn('Using fallback pseudo-embedding (local endpoint unavailable)')
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
  // Try batch processing via local endpoint
  try {
    const baseUrl = getBaseUrl()
    const cleanTexts = texts.map(t => t.trim().slice(0, 2000))
    
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ texts: cleanTexts })
    })
    
    if (response.ok) {
      const result = await response.json()
      if (result.embeddings && result.embeddings.length === texts.length) {
        return result.embeddings
      }
    }
  } catch (error) {
    console.warn('Batch embedding failed, falling back to sequential:', error)
  }
  
  // Fallback: process one at a time
  const results: number[][] = []
  for (const text of texts) {
    results.push(await generateEmbedding(text))
  }
  return results
}

export const EMBEDDING_CONFIG = {
  model: 'all-MiniLM-L6-v2 (sentence-transformers)',
  dimension: DEFAULT_EMBEDDING_DIMENSION  // 384 dimensions
}
