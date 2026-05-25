import { describe, it, expect, vi, beforeEach } from 'vitest'

// ────────────────────────────────────────────────────────────────────────────
// auth-reset.test.ts
// Tests for requestPasswordReset + resetPassword server actions.
// ────────────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-25T12:00:00Z')

// Fast clock
vi.setSystemTime(NOW)

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/email/resend', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  env: { NEXTAUTH_URL: 'http://localhost:3000' },
  baseUrl: 'http://localhost:3000',
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-pw-xyz'),
  },
}))

// Import after mocks
import { requestPasswordReset, resetPassword } from '@/actions/auth'
import { prisma } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
})

// ────────────────────────────────────────────────────────────────────────────
// requestPasswordReset
// ────────────────────────────────────────────────────────────────────────────

describe('requestPasswordReset', () => {
  it('returnerer success selv for ukendt email (ingen information-leakage)', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([])

    const result = await requestPasswordReset('ukendt@example.com')

    expect('data' in result).toBe(true)
    expect(result.data).toBe(true)
  })

  it('returnerer success og opretter token for kendte brugere', async () => {
    const fakeUser = { id: 'u-1', name: 'Philip', email: 'philip@example.com' }
    vi.mocked(prisma.user.findMany).mockResolvedValue([fakeUser] as never)
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({
      id: 'tok-1',
      token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    } as never)

    const result = await requestPasswordReset('philip@example.com')

    expect('data' in result).toBe(true)
    expect(prisma.passwordResetToken.create).toHaveBeenCalledOnce()
  })

  it('afviser ugyldig email-format', async () => {
    const result = await requestPasswordReset('ikke-en-email')

    expect('error' in result).toBe(true)
    expect(result.error).toMatch(/ugyldig/i)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('sender token til alle matchende brugere (multi-tenant)', async () => {
    const users = [
      { id: 'u-1', name: 'Philip Org1', email: 'philip@example.com' },
      { id: 'u-2', name: 'Philip Org2', email: 'philip@example.com' },
    ]
    vi.mocked(prisma.user.findMany).mockResolvedValue(users as never)
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({
      id: 'tok-x',
      token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    } as never)

    await requestPasswordReset('philip@example.com')

    // Én token pr. bruger
    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(2)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// resetPassword
// ────────────────────────────────────────────────────────────────────────────

describe('resetPassword', () => {
  // Standard v4 UUID
  const VALID_TOKEN = 'a1b2c3d4-e5f6-4789-9abc-def012345678'
  const VALID_PASSWORD = 'nyAdgangskode123'

  it('afviser ugyldigt token-format', async () => {
    const result = await resetPassword('ikke-et-uuid', VALID_PASSWORD)

    expect('error' in result).toBe(true)
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled()
  })

  it('afviser for kort adgangskode', async () => {
    const result = await resetPassword(VALID_TOKEN, 'kort')

    expect('error' in result).toBe(true)
    expect(result.error).toMatch(/mindst 8/i)
  })

  it('afviser udløbet token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: 'tok-1',
      token: VALID_TOKEN,
      user_id: 'u-1',
      expires_at: new Date('2026-05-25T11:00:00Z'), // 1 time FØR now
      used_at: null,
      user: { id: 'u-1', deleted_at: null, active: true },
    } as never)

    const result = await resetPassword(VALID_TOKEN, VALID_PASSWORD)

    expect('error' in result).toBe(true)
    expect(result.error).toMatch(/udløbet/i)
  })

  it('afviser allerede brugt token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: 'tok-1',
      token: VALID_TOKEN,
      user_id: 'u-1',
      expires_at: new Date('2026-05-25T13:00:00Z'), // ikke udløbet
      used_at: new Date('2026-05-25T11:30:00Z'), // brugt
      user: { id: 'u-1', deleted_at: null, active: true },
    } as never)

    const result = await resetPassword(VALID_TOKEN, VALID_PASSWORD)

    expect('error' in result).toBe(true)
    expect(result.error).toMatch(/allerede brugt/i)
  })

  it('returnerer fejl for ukendt token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null)

    const result = await resetPassword(VALID_TOKEN, VALID_PASSWORD)

    expect('error' in result).toBe(true)
    expect(result.error).toMatch(/ugyldigt/i)
  })

  it('happy path: opdaterer password_hash og markerer token som brugt', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: 'tok-1',
      token: VALID_TOKEN,
      user_id: 'u-1',
      expires_at: new Date('2026-05-25T13:00:00Z'), // gyldigt
      used_at: null,
      user: { id: 'u-1', deleted_at: null, active: true },
    } as never)

    // user.update og passwordResetToken.update returnerer promises i array-transaction
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(prisma.passwordResetToken.update).mockResolvedValue({} as never)
    vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown) =>
      Promise.all(ops as Promise<unknown>[])
    )

    const result = await resetPassword(VALID_TOKEN, VALID_PASSWORD)

    expect('data' in result).toBe(true)
    expect(result.data).toBe(true)
    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })
})
