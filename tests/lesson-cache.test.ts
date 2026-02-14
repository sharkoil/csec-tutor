/**
 * Unit tests for lesson-cache.ts — pure function tests for coaching cache
 * serialization, parsing, and validation logic.
 */

import {
  LESSON_PROMPT_VERSION,
  buildWizardSignature,
  serializeCachedContent,
  parseCachedContent,
  shouldUseCachedLesson,
} from '@/lib/lesson-cache'

// ── buildWizardSignature ──────────────────────────────────────────────────

describe('buildWizardSignature', () => {
  it('returns "no-wizard" when wizardData is undefined', () => {
    expect(buildWizardSignature(undefined)).toBe('no-wizard')
  })

  it('returns "no-wizard" when wizardData is explicitly undefined', () => {
    expect(buildWizardSignature()).toBe('no-wizard')
  })

  it('returns deterministic JSON for given wizard data', () => {
    const sig1 = buildWizardSignature({
      target_grade: 'grade_1',
      proficiency_level: 'advanced',
      learning_style: 'theory_first',
      topic_confidence: { Algebra: 'confident', Geometry: 'struggling' },
    })

    const sig2 = buildWizardSignature({
      target_grade: 'grade_1',
      proficiency_level: 'advanced',
      learning_style: 'theory_first',
      topic_confidence: { Algebra: 'confident', Geometry: 'struggling' },
    })

    expect(sig1).toBe(sig2)
  })

  it('normalizes missing fields to defaults', () => {
    const sig = buildWizardSignature({})
    const parsed = JSON.parse(sig)
    expect(parsed.target_grade).toBe('unknown')
    expect(parsed.proficiency_level).toBe('unknown')
    expect(parsed.learning_style).toBe('blended')
    expect(parsed.topic_confidence).toEqual({})
  })

  it('produces different signatures for different proficiency levels', () => {
    const sig1 = buildWizardSignature({ proficiency_level: 'beginner' })
    const sig2 = buildWizardSignature({ proficiency_level: 'advanced' })
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures for different topic confidence maps', () => {
    const sig1 = buildWizardSignature({
      topic_confidence: { Algebra: 'confident' },
    })
    const sig2 = buildWizardSignature({
      topic_confidence: { Algebra: 'struggling' },
    })
    expect(sig1).not.toBe(sig2)
  })
})

// ── serializeCachedContent ────────────────────────────────────────────────

describe('serializeCachedContent', () => {
  it('wraps content with LESSON_CACHE_META comment', () => {
    const result = serializeCachedContent('Hello **World**')
    expect(result).toContain('<!-- LESSON_CACHE_META:')
    expect(result).toContain('Hello **World**')
  })

  it('includes the current prompt version in metadata', () => {
    const result = serializeCachedContent('Content here')
    expect(result).toContain(`"v":"${LESSON_PROMPT_VERSION}"`)
  })

  it('includes wizard signature in metadata', () => {
    const wizardData = { target_grade: 'grade_2', proficiency_level: 'intermediate' }
    const result = serializeCachedContent('Content', wizardData)
    const expectedSig = buildWizardSignature(wizardData)
    expect(result).toContain(`"w":${JSON.stringify(expectedSig)}`)
  })

  it('uses "no-wizard" when no wizard data provided', () => {
    const result = serializeCachedContent('Content')
    expect(result).toContain('"w":"no-wizard"')
  })

  it('content appears after the meta comment on a new line', () => {
    const result = serializeCachedContent('## Section 1\nParagraph')
    const lines = result.split('\n')
    expect(lines[0]).toMatch(/^<!-- LESSON_CACHE_META:/)
    expect(lines[1]).toBe('## Section 1')
  })
})

// ── parseCachedContent ────────────────────────────────────────────────────

