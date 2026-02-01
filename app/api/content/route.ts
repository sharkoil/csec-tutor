import { NextRequest, NextResponse } from 'next/server'
import { VectorSearch } from '@/lib/vector-search'

export async function POST(request: NextRequest) {
  try {
    const { subject, topic, content_type, limit = 10 } = await request.json()
    
    const results = await VectorSearch.searchSimilarContent(
      `${subject} ${topic}`,
      subject,
      topic,
      content_type,
      limit
    )
    
    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search content' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject')
    
    if (subject) {
      const topics = await VectorSearch.getTopics(subject)
      return NextResponse.json({ success: true, data: topics })
    }
    
    const subjects = await VectorSearch.getSubjects()
    return NextResponse.json({ success: true, data: subjects })
  } catch (error) {
    console.error('Content fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch content' },
      { status: 500 }
    )
  }
}