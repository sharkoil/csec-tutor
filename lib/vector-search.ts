import { supabase } from './supabase'
import OpenAI from 'openai'

function getOpenAIClient() {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY
  return new OpenAI({
    apiKey: openrouterApiKey || process.env.OPENAI_API_KEY || 'dummy-key-for-build',
    baseURL: openrouterApiKey ? 'https://openrouter.ai/api/v1' : undefined,
    defaultHeaders: openrouterApiKey ? {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
    } : undefined
  })
}

export class VectorSearch {
  static async generateEmbedding(text: string): Promise<number[]> {
    const response = await getOpenAIClient().embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return response.data[0].embedding
  }

  static async addContent(content: {
    subject: string
    topic: string
    subtopic: string
    content_type: 'syllabus' | 'question' | 'explanation' | 'example'
    content: string
    metadata?: any
  }) {
    const embedding = await this.generateEmbedding(content.content)
    
    const { data, error } = await supabase
      .from('csec_content')
      .insert({
        ...content,
        embedding,
        metadata: content.metadata || {}
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async searchSimilarContent(
    query: string,
    subject?: string,
    topic?: string,
    content_type?: string,
    limit: number = 5
  ) {
    const queryEmbedding = await this.generateEmbedding(query)
    
    let queryBuilder = supabase.rpc('search_csec_content', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit
    })

    if (subject) queryBuilder = queryBuilder.eq('subject', subject)
    if (topic) queryBuilder = queryBuilder.eq('topic', topic)
    if (content_type) queryBuilder = queryBuilder.eq('content_type', content_type)

    const { data, error } = await queryBuilder
    
    if (error) throw error
    return data
  }

  static async getContentByTopic(subject: string, topic: string) {
    const { data, error } = await supabase
      .from('csec_content')
      .select('*')
      .eq('subject', subject)
      .eq('topic', topic)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  }

  static async getSubjects(): Promise<string[]> {
    const { data, error } = await supabase
      .from('csec_content')
      .select('subject')
      .order('subject')

    if (error) throw error
    
    const subjects = [...new Set(data?.map(item => item.subject))]
    return subjects
  }

  static async getTopics(subject: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('csec_content')
      .select('topic')
      .eq('subject', subject)
      .order('topic')

    if (error) throw error
    
    const topics = [...new Set(data?.map(item => item.topic))]
    return topics
  }
}