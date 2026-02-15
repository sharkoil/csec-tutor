import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
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

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const openai = getOpenAIClient()
    const { subject, topics, duration = 30 } = await request.json()

    if (!subject || !topics || !topics.length) {
      return NextResponse.json(
        { error: 'Subject and topics are required' },
        { status: 400 }
      )
    }

    const systemPrompt = `You are a CSEC examination creator for ${subject}.
Create a practice exam covering: ${topics.join(', ')}.

You MUST respond with valid JSON in exactly this format:
{
  "exam_content": "CSEC ${subject} Practice Exam - ${topics.join(', ')}\\n\\nTime: ${duration} minutes\\nTotal Marks: 50",
  "duration": ${duration},
  "topics": ${JSON.stringify(topics)},
  "total_marks": 50,
  "sections": [
    {
      "name": "Section A: Multiple Choice",
      "marks": 20,
      "questions": [
        {"id": "1", "question": "Question text here", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "A", "marks": 2},
        {"id": "2", "question": "Question text here", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "B", "marks": 2}
      ]
    },
    {
      "name": "Section B: Structured Questions",
      "marks": 30,
      "questions": [
        {"id": "B1", "question": "Structured question requiring detailed answer", "answer": "Model answer here", "marks": 10}
      ]
    }
  ]
}

REQUIREMENTS:
- Section A: Generate exactly 10 multiple choice questions (2 marks each = 20 marks)
- Section B: Generate 3 structured questions (10 marks each = 30 marks)
- Total: 13 questions, 50 marks
- All MCQ must have exactly 4 options (A, B, C, D)
- answer field for MCQ must be just the letter: "A", "B", "C", or "D"
- Questions should be appropriate for CSEC ${subject} level
- Include Caribbean context where appropriate
- Respond ONLY with the JSON object, no other text`

    const { result: response, model: usedModel, isFallback } = await callWithFallback(
      async (model) => openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a ${duration}-minute CSEC practice exam for ${subject} covering ${topics.join(', ')}. Respond ONLY with valid JSON.` }
        ],
        temperature: 0.5,
        max_tokens: TOKEN_BUDGETS.exam.output,
      }),
      'structured'
    )

    // Track usage (fire-and-forget)
    trackUsage(extractUsageFromResponse(response, 'exam', usedModel, subject, topics.join(', '))).catch(() => {})

    const content = response.choices[0].message.content || ''
    
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({
        exam_content: `CSEC ${subject} Practice Exam - ${topics.join(', ')}\n\nTime: ${duration} minutes\nTotal Marks: 50`,
        duration,
        topics,
        total_marks: 50
      })
    }
  } catch (error) {
    console.error('OpenRouter API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate exam' },
      { status: 500 }
    )
  }
}
