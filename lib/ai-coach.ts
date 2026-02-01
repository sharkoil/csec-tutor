import { VectorSearch } from './vector-search'
import OpenAI from 'openai'

const openrouterApiKey = process.env.OPENROUTER_API_KEY

// Use OpenRouter for all AI operations
const openai = new OpenAI({
  apiKey: openrouterApiKey || process.env.OPENAI_API_KEY!,
  baseURL: openrouterApiKey ? 'https://openrouter.ai/api/v1' : undefined,
  defaultHeaders: openrouterApiKey ? {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
  } : undefined
})

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
    const relevantContent = await VectorSearch.searchSimilarContent(
      `${subject} ${topic} fundamental concepts explanation`,
      subject,
      topic,
      'explanation',
      3
    )

    const systemPrompt = `You are a CSEC expert tutor specializing in ${subject}. 
    Provide comprehensive coaching for the topic "${topic}" at ${userLevel || 'intermediate'} level.
    
    Structure your response to include:
    1. Clear explanation of fundamental concepts
    2. Relevant examples from CSEC examinations
    3. Key points students must remember
    4. Practice tips and study strategies
    
    Use the provided context from CSEC materials to ensure accuracy and alignment with the curriculum.`

    const contextContent = relevantContent.map(item => item.content).join('\n\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Context from CSEC materials:\n${contextContent}\n\nPlease generate coaching content for ${topic} in ${subject}.`
        }
      ],
      temperature: 0.7,
    })

    const content = response.choices[0].message.content
    
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
    const pastQuestions = await VectorSearch.searchSimilarContent(
      `${subject} ${topic} practice questions`,
      subject,
      topic,
      'question',
      3
    )

    const systemPrompt = `You are a CSEC examination creator for ${subject}. 
    Generate ${count} practice questions for the topic "${topic}" at ${difficulty} level.
    
    Requirements:
    1. Questions must align with CSEC format and style
    2. Include a mix of question types (multiple choice, short answer, structured)
    3. Provide clear instructions for each question
    4. Include suggested answers and marking schemes
    5. Reference question patterns from actual CSEC past papers`

    const contextContent = pastQuestions.map(item => item.content).join('\n\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Context from CSEC past papers:\n${contextContent}\n\nGenerate ${count} practice questions for ${topic} in ${subject}.`
        }
      ],
      temperature: 0.6,
    })

    return response.choices[0].message.content
  }

  static async generatePracticeExam(
    subject: string,
    topics: string[],
    duration: number = 60
  ) {
    const examContent = await Promise.all(
      topics.map(topic => 
        VectorSearch.searchSimilarContent(
          `${subject} ${topic} exam questions`,
          subject,
          topic,
          'question',
          2
        )
      )
    ).then(results => results.flat())

    const systemPrompt = `You are a CSEC examination creator for ${subject}.
    Create a practice exam covering the topics: ${topics.join(', ')}.
    
    Exam specifications:
    - Duration: ${duration} minutes
    - Mix of topics with appropriate weightage
    - Include Paper 1 style (multiple choice) and Paper 2 style (structured) questions
    - Total marks: 100
    - Clear instructions and time allocations
    - Answer key and marking scheme
    - Format similar to actual CSEC examinations`

    const contextContent = examContent.map(item => item.content).join('\n\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Context from CSEC materials:\n${contextContent}\n\nGenerate a practice exam for ${subject}.`
        }
      ],
      temperature: 0.5,
    })

    return {
      exam_content: response.choices[0].message.content,
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