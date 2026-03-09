import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ==================== RATE LIMITING ====================
// PENTEST-005 / PENTEST-011 / DEC-051: Implementer rate limiting
//
// Denne implementation bruger en simpel in-memory sliding window.
// I produktion SKAL dette erstattes med Redis-baseret rate limiting
// (fx Upstash Ratelimit) for at virke korrekt på tværs af serverless instances.
//
// Installation til produktion:
//   npm install @upstash/ratelimit @upstash/redis
// Og brug konfigurationen i kommentarerne nedenfor.

interface RateLimitEntry {
  count: number
  windowStart: number
}

// In-memory store — KUN til development/single-instance.
// Erstat med Upstash Redis i produktion.
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Enkel sliding window rate limiter.
 * @param key Unik nøgle (IP + endpoint-type)
 * @param limit Max antal requests i vinduet
 * @param windowMs Vinduesstørrelse i millisekunder
 * @returns true hvis request er tilladt, false hvis rate-limiteret
 */
function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart > windowMs) {
    // Nyt vindue
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

/**
 * Hent klientens IP-adresse fra request headers.
 * Understøtter Vercel, Cloudflare og direkte forbindelser.
 */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  )
}

// ==================== RATE LIMIT KONFIGURATION ====================

const RATE_LIMITS = {
  // Auth endpoints — strengt begrænset mod brute force
  auth: {
    limit: 5,
    windowMs: 60 * 1000, // 5 requests per minut per IP
  },
  // Download endpoints — moderat begrænsning
  download: {
    limit: 20,
    windowMs: 60 * 1000, // 20 downloads per minut per IP
  },
  // Server actions / API generelt
  api: {
    limit: 100,
    windowMs: 60 * 1000, // 100 requests per minut per IP
  },
} as const

// ==================== MIDDLEWARE ====================

export default withAuth(
  function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl
    const clientIp = getClientIp(req)

    // Tillad altid API auth routes (håndteres separat med streng rate limiting)
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next()
    }

    // Rate limiting per endpoint-type
    let rateLimitConfig: { limit: number; windowMs: number }
    let rateLimitKey: string

    if (pathname.startsWith('/api/auth')) {
      // Auth endpoints — strengt begrænset (brute force beskyttelse)
      rateLimitConfig = RATE_LIMITS.auth
      rateLimitKey = `auth:${clientIp}`
    } else if (
      pathname.includes('/download') ||
      pathname.includes('getContractFileUrl') ||
      pathname.includes('getSignedDownloadUrl')
    ) {
      // Download endpoints
      rateLimitConfig = RATE_LIMITS.download
      rateLimitKey = `download:${clientIp}`
    } else {
      // Alle andre endpoints
      rateLimitConfig = RATE_LIMITS.api
      rateLimitKey = `api:${clientIp}`
    }

    const allowed = checkRateLimit(
      rateLimitKey,
      rateLimitConfig.limit,
      rateLimitConfig.windowMs
    )

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'For mange forespørgsler — vent venligst og prøv igen',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-RateLimit-Limit': String(rateLimitConfig.limit),
            'X-RateLimit-Window': String(rateLimitConfig.windowMs / 1000) + 's',
          },
        }
      )
    }

    // Tjek om bruger er autentificeret for beskyttede routes
    const token = req.nextauth.token

    if (!token) {
      const signInUrl = new URL('/login', req.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Tillad altid auth-relaterede API routes
        if (pathname.startsWith('/api/auth')) {
          return true
        }

        // SIKKERHED (DEC-023 / PENTEST-004):
        // Kræv BÅDE gyldigt token OG organizationId.
        // En bruger uden organizationId (afbrudt onboarding, korrupt token)
        // må ikke tilgå beskyttede routes.
        return !!token && !!token.organizationId
      },
    },
  }
)

export const config = {
  matcher: [
    // Beskyt dashboard og alle undersider
    '/dashboard/:path*',
    '/companies/:path*',
    '/contracts/:path*',
    '/cases/:path*',
    '/tasks/:path*',
    '/persons/:path*',
    '/documents/:path*',
    '/settings/:path*',
    // Beskyt API routes undtagen auth
    '/api/((?!auth).)*',
  ],
}

// ==================== PRODUKTION: Upstash Redis Rate Limiting ====================
//
// Erstat ovenstående in-memory implementation med dette i produktion:
//
// import { Ratelimit } from '@upstash/ratelimit'
// import { Redis } from '@upstash/redis'
//
// const redis = Redis.fromEnv()
//
// const authRatelimit = new Ratelimit({
//   redis,
//   limiter: Ratelimit.slidingWindow(5, '60 s'),
//   analytics: true,
//   prefix: 'chainhub:ratelimit:auth',
// })
//
// const downloadRatelimit = new Ratelimit({
//   redis,
//   limiter: Ratelimit.slidingWindow(20, '60 s'),
//   analytics: true,
//   prefix: 'chainhub:ratelimit:download',
// })
//
// const apiRatelimit = new Ratelimit({
//   redis,
//   limiter: Ratelimit.slidingWindow(100, '60 s'),
//   analytics: true,
//   prefix: 'chainhub:ratelimit:api',
// })
//
// Brug i middleware:
// const { success, limit, remaining, reset } = await apiRatelimit.limit(clientIp)
// if (!success) {
//   return new NextResponse(...429 response...)
// }