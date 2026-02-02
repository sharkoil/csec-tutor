import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/embeddings'
import { trackUsage, extractUsageFromResponse } from '@/lib/usage-tracking'

// Use Sonnet for deep, comprehensive coaching
const AI_MODEL = 'anthropic/claude-sonnet-4-20250514'

// Subject classification for tailored coaching
const STEM_SUBJECTS = ['Mathematics', 'Biology', 'Chemistry', 'Physics']
const WRITING_SUBJECTS = ['English A', 'English B', 'History', 'Geography', 'Social Studies', 'Principles of Business']

function isSTEMSubject(subject: string): boolean {
  return STEM_SUBJECTS.some(s => subject.toLowerCase().includes(s.toLowerCase()))
}

function isWritingSubject(subject: string): boolean {
  return WRITING_SUBJECTS.some(s => subject.toLowerCase().includes(s.toLowerCase()))
}

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

// Get relevant CSEC content using vector search
async function getRelevantContent(subject: string, topic: string): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey) {
      return ''
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Generate embedding for the query
    const query = `${subject} ${topic} CSEC syllabus concepts explanations examples`
    const embedding = await generateEmbedding(query)
    
    // Search for relevant content
    const { data, error } = await supabase.rpc('search_csec_content', {
      query_embedding: embedding,
      match_threshold: 0.4,
      match_count: 8
    })
    
    if (error || !data || data.length === 0) {
      return ''
    }
    
    // Format the relevant content for the AI
    const relevantContent = data
      .filter((item: any) => item.subject === subject)
      .map((item: any) => `[${item.content_type.toUpperCase()}] ${item.subtopic}:\n${item.content}`)
      .join('\n\n---\n\n')
    
    return relevantContent
  } catch (error) {
    console.error('Vector search error:', error)
    return ''
  }
}

// Generate STEM coaching prompt with 5 graduated examples
function getSTEMPrompt(subject: string, topic: string, userLevel: string, relevantContent: string): string {
  const contextSection = relevantContent 
    ? `\n\nCSEC CURRICULUM CONTEXT:\n${relevantContent}\n\nGround your response in this official curriculum content.`
    : ''

  return `You are a world-class CSEC ${subject} tutor preparing students for their most important examinations.
Your goal is to provide DEEP, COMPREHENSIVE coaching that truly helps students master "${topic}".${contextSection}

YOU MUST RESPOND WITH VALID JSON in this exact structure. This is CRITICAL - the application will parse your response as JSON.

{
  "explanation": "A thorough 3-4 paragraph explanation of the underlying concepts. Don't just define terms - explain WHY things work the way they do. Connect to real-world Caribbean applications. Build understanding from first principles.",
  
  "graduated_examples": [
    {
      "difficulty": "easy",
      "problem": "A straightforward problem that introduces the basic concept",
      "step_by_step_solution": "Step 1: [What we're doing and why]\\nStep 2: [Continue with clear reasoning]\\nStep 3: [And so on until solved]",
      "key_insight": "What fundamental principle does this demonstrate?",
      "common_mistakes": ["Mistake 1 students often make", "Mistake 2 to avoid"]
    },
    {
      "difficulty": "easy-medium",
      "problem": "Slightly more complex, requires combining concepts",
      "step_by_step_solution": "Full detailed solution with reasoning at each step",
      "key_insight": "What new skill does this add?",
      "common_mistakes": ["Common error 1", "Common error 2"]
    },
    {
      "difficulty": "medium",
      "problem": "Standard CSEC exam difficulty question - this is what they'll see on the actual exam",
      "step_by_step_solution": "Complete step-by-step solution showing CSEC-level problem solving",
      "key_insight": "Core exam skill this develops",
      "common_mistakes": ["Error 1", "Error 2", "Error 3 even good students make"]
    },
    {
      "difficulty": "medium-hard",
      "problem": "More complex application or multi-step problem requiring deeper thinking",
      "step_by_step_solution": "Full detailed solution with all reasoning shown",
      "key_insight": "Advanced understanding this builds",
      "common_mistakes": ["Subtle error 1", "Subtle error 2"]
    },
    {
      "difficulty": "hard",
      "problem": "Challenging problem that would earn distinction-level marks on CSEC",
      "step_by_step_solution": "Complete solution demonstrating sophisticated problem-solving approach",
      "key_insight": "What separates excellent students from average ones",
      "common_mistakes": ["Advanced trap 1", "Conceptual error to watch for"]
    }
  ],
  
  "key_points": [
    "Crucial fact or formula #1 that MUST be memorized",
    "Crucial fact or formula #2",
    "Crucial fact or formula #3",
    "Crucial fact or formula #4",
    "Crucial fact or formula #5",
    "Crucial fact or formula #6",
    "Crucial fact or formula #7",
    "Crucial fact or formula #8"
  ],
  
  "practice_tips": [
    "Specific, actionable study tip #1",
    "Time management advice for this type of problem",
    "How to check your work effectively",
    "Links between this topic and others in the CSEC syllabus"
  ],
  
  "examples": [],
  
  "pacing_notes": "Suggest how to spread studying this topic over 3-5 sessions. Session 1: [focus area]. Session 2: [focus area]. Etc. Students should NOT try to learn everything at once."
}

Generate coaching for "${topic}" in CSEC ${subject} at ${userLevel} level.
The students are preparing for the most important exams of their academic lives. Give them the deep, thorough preparation they deserve.
Respond ONLY with valid JSON - no markdown, no code blocks, just raw JSON.`
}

