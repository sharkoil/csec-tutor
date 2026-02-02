/**
 * Test the HuggingFace embedding service
 */
import { generateEmbedding, EMBEDDING_CONFIG } from '../lib/embeddings'

async function testEmbedding() {
  console.log('Testing HuggingFace Embedding Service')
  console.log('=====================================')
  console.log(`Model: ${EMBEDDING_CONFIG.model}`)
  console.log(`Expected Dimension: ${EMBEDDING_CONFIG.dimension}`)
  console.log('')
  
  const testText = 'Solve the quadratic equation 2x² - 5x + 3 = 0 using factorization.'
  
  console.log(`Test Input: "${testText}"`)
  console.log('')
  
  try {
    const startTime = Date.now()
    const embedding = await generateEmbedding(testText)
    const duration = Date.now() - startTime
    
    console.log(`✓ Success!`)
    console.log(`  Embedding dimension: ${embedding.length}`)
    console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
    console.log(`  Time: ${duration}ms`)
    console.log('')
    console.log('Embedding service is working correctly!')
    
  } catch (error) {
    console.error('✗ Failed!')
    console.error(`  Error: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}

testEmbedding()
