/**
 * Lesson Cache — serialization helpers for coaching lesson caching.
 *
 * Extracted from the coaching API route so they can be unit-tested
 * independently and reused across server / client code.
 */

export type WizardData = {
  target_grade?: string
  proficiency_level?: string
  topic_confidence?: Record<string, string>
  learning_style?: string
}

/** Current prompt blueprint version — bump whenever the prompt changes. */
export const LESSON_PROMPT_VERSION = 'v2-12-section'

/**
 * Build a deterministic string signature from wizard data
 * so we can detect when the user profile has changed.
 */
export function buildWizardSignature(wizardData?: WizardData): string {
  if (!wizardData) return 'no-wizard'

  const normalized = {
    target_grade: wizardData.target_grade || 'unknown',
    proficiency_level: wizardData.proficiency_level || 'unknown',
    learning_style: wizardData.learning_style || 'blended',
    topic_confidence: wizardData.topic_confidence || {},
  }

  return JSON.stringify(normalized)
}

/**
 * Wrap lesson content with a cache-metadata HTML comment.
 * The comment is the very first line and is stripped on read.
 */
export function serializeCachedContent(content: string, wizardData?: WizardData): string {
  const metadata = {
    v: LESSON_PROMPT_VERSION,
    w: buildWizardSignature(wizardData),
  }
  return `<!-- LESSON_CACHE_META:${JSON.stringify(metadata)} -->\n${content}`
}

/**
 * Parse a cached-content string, extracting the meta-data comment (if any)
 * and returning the clean lesson text plus version & wizard-signature.
 */
export function parseCachedContent(content: string): {
  cleanContent: string
  version: string | null
  wizardSignature: string | null
} {
  const match = content.match(/^<!--\s*LESSON_CACHE_META:(.*?)\s*-->\n?/)
  if (!match) {
    return { cleanContent: content, version: null, wizardSignature: null }
  }

  try {
    const parsed = JSON.parse(match[1]) as { v?: string; w?: string }
    return {
      cleanContent: content.replace(/^<!--\s*LESSON_CACHE_META:.*?\s*-->\n?/, ''),
      version: parsed.v || null,
      wizardSignature: parsed.w || null,
    }
  } catch {
    return { cleanContent: content, version: null, wizardSignature: null }
  }
}

/**
 * Decide whether a cached lesson is still valid for the current
 * prompt version AND wizard profile.
 *
 * Returns `{ ok: true, content }` when usable, or `{ ok: false, content }`
 * when the cache should be regenerated (content is still provided for
 * possible fallback use).
 */
export function shouldUseCachedLesson(
  rawContent: string,
  wizardData?: WizardData
): { ok: boolean; content: string } {
  const parsed = parseCachedContent(rawContent)

  // Legacy / missing metadata ⇒ stale
  if (!parsed.version || !parsed.wizardSignature) {
    return { ok: false, content: parsed.cleanContent }
  }

  // Version mismatch ⇒ stale
  if (parsed.version !== LESSON_PROMPT_VERSION) {
    return { ok: false, content: parsed.cleanContent }
  }

  // Wizard signature mismatch ⇒ stale
  const expectedSignature = buildWizardSignature(wizardData)
  if (parsed.wizardSignature !== expectedSignature) {
    return { ok: false, content: parsed.cleanContent }
  }

  return { ok: true, content: parsed.cleanContent }
}
