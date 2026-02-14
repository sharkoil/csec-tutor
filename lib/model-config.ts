/**
 * Model Configuration with Tiered Selection and Free Fallback
 * 
 * Uses Claude Sonnet 4 for quality-critical tasks (lessons, diagnostics)
 * Uses Claude Haiku for utility tasks (study guides, checkpoints)
 * Falls back to free model when credits are exhausted
 */

export const MODELS = {
  // Primary model for deep lesson content and diagnostics
  // Using Claude 3.5 Sonnet (latest stable version)
  LESSON: 'anthropic/claude-3.5-sonnet',
  
  // Cheaper model for utility tasks (study guides, key points, checkpoints)
  UTILITY: 'anthropic/claude-3-haiku',
  
  // Free fallback when paid credits are exhausted
  FREE_FALLBACK: 'meta-llama/llama-3.1-8b-instruct:free',
  
  // Minimum credit threshold before switching to free (in dollars)
  CREDIT_THRESHOLD: 0.10
} as const

export type ModelTier = 'lesson' | 'utility' | 'analysis'

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
 * Check if we have sufficient credits, with caching
 */
async function hasSufficientCredits(): Promise<boolean> {
  const now = Date.now()
  
  // Use cached value if still valid
  if (cachedCredits && (now - cachedCredits.checkedAt) < CACHE_TTL_MS) {
    return cachedCredits.remaining >= MODELS.CREDIT_THRESHOLD
  }
  
  // Fetch fresh credits
  const credits = await getOpenRouterCredits()
  
  if (credits) {
    cachedCredits = {
      remaining: credits.remaining,
      checkedAt: now
    }
    return credits.remaining >= MODELS.CREDIT_THRESHOLD
  }
  
  // If we can't check credits, assume we have them (fail open)
  return true
}

/**
 * Get the appropriate model for a task tier
 * Will return free fallback if credits are exhausted
 */
export async function getModelForTask(tier: ModelTier): Promise<{ model: string; isFallback: boolean }> {
  const hasCredits = await hasSufficientCredits()
  
  if (!hasCredits) {
    console.warn('OpenRouter credits exhausted, using free fallback model')
    return { model: MODELS.FREE_FALLBACK, isFallback: true }
  }
  
  switch (tier) {
    case 'lesson':
    case 'analysis':
      return { model: MODELS.LESSON, isFallback: false }
    case 'utility':
      return { model: MODELS.UTILITY, isFallback: false }
    default:
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
  
  try {
    const result = await primaryCall(model)
    return { result, model, isFallback }
  } catch (error: any) {
    // Check if it's a payment/credit error
    if (error?.status === 402 || error?.message?.includes('402') || error?.message?.includes('insufficient')) {
      console.warn('Payment required error, falling back to free model')
      
      // Invalidate cache
      cachedCredits = { remaining: 0, checkedAt: Date.now() }
      
      // Retry with free model
      const result = await primaryCall(MODELS.FREE_FALLBACK)
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
