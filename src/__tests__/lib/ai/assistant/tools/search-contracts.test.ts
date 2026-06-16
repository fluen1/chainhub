import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    contract: {
      findMany: vi.fn(),
    },
  }
  return { prismaMock }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['co-1', 'co-2']),
  getAllowedSensitivityLevels: vi.fn().mockResolvedValue(['PUBLIC', 'STANDARD', 'INTERN']),
}))

import * as perms from '@/lib/permissions'
import { searchContractsTool } from '@/lib/ai/assistant/tools/search-contracts'

const context = { organizationId: 'org-1', userId: 'user-1' }

describe('searchContractsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returnerer formateret liste ved match', async () => {
    prismaMock.contract.findMany.mockResolvedValue([
      {
        id: 'c-1',
        display_name: 'Ejeraftale Klinik A',
        system_type: 'EJERAFTALE',
        status: 'AKTIV',
        company_id: 'co-1',
        company: { id: 'co-1', name: 'Klinik A' },
        expiry_date: null,
      },
    ])

    const result = await searchContractsTool.execute({}, context)

    expect(result.success).toBe(true)
    expect(result.displayText).toContain('Klinik A')
    expect(result.displayText).toContain('EJERAFTALE')
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as unknown[]).length).toBe(1)
  })

  it('sender org-scoped query til Prisma (tenant-isolation)', async () => {
    prismaMock.contract.findMany.mockResolvedValue([])

    await searchContractsTool.execute({ query: 'test' }, context)

    const callArgs = prismaMock.contract.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
    }
    expect(callArgs.where.organization_id).toBe('org-1')
    expect(callArgs.where.deleted_at).toBe(null)
  })

  it('filtrerer på fritekst-query', async () => {
    prismaMock.contract.findMany.mockResolvedValue([])

    await searchContractsTool.execute({ query: 'lejekontrakt' }, context)

    const callArgs = prismaMock.contract.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
    }
    expect(callArgs.where.display_name).toEqual({
      contains: 'lejekontrakt',
      mode: 'insensitive',
    })
  })

  it('returnerer tom-state tekst når ingen kontrakter matcher', async () => {
    prismaMock.contract.findMany.mockResolvedValue([])

    const result = await searchContractsTool.execute({ status: 'UDKAST' }, context)

    expect(result.success).toBe(true)
    expect(result.displayText).toContain('Ingen kontrakter')
    expect(result.data).toEqual([])
  })

  it('requiresConfirmation er false (read-only)', () => {
    expect(searchContractsTool.requiresConfirmation).toBe(false)
  })

  it('begrænser til accessible companies og tilladte sensitivity-niveauer (RBAC)', async () => {
    prismaMock.contract.findMany.mockResolvedValue([])

    await searchContractsTool.execute({ query: 'x' }, context)

    const where = prismaMock.contract.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(where.company_id).toEqual({ in: ['co-1', 'co-2'] })
    expect(where.sensitivity).toEqual({ in: ['PUBLIC', 'STANDARD', 'INTERN'] })
    expect(perms.getAccessibleCompanies).toHaveBeenCalledWith('user-1', 'org-1')
    expect(perms.getAllowedSensitivityLevels).toHaveBeenCalledWith('user-1', 'org-1')
  })

  it('COMPANY_READONLY uden adgang til selskaber får tomt resultat (ingen lækage)', async () => {
    vi.mocked(perms.getAccessibleCompanies).mockResolvedValueOnce([])
    prismaMock.contract.findMany.mockResolvedValue([])

    const result = await searchContractsTool.execute({}, context)

    const where = prismaMock.contract.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>
    expect(where.company_id).toEqual({ in: [] })
    expect(result.data).toEqual([])
  })
})
