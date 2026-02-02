/**
 * Local Embedding API Endpoint
 * 
 * Generates 384-dim embeddings using the same model as bulk_populate_vectors.py
 * Uses @xenova/transformers (ONNX runtime) for local inference - no API calls needed
 */

import { NextRequest, NextResponse } from 'next/server'

// Dynamic import to avoid issues with server-side rendering
let pipeline: any = null
let embeddingPipeline: any = null

async function getEmbeddingPipeline() {
  if (embeddingPipeline) {
    return embeddingPipeline
  }
  
  if (!pipeline) {
    const transformers = await import('@xenova/transformers')
    pipeline = transformers.pipeline
  }
  
  // Load the same model used by the Python script
  embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true // Use quantized model for faster inference
  })
  
  return embeddingPipeline
}

function meanPooling(embeddings: number[][], attentionMask: number[]): number[] {
  // Mean pooling - take average of token embeddings weighted by attention mask
  const embeddingDim = embeddings[0].length
  const result = new Array(embeddingDim).fill(0)
  let totalWeight = 0
  
  for (let i = 0; i < embeddings.length; i++) {
    const weight = attentionMask[i]
    totalWeight += weight
    for (let j = 0; j < embeddingDim; j++) {
      result[j] += embeddings[i][j] * weight
    }
  }
  
  // Normalize
  for (let j = 0; j < embeddingDim; j++) {
    result[j] /= totalWeight
  }
  
  // L2 normalize
  const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0))
  for (let j = 0; j < embeddingDim; j++) {
    result[j] /= magnitude
  }
  
  return result
}

export async function POST(request: NextRequest) {
  try {
    const { text, texts } = await request.json()
    
    // Handle single text or array of texts
    const inputTexts = texts || (text ? [text] : null)
    
    if (!inputTexts || inputTexts.length === 0) {
      return NextResponse.json(
        { error: 'Missing text or texts parameter' },
        { status: 400 }
      )
    }
    
    const pipe = await getEmbeddingPipeline()
    
    // Generate embeddings for all texts
    const embeddings: number[][] = []
    
    for (const t of inputTexts) {
      const output = await pipe(t, { pooling: 'mean', normalize: true })
      // Convert to regular array
      const embedding = Array.from(output.data as Float32Array)
      embeddings.push(embedding)
    }
    
    // Return single embedding or array based on input
    if (text && !texts) {
      return NextResponse.json({
        embedding: embeddings[0],
        dimension: embeddings[0].length,
        model: 'all-MiniLM-L6-v2'
      })
    }
    
    return NextResponse.json({
      embeddings,
      dimension: embeddings[0]?.length || 384,
      model: 'all-MiniLM-L6-v2'
    })
    
  } catch (error) {
    console.error('Embedding generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate embedding', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    model: 'all-MiniLM-L6-v2',
    dimension: 384,
    description: 'Local embedding endpoint using sentence-transformers compatible model'
  })
}
