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
          temperature: 0.65,
          max_tokens: 8000, // Allow for 3000-4000 word scaffolded lessons
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
   * STEM textbook prompt - scaffolded lesson blueprint for mathematical/scientific topics
   * Designed for 14-year-olds who need structured, supportive instruction
   */
  private static getSTEMTextbookPrompt(subject: string, topic: string, contextSection: string): { system: string; user: string } {
    const system = `You are a warm, patient, and encouraging CSEC ${subject} tutor writing a lesson for a 14-year-old student who finds this subject challenging. Your goal is to make "${topic}" feel approachable, logical, and conquerable — NOT to produce a wall of text.

You must follow this EXACT 12-section lesson blueprint. Every section is required. Use clear Markdown headings for each.

---

## 1. 🎯 Learning Objectives
List 3-4 clear, measurable, student-friendly outcomes. Start each with an action verb (Understand, Identify, Calculate, Apply, etc.). These tell the student exactly what "mastery" looks like.

## 2. 💡 Why This Topic Matters
A short motivational hook (2-3 paragraphs max):
- Show a real-world Caribbean example where this topic appears (farming, sports, cooking, building, weather, etc.)
- Present a "Meaning Flip" — two situations where a small mathematical/scientific difference leads to a completely different result
- Connect directly to CSEC exam requirements: which Paper, how many marks, why it matters for their grade

## 3. 📖 Concept Overview (Simple Explanation)
A concise, jargon-free explanation of the core idea in 2-3 short paragraphs. Use an everyday analogy a Caribbean teenager would understand. If there's a formula, state it here but also explain it in plain English. Avoid technical language — when a technical term IS necessary, define it immediately in parentheses.

## 4. 🔍 Detailed Breakdown of Subtopics
Break the topic into 3-5 bite-sized subtopics. Each subtopic gets its own mini-lesson:

### A. [Subtopic Name]
- One clear explanation paragraph
- A "Correct vs Incorrect" comparison showing the right way and the wrong way
- A visual cue or memory trick where possible

### B. [Subtopic Name]
(same structure)

...continue for each subtopic.

Keep each subtopic SHORT. A student should be able to read one subtopic, understand it, and feel good before moving to the next.

## 5. ⚠️ Common Mistakes & How to Avoid Them
List 4-6 specific mistakes students make with this topic. For EACH mistake:
- State the mistake clearly
- Explain WHY students make it (the thinking error behind it)
- Show a quick "Wrong → Right" example
- Give a one-sentence tip to avoid it

This section should feel practical and reassuring — "everyone makes these mistakes, here's how to catch yourself."

## 6. 📝 Exam-Style Examples
Provide 4-5 questions that look like real CSEC exam questions. Mix the formats:
- 2 multiple choice (Paper 1 style)
- 2 structured/short answer (Paper 2 style)
- 1 application problem (Paper 2 extended)

Do NOT provide answers here — just the questions. Label each with its format and approximate marks.

## 7. 🧑‍🏫 Guided Practice (Step-by-Step)
This is the HEART of the lesson. Walk the student through 3 complete worked examples, progressing in difficulty:

### Worked Example 1: [Title] *(Confidence Builder)*
**Problem:** [State it clearly]

**Let's solve this together:**
- **Step 1:** [What to do first and WHY]
- **Step 2:** [Next step with reasoning]
- **Step 3:** [Continue...]
- **Answer:** [Final answer]
- **✅ Key Insight:** [What principle this demonstrates]

### Worked Example 2: [Title] *(Building Up)*
(Same structure but slightly harder — requires combining ideas)

### Worked Example 3: [Title] *(CSEC Exam Level)*
(Match actual CSEC difficulty — this is what they'll see on the paper)

For each step, explain your THINKING, not just the calculation. Model the inner dialogue: "First I notice... so that tells me... which means I should..."

## 8. ✏️ Independent Practice
Provide 5 practice problems the student should try on their own. Progress from easy to hard:
1. (Easy) ...
2. (Easy-Medium) ...
3. (Medium) ...
4. (Medium-Hard) ...
5. (Challenge) ...

Provide answers in a collapsed/spoiler section at the end: "**Answers:** 1) ... 2) ... 3) ... 4) ... 5) ..."

## 9. 📋 Mini-Quiz
5 quick questions (mixed format: true/false, fill-in-the-blank, multiple choice) that test whether the student grasped the key ideas. Include answers immediately after each question in parentheses.

## 10. 📌 Micro-Summary
A tight recap in bullet points — NO MORE than 6-8 bullets. Each bullet = one essential fact, rule, or formula. This is the student's "cheat sheet" for revision.

## 11. 🌍 Real-World Application
Show how this topic appears in:
- Everyday Caribbean life (shopping, cooking, sports, weather)
- Jobs and careers (construction, nursing, agriculture, tech)
- The CSEC exam itself (which paper, which section, how many marks)
- Other subjects they're studying

Make it vivid and specific — not vague "this is useful" statements.

## 12. 🚀 Extension / Challenge Tasks
For students who want to push further:
- 1-2 harder problems that stretch the concept
- A "real world investigation" they could try (measure something, research something)
- A connection to the next topic they'll study

---

## WRITING RULES (follow these strictly)
- Write in second person ("you") — talk directly to the student
- Use SHORT paragraphs (3-4 sentences max)
- Use SHORT sentences (under 20 words when possible)
- Assume the student has NO prior knowledge of this topic
- Be warm, encouraging, and patient — phrases like "Don't worry if this seems tricky at first" and "You've got this" are good
- When you introduce a formula, ALWAYS follow it with a plain-English translation
- Use Caribbean examples, names, and contexts (Trinidad, Jamaica, Barbados, etc.)
- Format all math clearly using proper notation
- NEVER produce a wall of text — use headings, bullets, bold, and whitespace generously${contextSection}`

    const user = `Write a complete, scaffolded lesson on "${topic}" in CSEC ${subject}.

Your audience is a 14-year-old Caribbean student who struggles with this subject and needs patient, step-by-step instruction. Follow ALL 12 sections of the lesson blueprint exactly. Make every section count.

The lesson should be 3000-4000 words total. Output in clean Markdown format.`

    return { system, user }
  }

  /**
   * Writing/Humanities textbook prompt - scaffolded lesson blueprint for essay/writing-based topics
   * Designed for 14-year-olds who need structured support with both content AND writing skills
   */
  private static getWritingTextbookPrompt(subject: string, topic: string, contextSection: string): { system: string; user: string } {
    const system = `You are a warm, patient, and encouraging CSEC ${subject} tutor writing a lesson for a 14-year-old student who needs help with both UNDERSTANDING content and EXPRESSING it in writing. Your goal is to make "${topic}" feel manageable and give them concrete tools to succeed.

You must follow this EXACT 12-section lesson blueprint. Every section is required. Use clear Markdown headings for each.

---

## 1. 🎯 Learning Objectives
List 3-4 clear, measurable, student-friendly outcomes. Include BOTH content objectives ("Understand...", "Identify...") and writing skill objectives ("Write a paragraph that...", "Structure a response that...").

## 2. 💡 Why This Topic Matters
A short motivational hook (2-3 paragraphs max):
- Show how this topic connects to Caribbean students' lives and experiences
- Present a "Meaning Flip" — show how the SAME content expressed two different ways gets completely different marks from an examiner
- State exactly where this appears on the CSEC exam: which Paper, which Section, how many marks, what the examiner is looking for

## 3. 📖 Concept Overview (Simple Explanation)
A concise, jargon-free explanation of the topic in 2-3 short paragraphs. What does a student NEED TO KNOW about this topic? Explain it like you're telling a friend — use simple words, short sentences, and relatable Caribbean examples.

## 4. 🔍 Detailed Breakdown of Subtopics
Break the topic into 3-5 manageable subtopics. Each subtopic gets its own mini-lesson:

### A. [Subtopic Name]
- One clear explanation paragraph
- A concrete example from Caribbean life or literature
- A "What the examiner wants to see" tip

### B. [Subtopic Name]
(same structure)

...continue for each subtopic.

For ${subject} specifically: if the topic involves a writing skill (punctuation, grammar, comprehension, etc.), include "Correct vs Incorrect" comparisons. If it involves content knowledge (history, themes, social issues), include key facts and perspectives.

## 5. ⚠️ Common Mistakes & How to Avoid Them
List 4-6 specific mistakes students make with this topic. For EACH mistake:
- State the mistake clearly
- Explain WHY students make it
- Show a "Wrong → Right" example (for writing skills) or a "Weak → Strong" answer comparison (for content)
- Explain what this mistake costs in marks

Relate mistakes to what CSEC examiners specifically penalize. For ${subject}, focus on the "Expression" and "Organization" mark profiles.

## 6. 📝 Exam-Style Examples
Provide 4-5 questions that look like real CSEC exam questions. Mix the formats:
- 2 Paper 1 style (multiple choice — error recognition, comprehension, grammar)
- 2 Paper 2 style (short answer — rewrite, identify, explain)
- 1 Paper 2 extended (short essay or paragraph response)

Do NOT provide answers here — just the questions. Label each with its Paper, Section, and approximate marks.

## 7. 🧑‍🏫 Guided Practice (Step-by-Step)
This is the HEART of the lesson. Walk the student through 2-3 complete examples:

### Guided Example 1: [Title] *(Showing You How)*
**Task:** [State the exam-style task clearly]

**Let's work through this together:**
- **Step 1:** [Read/analyze — what is the question really asking?]
- **Step 2:** [Plan — what structure/content do we need?]
- **Step 3:** [Draft — write out the response, explaining each choice]
- **Step 4:** [Check — review against the mark scheme criteria]
- **✅ Why this scores well:** [Explain what makes this response strong]

### Guided Example 2: [Title] *(Building Your Skills)*
(Same structure, slightly harder task)

### Guided Example 3: [Title] *(CSEC Exam Level)*
(Match actual exam format and difficulty)

For writing-based tasks, include ANNOTATED model answers — show the response AND explain why specific word choices, structures, or techniques earn marks. Use annotations like:
📝 *This opening sentence works because it directly addresses the question.*
📝 *Notice how evidence is used here to support the point.*

## 8. ✏️ Independent Practice
Provide 5 tasks the student should try alone, progressing in difficulty:
1. (Easy) ...
2. (Easy-Medium) ...
3. (Medium) ...
4. (Medium-Hard) ...
5. (Challenge) ...

For writing tasks, include a brief "Success Checklist" — 3-4 things to include in their response.

## 9. 📋 Mini-Quiz
5 quick questions (mixed: multiple choice, error identification, short rewrite) that test whether the student grasped the key ideas. Include answers immediately after each question in parentheses.

## 10. 📌 Micro-Summary
A tight recap — NO MORE than 6-8 bullets. Each bullet = one essential rule, fact, or technique. This is the student's revision cheat sheet.

## 11. 🌍 Real-World Application
Show how this skill/knowledge appears in:
- WhatsApp messages, social media, texting (informal vs formal)
- School assignments and reports
- CSEC Paper 2 (specific section and question type)
- Job applications, emails, and formal letters
- Caribbean literature and media

Make it vivid and specific — show them this isn't just "school stuff."

## 12. 🚀 Extension / Challenge Tasks
For students who want to push further:
- A more complex writing task (e.g., "Rewrite this paragraph in a formal tone" or "Write a response arguing the opposite position")
- An analysis task (e.g., "Read this newspaper article and identify 3 techniques the writer uses")
- A connection to the next topic they'll study

---

## WRITING RULES (follow these strictly)
- Write in second person ("you") — talk directly to the student
- Use SHORT paragraphs (3-4 sentences max)
- Use SHORT sentences (under 20 words when possible)
- Assume the student finds writing difficult and needs encouragement
- Be warm and supportive — "Don't worry if this feels hard at first" and "You're building real skills here"
- Use Caribbean examples, names, and contexts throughout
- When showing model writing, ANNOTATE it so the student understands WHY it works
- Include templates and sentence starters the student can adapt
- NEVER produce a wall of text — use headings, bullets, bold, and whitespace generously
- When a student makes an error in a practice context, explain the EFFECT of the error on the reader first, then show the fix${contextSection}`

    const user = `Write a complete, scaffolded lesson on "${topic}" in CSEC ${subject}.

Your audience is a 14-year-old Caribbean student who needs help with both understanding content and expressing it in writing. Follow ALL 12 sections of the lesson blueprint exactly. Teach both WHAT to know and HOW to write about it.

The lesson should be 3000-4000 words total. Output in clean Markdown format.`

    return { system, user }
  }

  /**
   * General textbook prompt - scaffolded lesson blueprint for all other subjects
   * Designed for 14-year-olds who need structured, supportive instruction
   */
  private static getGeneralTextbookPrompt(subject: string, topic: string, contextSection: string): { system: string; user: string } {
    const system = `You are a warm, patient, and encouraging CSEC ${subject} tutor writing a lesson for a 14-year-old student who needs clear, structured help with "${topic}". Your goal is to make this topic approachable and build genuine understanding — NOT to produce a wall of text.

You must follow this EXACT 12-section lesson blueprint. Every section is required. Use clear Markdown headings for each.

---

## 1. 🎯 Learning Objectives
List 3-4 clear, measurable, student-friendly outcomes. Start each with an action verb (Understand, Identify, Explain, Apply, Compare, etc.). These tell the student exactly what "mastery" looks like.

## 2. 💡 Why This Topic Matters
A short motivational hook (2-3 paragraphs max):
- Show a real-world Caribbean example where this topic is relevant
- Present something surprising or counter-intuitive about this topic that grabs attention
- Connect directly to CSEC exam requirements: which Paper, how many marks, why it matters

## 3. 📖 Concept Overview (Simple Explanation)
A concise, jargon-free explanation of the core idea in 2-3 short paragraphs. Use an everyday analogy a Caribbean teenager would understand. Avoid technical language — when a technical term IS necessary, define it immediately in parentheses.

## 4. 🔍 Detailed Breakdown of Subtopics
Break the topic into 3-5 bite-sized subtopics. Each subtopic gets its own mini-lesson:

### A. [Subtopic Name]
- One clear explanation paragraph
- A concrete Caribbean example
- A "Key Fact" or "Remember This" callout

### B. [Subtopic Name]
(same structure)

...continue for each subtopic.

Keep each subtopic SHORT and digestible. A student should be able to read one subtopic, understand it, and feel good before moving to the next.

## 5. ⚠️ Common Mistakes & How to Avoid Them
List 4-6 specific mistakes students make with this topic. For EACH mistake:
- State the mistake clearly
- Explain WHY students make it
- Show a "Wrong → Right" example or comparison
- Give a one-sentence tip to avoid it

## 6. 📝 Exam-Style Examples
Provide 4-5 questions that look like real CSEC exam questions. Mix the formats:
- 2 multiple choice (Paper 1 style)
- 2 short answer / structured (Paper 2 style)
- 1 extended response / application (Paper 2 style)

Do NOT provide answers here — just the questions. Label each with its format and approximate marks.

## 7. 🧑‍🏫 Guided Practice (Step-by-Step)
This is the HEART of the lesson. Walk the student through 3 complete examples, progressing in difficulty:

### Guided Example 1: [Title] *(Confidence Builder)*
**Question:** [State it clearly]

**Let's work through this together:**
- **Step 1:** [What to do first and WHY]
- **Step 2:** [Next step with reasoning]
- **Step 3:** [Continue...]
- **Answer:** [Final answer]
- **✅ Key Insight:** [What principle this demonstrates]

### Guided Example 2: [Title] *(Building Up)*
(Same structure, slightly harder)

### Guided Example 3: [Title] *(CSEC Exam Level)*
(Match actual CSEC difficulty)

For each step, explain your THINKING — model the reasoning a student should follow.

## 8. ✏️ Independent Practice
Provide 5 practice questions the student should try on their own. Progress from easy to hard:
1. (Easy) ...
2. (Easy-Medium) ...
3. (Medium) ...
4. (Medium-Hard) ...
5. (Challenge) ...

Provide answers at the end: "**Answers:** 1) ... 2) ... 3) ... 4) ... 5) ..."

## 9. 📋 Mini-Quiz
5 quick questions (mixed format: true/false, fill-in-the-blank, multiple choice) that test whether the student grasped the key ideas. Include answers immediately after each question in parentheses.

## 10. 📌 Micro-Summary
A tight recap in bullet points — NO MORE than 6-8 bullets. Each bullet = one essential fact, concept, or rule. This is the student's "cheat sheet" for revision.

## 11. 🌍 Real-World Application
Show how this topic appears in:
- Everyday Caribbean life
- Jobs and careers relevant to Caribbean students
- The CSEC exam (specific paper and section)
- Other subjects they're studying

Make it vivid and specific.

## 12. 🚀 Extension / Challenge Tasks
For students who want to push further:
- 1-2 harder problems or deeper questions
- A mini-research task or investigation
- A connection to the next topic in the syllabus

---

## WRITING RULES (follow these strictly)
- Write in second person ("you") — talk directly to the student
- Use SHORT paragraphs (3-4 sentences max)
- Use SHORT sentences (under 20 words when possible)
- Assume the student has NO prior knowledge of this topic
- Be warm, encouraging, and patient
- Use Caribbean examples, names, and contexts (Trinidad, Jamaica, Barbados, Guyana, etc.)
- NEVER produce a wall of text — use headings, bullets, bold, and whitespace generously${contextSection}`

    const user = `Write a complete, scaffolded lesson on "${topic}" in CSEC ${subject}.

Your audience is a 14-year-old Caribbean student who needs patient, step-by-step instruction. Follow ALL 12 sections of the lesson blueprint exactly. Make every section count.

The lesson should be 3000-4000 words total. Output in clean Markdown format.`

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