// Generate Writing/Humanities coaching prompt with essay structure
function getWritingPrompt(subject: string, topic: string, userLevel: string, relevantContent: string): string {
  const contextSection = relevantContent 
    ? `\n\nCSEC CURRICULUM CONTEXT:\n${relevantContent}\n\nGround your response in this official curriculum content.`
    : ''

  return `You are a world-class CSEC ${subject} tutor specializing in helping students master written responses and essay-based examinations.
Your goal is to provide DEEP, COMPREHENSIVE coaching on "${topic}" that transforms how students approach writing-based questions.${contextSection}

YOU MUST RESPOND WITH VALID JSON in this exact structure:

{
  "explanation": "Thorough 3-4 paragraph coverage of the CONTENT knowledge students need. Key concepts and their significance. Historical/geographical/social context as appropriate. How this topic typically appears in CSEC exams.",
  
  "writing_guidance": {
    "essay_structure": {
      "introduction_template": "A fill-in-the-blank template students can adapt. Example: '[Topic] is significant because... In this response, I will examine [point 1], [point 2], and [point 3]...'",
      "body_paragraph_template": "PEEL structure template: Point - State your main idea clearly. Evidence - Provide specific facts, examples, dates, or quotes. Explanation - Analyze how the evidence supports your point. Link - Connect back to the question and transition to next point.",
      "conclusion_template": "In conclusion, [restate main argument]. The evidence presented demonstrates that... [provide final insight that shows deep understanding].",
      "transition_phrases": ["Furthermore", "However", "In contrast", "Similarly", "As a result", "This demonstrates that", "Building on this", "It is important to note", "In the context of the Caribbean", "Evidence suggests", "A key example is", "This is significant because", "Moreover", "Nevertheless", "Consequently"]
    },
    "argument_building": [
      "How to analyze what the CSEC question is really asking",
      "How to brainstorm relevant points quickly under exam pressure", 
      "How to select the strongest evidence from your knowledge",
      "How to make your writing more persuasive and analytical",
      "How to address counter-arguments where appropriate"
    ],
    "evidence_usage": [
      "Types of evidence valued in ${subject} (specific facts, dates, examples, case studies)",
      "How to integrate evidence smoothly into your paragraphs",
      "How much detail is enough - quality over quantity",
      "Common evidence-related mistakes that lose marks"
    ],
    "marking_scheme_tips": [
      "What earns full marks vs. partial marks on ${subject} papers",
      "Common reasons students lose marks (vague answers, lack of examples)",
      "How to allocate time based on mark value of questions",
      "Keywords in questions that signal what examiners want (analyze, compare, evaluate, etc.)"
    ]
  },
  
  "examples": [
    "SAMPLE INTRODUCTION for a question on ${topic}:\\n[Write a complete, high-quality introduction paragraph]\\n\\n📝 Why this works: [Annotate what makes it effective - thesis statement, road map, engagement with question]",
    "SAMPLE BODY PARAGRAPH:\\n[Write a complete, well-evidenced body paragraph using PEEL structure]\\n\\n📝 Why this works: [Annotate the structure, evidence integration, and analysis]",
    "SAMPLE CONCLUSION:\\n[Write a complete conclusion that synthesizes the argument]\\n\\n📝 Why this works: [Annotate the summarization technique and final insight]"
  ],
  
  "key_points": [
    "Specific fact, date, or definition #1 related to ${topic}",
    "Specific fact #2 students should memorize",
    "Specific fact #3",
    "Specific fact #4",
    "Specific fact #5",
    "Specific fact #6",
    "Key concept #7",
    "Key concept #8",
    "Important example #9",
    "Important example #10"
  ],
  
  "practice_tips": [
    "How to practice essay writing effectively (timed practice, peer review)",
    "Self-evaluation checklist for your responses",
    "How to learn from model answers and past papers",
    "Building your evidence bank for ${subject}"
  ],
  
  "pacing_notes": "Study plan for mastering both content AND writing skills: Session 1: [Content focus]. Session 2: [Practice introduction writing]. Session 3: [Body paragraph practice]. Session 4: [Full essay under timed conditions]. Session 5: [Review and refine]."
}

Generate coaching for "${topic}" in CSEC ${subject} at ${userLevel} level.
Many students struggle with written exams not because they don't know content, but because they don't know HOW to present it. Teach them both.
Respond ONLY with valid JSON - no markdown, no code blocks, just raw JSON.`
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
    const { subject, topic, userLevel = 'intermediate' } = await request.json()

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required' },
        { status: 400 }
      )
    }

    // Retrieve relevant CSEC content from vector database
    const relevantContent = await getRelevantContent(subject, topic)
    
    // Select appropriate prompt based on subject type
    let systemPrompt: string
    let coachingType: string
    
    if (isSTEMSubject(subject)) {
      systemPrompt = getSTEMPrompt(subject, topic, userLevel, relevantContent)
      coachingType = 'stem-coaching'
    } else if (isWritingSubject(subject)) {
      systemPrompt = getWritingPrompt(subject, topic, userLevel, relevantContent)
      coachingType = 'writing-coaching'
    } else {
      // Default to STEM-style for unknown subjects
      systemPrompt = getSTEMPrompt(subject, topic, userLevel, relevantContent)
      coachingType = 'general-coaching'
    }

    const startTime = Date.now()
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate comprehensive CSEC coaching content for "${topic}" in ${subject}. Respond ONLY with valid JSON.` }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })
    const latencyMs = Date.now() - startTime

    // Track usage
    const usageRecord = extractUsageFromResponse(response, coachingType, AI_MODEL, subject, topic)
    usageRecord.latency_ms = latencyMs
    trackUsage(usageRecord)

    const content = response.choices[0].message.content || ''
    
    // Try to parse as JSON
    try {
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      
      // Ensure required fields exist
      const result = {
        explanation: parsed.explanation || '',
        examples: parsed.examples || [],
        key_points: parsed.key_points || [],
        practice_tips: parsed.practice_tips || [],
        graduated_examples: parsed.graduated_examples || undefined,
        writing_guidance: parsed.writing_guidance || undefined,
        pacing_notes: parsed.pacing_notes || undefined
      }
      
      return NextResponse.json(result)
    } catch {
      // If parsing fails, return structured fallback from the text
      console.error('Failed to parse AI response as JSON, returning text fallback')
      return NextResponse.json({
        explanation: content,
        examples: [],
        key_points: [],
        practice_tips: [],
        pacing_notes: 'Study this topic across multiple sessions for better retention.'
      })
    }
  } catch (error) {
    console.error('OpenRouter API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate coaching content' },
      { status: 500 }
    )
  }
}
