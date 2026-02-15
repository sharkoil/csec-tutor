import { NextRequest, NextResponse } from 'next/server'
import { authoriseAIRequest } from '@/lib/api-auth'

/**
 * Next.js Middleware — runs before every matched route.
 *
 * Protects `/api/ai/*` endpoints by:
 *   1. Requiring a valid UUID in the `x-user-id` header
 *   2. Applying per-IP rate limiting  (60 req / min)
 *   3. Applying per-user rate limiting (40 req / min)
 */
export function middleware(req: NextRequest) {
  // Only guard AI API routes
  if (req.nextUrl.pathname.startsWith('/api/ai')) {
    const rejection = authoriseAIRequest(req)
    if (rejection) return rejection
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/ai/:path*'],
}
