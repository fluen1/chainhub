import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bootstrapProd, type BootstrapPrisma } from '@/lib/bootstrap'

function makeMockPrisma(opts: { existingOrg?: boolean } = {}): BootstrapPrisma {
  return {
    organization: {
      findFirst: vi.fn().mockResolvedValue(opts.existingOrg ? { id: 'existing' } : null),
      create: vi.fn().mockResolvedValue({ id: 'org-new' }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'user-new' }),
    },
    userRoleAssignment: { create: vi.fn().mockResolvedValue({ id: 'role-new' }) },
  }
}

const validInput = {
  orgName: 'Min Kæde A/S',
  orgCvr: '12345678',
  adminEmail: 'admin@minkaede.dk',
  adminName: 'Admin Adminsen',
  adminPassword: 'hemmeligt123',
}

describe('bootstrapProd', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opretter org + GROUP_OWNER-admin i tom database', async () => {
    const prisma = makeMockPrisma()
    const result = await bootstrapProd(prisma, validInput)
    expect(result.created).toBe(true)
    expect(prisma.organization.create).toHaveBeenCalledOnce()
    expect(prisma.user.create).toHaveBeenCalledOnce()
    expect(prisma.userRoleAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'GROUP_OWNER', scope: 'ALL' }),
      })
    )
  })

  it('hasher adgangskoden (gemmer aldrig plaintext)', async () => {
    const prisma = makeMockPrisma()
    await bootstrapProd(prisma, validInput)
    const userArg = (prisma.user.create as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    const hash: string = userArg.data.password_hash
    expect(hash).not.toBe(validInput.adminPassword)
    expect(hash.startsWith('$2')).toBe(true) // bcrypt-prefix
  })

  it('afbryder sikkert hvis databasen allerede har en organisation', async () => {
    const prisma = makeMockPrisma({ existingOrg: true })
    const result = await bootstrapProd(prisma, validInput)
    expect(result.created).toBe(false)
    expect(prisma.organization.create).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('afviser ugyldig e-mail', async () => {
    const prisma = makeMockPrisma()
    await expect(
      bootstrapProd(prisma, { ...validInput, adminEmail: 'ikke-email' })
    ).rejects.toThrow()
    expect(prisma.organization.create).not.toHaveBeenCalled()
  })

  it('afviser for kort adgangskode (< 8 tegn)', async () => {
    const prisma = makeMockPrisma()
    await expect(bootstrapProd(prisma, { ...validInput, adminPassword: 'kort' })).rejects.toThrow()
    expect(prisma.organization.create).not.toHaveBeenCalled()
  })
})
