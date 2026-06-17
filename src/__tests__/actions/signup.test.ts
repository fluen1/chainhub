import { describe, it, expect, vi, beforeEach } from 'vitest'

// ────────────────────────────────────────────────────────────────────────────
// Mocks — skal stå FØR import af den testede modul
// ────────────────────────────────────────────────────────────────────────────

const mockTx = {
  organization: {
    create: vi.fn().mockResolvedValue({ id: 'org-new' }),
  },
  user: {
    create: vi.fn().mockResolvedValue({ id: 'user-new' }),
  },
  userRoleAssignment: {
    create: vi.fn().mockResolvedValue({}),
  },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn().mockResolvedValue(null), // ingen eksisterende bruger som default
    },
    organization: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi
      .fn()
      .mockImplementation(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-session', organizationId: 'a1b2c3d4-e5f6-4789-9abc-def012345678' },
  }),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-pw'),
  },
}))

import { createAccount, updateOrganizationOnboarding } from '@/actions/signup'

// ────────────────────────────────────────────────────────────────────────────
// createAccount tests
// ────────────────────────────────────────────────────────────────────────────

describe('createAccount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: opretter org + user + rolle og returnerer id-par', async () => {
    const result = await createAccount({
      name: 'Philip Birkenborg',
      email: 'philip@test.dk',
      password: 'sikkerPass1',
      termsAccepted: true,
      dpaAccepted: true,
    })

    expect('error' in result).toBe(false)
    if (!('error' in result) && result.data) {
      expect(result.data.userId).toBe('user-new')
      expect(result.data.organizationId).toBe('org-new')
    }
  })

  it('afviser adgangskode under 8 tegn', async () => {
    const result = await createAccount({
      name: 'Philip Birkenborg',
      email: 'philip@test.dk',
      password: 'kort',
      termsAccepted: true,
      dpaAccepted: true,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/mindst 8/i)
    }
  })

  it('afviser navn under 2 tegn', async () => {
    const result = await createAccount({
      name: 'P',
      email: 'philip@test.dk',
      password: 'godAdgangskode1',
      termsAccepted: true,
      dpaAccepted: true,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/mindst 2/i)
    }
  })

  it('afviser ugyldig e-mail', async () => {
    const result = await createAccount({
      name: 'Philip Birkenborg',
      email: 'ikke-en-email',
      password: 'godAdgangskode1',
      termsAccepted: true,
      dpaAccepted: true,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/e-mail/i)
    }
  })

  it('afviser duplikat e-mail', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 'existing' } as never)

    const result = await createAccount({
      name: 'Philip Birkenborg',
      email: 'allerede@test.dk',
      password: 'godAdgangskode1',
      termsAccepted: true,
      dpaAccepted: true,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/allerede/i)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// updateOrganizationOnboarding tests
// ────────────────────────────────────────────────────────────────────────────

describe('updateOrganizationOnboarding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: opdaterer org og returnerer success', async () => {
    const result = await updateOrganizationOnboarding({
      name: 'Tandlægegruppen A/S',
      industry: 'tandlaege',
      estimatedLocations: '6-25',
    })

    expect('error' in result).toBe(false)
    if (!('error' in result) && result.data) {
      expect(result.data.success).toBe(true)
    }
  })

  it('afviser tomt organisationsnavn', async () => {
    const result = await updateOrganizationOnboarding({
      name: '',
    })

    expect('error' in result).toBe(true)
  })

  it('afviser uautoriseret request', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null)

    const result = await updateOrganizationOnboarding({ name: 'TestOrg' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/autoriseret/i)
    }
  })
})
