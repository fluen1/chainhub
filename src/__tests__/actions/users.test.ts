import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    userRoleAssignment: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    company: { findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    inviteToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
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
vi.mock('@/lib/email/resend', () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/env', () => ({
  env: { NEXTAUTH_URL: 'http://localhost:3000' },
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}))

import {
  getOrganizationUsers,
  createUser,
  updateUserRole,
  getSettingsPageData,
  toggleUserActive,
  inviteUser,
  acceptInvite,
} from '@/actions/users'
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'

function makeSession(id = 'u1') {
  return {
    user: { id, organizationId: 'org-1', email: 'test@test.dk', name: 'Test User' },
    expires: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false } as any)
  // Default transaction: kald fn
  prismaMock.$transaction.mockImplementation((fn: Function) => fn(prismaMock))
})

// ─── getOrganizationUsers ──────────────────────────────────────────────────────
describe('getOrganizationUsers', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getOrganizationUsers()
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl uden user_management-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await getOrganizationUsers()
    expect(result).toMatchObject({ error: 'Du har ikke adgang til brugerstyring' })
  })

  it('returnerer brugerliste (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Test', email: 'test@test.dk', roles: [], organization_id: 'org-1' },
    ])

    const result = await getOrganizationUsers()
    expect(result).toMatchObject({ data: [{ id: 'u1' }] })
  })
})

// ─── createUser ───────────────────────────────────────────────────────────────
describe('createUser', () => {
  const validInput = {
    email: 'ny@test.dk',
    name: 'Ny Bruger',
    password: 'secret123',
    role: 'GROUP_ADMIN' as const,
    companyIds: [],
  }

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await createUser(validInput)
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl uden user_management-adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    prismaMock.user.findFirst.mockResolvedValue(null)
    const result = await createUser(validInput)
    expect(result).toMatchObject({ error: 'Du har ikke adgang til at oprette brugere' })
  })

  it('returnerer fejl ved ugyldigt email', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await createUser({ ...validInput, email: 'ikke-en-email' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis email allerede eksisterer i org', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u2', organization_id: 'org-1' })
    const result = await createUser(validInput)
    expect(result).toMatchObject({ error: expect.stringContaining('ny@test.dk') })
  })

  it('returnerer fejl hvis email eksisterer i anden org', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u2', organization_id: 'org-2' })
    const result = await createUser(validInput)
    expect(result).toMatchObject({ error: expect.stringContaining('anden organisation') })
  })

  it('opretter bruger (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue(null)

    const newUser = {
      id: 'u-new',
      name: 'Ny Bruger',
      email: 'ny@test.dk',
      organization_id: 'org-1',
    }
    prismaMock.user.create.mockResolvedValue(newUser)
    prismaMock.userRoleAssignment.create.mockResolvedValue({})

    const result = await createUser(validInput)
    expect(result).toMatchObject({ data: { id: 'u-new' } })
  })
})

// ─── updateUserRole ────────────────────────────────────────────────────────────
describe('updateUserRole', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await updateUserRole({ userId: 'u2', role: 'GROUP_ADMIN', companyIds: [] })
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl uden adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await updateUserRole({ userId: 'u2', role: 'GROUP_ADMIN', companyIds: [] })
    expect(result).toMatchObject({ error: 'Du har ikke adgang til at ændre brugerroller' })
  })

  it('returnerer fejl hvis bruger ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue(null)
    const result = await updateUserRole({ userId: 'u2', role: 'GROUP_ADMIN', companyIds: [] })
    expect(result).toMatchObject({ error: 'Bruger ikke fundet' })
  })

  it('opdaterer rolle (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u2', organization_id: 'org-1' })
    prismaMock.userRoleAssignment.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.userRoleAssignment.create.mockResolvedValue({})

    const result = await updateUserRole({ userId: 'u2', role: 'GROUP_ADMIN', companyIds: [] })
    expect(result).toMatchObject({ data: undefined })
  })
})

// ─── getSettingsPageData ───────────────────────────────────────────────────────
describe('getSettingsPageData', () => {
  it('returnerer null uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getSettingsPageData()
    expect(result).toBeNull()
  })

  it('returnerer null uden adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await getSettingsPageData()
    expect(result).toBeNull()
  })

  it('returnerer settings-data (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.company.findMany.mockResolvedValue([])
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Kæde',
      cvr: null,
      plan: null,
      plan_expires_at: null,
      chain_structure: false,
      created_at: new Date(),
    })

    const result = await getSettingsPageData()
    expect(result).not.toBeNull()
    expect(result?.organization?.id).toBe('org-1')
  })
})

// ─── toggleUserActive ──────────────────────────────────────────────────────────
describe('toggleUserActive', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await toggleUserActive('u2')
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl uden adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await toggleUserActive('u2')
    expect(result).toMatchObject({ error: 'Du har ikke adgang til at ændre brugerstatus' })
  })

  it('returnerer fejl ved selvdeaktivering', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession('u1') as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    const result = await toggleUserActive('u1')
    expect(result).toMatchObject({ error: 'Du kan ikke deaktivere dig selv' })
  })

  it('returnerer fejl hvis bruger ikke findes', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue(null)
    const result = await toggleUserActive('u2')
    expect(result).toMatchObject({ error: 'Bruger ikke fundet' })
  })

  it('returnerer fejl ved forsøg på at deaktivere sidste GROUP_OWNER', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u2',
      active: true,
      roles: [{ role: 'GROUP_OWNER' }],
    })
    prismaMock.user.count.mockResolvedValue(0) // ingen andre ejere

    const result = await toggleUserActive('u2')
    expect(result).toMatchObject({ error: 'Du kan ikke deaktivere den sidste kædeejer' })
  })

  it('toggler bruger (happy path — deaktivér ikke-ejer)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u2',
      active: true,
      roles: [{ role: 'GROUP_ADMIN' }],
    })
    prismaMock.user.update.mockResolvedValue({ id: 'u2', active: false })

    const result = await toggleUserActive('u2')
    expect(result).toMatchObject({ data: undefined })
  })
})

