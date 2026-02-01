import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CSEC_SUBJECTS } from '@/data/subjects'

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

// Build subject/topic reference for the prompt
function buildSubjectReference(): string {
  return Object.entries(CSEC_SUBJECTS).map(([key, subject]) => {
    return `${subject.name}:\n  Topics: ${subject.topics.join(', ')}`
  }).join('\n\n')
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    const { description, attachments } = await request.json()

    if (!description && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Please provide a description or upload files' },
        { status: 400 }
      )
    }

    const openai = getOpenAIClient()
    const subjectReference = buildSubjectReference()

    // Build messages array
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a CSEC study plan advisor. Analyze the student's input and suggest the most appropriate subject and topics based on what they need help with.

Available CSEC subjects and their topics:

${subjectReference}

You MUST respond with valid JSON in exactly this format:
{
  "suggested_subject": "Mathematics",
  "suggested_topics": ["Algebra", "Relations, Functions and Graphs"],
  "help_areas": ["Solving quadratic equations", "Understanding function notation", "Graphing linear equations"],
  "confidence": 0.85,
  "reasoning": "The student mentions struggling with equations and graphing, which are core algebra and functions topics in CSEC Mathematics."
}

Rules:
- Only suggest subjects from the available list
- Only suggest topics that exist for the chosen subject
- help_areas should be specific skills or concepts the student needs to work on
- confidence should be 0.0-1.0 based on how clear the student's needs are
- If the input is too vague, still make your best guess but lower the confidence`
      }
    ]

    // Build user message content
    let userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []

    if (description) {
      userContent.push({
        type: 'text',
        text: `Student's description of what they need help with:\n\n${description}`
      })
    }

    // Handle attachments - for images, use vision; for documents, note their presence
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.type.startsWith('image/')) {
          // For images, use Claude's vision capability
          if (attachment.url.startsWith('data:')) {
            // Base64 image
            userContent.push({
              type: 'image_url',
              image_url: {
                url: attachment.url
              }
            })
          } else {
            // URL image
            userContent.push({
              type: 'image_url',
              image_url: {
                url: attachment.url
              }
            })
          }
          userContent.push({
            type: 'text',
            text: `[Attached image: ${attachment.name}] - Please analyze this image to understand what subject/topics the student needs help with.`
          })
        } else {
          // For PDFs/documents, we'll just mention them (Claude can't read PDFs directly)
          userContent.push({
            type: 'text',
            text: `[Attached document: ${attachment.name}] - The student has attached this ${attachment.type} file. Consider the filename when making suggestions.`
          })
        }
      }
    }

    if (userContent.length === 0) {
      userContent.push({
        type: 'text',
        text: 'The student wants help with CSEC studies but has not provided specific details. Suggest a popular subject like Mathematics with core topics.'
      })
    }

    messages.push({
      role: 'user',
      content: userContent
    })

    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages,
      temperature: 0.3,
      max_tokens: 1000
    })

    const content = response.choices[0].message.content || ''

    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      
      // Validate the suggested subject exists
      const subjectKey = Object.keys(CSEC_SUBJECTS).find(
        key => CSEC_SUBJECTS[key as keyof typeof CSEC_SUBJECTS].name === parsed.suggested_subject
      )
      
      if (!subjectKey) {
        // Default to Mathematics if invalid
        parsed.suggested_subject = 'Mathematics'
        parsed.suggested_topics = ['Algebra', 'Number Theory']
        parsed.confidence = 0.5
      } else {
        // Validate topics exist for the subject
        const validTopics = CSEC_SUBJECTS[subjectKey as keyof typeof CSEC_SUBJECTS].topics
        parsed.suggested_topics = parsed.suggested_topics.filter((t: string) => 
          validTopics.includes(t)
        )
        
        // Ensure at least one topic
        if (parsed.suggested_topics.length === 0) {
          parsed.suggested_topics = [validTopics[0]]
        }
      }

      return NextResponse.json(parsed)
    } catch {
      // Return default suggestion if parsing fails
      return NextResponse.json({
        suggested_subject: 'Mathematics',
        suggested_topics: ['Algebra', 'Number Theory'],
        help_areas: ['General mathematics concepts'],
        confidence: 0.3,
        reasoning: 'Could not analyze input properly. Defaulting to common subjects.'
      })
    }
  } catch (error) {
    console.error('Plan analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze study plan requirements' },
      { status: 500 }
    )
  }
}
