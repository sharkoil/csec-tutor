import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/embeddings'
import { callWithFallback, TOKEN_BUDGETS } from '@/lib/model-config'
import { trackUsage, extractUsageFromResponse } from '@/lib/usage-tracking'

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

// Get relevant CSEC questions and content using vector search
async function getRelevantContent(subject: string, topic: string): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey) {
      return ''
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Generate embedding for the query
    const query = `${subject} ${topic} CSEC past paper questions practice problems`
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
    const { subject, topic, difficulty = 'medium', count = 5 } = await request.json()

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required' },
        { status: 400 }
      )
    }

    // Retrieve relevant CSEC content from vector database
    const relevantContent = await getRelevantContent(subject, topic)
    
    const contextSection = relevantContent 
      ? `\n\nRELEVANT CSEC CONTENT AND PAST QUESTIONS:\n${relevantContent}\n\nUse the above content as reference for creating authentic CSEC-style questions.`
      : ''

    const systemPrompt = `You are a CSEC examination question creator for ${subject}.
Generate ${count} practice questions for the topic "${topic}" at ${difficulty} difficulty level.${contextSection}

You MUST respond with valid JSON in exactly this format:
{
  "questions": [
    {
      "id": "1",
      "question": "The question text",
      "type": "multiple_choice",
      "marks": 2,
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "The correct option text",
      "explanation": "Why this is correct"
    },
    {
      "id": "2", 
      "question": "A short answer question",
      "type": "short_answer",
      "marks": 4,
      "answer": "The expected answer",
      "explanation": "Key points to include"
    }
  ]
}

Requirements:
- Include a mix of multiple_choice (2 marks each) and short_answer (4 marks each) questions
- Questions must align with CSEC ${subject} format and syllabus
- Use Caribbean context where appropriate
- Provide clear, unambiguous correct answers`

    const { result: response, model: usedModel, isFallback } = await callWithFallback(
      async (model) => openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate ${count} CSEC-style practice questions for ${topic} in ${subject}. Respond ONLY with valid JSON.` }
        ],
        temperature: 0.6,
        max_tokens: TOKEN_BUDGETS.practice.output,
      }),
      'structured'
    )

    // Track usage (fire-and-forget)
    trackUsage(extractUsageFromResponse(response, 'practice', usedModel, subject, topic)).catch(() => {})

    const content = response.choices[0].message.content || ''
    
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ questions: [] })
    }
  } catch (error) {
    console.error('OpenRouter API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate practice questions' },
      { status: 500 }
    )
  }
}
