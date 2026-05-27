import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authMiddleware } from '@/lib/auth'
import { isOAuthSignupRateLimited } from '@/lib/auth/redis-rate-limit'

/** Genererer en nonce-baseret CSP-header og returnerer nonce + header-værdien.
 *  'unsafe-inline' fjernes fra script-src (erstattes af nonce).
 *  'unsafe-inline' bevares i style-src fordi Tailwind kræver det. */
function buildCspHeader(): { nonce: string; csp: string } {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = [
    "default-src 'self'",
    // nonce erstatter 'unsafe-inline' for scripts — strict-dynamic er backup for ældre browsere
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`,
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

// Ruter der altid er offentlige (ingen auth krævet)
const PUBLIC_PATHS = ['/login', '/signup', '/invite', '/reset-password']

// API-ruter der er offentlige mht. session-auth (prefix-match)
// NB: /api/cron kræver stadig gyldig Bearer-token — se valideringen nedenfor
const PUBLIC_API_PREFIXES = ['/api/health', '/api/auth', '/api/cron', '/api/webhooks']

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return true
  }
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }
  return false
}

/** Validerer Bearer-token for cron-ruter i middleware.
 *  Bruger timing-safe sammenligning for at undgå timing-angreb.
 *  Returnerer 401-response hvis token er ugyldigt, ellers null. */
function validateCronToken(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.DIGEST_CRON_SECRET
  if (!cronSecret) {
    // Ingen hemmelighed konfigureret — afvis altid
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const provided = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret}`

  // Buffer-længder skal matche — ellers er timingSafeEqual aldrig true
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  return null // Token er gyldigt
}

/** Tilføjer CSP + nonce-header til en given NextResponse. */
function applyCspHeaders(response: NextResponse): NextResponse {
  const { nonce, csp } = buildCspHeader()
  response.headers.set('Content-Security-Policy', csp)
  // x-nonce videresendes til layout.tsx via headers() — bruges til <Script nonce={nonce}>
  response.headers.set('x-nonce', nonce)
  return response
}

/** Udtrækker klientens IP-adresse fra request-headers.
 *  Prioriterer x-forwarded-for (Vercel/Cloudflare) over x-real-ip. */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for kan indeholde en kommasepareret liste — første entry er klienten
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export default authMiddleware(async (req) => {
  const { nextUrl, auth } = req as NextRequest & { auth: { user?: unknown } | null }
  const pathname = nextUrl.pathname

  // Google OAuth callback: rate-limit nye signup-flows pr. IP-adresse.
  // Kaldet sker FØR NextAuth opretter bruger/organisation — en overskridelse giver 429.
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

  // Cron-ruter: valider Bearer-token i middleware — handler er sekundær forsvarslinje
  if (pathname.startsWith('/api/cron')) {
    const tokenError = validateCronToken(req as NextRequest)
    if (tokenError) return tokenError
    return applyCspHeaders(NextResponse.next())
  }

  // Øvrige offentlige ruter — lad altid igennem
  if (isPublicRoute(pathname)) {
    return applyCspHeaders(NextResponse.next())
  }

  // Dashboard-ruter kræver aktiv session
  const isDashboardRoute = pathname.startsWith('/(dashboard)/') || !pathname.startsWith('/api/')

  if (isDashboardRoute && !auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname + nextUrl.search)
    // Redirect-responses behøver ikke CSP (ingen HTML-indhold)
    return NextResponse.redirect(loginUrl)
  }

  return applyCspHeaders(NextResponse.next())
})

export const config = {
  /*
   * Kør middleware på alle ruter undtagen:
   * - Next.js interne ruter (_next/static, _next/image)
   * - Favicon og statiske filer i /public
   * - Sentry tunnel-rute (/monitoring)
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