// ─── inviteUser ───────────────────────────────────────────────────────────────
describe('inviteUser', () => {
  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await inviteUser({ email: 'ny@test.dk', role: 'GROUP_ADMIN' })
    expect(result).toMatchObject({ error: 'Ikke autoriseret' })
  })

  it('returnerer fejl uden adgang', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(false)
    const result = await inviteUser({ email: 'ny@test.dk', role: 'GROUP_ADMIN' })
    expect(result).toMatchObject({ error: 'Du har ikke adgang til at invitere brugere' })
  })

  it('returnerer fejl hvis bruger allerede er i org', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u2' })
    const result = await inviteUser({ email: 'ny@test.dk', role: 'GROUP_ADMIN' })
    expect(result).toMatchObject({ error: expect.stringContaining('allerede medlem') })
  })

  it('sender invitation (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(makeSession() as any)
    vi.mocked(canAccessModule).mockResolvedValue(true)
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.organization.findUnique.mockResolvedValue({ name: 'Kæde' })
    prismaMock.user.findUnique.mockResolvedValue({ name: 'Test User' })
    prismaMock.inviteToken.create.mockResolvedValue({})

    const result = await inviteUser({ email: 'ny@test.dk', role: 'GROUP_ADMIN' })
    expect(result).toMatchObject({ data: { success: true } })
  })
})

// ─── acceptInvite ─────────────────────────────────────────────────────────────
describe('acceptInvite', () => {
  const VALID_TOKEN = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  const validInput = { token: VALID_TOKEN, name: 'Ny Bruger', password: 'secret123' }

  it('returnerer fejl ved ugyldigt token format', async () => {
    const result = await acceptInvite({ token: 'ikke-uuid', name: 'Test', password: 'password123' })
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl hvis token ikke eksisterer', async () => {
    prismaMock.inviteToken.findUnique.mockResolvedValue(null)
    const result = await acceptInvite(validInput)
    expect(result).toMatchObject({ error: 'Invite-linket er ugyldigt' })
  })

  it('returnerer fejl hvis token allerede er brugt', async () => {
    prismaMock.inviteToken.findUnique.mockResolvedValue({
      id: 't1',
      used_at: new Date(),
      expires_at: new Date(Date.now() + 1000),
      email: 'ny@test.dk',
      role: 'GROUP_ADMIN',
      organization_id: 'org-1',
      created_by: 'u1',
    })
    const result = await acceptInvite(validInput)
    expect(result).toMatchObject({ error: 'Invite-linket er allerede brugt' })
  })

  it('returnerer fejl hvis token er udløbet', async () => {
    prismaMock.inviteToken.findUnique.mockResolvedValue({
      id: 't1',
      used_at: null,
      expires_at: new Date(Date.now() - 1000),
      email: 'ny@test.dk',
      role: 'GROUP_ADMIN',
      organization_id: 'org-1',
      created_by: 'u1',
    })
    const result = await acceptInvite(validInput)
    expect(result).toMatchObject({ error: 'Invite-linket er udløbet' })
  })

  it('returnerer fejl hvis email allerede er registreret', async () => {
    prismaMock.inviteToken.findUnique.mockResolvedValue({
      id: 't1',
      used_at: null,
      expires_at: new Date(Date.now() + 86400000),
      email: 'ny@test.dk',
      role: 'GROUP_ADMIN',
      organization_id: 'org-1',
      created_by: 'u1',
    })
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u-existing' })
    const result = await acceptInvite(validInput)
    expect(result).toMatchObject({ error: expect.stringContaining('allerede registreret') })
  })

  it('accepterer invitation (happy path)', async () => {
    prismaMock.inviteToken.findUnique.mockResolvedValue({
      id: 't1',
      used_at: null,
      expires_at: new Date(Date.now() + 86400000),
      email: 'ny@test.dk',
      role: 'GROUP_ADMIN',
      organization_id: 'org-1',
      created_by: 'u1',
    })
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.inviteToken.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.create.mockResolvedValue({ id: 'u-new' })
    prismaMock.userRoleAssignment.create.mockResolvedValue({})

    const result = await acceptInvite(validInput)
    expect(result).toMatchObject({ data: { email: 'ny@test.dk' } })
  })

  it('returnerer fejl ved TOCTOU race (parallel claim)', async () => {
    prismaMock.inviteToken.findUnique.mockResolvedValue({
      id: 't1',
      used_at: null,
      expires_at: new Date(Date.now() + 86400000),
      email: 'ny@test.dk',
      role: 'GROUP_ADMIN',
      organization_id: 'org-1',
      created_by: 'u1',
    })
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.inviteToken.updateMany.mockResolvedValue({ count: 0 }) // allerede brugt

    const result = await acceptInvite(validInput)
    expect(result).toMatchObject({ error: 'Invite-linket er allerede brugt' })
  })
})
