import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/embeddings'

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
    }
  })
}

// Get relevant CSEC content using vector search
async function getRelevantContent(subject: string, topic: string): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey) {
      return ''
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Generate embedding for the query
    const query = `${subject} ${topic} CSEC syllabus concepts explanations`
    const embedding = await generateEmbedding(query)
    
    // Search for relevant content
    const { data, error } = await supabase.rpc('search_csec_content', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5
    })
    
    if (error || !data || data.length === 0) {
      return ''
    }
    
    // Format the relevant content for the AI
    const relevantContent = data
      .filter((item: any) => item.subject === subject)
      .map((item: any) => `[${item.content_type.toUpperCase()}] ${item.subtopic}:\n${item.content}`)
      .join('\n\n---\n\n')
    
    return relevantContent
  } catch (error) {
    console.error('Vector search error:', error)
    return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const openai = getOpenAIClient()
    const { subject, topic, userLevel = 'intermediate' } = await request.json()

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required' },
        { status: 400 }
      )
    }

    // Retrieve relevant CSEC content from vector database
    const relevantContent = await getRelevantContent(subject, topic)
    
    const contextSection = relevantContent 
      ? `\n\nRELEVANT CSEC SYLLABUS AND CONTENT:\n${relevantContent}\n\nUse the above official CSEC content to ensure your response is curriculum-aligned.`
      : ''

    const systemPrompt = `You are a CSEC expert tutor specializing in ${subject}. 
Provide comprehensive coaching for the topic "${topic}" at ${userLevel} level.${contextSection}

You MUST respond with valid JSON in exactly this format:
{
  "explanation": "A detailed explanation of the fundamental concepts (2-3 paragraphs)",
  "examples": ["Example 1 with details", "Example 2 with details", "Example 3 with details"],
  "key_points": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"],
  "practice_tips": ["Tip 1", "Tip 2", "Tip 3"]
}

Focus on:
1. Clear explanation of fundamental concepts relevant to CSEC ${subject}
2. Caribbean-context examples that students can relate to
3. Key points essential for CSEC exam success
4. Practical study tips and strategies`

    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate comprehensive CSEC coaching content for ${topic} in ${subject}. Respond ONLY with valid JSON.` }
      ],
      temperature: 0.7,
    })

    const content = response.choices[0].message.content || ''
    
    // Try to parse as JSON
    try {
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      return NextResponse.json(parsed)
    } catch {
      // If parsing fails, return structured fallback from the text
      return NextResponse.json({
        explanation: content,
        examples: [],
        key_points: [],
        practice_tips: []
      })
    }
  } catch (error) {
    console.error('OpenRouter API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate coaching content' },
      { status: 500 }
    )
  }
}
