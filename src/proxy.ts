import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authMiddleware } from '@/lib/auth'
import { isOAuthSignupRateLimited } from '@/lib/auth/redis-rate-limit'

const isDev = process.env.NODE_ENV === 'development'

function buildCspHeader(): { nonce: string; csp: string } {
  const nonce = btoa(crypto.randomUUID())
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    "font-src 'self'",
    "connect-src 'self' https://*.sentry.io https://*.supabase.co https://api.stripe.com https://*.posthog.com https://us.i.posthog.com",
    'frame-src https://js.stripe.com https://hooks.stripe.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
  return { nonce, csp }
}

function applyCspHeaders(response: NextResponse): NextResponse {
  const { nonce, csp } = buildCspHeader()
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)
  return response
}

// '/' matcher KUN eksakt (isPublicRoute bruger `pathname === p`), så øvrige routes
// forbliver beskyttede. /pricing og /kontakt matcher eksakt + evt. undersider.
const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/kontakt',
  '/legal',
  '/docs',
  '/terms',
  '/privacy',
  '/login',
  '/signup',
  '/invite',
  '/reset-password',
]
const PUBLIC_API_PREFIXES = ['/api/health', '/api/auth', '/api/cron', '/api/webhooks']

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  return false
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// Edge-kompatibel constant-time string-sammenligning (erstatter Node.js timingSafeEqual)
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

function validateCronToken(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.DIGEST_CRON_SECRET
  if (!cronSecret) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const provided = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret}`

  if (!constantTimeEqual(provided, expected)) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  return null
}

export const proxy = authMiddleware(async (req) => {
  const { nextUrl, auth } = req as NextRequest & { auth: { user?: unknown } | null }
  const pathname = nextUrl.pathname

  // OAuth callback: rate-limit nye signup-flows pr. IP
  if (pathname === '/api/auth/callback/google') {
    const ip = getClientIp(req as NextRequest)
    const rateLimitResult = await isOAuthSignupRateLimited(ip).catch(() => null)
    if (rateLimitResult?.limited) {
      const retryAfterSec = Math.ceil((rateLimitResult.retryAfterMs ?? 3600000) / 1000)
      return new NextResponse(
        JSON.stringify({ error: 'For mange tilmeldingsforsøg — prøv igen senere' }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(retryAfterSec),
          },
        }
      )
    }
  }

  // Cron-ruter: valider Bearer-token (defense-in-depth — handler validerer også)
  if (pathname.startsWith('/api/cron')) {
    const tokenError = validateCronToken(req as NextRequest)
    if (tokenError) return tokenError
    return applyCspHeaders(NextResponse.next())
  }

  // Offentlige ruter — lad igennem med CSP
  if (isPublicRoute(pathname)) {
    return applyCspHeaders(NextResponse.next())
  }

  // Dashboard-ruter kræver aktiv session
  if (!auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname + nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  const res = NextResponse.next()
  res.headers.set('x-pathname', pathname)
  return applyCspHeaders(res)
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
