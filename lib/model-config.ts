/**
 * Model Configuration v2 — Tiered Selection with Cost Optimization
 * 
 * v2 Cost Optimization Strategy:
 * - GENERATION: GPT-4.1-mini for lesson content (80% cost reduction vs GPT-5.2)
 * - GENERATION_HQ: GPT-4.1 for quality-flagged regeneration
 * - STRUCTURED: GPT-4o-mini for quizzes, exams, classification (90% cost reduction)
 * - CONVERSATIONAL: GPT-4o-mini for chat Q&A, study guides
 * - FREE_FALLBACK: Llama 3.3 70B when credits are exhausted
 * - Daily cost circuit breaker: forces free model when daily spend exceeds budget
 */

import { checkDailyBudget } from './usage-tracking'

export const MODELS = {
  // Primary model for lesson content generation (workhorse)
  LESSON: 'openai/gpt-4.1-mini',
  
  // High-quality fallback for flagged/regenerated content
  LESSON_HQ: 'openai/gpt-4.1',
  
  // Structured output tasks: quizzes, exams, plan analysis, classification
  STRUCTURED: 'openai/gpt-4o-mini',
  
  // Conversational: chat Q&A, study guides  
  UTILITY: 'openai/gpt-4o-mini',
  
  // Free fallback when paid credits are exhausted
  FREE_FALLBACK: 'meta-llama/llama-3.3-70b-instruct:free',
  
  // Minimum credit threshold before switching to free (in dollars)
  CREDIT_THRESHOLD: 0.10
} as const

/** Token budgets per task type to prevent runaway costs */
export const TOKEN_BUDGETS = {
  lesson:        { input: 2500, output: 6000 },
  practice:      { input: 1200, output: 2000 },
  exam:          { input: 1500, output: 4000 },
  chat:          { input: 2000, output: 600  },
  study_guide:   { input: 1000, output: 1500 },
  plan_analysis: { input: 2000, output: 800  },
} as const

export type TaskType = keyof typeof TOKEN_BUDGETS

export type ModelTier = 'lesson' | 'lesson_hq' | 'structured' | 'utility' | 'analysis'

// Cache the credit check for 5 minutes to avoid excessive API calls
let cachedCredits: { remaining: number; checkedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get remaining OpenRouter credits
 */
export async function getOpenRouterCredits(): Promise<{ total: number; used: number; remaining: number } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      console.error('Failed to fetch OpenRouter credits:', response.status)
      return null
    }

    const result = await response.json()
    const data = result.data || result
    
    return {
      total: data.total_credits || 0,
      used: data.total_usage || 0,
      remaining: (data.total_credits || 0) - (data.total_usage || 0)
    }
  } catch (error) {
    console.error('Error fetching OpenRouter credits:', error)
    return null
  }
}

/**
 * Check if we have sufficient credits AND are within daily budget, with caching
 */
async function hasSufficientCredits(): Promise<boolean> {
  const now = Date.now()
  
  // Check daily cost circuit breaker first
  try {
    const budget = await checkDailyBudget()
    if (!budget.allowed) {
      console.warn('[hasSufficientCredits] Daily cost budget exceeded — forcing free model')
      return false
    }
  } catch {
    // If budget check fails, continue with credit check
  }
  
  // Use cached value if still valid
  if (cachedCredits && (now - cachedCredits.checkedAt) < CACHE_TTL_MS) {
    console.log('[hasSufficientCredits] Using cached value:', cachedCredits.remaining, 'remaining')
    return cachedCredits.remaining >= MODELS.CREDIT_THRESHOLD
  }
  
  // Fetch fresh credits
  const credits = await getOpenRouterCredits()
  
  if (credits) {
    cachedCredits = {
      remaining: credits.remaining,
      checkedAt: now
    }
    console.log('[hasSufficientCredits] Fresh check - remaining:', credits.remaining, 'threshold:', MODELS.CREDIT_THRESHOLD)
    return credits.remaining >= MODELS.CREDIT_THRESHOLD
  }
  
  // If we can't check credits, assume we have them (fail open)
  console.warn('[hasSufficientCredits] Could not fetch credits, assuming we have them')
  return true
}

/**
 * Get the appropriate model for a task tier
 * Will return free fallback if credits are exhausted
 */
export async function getModelForTask(tier: ModelTier): Promise<{ model: string; isFallback: boolean }> {
  const hasCredits = await hasSufficientCredits()
  
  if (!hasCredits) {
    console.warn('[getModelForTask] OpenRouter credits exhausted, using free fallback model')
    return { model: MODELS.FREE_FALLBACK, isFallback: true }
  }
  
  switch (tier) {
    case 'lesson':
      console.log('[getModelForTask] Selecting GENERATION tier model:', MODELS.LESSON)
      return { model: MODELS.LESSON, isFallback: false }
    case 'lesson_hq':
      console.log('[getModelForTask] Selecting GENERATION_HQ tier model:', MODELS.LESSON_HQ)
      return { model: MODELS.LESSON_HQ, isFallback: false }
    case 'structured':
      console.log('[getModelForTask] Selecting STRUCTURED tier model:', MODELS.STRUCTURED)
      return { model: MODELS.STRUCTURED, isFallback: false }
    case 'utility':
    case 'analysis':
      console.log('[getModelForTask] Selecting UTILITY tier model:', MODELS.UTILITY)
      return { model: MODELS.UTILITY, isFallback: false }
    default:
      console.log('[getModelForTask] Selecting default model:', MODELS.LESSON)
      return { model: MODELS.LESSON, isFallback: false }
  }
}

/**
 * Wrapper to make AI call with automatic fallback on 402 Payment Required
 */
export async function callWithFallback<T>(
  primaryCall: (model: string) => Promise<T>,
  tier: ModelTier
): Promise<{ result: T; model: string; isFallback: boolean }> {
  const { model, isFallback } = await getModelForTask(tier)
  console.log('[callWithFallback] Selected model for tier', tier, ':', model, 'isFallback:', isFallback)
  
  try {
    const result = await primaryCall(model)
    console.log('[callWithFallback] Successfully got result with', model)
    return { result, model, isFallback }
  } catch (error: any) {
    console.error('[callWithFallback] Error with', model, ':', error?.message)
    // Check if it's a payment/credit error
    if (error?.status === 402 || error?.message?.includes('402') || error?.message?.includes('insufficient')) {
      console.warn('[callWithFallback] Payment required error, falling back to free model:', MODELS.FREE_FALLBACK)
      
      // Invalidate cache
      cachedCredits = { remaining: 0, checkedAt: Date.now() }
      
      // Retry with free model
      const result = await primaryCall(MODELS.FREE_FALLBACK)
      console.log('[callWithFallback] Successfully got result with fallback model:', MODELS.FREE_FALLBACK)
      return { result, model: MODELS.FREE_FALLBACK, isFallback: true }
    }
    
    // Re-throw other errors
    throw error
  }
}

/**
 * Clear the credit cache (useful after adding credits)
 */
export function clearCreditCache(): void {
  cachedCredits = null
}
