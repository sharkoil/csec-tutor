/**
 * Debug embedding APIs
 */

async function debugJina() {
  console.log('Testing Jina AI API...')
  
  const text = 'Solve the quadratic equation 2x² - 5x + 3 = 0 using factorization.'
  
  try {
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v2-small-en',
        input: [text],
        normalized: true
      })
    })
    
    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)
    
    const responseText = await response.text()
    console.log('Response:', responseText.substring(0, 500))
    
    if (response.ok) {
      const data = JSON.parse(responseText)
      if (data.data && data.data[0] && data.data[0].embedding) {
        console.log('Embedding dimension:', data.data[0].embedding.length)
        console.log('First 5 values:', data.data[0].embedding.slice(0, 5))
      }
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

debugJina()
