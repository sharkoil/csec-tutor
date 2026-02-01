import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openrouterApiKey = process.env.OPENROUTER_API_KEY

// OpenRouter client using OpenAI SDK with custom configuration
const openrouterClient = new OpenAI({
  apiKey: openrouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
  },
  dangerouslyAllowBrowser: true, // Allow in browser for development
})

// Model configurations optimized for different tasks
export const OPENROUTER_MODELS = {
  EMBEDDING: 'openai/text-embedding-3-small',
  COACHING: 'anthropic/claude-3-sonnet',
  QUESTIONS: 'anthropic/claude-3-haiku',
  EXAMS: 'anthropic/claude-3-sonnet'
} as const

export interface CoachingResponse {
  explanation: string
  examples: string[]
  key_points: string[]
  practice_tips: string[]
}

export class AICoach {
  static async generateFundamentalCoaching(
    subject: string,
    topic: string,
    userLevel?: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<CoachingResponse> {
    const systemPrompt = `You are a CSEC expert tutor specializing in ${subject}. 
    Provide comprehensive coaching for the topic "${topic}" at ${userLevel || 'intermediate'} level.
    
    Structure your response to include:
    1. Clear explanation of fundamental concepts
    2. Relevant examples from CSEC examinations
    3. Key points students must remember
    4. Practice tips and study strategies
    
    Use CSEC curriculum standards and ensure all content is curriculum-aligned.`

    const response = await openrouterClient.chat.completions.create({
      model: OPENROUTER_MODELS.COACHING,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Generate comprehensive coaching content for ${topic} in ${subject}. Include clear explanations, CSEC-style examples, key points, and study tips.`
        }
      ],
      temperature: 0.7,
    })

    const content = response.choices[0].message.content || ''
    
    return {
      explanation: this.extractSection(content, 'explanation'),
      examples: this.extractList(content, 'examples'),
      key_points: this.extractList(content, 'key points'),
      practice_tips: this.extractList(content, 'practice tips')
    }
  }

  static async generatePracticeQuestions(
    subject: string,
    topic: string,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    count: number = 5
  ) {
    const systemPrompt = `You are a CSEC examination creator for ${subject}. 
    Generate ${count} practice questions for the topic "${topic}" at ${difficulty} level.
    
    Requirements:
    1. Questions must align with CSEC format and style
    2. Include a mix of question types (multiple choice, short answer, structured)
    3. Provide clear instructions for each question
    4. Include suggested answers and marking schemes
    5. Reference question patterns from actual CSEC past papers

    Format your response as JSON with this structure:
    {
      "questions": [
        {
          "id": "1",
          "question": "the question text",
          "type": "multiple_choice|short_answer|structured",
          "marks": 3,
          "options": ["option A", "option B", "option C", "option D"],
          "answer": "correct answer",
          "explanation": "step-by-step explanation"
        }
      ]
    }`

    const response = await openrouterClient.chat.completions.create({
      model: OPENROUTER_MODELS.QUESTIONS,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Generate ${count} CSEC practice questions for ${topic} in ${subject}. Make them suitable for ${difficulty} level students.`
        }
      ],
      temperature: 0.6,
    })

    try {
      const content = response.choices[0].message.content || '{}'
      return content
    } catch (error) {
      console.error('Error parsing AI response:', error)
      return 'Failed to generate questions. Please try again.'
    }
  }

  static async generatePracticeExam(
    subject: string,
    topics: string[],
    duration: number = 60
  ) {
    const systemPrompt = `You are a CSEC examination creator for ${subject}.
    Create a practice exam covering the topics: ${topics.join(', ')}.
    
    Exam specifications:
    - Duration: ${duration} minutes
    - Mix of topics with appropriate weightage
    - Include Paper 1 style (multiple choice) and Paper 2 style (structured) questions
    - Total marks: 100
    - Clear instructions and time allocations
    - Answer key and marking scheme
    - Format similar to actual CSEC examinations

    Create a comprehensive practice exam that tests all specified topics.`

    const response = await openrouterClient.chat.completions.create({
      model: OPENROUTER_MODELS.EXAMS,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Generate a comprehensive CSEC practice exam for ${subject} covering ${topics.join(', ')}. Duration should be ${duration} minutes with total 100 marks.`
        }
      ],
      temperature: 0.5,
    })

    return {
      exam_content: response.choices[0].message.content || 'Exam generation failed. Please try again.',
      duration,
      topics,
      total_marks: 100
    }
  }

  private static extractSection(content: string, section: string): string {
    const regex = new RegExp(`${section}:?(.*?)(?=\n\n|\n[A-Z]|\n\d+\.|$)`, 'is')
    const match = content.match(regex)
    return match ? match[1].trim() : content
  }

  private static extractList(content: string, type: string): string[] {
    const regex = new RegExp(`${type}:?(.*?)(?=\n\n|\n[A-Z]|\n\d+\.|$)`, 'is')
    const match = content.match(regex)
    if (!match) return []
    
    return match[1]
      .trim()
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•') || /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^[-•]\s*|^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0)
  }
}