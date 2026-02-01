import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

console.log('🔍 Testing database connection...')

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      throw new Error(`Database test failed: ${error.message}`)
    }
    
    console.log('✅ Database connection successful!')
    console.log('📊 Connected to:', supabaseUrl.replace(/https?:\/\//, ''))
    
    // Test pgvector extension
    const { data: vectorTest, error: vectorError } = await supabase
      .from('csec_content')
      .select('id')
      .limit(1)
    
    if (vectorError) {
      console.log('⚠️  Vector table may not exist:', vectorError.message)
    } else {
      console.log('✅ Vector search table ready')
    }
    
    // Test search function
    try {
      const { data: searchTest, error: searchError } = await supabase
        .rpc('search_csec_content', {
          query_embedding: Array(1536).fill(0),
          match_threshold: 0.7,
          match_count: 1
        })
      
      if (searchError) {
        console.log('⚠️  Search function may not exist:', searchError.message)
      } else {
        console.log('✅ Vector search function ready')
      }
    } catch (err) {
      console.log('⚠️  Search function not ready:', err.message)
    }
    
    console.log('')
    console.log('🎯 Database is ready for content population!')
    console.log('')
    console.log('Next steps:')
    console.log('1. Add OPENAI_API_KEY to .env.local')
    console.log('2. Run: npm run populate-db')
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    console.log('')
    console.log('🔧 Possible issues:')
    console.log('• Check if database schema was created')
    console.log('• Verify your Supabase URL and anon key')
    console.log('• Ensure project is not paused')
    console.log('• Check network connection')
  }
}

testConnection()