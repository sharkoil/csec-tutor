import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const openrouterApiKey = process.env.OPENROUTER_API_KEY

if (!supabaseUrl || !supabaseAnonKey || !openrouterApiKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.error('   - OPENROUTER_API_KEY')
  console.error('')
  console.error('Please create a .env.local file with these variables set.')
  process.exit(1)
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create OpenRouter client
const openrouterClient = new OpenAI({
  apiKey: openrouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
  }
})

const OPENROUTER_MODELS = {
  EMBEDDING: 'openai/text-embedding-3-small',
  COACHING: 'anthropic/claude-3-sonnet',
  QUESTIONS: 'anthropic/claude-3-haiku',
  EXAMS: 'anthropic/claude-3-sonnet'
} as const

console.log('🔍 Testing OpenRouter connection...')

async function testOpenRouterConnection() {
  try {
    // Test embedding generation
    console.log('  📝 Testing embedding generation...')
    const embeddingResponse = await openrouterClient.embeddings.create({
      model: OPENROUTER_MODELS.EMBEDDING,
      input: 'CSEC mathematics test question',
    })
    
    if (embeddingResponse.data && embeddingResponse.data.length > 0) {
      console.log('  ✅ Embedding generation works')
      console.log(`  📊 Embedding dimensions: ${embeddingResponse.data[0].embedding.length}`)
    } else {
      throw new Error('Embedding generation failed')
    }

    // Test chat completion
    console.log('  💬 Testing chat completion...')
    const chatResponse = await openrouterClient.chat.completions.create({
      model: OPENROUTER_MODELS.QUESTIONS,
      messages: [
        {
          role: 'user',
          content: 'Generate one simple CSEC mathematics question'
        }
      ],
      max_tokens: 100
    })
    
    if (chatResponse.choices && chatResponse.choices.length > 0) {
      console.log('  ✅ Chat completion works')
      console.log(`  🤖 Model used: ${OPENROUTER_MODELS.QUESTIONS}`)
    } else {
      throw new Error('Chat completion failed')
    }

    // Test database connection
    console.log('  🗄️ Testing database connection...')
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`)
    }
    
    console.log('  ✅ Database connection works')
    
    console.log('')
    console.log('🎉 All systems operational!')
    console.log('')
    console.log('🤖 OpenRouter Configuration:')
    console.log(`   • Embedding Model: ${OPENROUTER_MODELS.EMBEDDING}`)
    console.log(`   • Coaching Model: ${OPENROUTER_MODELS.COACHING}`)
    console.log(`   • Questions Model: ${OPENROUTER_MODELS.QUESTIONS}`)
    console.log(`   • Exams Model: ${OPENROUTER_MODELS.EXAMS}`)
    console.log('')
    console.log('📊 Ready to populate with CSEC content!')
    console.log('Run: npm run populate-db-openrouter')
    
  } catch (error) {
    console.error('❌ OpenRouter connection failed:', error.message)
    console.log('')
    console.log('🔧 Possible issues:')
    console.log('• Invalid OpenRouter API key')
    console.log('• Insufficient OpenRouter credits')
    console.log('• Network connectivity issues')
    console.log('• Model availability problems')
    process.exit(1)
  }
}

testOpenRouterConnection()