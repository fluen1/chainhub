import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    organization: { update: vi.fn() },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi
    .fn()
    .mockReturnValue({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/action-helpers', async () => {
  // Pass-through: kald fn direkte
  return {
    withActionLogging: vi
      .fn()
      .mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
  }
})

import { updateOrganization } from '@/actions/organizations'
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

function makeSession() {
  return {
    user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
    expires: '',
  }
}

const validInput = { name: 'Ny Kæde', cvr: '12345678', chain_structure: true }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false } as any)
})

describe('updateOrganization', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateOrganization(validInput)
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl uden settings-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await updateOrganization(validInput)
    expect(result).toMatchObject({ error: 'Ingen adgang til indstillinger' })
  })

  it('returnerer fejl ved rate limit', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as any)
    const result = await updateOrganization(validInput)
    expect(result).toMatchObject({ error: 'For mange handlinger. Vent venligst.' })
  })

  it('returnerer fejl ved ugyldigt input', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    // name er tom — fejler Zod
    const result = await updateOrganization({ name: '', cvr: null as any, chain_structure: false })
    expect('error' in result).toBe(true)
  })

  it('opdaterer organisation (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)

    const updatedOrg = {
      id: 'org-1',
      name: 'Ny Kæde',
      cvr: '12345678',
      chain_structure: true,
      created_at: new Date(),
      updated_at: new Date(),
      plan: null,
      plan_expires_at: null,
    }
    prismaMock.organization.update.mockResolvedValue(updatedOrg)

    const result = await updateOrganization(validInput)
    expect(result).toMatchObject({ data: { name: 'Ny Kæde' } })
  })

  it('sætter cvr til null ved tom streng', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)

    const updatedOrg = { id: 'org-1', name: 'Kæde', cvr: null, chain_structure: false }
    prismaMock.organization.update.mockResolvedValue(updatedOrg)

    await updateOrganization({ name: 'Kæde', cvr: '', chain_structure: false })

    expect(prismaMock.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cvr: null }) })
    )
  })

  it('returnerer fejl ved DB-fejl', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.organization.update.mockRejectedValue(new Error('DB fejl'))

    const result = await updateOrganization(validInput)
    expect(result).toMatchObject({ error: 'Organisation kunne ikke opdateres — prøv igen' })
  })
})
