import { VectorSearch } from './vector-search'
import { trackUsage, extractUsageFromResponse } from './usage-tracking'
import { MODELS, callWithFallback, getOpenRouterCredits } from './model-config'
import OpenAI from 'openai'

/**
 * AI Coach - Generates deep textbook-quality lessons for CSEC topics
 * 
 * Uses tiered model selection:
 * - LESSON tier (Claude Sonnet 4): Main narrative content
 * - UTILITY tier (Claude Haiku): Study guides, key points (lazy-loaded)
 * - Falls back to free model when credits exhausted
 */

// Subject classification for tailored content  
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

/**
 * TextbookLesson - Deep narrative lesson (2000-2500 words)
 * This is the primary output format for coaching content
 */
export interface TextbookLesson {
  // Main narrative content in markdown (2000-2500 words)
  content: string
  // Model used to generate (for display/tracking)
  model: string
  // Whether fallback model was used
  isFallback: boolean
  // Generation timestamp
  generatedAt: string
  // Subject and topic for caching
  subject: string
  topic: string
}

/**
 * StudyGuide - Lazy-loaded supplementary content (generated with cheaper model)
 */
export interface StudyGuide {
  keyPoints: string[]
  quickReference: string
  practiceCheckpoints: string[]
  examTips: string[]
}

/**
 * Legacy interface for backward compatibility
 */
export interface CoachingResponse {
  explanation: string
  examples: string[]
  key_points: string[]
  practice_tips: string[]
  // New enhanced fields
  graduated_examples?: GraduatedExample[]
  writing_guidance?: WritingGuidance
  pacing_notes?: string
  // New textbook fields
  narrativeContent?: string
  model?: string
  isFallback?: boolean
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
   * Generate deep textbook-quality lesson (2000-2500 words)
   * This is the PRIMARY method for generating coaching content.
   * Uses callWithFallback for automatic free model fallback on credit exhaustion.
   */
  static async generateTextbookLesson(
    subject: string,
    topic: string
  ): Promise<TextbookLesson> {
    // Get relevant curriculum context
    const relevantContent = await VectorSearch.searchSimilarContent(
      `${subject} ${topic} CSEC syllabus concepts explanations examples past papers`,
      subject,
      topic,
      'explanation',
      8
    )
    const contextContent = relevantContent.map((item: { content: string }) => item.content).join('\n\n---\n\n')

    // Select appropriate prompt based on subject type
    const prompt = this.getTextbookPrompt(subject, topic, contextContent)
    
    const openai = getOpenAIClient()
    const startTime = Date.now()

    // Use callWithFallback for automatic retry with free model on 402
    const { result: response, model, isFallback } = await callWithFallback(
      async (modelToUse) => {
        return await openai.chat.completions.create({
          model: modelToUse,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          temperature: 0.7,
          max_tokens: 6000, // Allow for 2000-2500 word lessons
        })
      },
      'lesson' // Use LESSON tier
    )
    
    const latencyMs = Date.now() - startTime

    // Track usage
    const usageRecord = extractUsageFromResponse(response, 'textbook-lesson', model, subject, topic)
    usageRecord.latency_ms = latencyMs
    trackUsage(usageRecord)

    const content = response.choices[0].message.content || ''

    return {
      content,
      model,
      isFallback,
      generatedAt: new Date().toISOString(),
      subject,
      topic
    }
  }

  /**
   * Generate the textbook-style prompt based on subject type
   */
  private static getTextbookPrompt(subject: string, topic: string, contextContent: string): { system: string; user: string } {
    const contextSection = contextContent 
      ? `\n\n## OFFICIAL CSEC CURRICULUM CONTEXT\nUse this content to ground your lesson in the actual syllabus:\n\n${contextContent}`
      : ''

    if (isSTEMSubject(subject)) {
      return this.getSTEMTextbookPrompt(subject, topic, contextSection)
    } else if (isWritingSubject(subject)) {
      return this.getWritingTextbookPrompt(subject, topic, contextSection)
    } else {
      return this.getGeneralTextbookPrompt(subject, topic, contextSection)
    }
  }

