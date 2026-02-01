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
  "exam_content": "CSEC ${subject} Practice Exam\\n\\nTime: ${duration} minutes\\nTotal Marks: 50\\n\\nSection A: Multiple Choice (20 marks)\\n[Questions here]\\n\\nSection B: Structured Questions (30 marks)\\n[Questions here]",
  "duration": ${duration},
  "topics": ${JSON.stringify(topics)},
  "total_marks": 50,
  "sections": [
    {
      "name": "Section A: Multiple Choice",
      "marks": 20,
      "questions": [
        {"id": "1", "question": "Question text", "options": ["A", "B", "C", "D"], "answer": "A", "marks": 2}
      ]
    },
    {
      "name": "Section B: Structured",
      "marks": 30,
      "questions": [
        {"id": "1", "question": "Question text", "answer": "Expected answer", "marks": 10}
      ]
    }
  ]
}

Requirements:
- Format similar to actual CSEC ${subject} examinations
- Include Paper 1 style (multiple choice) and Paper 2 style (structured) questions
- Caribbean context where appropriate
- Clear marking scheme`

    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a ${duration}-minute CSEC practice exam for ${subject} covering ${topics.join(', ')}. Respond ONLY with valid JSON.` }
      ],
      temperature: 0.5,
    })

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
