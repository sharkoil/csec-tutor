import { supabase } from './supabase'
import { generateEmbedding } from './embeddings'

export class VectorSearch {
  static async generateEmbedding(text: string): Promise<number[]> {
    return generateEmbedding(text)
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
    try {
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
      
      if (error) {
        // Log but don't fail - vector search is optional enhancement
        console.warn('Vector search failed (will continue without context):', error.message || error)
        return []
      }
      return data || []
    } catch (err) {
      // Vector search is an enhancement, not required for core functionality
      console.warn('Vector search error (continuing without context):', err)
      return []
    }
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