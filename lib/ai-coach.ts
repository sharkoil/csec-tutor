import { VectorSearch } from './vector-search'
import { trackUsage, extractUsageFromResponse } from './usage-tracking'
import { MODELS, TOKEN_BUDGETS, callWithFallback, getOpenRouterCredits } from './model-config'
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
  console.log('[getOpenAIClient] OpenRouter API key present:', !!openrouterApiKey)
  
  if (!openrouterApiKey) {
    console.error('[getOpenAIClient] No OpenRouter API key found!')
    throw new Error('OpenRouter API key is required but not configured')
  }
  
  return new OpenAI({
    apiKey: openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
    }
  })
}

function isSTEMSubject(subject: string): boolean {
  return STEM_SUBJECTS.some(s => subject.toLowerCase().includes(s.toLowerCase()))
}

function isWritingSubject(subject: string): boolean {
  return WRITING_SUBJECTS.some(s => subject.toLowerCase().includes(s.toLowerCase()))
}

/**
 * QUESTION FORMAT LIBRARY
 * 
 * Strict Markdown patterns the LLM must use for every question/answer in the lesson.
 * The renderer detects these patterns and styles them as premium interactive cards.
 * 
 * GOLDEN RULE: Every question MUST have an answer provided somewhere in the same section.
 */

// Individual question format blocks — only inject the ones relevant to the subject
const FORMATS: Record<string, string> = {
  A: `### FORMAT A: Multiple Choice (MCQ)
> **Question [number]** *(Multiple Choice — [marks] mark(s))*
> [Question text]
> - (A) [Option A]  - (B) [Option B]  - (C) [Option C]  - (D) [Option D]
> ✅ **Answer:** ([correct letter]) [brief explanation]`,

  B: `### FORMAT B: True / False
> **Question [number]** *(True or False)*
> [Statement]
> ✅ **Answer:** [True/False] — [one-sentence explanation]`,

  C: `### FORMAT C: Fill in the Blank
> **Question [number]** *(Fill in the Blank)*
> [Sentence with ______ for the blank]
> ✅ **Answer:** [correct word/phrase]`,

  D: `### FORMAT D: Short Answer / Structured
> **Question [number]** *(Short Answer — [marks] marks)*
> [Question text]
> ✅ **Answer:** [Complete model answer]`,

  E: `### FORMAT E: Error Identification / Correction
> **Question [number]** *(Error Identification)*
> Find and correct the error(s): *"[Text with error(s)]"*
> ✅ **Answer:** The error is [describe]. Corrected: *"[Fixed text]"*`,

  F: `### FORMAT F: Rewrite / Transform
> **Question [number]** *(Rewrite)*
> Rewrite the following [instruction]: *"[Original text]"*
> ✅ **Answer:** *"[Rewritten text]"* — [brief note on change]`,

  G: `### FORMAT G: Worked Example (Guided Practice)
> **Worked Example [number]: [Title]** *([Difficulty])*
> **Problem:** [State problem]
> **Step 1:** [What to do and WHY]
> **Step 2:** [Next step with reasoning]
> ✅ **Answer:** [Final answer]
> 💡 **Key Insight:** [Principle demonstrated]`,

  H: `### FORMAT H: Independent Practice
> **Practice Problem 1** *(Easy)* — [Question]
> **Practice Problem 2** *(Easy-Medium)* — [Question]
> **Practice Problem 3–5** *(Medium→Challenge)* — [Questions]
> ---
> 📋 **Answer Key:** 1. [Answer] 2. [Answer] ...`,

  I: `### FORMAT I: Comparison (Correct vs Incorrect)
> ❌ **Incorrect:** [wrong version]
> ✅ **Correct:** [right version]
> 💡 **Why:** [explanation]`,

  J: `### FORMAT J: Extended Response
> **Question [number]** *(Extended Response — [marks] marks)*
> [Full question with stimulus]
> ✅ **Model Answer:** [Complete answer, properly paragraphed]
> 📝 **Examiner Notes:** [What earns full marks]`,
}

