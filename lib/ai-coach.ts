import { VectorSearch } from './vector-search'
import { trackUsage, extractUsageFromResponse } from './usage-tracking'
import OpenAI from 'openai'

// Use Sonnet for deep, comprehensive coaching content
const AI_MODEL = 'anthropic/claude-sonnet-4-20250514'

// Subject classification for tailored coaching
const STEM_SUBJECTS = ['Mathematics', 'Biology', 'Chemistry', 'Physics']
const WRITING_SUBJECTS = ['English A', 'English B', 'History', 'Geography', 'Social Studies', 'Principles of Business']

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

function isSTEMSubject(subject: string): boolean {
  return STEM_SUBJECTS.some(s => subject.toLowerCase().includes(s.toLowerCase()))
}

function isWritingSubject(subject: string): boolean {
  return WRITING_SUBJECTS.some(s => subject.toLowerCase().includes(s.toLowerCase()))
}

export interface CoachingResponse {
  explanation: string
  examples: string[]
  key_points: string[]
  practice_tips: string[]
  // New enhanced fields
  graduated_examples?: GraduatedExample[]
  writing_guidance?: WritingGuidance
  pacing_notes?: string
}

export interface GraduatedExample {
  difficulty: 'easy' | 'easy-medium' | 'medium' | 'medium-hard' | 'hard'
  problem: string
  step_by_step_solution: string
  key_insight: string
  common_mistakes: string[]
}

export interface WritingGuidance {
  essay_structure: EssayStructure
  argument_building: string[]
  evidence_usage: string[]
  conclusion_techniques: string[]
  marking_scheme_tips: string[]
  sample_paragraphs: SampleParagraph[]
}

export interface EssayStructure {
  introduction_template: string
  body_paragraph_template: string
  conclusion_template: string
  transition_phrases: string[]
}

export interface SampleParagraph {
  type: 'introduction' | 'body' | 'conclusion'
  content: string
  annotations: string[]
}

export class AICoach {
  /**
   * Generate comprehensive, deep coaching content tailored to subject type.
   * - STEM subjects: 5 graduated difficulty examples with step-by-step solutions
   * - Writing subjects: Essay structure, argument building, sample paragraphs
   */
  static async generateFundamentalCoaching(
    subject: string,
    topic: string,
    userLevel?: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<CoachingResponse> {
    const relevantContent = await VectorSearch.searchSimilarContent(
      `${subject} ${topic} fundamental concepts explanation examples`,
      subject,
      topic,
      'explanation',
      5
    )

    const contextContent = relevantContent.map((item: { content: string }) => item.content).join('\n\n')
    const level = userLevel || 'intermediate'

    // Route to appropriate coaching generator based on subject type
    if (isSTEMSubject(subject)) {
      return this.generateSTEMCoaching(subject, topic, level, contextContent)
    } else if (isWritingSubject(subject)) {
      return this.generateWritingCoaching(subject, topic, level, contextContent)
    } else {
      return this.generateGeneralCoaching(subject, topic, level, contextContent)
    }
  }

  /**
   * STEM Coaching: Deep mathematical/scientific explanations with 5 graduated examples
   */
  private static async generateSTEMCoaching(
    subject: string,
    topic: string,
    level: string,
    contextContent: string
  ): Promise<CoachingResponse> {
    const systemPrompt = `You are a world-class CSEC ${subject} tutor preparing students for their most important examinations.
Your goal is to provide DEEP, COMPREHENSIVE coaching that truly helps students master "${topic}".

YOU MUST STRUCTURE YOUR RESPONSE EXACTLY AS FOLLOWS:

## PART 1: CONCEPTUAL FOUNDATION
Provide a thorough explanation of the underlying concepts. Don't just define terms - explain WHY things work the way they do. Connect to real-world applications Caribbean students can relate to. Build understanding from first principles.

## PART 2: FIVE GRADUATED EXAMPLES (CRITICAL - DO NOT SKIP)
You MUST provide exactly 5 worked examples, progressing from easy to hard. For EACH example:

### EXAMPLE 1 (EASY) - Confidence Builder
**Problem:** [State a straightforward problem that introduces the basic concept]
**Step-by-Step Solution:**
- Step 1: [Explain what we're doing and why]
- Step 2: [Continue with clear reasoning]
- [Continue until solved]
**Key Insight:** [What fundamental principle does this demonstrate?]
**Common Mistakes to Avoid:** [List 1-2 mistakes students often make here]

### EXAMPLE 2 (EASY-MEDIUM) - Building Skills
**Problem:** [Slightly more complex, requires combining concepts]
**Step-by-Step Solution:**
[Full detailed solution with reasoning]
**Key Insight:** [What new skill does this add?]
**Common Mistakes to Avoid:** [1-2 common errors]

### EXAMPLE 3 (MEDIUM) - Core Competency
**Problem:** [Standard CSEC exam difficulty question]
**Step-by-Step Solution:**
[Full detailed solution - this is what they'll see on the exam]
**Key Insight:** [Core exam skill this develops]
**Common Mistakes to Avoid:** [2-3 common errors]

### EXAMPLE 4 (MEDIUM-HARD) - Challenge Level
**Problem:** [More complex application or multi-step problem]
**Step-by-Step Solution:**
[Full detailed solution with all reasoning]
**Key Insight:** [Advanced understanding this builds]
**Common Mistakes to Avoid:** [2-3 mistakes even good students make]

### EXAMPLE 5 (HARD) - Mastery Level
**Problem:** [Challenging problem that would earn distinction-level marks]
**Step-by-Step Solution:**
[Complete solution showing sophisticated problem-solving]
**Key Insight:** [What separates excellent students]
**Common Mistakes to Avoid:** [Subtle errors to watch for]

## PART 3: KEY POINTS TO MEMORIZE
List 8-10 crucial facts, formulas, or principles that MUST be committed to memory. These should be exam-ready.

## PART 4: PRACTICE STRATEGY
Provide specific, actionable study tips:
- How to approach this topic systematically
- Time management for this type of problem in exams
- How to check your work
- Links between this topic and others in the syllabus

## PART 5: PACING YOUR LEARNING
Suggest how to spread studying this topic over multiple sessions. Students should NOT try to learn everything at once. Provide a realistic 3-5 session study plan.

Remember: These students are preparing for the most important exams of their academic lives so far. Give them the deep, thorough preparation they deserve.`

    const startTime = Date.now()
    const response = await getOpenAIClient().chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `CSEC Curriculum Context:\n${contextContent}\n\nGenerate comprehensive coaching for "${topic}" in ${subject} at ${level} level. This is for Caribbean secondary students preparing for CSEC examinations.`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })
    const latencyMs = Date.now() - startTime