  /**
   * STEM textbook prompt - focuses on mathematical/scientific reasoning
   */
  private static getSTEMTextbookPrompt(subject: string, topic: string, contextSection: string): { system: string; user: string } {
    const system = `You are a master ${subject} educator writing a chapter of a comprehensive CSEC preparation textbook. Your writing should be engaging, thorough, and designed to build DEEP understanding—not superficial memorization.

## YOUR MISSION
Write a complete lesson on "${topic}" that could stand alone as a textbook chapter. This lesson should be 2000-2500 words of flowing, pedagogically sound content.

## STRUCTURE YOUR LESSON AS FOLLOWS

### 1. OPENING HOOK (1-2 paragraphs)
Start with something that makes students CARE about this topic:
- A real-world Caribbean application
- A thought-provoking question
- A common misconception to address
- A historical story about the development of this concept

### 2. BUILDING THE FOUNDATION (3-4 paragraphs)
Develop the core concepts from first principles:
- Don't just state definitions—explain WHY they matter
- Build from simpler ideas to more complex ones
- Use analogies Caribbean students can relate to
- Address the intuition behind the mathematics/science

### 3. WORKED EXAMPLES (The Heart of Your Lesson)
Provide 5 progressively challenging worked examples. Each should feel like a natural continuation of the narrative, not a disconnected problem. Format each as:

**Example 1: [Descriptive Title]** _(Confidence Builder)_
[Present the problem in context]
_Solution:_ Walk through each step, explaining your thinking. Don't just show what to do—explain why.
_Key Insight:_ What principle does this reinforce?

**Example 2: [Descriptive Title]** _(Building Skills)_
...continue the progression...

**Example 3: [Descriptive Title]** _(CSEC Exam Level)_
This should match typical CSEC difficulty.

**Example 4: [Descriptive Title]** _(Challenge Level)_
Multi-step or application problem.

**Example 5: [Descriptive Title]** _(Distinction Level)_
The kind of problem that separates excellent students.

### 4. COMMON PITFALLS (2-3 paragraphs)
Discuss mistakes students commonly make with this topic:
- Why students make these mistakes
- How to recognize when you're falling into these traps
- Strategies to avoid them

### 5. CONNECTING THE DOTS (1-2 paragraphs)
- How does this topic connect to other areas of ${subject}?
- Where will students see these concepts again in the CSEC syllabus?
- Real-world applications in Caribbean context

### 6. SELF-CHECK QUESTIONS (Brief section)
Provide 3-4 questions students can use to test their understanding. Include answers in parentheses.

## WRITING STYLE
- Write in second person ("you") to engage the reader directly
- Use clear, accessible language—avoid unnecessary jargon
- When technical terms are necessary, explain them
- Include encouragement—remind students they CAN master this
- Format mathematics clearly using proper notation${contextSection}`

    const user = `Write a complete 2000-2500 word textbook lesson on "${topic}" in CSEC ${subject}. 

This should be a flowing, narrative lesson—not a bulleted outline. Write it as if you're explaining directly to a student who needs to truly understand this topic for their CSEC examination.

Output the lesson in clean Markdown format.`

    return { system, user }
  }

  /**
   * Writing/Humanities textbook prompt - focuses on essay structure and content
   */
  private static getWritingTextbookPrompt(subject: string, topic: string, contextSection: string): { system: string; user: string } {
    const system = `You are a master ${subject} educator writing a chapter of a comprehensive CSEC preparation textbook. Your writing should be engaging, thorough, and designed to help students both UNDERSTAND the content and EXPRESS that understanding effectively on exams.

## YOUR MISSION
Write a complete lesson on "${topic}" that could stand alone as a textbook chapter. This lesson should be 2000-2500 words covering both the CONTENT and HOW TO WRITE ABOUT IT.

## STRUCTURE YOUR LESSON AS FOLLOWS

### 1. OPENING ENGAGEMENT (1-2 paragraphs)
Draw students into the topic:
- Why does this matter for Caribbean students?
- Connect to current events or students' lived experiences
- Frame the key questions this topic addresses

### 2. UNDERSTANDING THE CONTENT (4-5 paragraphs)
Provide thorough coverage of what students need to KNOW:
- Key facts, dates, concepts, and their significance
- Important figures, events, or theories
- Context that deepens understanding
- Different perspectives or interpretations
- Caribbean-specific angles when relevant

### 3. HOW CSEC TESTS THIS (2 paragraphs)
- What types of questions appear on this topic?
- What are examiners looking for?
- Common mark allocations and what they mean

### 4. ESSAY WRITING MASTERCLASS

**The Art of Introduction** (1-2 paragraphs + template)
Explain how to open a response on this topic. Provide a fill-in template students can adapt.

**Building Your Argument** (2-3 paragraphs)
- How to structure body paragraphs (PEEL method)
- What evidence works best for ${topic}
- How to analyze rather than just describe

**Sample Body Paragraph** (Write a complete, annotated example)
Show students exactly what a strong paragraph looks like on this topic. Annotate it to explain why it works.

**Concluding with Impact** (1 paragraph + example)
How to end responses effectively.

### 5. THE EVIDENCE TOOLKIT
Provide 8-10 specific facts, examples, quotes, or case studies students can use when writing about ${topic}. For each, explain when and how to use it.

### 6. COMMON MISTAKES TO AVOID (2 paragraphs)
- What loses marks on this topic
- How to avoid being too vague or too descriptive

### 7. SELF-CHECK
3-4 potential essay questions with brief notes on how to approach each.

## WRITING STYLE
- Write in second person ("you") to engage directly
- Be practical and actionable—students should finish feeling equipped to tackle any question
- Include model phrases and templates they can adapt
- Balance content knowledge with writing skills${contextSection}`

    const user = `Write a complete 2000-2500 word textbook lesson on "${topic}" in CSEC ${subject}.

This should be a flowing, narrative lesson that teaches both CONTENT and WRITING SKILLS. Write it as if you're preparing a student to tackle any possible exam question on this topic.

Output the lesson in clean Markdown format.`

    return { system, user }
  }

