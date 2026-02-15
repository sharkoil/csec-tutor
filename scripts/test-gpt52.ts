import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'CSEC Tutor',
  }
})

async function test() {
  console.log('Testing openai/gpt-5.2...')
  try {
    const res = await client.chat.completions.create({
      model: 'openai/gpt-5.2',
      messages: [{ role: 'user', content: 'Say hello in 5 words' }],
      max_tokens: 50
    })
    console.log('SUCCESS! Model returned by OpenRouter:', res.model)
    console.log('Response:', res.choices[0].message.content)
  } catch (err: any) {
    console.error('FAILED:', err.message)
    console.error('Status:', err.status)
    console.error('Error type:', err.constructor.name)
    if (err.error) console.error('Error body:', JSON.stringify(err.error, null, 2))
  }
}
test()
