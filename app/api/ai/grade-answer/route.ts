import { NextRequest, NextResponse } from 'next/server'
import { callWithFallback, MODELS } from '@/lib/model-config'
import { trackUsage, extractUsageFromResponse } from '@/lib/usage-tracking'
import OpenAI from 'openai'

/**
 * Grade Answer API — Quick LLM call to evaluate a student's written answer
 * against a model answer. Uses STRUCTURED tier (GPT-4o-mini) for cost efficiency.
 */

function getOpenAIClient() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OpenRouter API key is required')
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { question, modelAnswer, studentAnswer, marks, subject, topic } = body

    if (!question || !studentAnswer) {
      return NextResponse.json(
        { error: 'Missing required fields: question, studentAnswer' },
        { status: 400 }
      )
    }

    if (studentAnswer.trim().length < 2) {
      return NextResponse.json(
        { error: 'Answer is too short to grade' },
        { status: 400 }
      )
    }

    const maxMarks = marks || 10
    const subjectName = subject || 'General'
    const topicName = topic || ''

    const systemPrompt = `You are an experienced CSEC (Caribbean Secondary Education Certificate) examiner for ${subjectName}. 
You are grading a student's answer to a ${topicName ? topicName + ' ' : ''}question worth ${maxMarks} mark${maxMarks > 1 ? 's' : ''}.

Grade fairly but encouragingly. CSEC examiners award marks for each valid point made.

Respond ONLY with valid JSON in this exact format:
{
  "score": <number 0 to ${maxMarks}>,
  "maxScore": ${maxMarks},
  "feedback": "<1-2 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "missingPoints": ["<key point student missed>"]
}`

    const userPrompt = `**Question:**
${question}

${modelAnswer ? `**Model Answer:**\n${modelAnswer}\n` : ''}
**Student's Answer:**
${studentAnswer}

Grade this answer out of ${maxMarks}. Award partial marks for partially correct answers.`

    const openai = getOpenAIClient()

    const { result, model, isFallback } = await callWithFallback(
      async (selectedModel: string) => {
        const response = await openai.chat.completions.create({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.3,
        })

        // Track usage
        const usage = extractUsageFromResponse(response, 'grade_answer', selectedModel, subject, topic)
        if (usage) {
          await trackUsage(usage).catch(() => {})
        }

        return response
      },
      'structured'
    )

    const raw = result.choices?.[0]?.message?.content?.trim() || ''

    // Parse JSON from response, handling potential markdown wrapping  
    let grading
    try {
      const jsonStr = raw.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      grading = JSON.parse(jsonStr)
    } catch {
      // If JSON parsing fails, return a structured fallback
      console.error('[grade-answer] Failed to parse LLM response as JSON:', raw)
      grading = {
        score: Math.round(maxMarks * 0.5),
        maxScore: maxMarks,
        feedback: raw || 'Unable to parse grading response. Please try again.',
        strengths: [],
        improvements: [],
        missingPoints: [],
      }
    }

    // Clamp score within valid range
    grading.score = Math.max(0, Math.min(maxMarks, Number(grading.score) || 0))
    grading.maxScore = maxMarks

    return NextResponse.json({
      ...grading,
      model,
      isFallback,
    })
  } catch (error: any) {
    console.error('[grade-answer] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to grade answer' },
      { status: 500 }
    )
  }
}