  /**
   * General textbook prompt for other subjects
   */
  private static getGeneralTextbookPrompt(subject: string, topic: string, contextSection: string): { system: string; user: string } {
    const system = `You are a master ${subject} educator writing a chapter of a comprehensive CSEC preparation textbook. Your writing should be engaging, thorough, and designed to build DEEP understanding.

## YOUR MISSION
Write a complete lesson on "${topic}" that could stand alone as a textbook chapter. This lesson should be 2000-2500 words of flowing, pedagogically sound content.

## STRUCTURE YOUR LESSON

### 1. ENGAGING INTRODUCTION (1-2 paragraphs)
Hook students with relevance to Caribbean life or a compelling question.

### 2. CORE CONCEPTS (4-5 paragraphs)
Build understanding from the ground up:
- Explain concepts thoroughly, not just definitions
- Use examples and analogies
- Connect ideas to each other
- Address common misconceptions

### 3. APPLICATIONS & EXAMPLES
Provide 4-5 worked examples or case studies that illustrate the concepts. Progress from simpler to more complex. Explain your reasoning throughout.

### 4. CONNECTIONS
- How does this connect to other parts of the ${subject} syllabus?
- Real-world applications

### 5. EXAM FOCUS
- What types of questions appear on this topic?
- Key facts/concepts to memorize
- Common mistakes to avoid

### 6. SELF-CHECK
3-4 questions for students to test their understanding.

## WRITING STYLE
- Write in second person ("you")
- Be thorough but accessible
- Encourage the reader
- Use Markdown formatting${contextSection}`

    const user = `Write a complete 2000-2500 word textbook lesson on "${topic}" in CSEC ${subject}.

This should read like a textbook chapter—flowing narrative that truly teaches the topic. Output in Markdown format.`

    return { system, user }
  }

  /**
   * Generate study guide (key points, quick reference) using cheaper model
   * This is lazy-loaded on demand to save costs
   */
  static async generateStudyGuide(
    subject: string,
    topic: string
  ): Promise<StudyGuide> {
    const openai = getOpenAIClient()
    const startTime = Date.now()

    const { result: response, model, isFallback } = await callWithFallback(
      async (modelToUse) => {
        return await openai.chat.completions.create({
          model: modelToUse,
          messages: [
            { 
              role: 'system', 
              content: `You are creating a concise study guide for CSEC ${subject} students. Output JSON only.`
            },
            { 
              role: 'user', 
              content: `Create a study guide for "${topic}" in ${subject}. Return ONLY valid JSON:
{
  "keyPoints": ["Point 1", "Point 2", ... (8-10 essential points to memorize)],
  "quickReference": "A 2-3 sentence summary of the most critical concept",
  "practiceCheckpoints": ["Checkpoint question 1", "Checkpoint question 2", ... (4-5 self-test questions)],
  "examTips": ["Tip 1", "Tip 2", ... (4-5 exam-specific tips)]
}`
            }
          ],
          temperature: 0.5,
          max_tokens: 1500,
        })
      },
      'utility' // Use UTILITY tier (Haiku - cheaper)
    )

    const latencyMs = Date.now() - startTime
    const usageRecord = extractUsageFromResponse(response, 'study-guide', model, subject, topic)
    usageRecord.latency_ms = latencyMs
    trackUsage(usageRecord)

    const content = response.choices[0].message.content || '{}'
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      return JSON.parse(jsonStr)
    } catch {
      return {
        keyPoints: [],
        quickReference: content.substring(0, 200),
        practiceCheckpoints: [],
        examTips: []
      }
    }
  }

  /**
   * Check current credit status
   */
  static async getCreditStatus(): Promise<{ hasCredits: boolean; remaining: number; isFallbackMode: boolean }> {
    const credits = await getOpenRouterCredits()
    if (!credits) {
      return { hasCredits: true, remaining: 0, isFallbackMode: false }
    }
    const threshold = 0.10
    return {
      hasCredits: credits.remaining >= threshold,
      remaining: credits.remaining,
      isFallbackMode: credits.remaining < threshold
    }
  }

  // ============ LEGACY METHODS (kept for backward compatibility) ============
  
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
      model: MODELS.LESSON,
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

    const usageRecord = extractUsageFromResponse(response, 'stem-coaching', MODELS.LESSON, subject, topic)
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
      model: MODELS.LESSON,
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

    const usageRecord = extractUsageFromResponse(response, 'writing-coaching', MODELS.LESSON, subject, topic)
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
      model: MODELS.LESSON,
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

    const usageRecord = extractUsageFromResponse(response, 'general-coaching', MODELS.LESSON, subject, topic)
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
      model: MODELS.LESSON,
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
    const usageRecord = extractUsageFromResponse(response, 'practice-questions', MODELS.LESSON, subject, topic)
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
      model: MODELS.LESSON,
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
    const usageRecord = extractUsageFromResponse(response, 'practice-exam', MODELS.LESSON, subject, topics.join(', '))
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
