/**
 * BA-11: Security — authentication guard verificering
 *
 * Tester REAL adfærd: importerer actions, mocker auth() til null,
 * og verificerer at hver action returnerer en fejl uden session.
 * Erstatter den gamle string-pattern tilgang som gav falsk tryghed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks SKAL erklæres før imports af de mockede moduler ──────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    contract: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    case: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    caseCompany: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    task: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    person: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ownership: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    companyPerson: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    userRole: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessModule: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
  getAccessibleCompanies: vi.fn().mockResolvedValue([]),
  getAllowedSensitivityLevels: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn(),
}))

vi.mock('@/lib/geocode', () => ({
  geocodeAddress: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/ai/invalidate-cache', () => ({
  invalidateCompanyInsightsCache: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ── Importer actions EFTER mocks ───────────────────────────────────────────

import { createCase, closeCase, deleteCase } from '@/actions/cases'
import { createCompany, deleteCompany } from '@/actions/companies'
import { createContract, updateContractStatus, deleteContract } from '@/actions/contracts'
import { addOwner } from '@/actions/ownership'
import { createPerson, deletePerson } from '@/actions/persons'
import { createTask, updateTaskStatus, deleteTask } from '@/actions/tasks'
import { auth } from '@/lib/auth'

// ── Helpers ────────────────────────────────────────────────────────────────

function isErrorResult(result: unknown): boolean {
  return (
    result !== null &&
    typeof result === 'object' &&
    'error' in (result as object) &&
    typeof (result as { error: unknown }).error === 'string' &&
    (result as { error: string }).error.length > 0
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Auth guard — alle muterende actions kræver session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(null)
  })

  // ── Contracts ────────────────────────────────────────────────────────────

  it('createContract returnerer fejl uden session', async () => {
    const result = await createContract({
      companyId: 'c1',
      systemType: 'LEJEKONTRAKT',
      sensitivity: 'STANDARD',
      status: 'UDKAST',
    } as unknown as Parameters<typeof createContract>[0])
    expect(isErrorResult(result)).toBe(true)
  })

  it('updateContractStatus returnerer fejl uden session', async () => {
    const result = await updateContractStatus({ contractId: 'c1', status: 'AKTIV' })
    expect(isErrorResult(result)).toBe(true)
  })

  it('deleteContract returnerer fejl uden session', async () => {
    const result = await deleteContract('c1')
    expect(isErrorResult(result)).toBe(true)
  })

  // ── Cases ────────────────────────────────────────────────────────────────

  it('createCase returnerer fejl uden session', async () => {
    const result = await createCase({
      companyIds: ['c1'],
      title: 'Test sag',
      type: 'TVIST',
      sensitivity: 'STANDARD',
    } as unknown as Parameters<typeof createCase>[0])
    expect(isErrorResult(result)).toBe(true)
  })

  it('closeCase returnerer fejl uden session', async () => {
    const result = await closeCase('case-1', 'Lukket')
    expect(isErrorResult(result)).toBe(true)
  })

  it('deleteCase returnerer fejl uden session', async () => {
    const result = await deleteCase('case-1')
    expect(isErrorResult(result)).toBe(true)
  })

  // ── Tasks ────────────────────────────────────────────────────────────────

  it('createTask returnerer fejl uden session', async () => {
    const result = await createTask({
      title: 'Test opgave',
      companyId: 'c1',
    } as Parameters<typeof createTask>[0])
    expect(isErrorResult(result)).toBe(true)
  })

  it('updateTaskStatus returnerer fejl uden session', async () => {
    const result = await updateTaskStatus({ taskId: 't1', status: 'AKTIV_TASK' })
    expect(isErrorResult(result)).toBe(true)
  })

  it('deleteTask returnerer fejl uden session', async () => {
    const result = await deleteTask('t1')
    expect(isErrorResult(result)).toBe(true)
  })

  // ── Companies ────────────────────────────────────────────────────────────

  it('createCompany returnerer fejl uden session', async () => {
    const result = await createCompany({ name: 'Test ApS' } as Parameters<typeof createCompany>[0])
    expect(isErrorResult(result)).toBe(true)
  })

  it('deleteCompany returnerer fejl uden session', async () => {
    const result = await deleteCompany('company-1')
    expect(isErrorResult(result)).toBe(true)
  })

  // ── Persons ──────────────────────────────────────────────────────────────

  it('createPerson returnerer fejl uden session', async () => {
    const result = await createPerson({
      firstName: 'Test',
      lastName: 'Person',
    } as Parameters<typeof createPerson>[0])
    expect(isErrorResult(result)).toBe(true)
  })

  it('deletePerson returnerer fejl uden session', async () => {
    const result = await deletePerson('person-1')
    expect(isErrorResult(result)).toBe(true)
  })

  // ── Ownership ────────────────────────────────────────────────────────────

  it('addOwner returnerer fejl uden session', async () => {
    const result = await addOwner({
      companyId: 'c1',
      personId: 'p1',
      ownershipPct: 50,
      ownerType: 'DIREKTE',
    } as unknown as Parameters<typeof addOwner>[0])
    expect(isErrorResult(result)).toBe(true)
  })
})
