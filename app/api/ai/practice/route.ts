import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
  }
})

export async function POST(request: NextRequest) {
  try {
    const { subject, topic, difficulty = 'medium', count = 5 } = await request.json()

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required' },
        { status: 400 }
      )
    }

    const systemPrompt = `You are a CSEC examination question creator for ${subject}.
Generate ${count} practice questions for the topic "${topic}" at ${difficulty} difficulty level.

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

    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate ${count} CSEC-style practice questions for ${topic} in ${subject}. Respond ONLY with valid JSON.` }
      ],
      temperature: 0.6,
    })

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
