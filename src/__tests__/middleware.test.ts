import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock OAuth rate limiter ─────────────────────────────────────────────────
vi.mock('@/lib/auth/redis-rate-limit', () => ({
  isOAuthSignupRateLimited: vi.fn().mockResolvedValue({ limited: false }),
}))

// ── Mock next/server and auth before any imports ──────────────────────────────
function makeHeadersMock() {
  const store: Record<string, string> = {}
  return {
    set: (k: string, v: string) => {
      store[k] = v
    },
    get: (k: string) => store[k] ?? null,
  }
}
const mockNext = vi.fn(() => ({ type: 'next', headers: makeHeadersMock() }))
const mockRedirect = vi.fn((url: URL) => ({
  type: 'redirect',
  url: url.toString(),
  headers: makeHeadersMock(),
}))

class MockNextResponse {
  body: string
  status: number
  headers: Record<string, string>
  type = 'response'
  constructor(body: string, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body
    this.status = init?.status ?? 200
    this.headers = init?.headers ?? {}
  }
  static next = mockNext
  static redirect = mockRedirect
}

vi.mock('next/server', () => ({
  NextResponse: MockNextResponse,
}))

// authMiddleware simply invokes the handler function it receives with the request.
let capturedHandler: ((req: object) => unknown) | null = null
vi.mock('@/lib/auth', () => ({
  authMiddleware: (fn: (req: object) => unknown) => {
    capturedHandler = fn
    return () => {}
  },
  auth: vi.fn(),
}))

// Import proxy AFTER mocks (Next.js 16 uses proxy.ts instead of middleware.ts)
await import('@/proxy')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, withAuth = false, headers: Record<string, string> = {}) {
  const url = `http://localhost:3000${pathname}`
  return {
    nextUrl: { pathname, search: '' },
    url,
    auth: withAuth ? { user: { id: 'u1' } } : null,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  }
}

async function runMiddleware(
  pathname: string,
  withAuth = false,
  headers: Record<string, string> = {}
) {
  if (!capturedHandler) throw new Error('capturedHandler not set')
  return capturedHandler(makeRequest(pathname, withAuth, headers))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('middleware — public routes pass through without auth', () => {
  beforeEach(() => {
    mockNext.mockClear()
    mockRedirect.mockClear()
  })

  it('allows /login without auth', async () => {
    await runMiddleware('/login', false)
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /signup without auth', async () => {
    await runMiddleware('/signup', false)
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /invite without auth', async () => {
    await runMiddleware('/invite', false)
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /reset-password without auth', async () => {
    await runMiddleware('/reset-password', false)
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /login/... sub-paths without auth', async () => {
    await runMiddleware('/login/callback', false)
    expect(mockNext).toHaveBeenCalled()
  })
})

describe('middleware — public API routes pass through without auth', () => {
  beforeEach(() => {
    mockNext.mockClear()
    mockRedirect.mockClear()
  })

  it('allows /api/health without auth', async () => {
    await runMiddleware('/api/health', false)
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /api/auth/... without auth', async () => {
    await runMiddleware('/api/auth/session', false)
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /api/webhooks/... without auth', async () => {
    await runMiddleware('/api/webhooks/stripe', false)
    expect(mockNext).toHaveBeenCalled()
  })
})

describe('middleware — cron routes require Bearer token', () => {
  const CRON_SECRET = 'test-cron-secret-123'

  beforeEach(() => {
    mockNext.mockClear()
    mockRedirect.mockClear()
    process.env.DIGEST_CRON_SECRET = CRON_SECRET
  })

  afterEach(() => {
    delete process.env.DIGEST_CRON_SECRET
  })

  it('allows /api/cron with valid Bearer token', async () => {
    const result = await runMiddleware('/api/cron/daily-digest', false, {
      authorization: `Bearer ${CRON_SECRET}`,
    })
    expect(mockNext).toHaveBeenCalled()
    expect((result as { type: string }).type).toBe('next')
  })

  it('rejects /api/cron with invalid Bearer token', async () => {
    const result = await runMiddleware('/api/cron/daily-digest', false, {
      authorization: 'Bearer wrong-token',
    })
    expect(mockNext).not.toHaveBeenCalled()
    expect(result).toBeInstanceOf(MockNextResponse)
    expect((result as MockNextResponse).status).toBe(401)
  })

  it('rejects /api/cron with no token', async () => {
    const result = await runMiddleware('/api/cron/daily-digest', false)
    expect(mockNext).not.toHaveBeenCalled()
    expect(result).toBeInstanceOf(MockNextResponse)
    expect((result as MockNextResponse).status).toBe(401)
  })

  it('rejects /api/cron when DIGEST_CRON_SECRET is not set', async () => {
    delete process.env.DIGEST_CRON_SECRET
    const result = await runMiddleware('/api/cron/daily-digest', false, {
      authorization: `Bearer ${CRON_SECRET}`,
    })
    expect(mockNext).not.toHaveBeenCalled()
    expect(result).toBeInstanceOf(MockNextResponse)
    expect((result as MockNextResponse).status).toBe(401)
  })
})

describe('middleware — protected routes redirect unauthenticated users', () => {
  beforeEach(() => {
    mockNext.mockClear()
    mockRedirect.mockClear()
  })

  it('redirects /dashboard to /login when unauthenticated', async () => {
    await runMiddleware('/dashboard', false)
    expect(mockRedirect).toHaveBeenCalled()
    expect(mockNext).not.toHaveBeenCalled()
    const redirectUrl: string = mockRedirect.mock.calls[0]?.[0]?.toString() ?? ''
    expect(redirectUrl).toContain('/login')
  })

  it('includes callbackUrl in redirect', async () => {
    await runMiddleware('/dashboard', false)
    const redirectUrl: string = mockRedirect.mock.calls[0]?.[0]?.toString() ?? ''
    expect(redirectUrl).toContain('callbackUrl=%2Fdashboard')
  })

  it('redirects /companies without auth', async () => {
    await runMiddleware('/companies', false)
    expect(mockRedirect).toHaveBeenCalled()
  })

  it('redirects /contracts without auth', async () => {
    await runMiddleware('/contracts', false)
    expect(mockRedirect).toHaveBeenCalled()
  })
})

describe('middleware — authenticated users pass through protected routes', () => {
  beforeEach(() => {
    mockNext.mockClear()
    mockRedirect.mockClear()
  })

  it('allows /dashboard when authenticated', async () => {
    await runMiddleware('/dashboard', true)
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /companies when authenticated', async () => {
    await runMiddleware('/companies', true)
    expect(mockNext).toHaveBeenCalled()
  })

  it('allows /contracts when authenticated', async () => {
    await runMiddleware('/contracts', true)
    expect(mockNext).toHaveBeenCalled()
  })
})

describe('middleware — public marketing-sider passerer uden auth', () => {
  beforeEach(() => {
    mockNext.mockClear()
    mockRedirect.mockClear()
  })

  it('allows / (forside) without auth', async () => {
    await runMiddleware('/', false)
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /pricing without auth', async () => {
    await runMiddleware('/pricing', false)
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /kontakt without auth', async () => {
    await runMiddleware('/kontakt', false)
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('allows /pricing/... sub-paths without auth', async () => {
    await runMiddleware('/pricing/sammenlign', false)
    expect(mockNext).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redirecter STADIG /dashboard til login (/ må ikke gøre alt public)', async () => {
    await runMiddleware('/dashboard', false)
    expect(mockRedirect).toHaveBeenCalled()
    expect(mockNext).not.toHaveBeenCalled()
  })
})
