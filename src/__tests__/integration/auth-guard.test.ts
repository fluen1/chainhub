/**
 * Auth guard integration tests
 * Verificerer at alle kritiske endpoints kræver autentifikation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

const mockPrisma = mockDeep<PrismaClient>()

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(false),
  canAccessSensitivity: vi.fn().mockResolvedValue(false),
  canAccessModule: vi.fn().mockResolvedValue(false),
  getAccessibleCompanies: vi.fn().mockResolvedValue([]),
}))

import { auth } from '@/lib/auth'
import { createCompany, getCompanies, getCompany, deleteCompany } from '@/actions/companies'
import { getContract, listContracts, deleteContract } from '@/actions/contracts'

const mockAuth = vi.mocked(auth)

beforeEach(() => {
  mockReset(mockPrisma)
  vi.clearAllMocks()
  mockAuth.mockResolvedValue(null) // Standard: ingen session
})

// IKKE-FORHANDLINGSBAR TEST
describe('unauthenticated user cannot access dashboard', () => {
  it('getCompanies afviser uautoriseret bruger', async () => {
    const result = await getCompanies()
    expect(result.error).toBe('Ikke autoriseret')
    expect(result.data).toBeUndefined()
  })

  it('getCompany afviser uautoriseret bruger', async () => {
    const result = await getCompany('any-id')
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('createCompany afviser uautoriseret bruger', async () => {
    const result = await createCompany({ name: 'Test ApS', status: 'aktiv' })
    expect(result.error).toBe('Ikke autoriseret')
    expect(mockPrisma.company.create).not.toHaveBeenCalled()
  })

  it('deleteCompany afviser uautoriseret bruger', async () => {
    const result = await deleteCompany('any-id')
    expect(result.error).toBe('Ikke autoriseret')
    expect(mockPrisma.company.update).not.toHaveBeenCalled()
  })

  it('getContract afviser uautoriseret bruger', async () => {
    const result = await getContract({ contractId: 'any-id' })
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('listContracts afviser uautoriseret bruger', async () => {
    const result = await listContracts({})
    expect(result.error).toBe('Ikke autoriseret')
  })

  it('deleteContract afviser uautoriseret bruger', async () => {
    const result = await deleteContract({ contractId: 'any-id' })
    expect(result.error).toBe('Ikke autoriseret')
  })
})

describe('Prisma aldrig kaldt ved uautoriseret adgang', () => {
  it('ingen DB-kald ved manglende session', async () => {
    await getCompanies()
    await getCompany('test')
    await createCompany({ name: 'Test', status: 'aktiv' })
    await listContracts({})

    expect(mockPrisma.company.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.company.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.company.create).not.toHaveBeenCalled()
  })
})