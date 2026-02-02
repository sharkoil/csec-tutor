import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/embeddings'

// Initialize Supabase client lazily
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    throw new Error('Supabase URL not configured')
  }
  
  return createClient(supabaseUrl, supabaseKey!)
}

export async function POST(req: NextRequest) {
  try {
    const { query, subject, topic, content_type, limit = 5 } = await req.json()
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }
    
    const supabase = getSupabaseClient()
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)
    
    // Call the vector search function
    const { data, error } = await supabase.rpc('search_csec_content', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit
    })
    
    if (error) {
      console.error('Vector search error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Filter by subject/topic/content_type if provided
    let results = data || []
    if (subject) results = results.filter((r: any) => r.subject === subject)
    if (topic) results = results.filter((r: any) => r.topic === topic)
    if (content_type) results = results.filter((r: any) => r.content_type === content_type)
    
    return NextResponse.json({ 
      results,
      query,
      count: results.length
    })
    
  } catch (error) {
    console.error('Vector search error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Vector search failed'
    }, { status: 500 })
  }
}

// GET endpoint to check if vector search is configured
export async function GET() {
  try {
    const supabase = getSupabaseClient()
    
    // Check if csec_content table exists and has data
    const { data, error, count } = await supabase
      .from('csec_content')
      .select('id', { count: 'exact', head: true })
    
    if (error) {
      return NextResponse.json({ 
        status: 'error', 
        message: error.message,
        configured: false
      })
    }
    
    return NextResponse.json({ 
      status: 'ok',
      configured: true,
      content_count: count || 0
    })
    
  } catch (error) {
    return NextResponse.json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      configured: false
    })
  }
}