describe('parseCachedContent', () => {
  it('extracts version and wizard signature from cached content', () => {
    const serialized = serializeCachedContent('Lesson text', { target_grade: 'grade_1' })
    const parsed = parseCachedContent(serialized)

    expect(parsed.version).toBe(LESSON_PROMPT_VERSION)
    expect(parsed.wizardSignature).not.toBeNull()
    expect(parsed.cleanContent).toBe('Lesson text')
  })

  it('returns null version/signature for legacy content without meta comment', () => {
    const parsed = parseCachedContent('Just raw content without any meta')
    expect(parsed.version).toBeNull()
    expect(parsed.wizardSignature).toBeNull()
    expect(parsed.cleanContent).toBe('Just raw content without any meta')
  })

  it('handles malformed JSON in meta comment gracefully', () => {
    const malformed = '<!-- LESSON_CACHE_META:{not valid json} -->\nContent'
    const parsed = parseCachedContent(malformed)
    expect(parsed.version).toBeNull()
    expect(parsed.wizardSignature).toBeNull()
    expect(parsed.cleanContent).toBe(malformed)
  })

  it('strips the meta comment from clean content', () => {
    const serialized = serializeCachedContent('Clean lesson content')
    const parsed = parseCachedContent(serialized)
    expect(parsed.cleanContent).not.toContain('LESSON_CACHE_META')
    expect(parsed.cleanContent).toBe('Clean lesson content')
  })

  it('round-trips correctly', () => {
    const original = '## Algebra\n\nHere is the lesson.\n\n### Section 2\n\nMore content.'
    const wizardData = {
      target_grade: 'grade_1',
      proficiency_level: 'advanced',
      learning_style: 'theory_first',
      topic_confidence: { Algebra: 'confident' },
    }
    const serialized = serializeCachedContent(original, wizardData)
    const parsed = parseCachedContent(serialized)

    expect(parsed.cleanContent).toBe(original)
    expect(parsed.version).toBe(LESSON_PROMPT_VERSION)
    expect(parsed.wizardSignature).toBe(buildWizardSignature(wizardData))
  })
})

// ── shouldUseCachedLesson ─────────────────────────────────────────────────

describe('shouldUseCachedLesson', () => {
  it('returns ok=true when version and wizard signature match', () => {
    const wizardData = { target_grade: 'grade_2', proficiency_level: 'intermediate' }
    const cached = serializeCachedContent('Good content', wizardData)

    const result = shouldUseCachedLesson(cached, wizardData)
    expect(result.ok).toBe(true)
    expect(result.content).toBe('Good content')
  })

  it('returns ok=false for legacy content without metadata', () => {
    const result = shouldUseCachedLesson('Old legacy content')
    expect(result.ok).toBe(false)
    expect(result.content).toBe('Old legacy content')
  })

  it('returns ok=false when version is different', () => {
    // Simulate old version by manually crafting the meta
    const oldMeta = `<!-- LESSON_CACHE_META:${JSON.stringify({ v: 'v1-old', w: 'no-wizard' })} -->\nContent`
    const result = shouldUseCachedLesson(oldMeta)
    expect(result.ok).toBe(false)
  })

  it('returns ok=false when wizard signature does not match', () => {
    const wizardA = { target_grade: 'grade_1', proficiency_level: 'advanced' }
    const wizardB = { target_grade: 'grade_3', proficiency_level: 'beginner' }

    // Cache was created with wizardA
    const cached = serializeCachedContent('Lesson for advanced', wizardA)

    // But user now has wizardB
    const result = shouldUseCachedLesson(cached, wizardB)
    expect(result.ok).toBe(false)
    expect(result.content).toBe('Lesson for advanced')
  })

  it('returns ok=true when both have no wizard data', () => {
    const cached = serializeCachedContent('Generic lesson')
    const result = shouldUseCachedLesson(cached)
    expect(result.ok).toBe(true)
    expect(result.content).toBe('Generic lesson')
  })

  it('returns ok=false when cached has wizard but current does not', () => {
    const wizardData = { target_grade: 'grade_1' }
    const cached = serializeCachedContent('Personalized', wizardData)
    const result = shouldUseCachedLesson(cached, undefined)
    expect(result.ok).toBe(false)
  })

  it('returns ok=false when cached has no wizard but current does', () => {
    const cached = serializeCachedContent('Generic')
    const result = shouldUseCachedLesson(cached, { target_grade: 'grade_1' })
    expect(result.ok).toBe(false)
  })
})
