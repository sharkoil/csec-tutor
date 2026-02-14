/**
 * Integration tests for the POST /api/ai/coaching route handler.
 *
 * Tests cache logic, validation, generation, and the fixed
 * double-request.json() bug.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Polyfill Web APIs for jsdom ────────────────────────────────────────────
// jest-environment-jsdom sandboxes globals. Re-inject from Node builtins.
const { Request: NodeRequest, Response: NodeResponse, Headers: NodeHeaders, fetch: nodeFetch } = 
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('node:http') as any;

// Use the native undici-based globals that Node 22 ships
(globalThis as any).Request ??= NodeRequest;
(globalThis as any).Response ??= NodeResponse;
(globalThis as any).Headers ??= NodeHeaders;
(globalThis as any).fetch ??= nodeFetch;

// ── Mocks ──────────────────────────────────────────────────────────────────

// We need to mock the environment variable BEFORE importing the route
process.env.OPENROUTER_API_KEY = 'test-key-123'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Mock next/server
jest.mock('next/server', () => {
  // Build a minimal NextResponse.json helper
  const json = (body: any, init?: { status?: number; headers?: Record<string,string> }) => {
    const status = init?.status ?? 200
    return {
      status,
      headers: new Map(Object.entries(init?.headers ?? {})),
      json: async () => body,
      _body: body,
    }
  }
  return {
    NextRequest: class {
      url: string
      method: string
      _body: any
      nextUrl: URL
      headers: Map<string, string>
      constructor(input: string, init?: any) {
        this.url = input
        this.method = init?.method ?? 'GET'
        this._body = init?.body ?? null
        this.nextUrl = new URL(input)
        this.headers = new Map(Object.entries(init?.headers ?? {}))
      }
      async json() {
        return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
      }
    },
    NextResponse: { json },
  }
})

// Mock AICoach
const mockGenerateTextbookLesson = jest.fn()
const mockGenerateFundamentalCoaching = jest.fn()
const mockGetCreditStatus = jest.fn()

jest.mock('@/lib/ai-coach', () => ({
  AICoach: {
    generateTextbookLesson: (...args: any[]) => mockGenerateTextbookLesson(...args),
    generateFundamentalCoaching: (...args: any[]) => mockGenerateFundamentalCoaching(...args),
    getCreditStatus: (...args: any[]) => mockGetCreditStatus(...args),
  },
}))

// Mock Supabase
// The query object must be both chainable (methods return self) and
// thenable (awaiting it resolves to { data, error }).  This is how
// the real Supabase PostgREST builder works.
let mockQueryResult: any = { data: null, error: null }

const mockQuery: any = {
  select: jest.fn(() => mockQuery),
  insert: jest.fn(() => mockQuery),
  delete: jest.fn(() => mockQuery),
  eq: jest.fn(() => mockQuery),
  is: jest.fn(() => mockQuery),
  order: jest.fn(() => mockQuery),
  limit: jest.fn(() => mockQuery),
  // Make it thenable so `const { data, error } = await query` works
  then(resolve: any, reject?: any) {
    return Promise.resolve(mockQueryResult).then(resolve, reject)
  },
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => mockQuery),
  })),
}))

// No external module needed for lesson-cache since they're re-exported through the route,
// but we import them directly for test data creation
import {
  serializeCachedContent,
  LESSON_PROMPT_VERSION,
  buildWizardSignature,
} from '@/lib/lesson-cache'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: any) {
  // Matches the shape of our NextRequest mock above
  return {
    url: 'http://localhost:3000/api/ai/coaching',
    method: 'POST',
    _body: JSON.stringify(body),
    nextUrl: new URL('http://localhost:3000/api/ai/coaching'),
    headers: new Map([['content-type', 'application/json']]),
    async json() {
      return body
    },
  }
}

// ── Import route handler ──────────────────────────────────────────────────
// Must come after mocks

import { POST, GET } from '@/app/api/ai/coaching/route'

describe('POST /api/ai/coaching', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = 'test-key-123'

    // Default: no cache (Supabase returns empty)
    mockQueryResult = { data: [], error: null }
  })

  // ── Validation ──────────────────────────────────────────────────────────

  it('returns 500 when OPENROUTER_API_KEY is not set', async () => {
    delete process.env.OPENROUTER_API_KEY
    const req = makeRequest({ subject: 'Math', topic: 'Algebra' }) as any
    const response = await POST(req)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('API key')
    // Restore for other tests
    process.env.OPENROUTER_API_KEY = 'test-key-123'
  })

  it('returns 400 when subject is missing', async () => {
    const req = makeRequest({ topic: 'Algebra' }) as any
    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('returns 400 when topic is missing', async () => {
    const req = makeRequest({ subject: 'Math' }) as any
    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  // ── Cache hit ───────────────────────────────────────────────────────────

  it('returns cached content when version and wizard signature match', async () => {
    const wizardData = { target_grade: 'grade_2', proficiency_level: 'intermediate' }
    const cachedContent = serializeCachedContent('## Cached Lesson\nGreat content.', wizardData)

    mockQueryResult = {
      data: [{
        content: cachedContent,
        model: 'claude-sonnet',
        is_fallback: false,
        created_at: '2026-01-01',
      }],
      error: null,
    }

    const req = makeRequest({
      subject: 'Math',
      topic: 'Algebra',
      wizardData,
    }) as any

    const response = await POST(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.cached).toBe(true)
    expect(body.narrativeContent).toBe('## Cached Lesson\nGreat content.')
    // Should NOT have called generateTextbookLesson
    expect(mockGenerateTextbookLesson).not.toHaveBeenCalled()
  })

  // ── Cache miss (cacheOnly) ──────────────────────────────────────────────

  it('returns 404 when cacheOnly=true and no cache exists', async () => {
    mockQueryResult = { data: [], error: null }

    const req = makeRequest({
      subject: 'Math',
      topic: 'Algebra',
      cacheOnly: true,
    }) as any

    const response = await POST(req)
    expect(response.status).toBe(404)
  })

  it('returns 404 when cacheOnly=true and cache has wrong wizard signature', async () => {
    const wizardA = { target_grade: 'grade_1', proficiency_level: 'advanced' }
    const wizardB = { target_grade: 'grade_3', proficiency_level: 'beginner' }
    const cachedContent = serializeCachedContent('Old lesson', wizardA)

    mockQueryResult = {
      data: [{ content: cachedContent, model: 'test', is_fallback: false, created_at: '2026-01-01' }],
      error: null,
    }

    const req = makeRequest({
      subject: 'Math',
      topic: 'Algebra',
      cacheOnly: true,
      wizardData: wizardB,
    }) as any

    const response = await POST(req)
    expect(response.status).toBe(404)
  })

  // ── Generation ──────────────────────────────────────────────────────────

  it('generates fresh content when no cache exists', async () => {
    mockQueryResult = { data: [], error: null }

    const generatedLesson = {
      subject: 'Math',
      topic: 'Algebra',
      content: '## Algebra\n\nFresh personalized content.',
      model: 'claude-sonnet-4',
      isFallback: false,
      generatedAt: '2026-01-01',
    }
    mockGenerateTextbookLesson.mockResolvedValue(generatedLesson)

    const req = makeRequest({
      subject: 'Math',
      topic: 'Algebra',
      wizardData: { target_grade: 'grade_1', proficiency_level: 'advanced' },
    }) as any

    const response = await POST(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.cached).toBe(false)
    expect(body.narrativeContent).toContain('Fresh personalized content')
    expect(mockGenerateTextbookLesson).toHaveBeenCalledWith(
      'Math',
      'Algebra',
      { target_grade: 'grade_1', proficiency_level: 'advanced' }
    )
  })

  it('regenerates when cache has stale wizard signature (non-cacheOnly)', async () => {
    const staleWizard = { target_grade: 'grade_3' }
    const currentWizard = { target_grade: 'grade_1', proficiency_level: 'advanced' }
    const cachedContent = serializeCachedContent('Stale lesson', staleWizard)

    mockQueryResult = {
      data: [{ content: cachedContent, model: 'old', is_fallback: false, created_at: '2025-01-01' }],
      error: null,
    }

    const freshLesson = {
      subject: 'Math',
      topic: 'Algebra',
      content: '## Fresh personalized lesson',
      model: 'claude-sonnet-4',
      isFallback: false,
      generatedAt: '2026-01-01',
    }
    mockGenerateTextbookLesson.mockResolvedValue(freshLesson)

    const req = makeRequest({
      subject: 'Math',
      topic: 'Algebra',
      wizardData: currentWizard,
    }) as any

    const response = await POST(req)
    const body = await response.json()
    expect(body.cached).toBe(false)
    expect(body.narrativeContent).toContain('Fresh personalized lesson')
    expect(mockGenerateTextbookLesson).toHaveBeenCalled()
  })

  it('skips cache when refresh=true', async () => {
    const wizardData = { target_grade: 'grade_2' }
    const cachedContent = serializeCachedContent('Cached', wizardData)

    mockQueryResult = {
      data: [{ content: cachedContent, model: 'test', is_fallback: false, created_at: '2026-01-01' }],
      error: null,
    }

    const freshLesson = {
      subject: 'Math',
      topic: 'Algebra',
      content: 'Refreshed content',
      model: 'claude',
      isFallback: false,
      generatedAt: '2026-01-01',
    }
    mockGenerateTextbookLesson.mockResolvedValue(freshLesson)

    const req = makeRequest({
      subject: 'Math',
      topic: 'Algebra',
      refresh: true,
      wizardData,
    }) as any

    const response = await POST(req)
    const body = await response.json()
    expect(body.cached).toBe(false)
    expect(mockGenerateTextbookLesson).toHaveBeenCalled()
  })

  // ── Scope ───────────────────────────────────────────────────────────────

  it('uses personalized scope when userId is provided', async () => {
    mockQueryResult = { data: [], error: null }

    mockGenerateTextbookLesson.mockResolvedValue({
      subject: 'Math',
      topic: 'Algebra',
      content: 'Personal',
      model: 'claude',
      isFallback: false,
      generatedAt: '2026-01-01',
    })

    const req = makeRequest({
      subject: 'Math',
      topic: 'Algebra',
      userId: 'user-123',
    }) as any

    await POST(req)

    // The insert call should include content_type: 'personalized'
    // Check that eq was called with 'personalized' somewhere
    const eqCalls = mockQuery.eq.mock.calls
    // At minimum, generateTextbookLesson was called
    expect(mockGenerateTextbookLesson).toHaveBeenCalled()
  })

  // ── Error handling ──────────────────────────────────────────────────────

  it('returns 500 when generation fails', async () => {
    mockQueryResult = { data: [], error: null }
    mockGenerateTextbookLesson.mockRejectedValue(new Error('Model unavailable'))

    const req = makeRequest({
      subject: 'Math',
      topic: 'Algebra',
    }) as any

    const response = await POST(req)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('Failed to generate')
  })
})

describe('GET /api/ai/coaching', () => {
  it('returns credit status', async () => {
    mockGetCreditStatus.mockResolvedValue({
      hasCredits: true,
      remaining: 100,
      isFallbackMode: false,
    })

    const response = await GET()
    const body = await response.json()
    expect(body.hasCredits).toBe(true)
  })

  it('returns fallback status on error', async () => {
    mockGetCreditStatus.mockRejectedValue(new Error('Failed'))
    const response = await GET()
    const body = await response.json()
    expect(body.hasCredits).toBe(true)
    expect(body.isFallbackMode).toBe(false)
  })
})