    const usageRecord = extractUsageFromResponse(response, 'stem-coaching', AI_MODEL, subject, topic)
    usageRecord.latency_ms = latencyMs
    trackUsage(usageRecord)

    const content = response.choices[0].message.content || ''
    
    return {
      explanation: this.extractMarkdownSection(content, 'CONCEPTUAL FOUNDATION'),
      examples: this.extractExamplesList(content),
      key_points: this.extractMarkdownList(content, 'KEY POINTS TO MEMORIZE'),
      practice_tips: this.extractMarkdownList(content, 'PRACTICE STRATEGY'),
      graduated_examples: this.parseGraduatedExamples(content),
      pacing_notes: this.extractMarkdownSection(content, 'PACING YOUR LEARNING')
    }
  }

  /**
   * Writing/Humanities Coaching: Essay structure, argument building, sample paragraphs
   */
  private static async generateWritingCoaching(
    subject: string,
    topic: string,
    level: string,
    contextContent: string
  ): Promise<CoachingResponse> {
    const systemPrompt = `You are a world-class CSEC ${subject} tutor specializing in helping students master written responses and essay-based examinations.
Your goal is to provide DEEP, COMPREHENSIVE coaching on "${topic}" that transforms how students approach writing-based questions.

YOU MUST STRUCTURE YOUR RESPONSE EXACTLY AS FOLLOWS:

## PART 1: UNDERSTANDING THE TOPIC
Provide thorough coverage of the CONTENT knowledge students need. Don't just list facts - explain:
- Key concepts and their significance
- Historical/geographical/social context (as appropriate)
- Connections between ideas
- How this topic typically appears in CSEC exams

## PART 2: HOW TO STRUCTURE YOUR RESPONSE
CSEC examiners are looking for well-organized responses. Teach students:

### Essay Structure Template
**Introduction (1 paragraph):**
[Provide a fill-in-the-blank template they can adapt]
Example opening: "[Topic] is significant because... This essay will examine [3 key points]..."

**Body Paragraphs (3-4 paragraphs):**
[Provide the PEEL/PEE structure or similar]
- Point: State your main idea
- Evidence: Provide specific facts, examples, or quotes
- Explanation: Analyze how the evidence supports your point
- Link: Connect back to the question

**Conclusion (1 paragraph):**
[Template for strong conclusions]
"In conclusion, [restate main argument]. The evidence presented demonstrates that... [final insight]."

### Transition Phrases to Use
[List 15-20 useful transition phrases for Caribbean students]

## PART 3: BUILDING STRONG ARGUMENTS
Teach students HOW TO THINK about writing responses:
- How to analyze what the question is really asking
- How to brainstorm relevant points quickly
- How to select the strongest evidence
- How to make their writing more persuasive
- How to address counter-arguments (where appropriate)

## PART 4: USING EVIDENCE EFFECTIVELY
- Types of evidence valued in ${subject}
- How to integrate quotes/data smoothly
- How much detail is enough?
- Common evidence-related mistakes

## PART 5: SAMPLE PARAGRAPHS (CRITICAL - SHOW DON'T JUST TELL)
Provide 3 fully-written sample paragraphs related to "${topic}":

### Sample Introduction
[Write a complete, high-quality introduction paragraph on an aspect of ${topic}]
📝 **Why this works:** [Annotate what makes it effective]

### Sample Body Paragraph  
[Write a complete, well-evidenced body paragraph]
📝 **Why this works:** [Annotate the structure and evidence use]

### Sample Conclusion
[Write a complete conclusion that synthesizes the argument]
📝 **Why this works:** [Annotate the techniques used]

## PART 6: MARKING SCHEME INSIGHTS
Help students understand how CSEC examiners award marks:
- What earns full marks vs. partial marks
- Common reasons students lose marks
- How to allocate time based on mark value
- Keywords that signal what examiners want

## PART 7: KEY CONTENT TO KNOW
List 10-12 specific facts, dates, definitions, or concepts related to "${topic}" that students should memorize.

## PART 8: PRACTICE STRATEGY
- How to practice essay writing effectively
- Timed practice recommendations
- Self-evaluation checklist
- How to learn from model answers

## PART 9: PACING YOUR LEARNING
Suggest a realistic study plan for mastering both the content and writing skills for this topic. Break into 4-6 manageable sessions.

Remember: Many students struggle with written exams not because they don't know the content, but because they don't know HOW to present it. Teach them both.`

    const startTime = Date.now()
    const response = await getOpenAIClient().chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `CSEC Curriculum Context:\n${contextContent}\n\nGenerate comprehensive coaching for "${topic}" in ${subject} at ${level} level. Focus on both content mastery AND writing skills for Caribbean secondary students preparing for CSEC examinations.`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })
    const latencyMs = Date.now() - startTime

    const usageRecord = extractUsageFromResponse(response, 'writing-coaching', AI_MODEL, subject, topic)
    usageRecord.latency_ms = latencyMs
    trackUsage(usageRecord)

    const content = response.choices[0].message.content || ''
    
    return {
      explanation: this.extractMarkdownSection(content, 'UNDERSTANDING THE TOPIC'),
      examples: this.extractSampleParagraphsList(content),
      key_points: this.extractMarkdownList(content, 'KEY CONTENT TO KNOW'),
      practice_tips: this.extractMarkdownList(content, 'PRACTICE STRATEGY'),
      writing_guidance: this.parseWritingGuidance(content),
      pacing_notes: this.extractMarkdownSection(content, 'PACING YOUR LEARNING')
    }
  }

  /**
   * General coaching for subjects that don't fit STEM or Writing categories
   */
  private static async generateGeneralCoaching(
    subject: string,
    topic: string,
    level: string,
    contextContent: string
  ): Promise<CoachingResponse> {
    const systemPrompt = `You are a world-class CSEC ${subject} tutor preparing students for their most important examinations.
Provide COMPREHENSIVE coaching for "${topic}" at ${level} level.

Structure your response with:

## CONCEPTUAL FOUNDATION
Thorough explanation of core concepts with real-world Caribbean context.

## WORKED EXAMPLES
Provide 5 examples progressing from easy to hard, each with:
- Problem statement
- Complete solution with reasoning
- Key insight
- Common mistakes

## KEY POINTS
10 essential facts or concepts to memorize.

## PRACTICE STRATEGY
Specific study tips and exam techniques.

## STUDY PACING
How to spread learning across multiple sessions.`

    const startTime = Date.now()
    const response = await getOpenAIClient().chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `CSEC Curriculum Context:\n${contextContent}\n\nGenerate coaching for "${topic}" in ${subject} at ${level} level.`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })
    const latencyMs = Date.now() - startTime

    const usageRecord = extractUsageFromResponse(response, 'general-coaching', AI_MODEL, subject, topic)
    usageRecord.latency_ms = latencyMs
    trackUsage(usageRecord)

    const content = response.choices[0].message.content || ''
    
    return {
      explanation: this.extractMarkdownSection(content, 'CONCEPTUAL FOUNDATION'),
      examples: this.extractExamplesList(content),
      key_points: this.extractMarkdownList(content, 'KEY POINTS'),
      practice_tips: this.extractMarkdownList(content, 'PRACTICE STRATEGY'),
      pacing_notes: this.extractMarkdownSection(content, 'STUDY PACING')
    }
  }

  // Helper methods for parsing enhanced responses
  private static extractMarkdownSection(content: string, heading: string): string {
    const headingVariants = [
      `## PART \\d+: ${heading}`,
      `## ${heading}`,
      `### ${heading}`,
      `${heading}:`,
      `**${heading}**`
    ]
    
    for (const pattern of headingVariants) {
      const regex = new RegExp(`${pattern}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n### EXAMPLE|$)`, 'i')
      const match = content.match(regex)
      if (match && match[1].trim().length > 50) {
        return match[1].trim()
      }
    }
    
    return content.substring(0, 2000) // Fallback to first portion
  }

  private static extractMarkdownList(content: string, heading: string): string[] {
    const section = this.extractMarkdownSection(content, heading)
    const lines = section.split('\n')
    const items: string[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.match(/^[-•*]\s+/) || trimmed.match(/^\d+[\.\)]\s+/)) {
        const cleaned = trimmed.replace(/^[-•*]\s+/, '').replace(/^\d+[\.\)]\s+/, '')
        if (cleaned.length > 10) {
          items.push(cleaned)
        }
      }
    }
    
    return items.length > 0 ? items : [section.substring(0, 500)]
  }

  private static extractExamplesList(content: string): string[] {
    const examples: string[] = []
    const exampleRegex = /### EXAMPLE \d+ \([^)]+\)[^#]*?(?=### EXAMPLE|\n## |$)/gi
    const matches = content.match(exampleRegex)
    
    if (matches) {
      for (const match of matches) {
        examples.push(match.trim())
      }
    }
    
    return examples
  }

  private static extractSampleParagraphsList(content: string): string[] {
    const samples: string[] = []
    const sampleRegex = /### Sample (Introduction|Body Paragraph|Conclusion)[^#]*?(?=### Sample|## PART|\n## |$)/gi
    const matches = content.match(sampleRegex)
    
    if (matches) {
      for (const match of matches) {
        samples.push(match.trim())
      }
    }
    
    return samples
  }

  private static parseGraduatedExamples(content: string): GraduatedExample[] {
    const examples: GraduatedExample[] = []
    const difficulties: Array<'easy' | 'easy-medium' | 'medium' | 'medium-hard' | 'hard'> = 
      ['easy', 'easy-medium', 'medium', 'medium-hard', 'hard']
    
    for (let i = 0; i < 5; i++) {
      const exampleRegex = new RegExp(
        `### EXAMPLE ${i + 1}[^#]*?\\*\\*Problem:\\*\\*([^*]+)\\*\\*Step-by-Step Solution:\\*\\*([^*]+)\\*\\*Key Insight:\\*\\*([^*]+)\\*\\*Common Mistakes`,
        'is'
      )
      const match = content.match(exampleRegex)
      
      if (match) {
        examples.push({
          difficulty: difficulties[i],
          problem: match[1].trim(),
          step_by_step_solution: match[2].trim(),
          key_insight: match[3].trim(),
          common_mistakes: []
        })
      }
    }
    
    return examples
  }

  private static parseWritingGuidance(content: string): WritingGuidance {
    return {
      essay_structure: {
        introduction_template: this.extractMarkdownSection(content, 'Introduction') || 
          'State your thesis and outline your main points...',
        body_paragraph_template: this.extractMarkdownSection(content, 'Body Paragraphs') ||
          'Point, Evidence, Explanation, Link...',
        conclusion_template: this.extractMarkdownSection(content, 'Conclusion') ||
          'Summarize main points and provide final insight...',
        transition_phrases: this.extractMarkdownList(content, 'Transition Phrases')
      },
      argument_building: this.extractMarkdownList(content, 'BUILDING STRONG ARGUMENTS'),
      evidence_usage: this.extractMarkdownList(content, 'USING EVIDENCE EFFECTIVELY'),
      conclusion_techniques: [],
      marking_scheme_tips: this.extractMarkdownList(content, 'MARKING SCHEME INSIGHTS'),
      sample_paragraphs: []
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

    const contextContent = pastQuestions.map((item: { content: string }) => item.content).join('\n\n')

    const startTime = Date.now()
    const response = await getOpenAIClient().chat.completions.create({
      model: AI_MODEL,
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
    const latencyMs = Date.now() - startTime

    // Track usage asynchronously
    const usageRecord = extractUsageFromResponse(response, 'practice-questions', AI_MODEL, subject, topic)
    usageRecord.latency_ms = latencyMs
    trackUsage(usageRecord)

    return response.choices[0].message.content || ''
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

    const contextContent = examContent.map((item: { content: string }) => item.content).join('\n\n')

    const startTime = Date.now()
    const response = await getOpenAIClient().chat.completions.create({
      model: AI_MODEL,
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
    const latencyMs = Date.now() - startTime

    // Track usage asynchronously
    const usageRecord = extractUsageFromResponse(response, 'practice-exam', AI_MODEL, subject, topics.join(', '))
    usageRecord.latency_ms = latencyMs
    trackUsage(usageRecord)

    return {
      exam_content: response.choices[0].message.content || '',
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