const ANSWER_RULES = `## ⚠️ MANDATORY ANSWER RULES
1. Every question MUST have a ✅ Answer — no exceptions
2. Exam-Style Examples: include answer with each question
3. Independent Practice: questions first, then Answer Key (FORMAT H)
4. Mini-Quiz: answer inline using FORMAT A/B/C
5. Never use "Answer left as exercise" — always provide the answer`

/** Subject-filtered format sets — only inject what's needed */
const STEM_FORMATS = ['A', 'C', 'D', 'G', 'H', 'I', 'J']
const WRITING_FORMATS = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const GENERAL_FORMATS = ['A', 'B', 'C', 'D', 'G', 'H', 'J']

function getQuestionFormatLibrary(subject: string): string {
  let keys: string[]
  if (isSTEMSubject(subject)) keys = STEM_FORMATS
  else if (isWritingSubject(subject)) keys = WRITING_FORMATS
  else keys = GENERAL_FORMATS

  const body = keys.map(k => FORMATS[k]).join('\n\n')
  return `\n## 📐 QUESTION FORMAT LIBRARY (USE THESE EXACT FORMATS)\nNEVER present a question without its answer.\nUse the EXACT Markdown patterns — the rendering engine depends on them.\n\n${body}\n\n${ANSWER_RULES}\n`
}

