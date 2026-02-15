import { NextRequest, NextResponse } from 'next/server'

// ─── Constants ────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Requests per window per IP address */
const IP_RATE_LIMIT = 60
/** Requests per window per user */
const USER_RATE_LIMIT = 40
/** Rate-limit window in milliseconds (1 minute) */
const RATE_WINDOW_MS = 60_000

// ─── In-memory rate-limit stores ──────────────────────────────────────────────
// These reset on server restart / redeployment — acceptable for a v1 guard.
// Upgrade to Redis / Upstash for production scale.
const ipBuckets = new Map<string, { count: number; windowStart: number }>()
const userBuckets = new Map<string, { count: number; windowStart: number }>()

/** Evict stale entries every 5 minutes to prevent memory leaks */
let lastEvict = Date.now()
function evictStale() {
  const now = Date.now()
  if (now - lastEvict < 5 * 60_000) return
  lastEvict = now
  for (const [key, val] of ipBuckets) {
    if (now - val.windowStart > RATE_WINDOW_MS * 2) ipBuckets.delete(key)
  }
  for (const [key, val] of userBuckets) {
    if (now - val.windowStart > RATE_WINDOW_MS * 2) userBuckets.delete(key)
  }
}

function checkBucket(
  store: Map<string, { count: number; windowStart: number }>,
  key: string,
  limit: number,
): { allowed: boolean; remaining: number } {
  evictStale()
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }
  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Extract the real client IP from the request */
export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Validate the `x-user-id` header and apply rate limiting.
 *
 * Returns `null` when the request is authorised, or a `NextResponse`
 * that should be returned immediately (401 / 429).
 */
export function authoriseAIRequest(req: NextRequest): NextResponse | null {
  // 1. Require x-user-id header with valid UUID
  const userId = req.headers.get('x-user-id')
  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    )
  }

  // 2. IP-based rate limit
  const ip = getClientIP(req)
  const ipCheck = checkBucket(ipBuckets, ip, IP_RATE_LIMIT)
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  // 3. Per-user rate limit (prevents a single user from exhausting budget)
  const userCheck = checkBucket(userBuckets, userId, USER_RATE_LIMIT)
  if (!userCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  return null // authorised
}

/**
 * Extract the verified user ID from the request header.
 * Call this inside API routes AFTER middleware has run.
 */
export function getUserId(req: NextRequest): string {
  return req.headers.get('x-user-id') || ''
}
