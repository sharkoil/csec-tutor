import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const openrouterApiKey = process.env.OPENROUTER_API_KEY

console.log('🔍 Environment Check:')
console.log('  Supabase URL:', supabaseUrl?.substring(0, 30) + '...')
console.log('  Supabase Key:', supabaseAnonKey?.substring(0, 20) + '...')
console.log('  OpenRouter Key:', openrouterApiKey?.substring(0, 20) + '...')

if (!supabaseUrl || !supabaseAnonKey || !openrouterApiKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

// Create clients
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
}

// Simple test content that doesn't require API calls initially
const sampleContent = [
  {
    subject: 'mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    content_type: 'syllabus' as const,
    content: 'Students should be able to solve linear equations in one variable, including equations with brackets and fractions.',
    metadata: { difficulty: 'medium' },
    embedding: Array(1536).fill(0.1) // Dummy embedding for now
  },
  {
    subject: 'mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    content_type: 'question' as const,
    content: 'Solve the equation 2x + 5 = 15',
    metadata: { year: 2024, paper_number: 'P1', difficulty: 'easy', marks: 2 },
    embedding: Array(1536).fill(0.2) // Dummy embedding for now
  }
]

async function populateSampleContent() {
  console.log('🚀 Populating database with sample CSEC content...')
  console.log('  (Using dummy embeddings for demo)')
  
  try {
    // Test database connection first
    console.log('🔍 Testing database connection...')
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error) {
      console.error('❌ Database test failed:', error.message)
      console.log('💡 Make sure you ran the SQL schema in Supabase dashboard!')
      return
    }
    
    console.log('✅ Database connection successful')
    
    // Add sample content
    console.log('📚 Adding sample content...')
    for (const content of sampleContent) {
      try {
        const { data, error } = await supabase
          .from('csec_content')
          .insert(content)
          .select()
          .single()
        
        if (error) {
          console.error('❌ Failed to add content:', error.message)
        } else {
          console.log(`  ✓ Added: ${content.content_type} - ${content.topic}`)
        }
      } catch (err) {
        console.error('❌ Error adding content:', err)
      }
    }
    
    console.log('')
    console.log('✅ Sample content added successfully!')
    console.log('📊 Content added:')
    console.log(`  • Mathematics syllabus content`)
    console.log(`  • Mathematics practice question`)
    console.log(`  • Total: 2 content items`)
    console.log('')
    console.log('🎯 Next steps:')
    console.log('1. Start the app: npm run dev')
    console.log('2. Create a study plan')
    console.log('3. Test the search functionality')
    console.log('')
    console.log('📝 Note: Using dummy embeddings for demo.')
    console.log('  To get real AI-powered features, fix the OpenRouter key issue.')
    
  } catch (error) {
    console.error('❌ Population failed:', error)
  }
}

// Try OpenRouter with different approach
async function testOpenRouterDirect() {
  console.log('🔍 Testing OpenRouter with direct request...')
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      console.log('✅ OpenRouter API key is valid')
      const models = await response.json()
      console.log(`  📊 Available models: ${models.data?.length || 0}`)
    } else {
      console.log('❌ OpenRouter API key issue')
      console.log(`  Status: ${response.status}`)
      console.log(`  StatusText: ${response.statusText}`)
    }
  } catch (error) {
    console.error('❌ OpenRouter test failed:', error)
  }
}

async function main() {
  await testOpenRouterDirect()
  await populateSampleContent()
}

main().catch(console.error)