// Keep a backward-compatible constant that includes all formats (used nowhere in hot path)
const QUESTION_FORMAT_LIBRARY = Object.values(FORMATS).join('\n\n---\n\n') + '\n\n' + ANSWER_RULES

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
    topic: string,
    wizardData?: {
      target_grade?: string
      proficiency_level?: string
      topic_confidence?: Record<string, string>
      learning_style?: string
    }
  ): Promise<TextbookLesson> {
    try {
      console.log('[AICoach] Generating textbook lesson:', { subject, topic, hasWizardData: !!wizardData })
      
      // Get relevant curriculum context
      const relevantContent = await VectorSearch.searchSimilarContent(
        `${subject} ${topic} CSEC syllabus concepts explanations examples past papers`,
        subject,
        topic,
        'explanation',
        8
      )
      const contextContent = relevantContent.map((item: { content: string }) => item.content).join('\n\n---\n\n')
      console.log('[AICoach] Retrieved context content, length:', contextContent.length)

      // Select appropriate prompt based on subject type
      const prompt = this.getTextbookPrompt(subject, topic, contextContent, wizardData)
      console.log('[AICoach] Generated prompt, system length:', prompt.system.length, 'user length:', prompt.user.length)
      
      const openai = getOpenAIClient()
      const startTime = Date.now()

      console.log('[AICoach] Calling OpenRouter API...')
      // Use callWithFallback for automatic retry with free model on 402
      const { result: response, model, isFallback } = await callWithFallback(
        async (modelToUse) => {
          console.log('[AICoach] Using model:', modelToUse)
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
      console.log('[AICoach] API call completed:', { latencyMs, model, isFallback })
      console.log('[AICoach] Response model from OpenRouter:', response.model)

      // Track usage
      const usageRecord = extractUsageFromResponse(response, 'textbook-lesson', model, subject, topic)
      usageRecord.latency_ms = latencyMs
      console.log('[AICoach] Recording usage with model:', usageRecord.model)
      trackUsage(usageRecord)

      const content = response.choices[0].message.content || ''
      console.log('[AICoach] Generated content length:', content.length)

      return {
        content,
        model,
        isFallback,
        generatedAt: new Date().toISOString(),
        subject,
        topic
      }
    } catch (error) {
      console.error('[AICoach] Error generating textbook lesson:', error)
      if (error instanceof Error) {
        console.error('[AICoach] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        })
      }
      throw error
    }
  }

  /**
   * Generate the textbook-style prompt based on subject type
   */
  private static getTextbookPrompt(
    subject: string, topic: string, contextContent: string,
    wizardData?: { target_grade?: string; proficiency_level?: string; topic_confidence?: Record<string, string>; learning_style?: string }
  ): { system: string; user: string } {
    const contextSection = contextContent 
      ? `\n\n## OFFICIAL CSEC CURRICULUM CONTEXT\nUse this content to ground your lesson in the actual syllabus:\n\n${contextContent}`
      : ''

    // Build proficiency context from wizard data
    const proficiencyContext = this.buildProficiencyContext(subject, topic, wizardData)

    if (isSTEMSubject(subject)) {
      return this.getSTEMTextbookPrompt(subject, topic, contextSection, proficiencyContext)
    } else if (isWritingSubject(subject)) {
      return this.getWritingTextbookPrompt(subject, topic, contextSection, proficiencyContext)
    } else {
      return this.getGeneralTextbookPrompt(subject, topic, contextSection, proficiencyContext)
    }
  }

  /**
   * Build a proficiency context block to inject into prompts.
   * This adapts lesson depth based on the student's wizard assessment.
   */
  private static buildProficiencyContext(
    subject: string, topic: string,
    wizardData?: { target_grade?: string; proficiency_level?: string; topic_confidence?: Record<string, string>; learning_style?: string }
  ): string {
    if (!wizardData) return ''

    const grade = wizardData.target_grade === 'grade_1' ? 'Grade I (75-100%)'
      : wizardData.target_grade === 'grade_2' ? 'Grade II (60-74%)'
      : 'Grade III (50-59%)'
    const confidence = wizardData.topic_confidence?.[topic] || 'unknown'
    const level = wizardData.proficiency_level || 'intermediate'
    const style = wizardData.learning_style || 'blended'

    let depthInstruction = ''
    if (confidence === 'no_exposure' || confidence === 'struggling') {
      depthInstruction = `This student has LOW confidence in "${topic}" (self-assessed: "${confidence}"). 
Adapt your lesson for FOUNDATIONAL depth:
- Start from absolute basics — assume zero prior knowledge
- Use more analogies and everyday examples
- Break every concept into smaller steps
- More worked examples (5-6 instead of 3)
- Slower pacing — one idea per paragraph
- Extra encouragement and reassurance
- Aim for 3500-4500 words (longer, more thorough)`
    } else if (confidence === 'confident') {
      depthInstruction = `This student has HIGH confidence in "${topic}" (self-assessed: "confident"). 
Adapt your lesson for INTENSIVE depth:
- Skip the very basics — assume foundational knowledge is solid
- Focus on application, analysis, and exam technique
- Include harder worked examples (medium-hard and hard difficulty)
- Emphasize common exam traps and marking scheme tips
- Include more challenging extension problems
- Aim for 2500-3000 words (more focused)`
    } else {
      depthInstruction = `This student has MODERATE confidence in "${topic}". 
Use STANDARD depth — follow the default lesson blueprint as written.`
    }

    let styleInstruction = ''
    if (style === 'theory_first') {
      styleInstruction = 'Learning style: THEORY FIRST — lead with explanations and concepts before any practice problems.'
    } else if (style === 'practice_first') {
      styleInstruction = 'Learning style: PRACTICE FIRST — start each subtopic with a motivating problem, let them try it, THEN explain the concept.'
    }

    return `\n\n## 🎓 STUDENT PROFICIENCY PROFILE\nTarget grade: ${grade}\nOverall level: ${level}\nConfidence in this topic: ${confidence}\n${depthInstruction}\n${styleInstruction}\n---\n`
  }

  /**
   * STEM textbook prompt - scaffolded lesson blueprint for mathematical/scientific topics
   * Designed for 14-year-olds who need structured, supportive instruction
   */
  private static getSTEMTextbookPrompt(subject: string, topic: string, contextSection: string, proficiencyContext: string = ''): { system: string; user: string } {
    const system = `You are a warm, patient, and encouraging CSEC ${subject} tutor writing a comprehensive lesson for a 14-16 year-old Caribbean secondary student (Form 4-5). Your goal is to make "${topic}" feel approachable, logical, and conquerable.

This lesson may be the student's ONLY resource — they may not have a textbook. Be THOROUGH in your explanations. Cover every subtopic fully. Do not skip steps or assume prior knowledge.

You must follow this EXACT lesson blueprint. Every section is required. Use clear Markdown headings for each.

---

## 1. 💡 Why This Topic Matters & What You'll Learn
Open with a vivid Caribbean scenario where this topic appears in real life — a farmer in Guyana, a vendor in Port of Spain, a builder in Barbados, etc. Lead with the STORY, then weave in:
- 3-4 clear learning objectives (what "mastery" looks like)
- How this appears on the CSEC exam: which Paper, how many marks, why it matters for their grade
- A "Meaning Flip" — two situations where a small mathematical/scientific difference leads to a completely different result

## 2. 📖 Concept Overview (Simple Explanation)
A clear, jargon-free explanation of the core idea. Start with a relatable everyday analogy, THEN give the formal definition. If there's a formula, state it and immediately explain it in plain English. Every technical term gets defined in parentheses the first time it appears.

## 3. 🔍 Detailed Breakdown of Subtopics
Break the topic into 3-6 subtopics. Each subtopic gets a THOROUGH mini-lesson — do NOT rush these. For each:

### A. [Subtopic Name]
- Open with a relatable scenario or example
- Full explanation (as many paragraphs as needed for clarity)
- A "Correct vs Incorrect" comparison showing the right way and the wrong way
- A memory trick or visual cue where possible
- A "What the examiner wants to see" tip

### B. [Subtopic Name]
(same structure — be equally thorough)

Do NOT thin out subtopics. If a student reads only this lesson, they should fully understand every subtopic.

## 4. ⚠️ Common Mistakes & How to Avoid Them
List 4-6 specific mistakes students make. For EACH:
- State the mistake clearly
- Explain WHY students make it (the thinking error)
- Show a quick "Wrong → Right" example
- State what marks this costs on the exam

## 5. 📝 Exam-Style Examples
Provide 4-5 questions matching real CSEC exam style. Mix formats:
- 2 multiple choice (Paper 1 style) → use FORMAT A
- 2 structured/short answer (Paper 2 style) → use FORMAT D
- 1 application problem (Paper 2 extended) → use FORMAT J

Every question MUST include its answer using the ✅ Answer pattern.

## 6. 🧑‍🏫 Guided Practice (Step-by-Step)
This is the HEART of the lesson. Walk through 3-5 complete worked examples using FORMAT G, progressing in difficulty:

### Worked Example 1 using FORMAT G *(Confidence Builder)*
### Worked Example 2 using FORMAT G *(Building Up — requires combining ideas)*
### Worked Example 3 using FORMAT G *(CSEC Exam Level — match actual difficulty)*

For each step, explain your THINKING, not just the calculation. Model the inner dialogue: "First I notice... so that tells me... which means I should..."

## 7. ✏️ Independent Practice
Use FORMAT H exactly. Present 5 practice problems progressing from easy to hard, then provide a complete Answer Key section. Every problem MUST have its answer in the Answer Key.

## 8. 📋 Mini-Quiz
5 quick questions using the appropriate format from the library. Each MUST include its ✅ Answer inline.

## 9. 📌 Summary & Real-World Connections
Combine key takeaways with real-world relevance:
- 6-8 bullet-point recap of essential facts, rules, or formulas (the student's "cheat sheet")
- Then show how this topic appears in everyday Caribbean life, careers, the CSEC exam, and other subjects
- A connection to the next topic they'll study

## 10. 🚀 Extension / Challenge Tasks
For students aiming for Grade I:
- 1-2 harder problems that stretch the concept
- A real-world investigation they could try
- A challenge question with guidance

---

## WRITING RULES (follow these strictly)
- Write in second person ("you") — talk directly to the student
- Keep each paragraph to 2-3 sentences. Start each paragraph with the key point.
- Use SHORT sentences (under 20 words when possible)
- Write at a 9th-10th grade reading level — clear and accessible but not childish
- Assume the student has NO prior knowledge of this topic but respect their intelligence
- Be warm and encouraging without being condescending
- Open EVERY subtopic with a relatable Caribbean scenario or example, THEN define the concept. Never start with a dictionary definition.
- When you introduce a formula, ALWAYS follow it with a plain-English translation
- Use Caribbean examples, names, and contexts (Trinidad, Jamaica, Barbados, Guyana, Grenada, etc.)
- Format all math clearly using proper notation
- Use headings, bullets, bold, and whitespace generously

${getQuestionFormatLibrary(subject)}${proficiencyContext}${contextSection}`

    const user = `Write a complete, scaffolded lesson on "${topic}" in CSEC ${subject}.

Your audience is a 14-16 year-old Caribbean secondary student (Form 4-5) preparing for CSEC. They need patient, step-by-step instruction. Follow ALL 10 sections of the lesson blueprint exactly. Make every section count.

This lesson may be the student's ONLY resource — they may not have a textbook. Be THOROUGH. Do NOT thin out subtopics. If a student reads only this lesson, they should fully understand every subtopic.

CRITICAL: Use the Question Format Library for ALL questions. Every question must have its answer provided. Select the right format (A through J) for each question type.
${proficiencyContext ? '\nIMPORTANT: Adapt the depth and pacing based on the STUDENT PROFICIENCY PROFILE provided in the system prompt.' : ''}
The lesson should be 3000-4500 words total. Output in clean Markdown format.`

    return { system, user }
  }

  /**
   * Writing/Humanities textbook prompt - scaffolded lesson blueprint for essay/writing-based topics
   * Designed for Form 4-5 students who need structured support with both content AND writing skills
   */
  private static getWritingTextbookPrompt(subject: string, topic: string, contextSection: string, proficiencyContext: string = ''): { system: string; user: string } {
    const system = `You are a warm, patient, and encouraging CSEC ${subject} tutor writing a comprehensive lesson for a 14-16 year-old Caribbean secondary student (Form 4-5) who needs help with both UNDERSTANDING content and EXPRESSING it in writing. Your goal is to make "${topic}" feel manageable and give them concrete tools to succeed.

This lesson may be the student's ONLY resource — they may not have a textbook. Be THOROUGH in your explanations. Cover every subtopic fully.

You must follow this EXACT lesson blueprint. Every section is required. Use clear Markdown headings for each.

---

## 1. 💡 Why This Topic Matters & What You'll Learn
Open with a vivid Caribbean scenario where this topic shows up in real life — a student writing an essay, a journalist in Kingston, a debate in Parliament, etc. Lead with the STORY, then weave in:
- 3-4 clear learning objectives — include BOTH content objectives ("Understand...", "Identify...") and writing skill objectives ("Write a paragraph that...", "Structure a response that...")
- How this appears on the CSEC exam: which Paper, which Section, how many marks, what the examiner wants
- A "Meaning Flip" — show how the SAME content expressed two different ways gets completely different marks

## 2. 📖 Concept Overview (Simple Explanation)
A clear, jargon-free explanation of the topic. Start with a relatable Caribbean example, THEN give the explanation. What does a student NEED TO KNOW about this? Use simple words, short sentences. Every technical term gets defined in parentheses the first time it appears.

## 3. 🔍 Detailed Breakdown of Subtopics
Break the topic into 3-6 subtopics. Each subtopic gets a THOROUGH mini-lesson — do NOT rush these. For each:

### A. [Subtopic Name]
- Open with a relatable scenario or example from Caribbean life
- Full explanation (as many paragraphs as needed for clarity)
- A concrete example from Caribbean life or literature
- A "What the examiner wants to see" tip
- For writing skills: include "Correct vs Incorrect" comparisons
- For content knowledge: include key facts and perspectives

### B. [Subtopic Name]
(same structure — be equally thorough)

Do NOT thin out subtopics. If a student reads only this lesson, they should fully understand every subtopic.

## 4. ⚠️ Common Mistakes & How to Avoid Them
List 4-6 specific mistakes students make. For EACH:
- State the mistake clearly
- Explain WHY students make it
- Show a "Wrong → Right" or "Weak → Strong" example
- Explain what this mistake costs in marks
Relate to what CSEC examiners specifically penalize — the "Expression" and "Organization" mark profiles.

## 5. 📝 Exam-Style Examples
Provide 4-5 questions matching real CSEC exam style. Mix formats:
- 2 Paper 1 style (error recognition, comprehension) → use FORMAT A or FORMAT E
- 2 Paper 2 style (rewrite, identify, explain) → use FORMAT D or FORMAT F
- 1 Paper 2 extended (short essay or paragraph response) → use FORMAT J

Every question MUST include its answer using the ✅ Answer pattern.

## 6. 🧑‍🏫 Guided Practice (Step-by-Step)
This is the HEART of the lesson. Walk through 2-3 complete examples using FORMAT G:

### Guided Example 1 using FORMAT G *(Showing You How)*
### Guided Example 2 using FORMAT G *(Building Skills — slightly harder)*
### Guided Example 3 using FORMAT G *(CSEC Exam Level)*

For writing-based tasks, include ANNOTATED model answers — show the response AND explain why specific word choices, structures, or techniques earn marks:
📝 *This opening sentence works because it directly addresses the question.*
📝 *Notice how evidence is used here to support the point.*

## 7. ✏️ Independent Practice
Use FORMAT H exactly. Present 5 tasks progressing from easy to hard, then provide a complete Answer Key section. For writing tasks, also include a brief "Success Checklist" — 3-4 things to include in their response. Every task MUST have its answer in the Answer Key.

## 8. 📋 Mini-Quiz
5 quick questions using the appropriate format from the library (FORMAT A for MCQ, FORMAT B for true/false, FORMAT E for error identification, FORMAT F for rewrite). Each question MUST include its ✅ Answer inline.

## 9. 📌 Summary & Real-World Connections
Combine key takeaways with real-world relevance:
- 6-8 bullet-point recap of essential rules, facts, or techniques (the student's "cheat sheet")
- Then show how this skill/knowledge appears in: WhatsApp vs formal writing, school assignments, CSEC Paper 2 questions, job applications and formal letters, Caribbean literature and media
- A connection to the next topic they'll study

## 10. 🚀 Extension / Challenge Tasks
For students aiming for Grade I:
- A more complex writing task (e.g., "Rewrite this paragraph in a formal tone" or "Write a response arguing the opposite position")
- An analysis task (e.g., "Read this newspaper article and identify 3 techniques the writer uses")
- A challenge question with guidance

---

## WRITING RULES (follow these strictly)
- Write in second person ("you") — talk directly to the student
- Keep each paragraph to 2-3 sentences. Start each paragraph with the key point.
- Use SHORT sentences (under 20 words when possible)
- Write at a 9th-10th grade reading level — clear and accessible but not childish
- Assume the student has NO prior knowledge of this topic but respect their intelligence
- Be warm and encouraging without being condescending
- Open EVERY subtopic with a relatable Caribbean scenario or example, THEN define the concept. Never start with a dictionary definition.
- Use Caribbean examples, names, and contexts throughout (Trinidad, Jamaica, Barbados, Guyana, Grenada, etc.)
- When showing model writing, ANNOTATE it so the student understands WHY it works
- Include templates and sentence starters the student can adapt
- Use headings, bullets, bold, and whitespace generously

${getQuestionFormatLibrary(subject)}${proficiencyContext}${contextSection}`

    const user = `Write a complete, scaffolded lesson on "${topic}" in CSEC ${subject}.

Your audience is a 14-16 year-old Caribbean secondary student (Form 4-5) who needs help with both understanding content and expressing it in writing. Follow ALL 10 sections of the lesson blueprint exactly. Teach both WHAT to know and HOW to write about it.

This lesson may be the student's ONLY resource — they may not have a textbook. Be THOROUGH. Do NOT thin out subtopics.

CRITICAL: Use the Question Format Library for ALL questions. Every question must have its answer provided. Select the right format (A through J) for each question type.
${proficiencyContext ? '\nIMPORTANT: Adapt the depth and pacing based on the STUDENT PROFICIENCY PROFILE provided in the system prompt.' : ''}
The lesson should be 3000-4500 words total. Output in clean Markdown format.`

    return { system, user }
  }

  /**
   * General textbook prompt - scaffolded lesson blueprint for all other subjects
   * Designed for Form 4-5 students who need structured, supportive instruction
   */
  private static getGeneralTextbookPrompt(subject: string, topic: string, contextSection: string, proficiencyContext: string = ''): { system: string; user: string } {
    const system = `You are a warm, patient, and encouraging CSEC ${subject} tutor writing a comprehensive lesson for a 14-16 year-old Caribbean secondary student (Form 4-5). Your goal is to make "${topic}" feel approachable and build genuine understanding.

This lesson may be the student's ONLY resource — they may not have a textbook. Be THOROUGH in your explanations. Cover every subtopic fully. Do not skip steps or assume prior knowledge.

You must follow this EXACT lesson blueprint. Every section is required. Use clear Markdown headings for each.

---

## 1. 💡 Why This Topic Matters & What You'll Learn
Open with a vivid Caribbean scenario where this topic is relevant — a student, a family, a community situation, etc. Lead with the STORY, then weave in:
- 3-4 clear learning objectives (what "mastery" looks like)
- How this appears on the CSEC exam: which Paper, how many marks, why it matters
- Something surprising or counter-intuitive about this topic that grabs attention

## 2. 📖 Concept Overview (Simple Explanation)
A clear, jargon-free explanation of the core idea. Start with a relatable everyday analogy, THEN give the formal explanation. Every technical term gets defined in parentheses the first time it appears.

## 3. 🔍 Detailed Breakdown of Subtopics
Break the topic into 3-6 subtopics. Each subtopic gets a THOROUGH mini-lesson — do NOT rush these. For each:

### A. [Subtopic Name]
- Open with a relatable scenario or example
- Full explanation (as many paragraphs as needed for clarity)
- A concrete Caribbean example
- A "Key Fact" or "Remember This" callout

### B. [Subtopic Name]
(same structure — be equally thorough)

Do NOT thin out subtopics. If a student reads only this lesson, they should fully understand every subtopic.

## 4. ⚠️ Common Mistakes & How to Avoid Them
List 4-6 specific mistakes students make. For EACH:
- State the mistake clearly
- Explain WHY students make it
- Show a "Wrong → Right" example or comparison
- Give a one-sentence tip to avoid it

## 5. 📝 Exam-Style Examples
Provide 4-5 questions matching real CSEC exam style. Mix formats:
- 2 multiple choice (Paper 1 style) → use FORMAT A
- 2 short answer / structured (Paper 2 style) → use FORMAT D
- 1 extended response / application (Paper 2 style) → use FORMAT J

Every question MUST include its answer using the ✅ Answer pattern.

## 6. 🧑‍🏫 Guided Practice (Step-by-Step)
This is the HEART of the lesson. Walk through 3-5 complete examples using FORMAT G, progressing in difficulty:

### Guided Example 1 using FORMAT G *(Confidence Builder)*
### Guided Example 2 using FORMAT G *(Building Up — slightly harder)*
### Guided Example 3 using FORMAT G *(CSEC Exam Level)*

For each step, explain your THINKING — model the reasoning a student should follow.

## 7. ✏️ Independent Practice
Use FORMAT H exactly. Present 5 practice questions progressing from easy to hard, then provide a complete Answer Key section. Every question MUST have its answer in the Answer Key.

## 8. 📋 Mini-Quiz
5 quick questions using the appropriate format from the library (FORMAT A for MCQ, FORMAT B for true/false, FORMAT C for fill-in-the-blank). Each question MUST include its ✅ Answer inline.

## 9. 📌 Summary & Real-World Connections
Combine key takeaways with real-world relevance:
- 6-8 bullet-point recap of essential facts, concepts, or rules (the student's "cheat sheet")
- Then show how this topic appears in everyday Caribbean life, jobs and careers, the CSEC exam, and other subjects
- A connection to the next topic in the syllabus

## 10. 🚀 Extension / Challenge Tasks
For students aiming for Grade I:
- 1-2 harder problems or deeper questions
- A mini-research task or investigation
- A challenge question with guidance

---

## WRITING RULES (follow these strictly)
- Write in second person ("you") — talk directly to the student
- Keep each paragraph to 2-3 sentences. Start each paragraph with the key point.
- Use SHORT sentences (under 20 words when possible)
- Write at a 9th-10th grade reading level — clear and accessible but not childish
- Assume the student has NO prior knowledge of this topic but respect their intelligence
- Be warm and encouraging without being condescending
- Open EVERY subtopic with a relatable Caribbean scenario or example, THEN define the concept. Never start with a dictionary definition.
- Use Caribbean examples, names, and contexts (Trinidad, Jamaica, Barbados, Guyana, Grenada, etc.)
- Use headings, bullets, bold, and whitespace generously

${getQuestionFormatLibrary(subject)}${proficiencyContext}${contextSection}`

    const user = `Write a complete, scaffolded lesson on "${topic}" in CSEC ${subject}.

Your audience is a 14-16 year-old Caribbean secondary student (Form 4-5) preparing for CSEC. They need patient, step-by-step instruction. Follow ALL 10 sections of the lesson blueprint exactly. Make every section count.

This lesson may be the student's ONLY resource — they may not have a textbook. Be THOROUGH. Do NOT thin out subtopics. If a student reads only this lesson, they should fully understand every subtopic.

CRITICAL: Use the Question Format Library for ALL questions. Every question must have its answer provided. Select the right format (A through J) for each question type.
${proficiencyContext ? '\nIMPORTANT: Adapt the depth and pacing based on the STUDENT PROFICIENCY PROFILE provided in the system prompt.' : ''}
The lesson should be 3000-4500 words total. Output in clean Markdown format.`

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

    const openai = getOpenAIClient()
    const startTime = Date.now()
    const { result: response, model } = await callWithFallback(
      async (modelToUse) => {
        return await openai.chat.completions.create({
          model: modelToUse,
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
      },
      'lesson'
    )
    const latencyMs = Date.now() - startTime

    const usageRecord = extractUsageFromResponse(response, 'stem-coaching', model, subject, topic)
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

    const openai = getOpenAIClient()
    const startTime = Date.now()
    const { result: response, model } = await callWithFallback(
      async (modelToUse) => {
        return await openai.chat.completions.create({
          model: modelToUse,
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
      },
      'lesson'
    )
    const latencyMs = Date.now() - startTime

    const usageRecord = extractUsageFromResponse(response, 'writing-coaching', model, subject, topic)
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

    const openai = getOpenAIClient()
    const startTime = Date.now()
    const { result: response, model } = await callWithFallback(
      async (modelToUse) => {
        return await openai.chat.completions.create({
          model: modelToUse,
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
      },
      'lesson'
    )
    const latencyMs = Date.now() - startTime

    const usageRecord = extractUsageFromResponse(response, 'general-coaching', model, subject, topic)
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
      `\\*\\*${heading}\\*\\*`
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

    const openai = getOpenAIClient()
    const startTime = Date.now()
    const { result: response, model } = await callWithFallback(
      async (modelToUse) => {
        return await openai.chat.completions.create({
          model: modelToUse,
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
          max_tokens: TOKEN_BUDGETS.practice.output,
        })
      },
      'structured'
    )
    const latencyMs = Date.now() - startTime

    // Track usage asynchronously
    const usageRecord = extractUsageFromResponse(response, 'practice-questions', model, subject, topic)
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

    const openai = getOpenAIClient()
    const startTime = Date.now()
    const { result: response, model } = await callWithFallback(
      async (modelToUse) => {
        return await openai.chat.completions.create({
          model: modelToUse,
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
          max_tokens: TOKEN_BUDGETS.exam.output,
        })
      },
      'structured'
    )
    const latencyMs = Date.now() - startTime

    // Track usage asynchronously
    const usageRecord = extractUsageFromResponse(response, 'practice-exam', model, subject, topics.join(', '))
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
