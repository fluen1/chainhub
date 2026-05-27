/**
 * Phase N2 — Commit 2: ActivityPanel created_at-filter + UrgencyPanel labels + events klikbare.
 *
 * 1. getRecentActivity: since-param sendes med til Prisma (created_at >= since)
 * 2. getRecentActivity: returnerer resource_type + resource_id for link-routing
 * 3. UrgencyPanel: SECTION_SHORT_LABEL kortform-map (ren funktion)
 * 4. ActivityPanel: eventHref bygger korrekt URL for kendte resource_types
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

// Brug RFC-konforme UUIDs (version 4, variant 2) — Zod v4 validerer strengt
vi.mock('@/lib/permissions', () => ({
  getAccessibleCompanies: vi.fn().mockResolvedValue(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']),
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

import { getRecentActivity } from '@/actions/activity-feed'

// RFC-konforme test-UUIDs
const COMPANY_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

// ─── Tests for getRecentActivity since-param ──────────────────────────────────

describe('getRecentActivity — created_at WHERE-klausul (since-param)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('kalder Prisma med created_at: { gte: since } når since angives', async () => {
    const { prisma } = await import('@/lib/db')
    const since = new Date('2026-05-15T00:00:00Z')

    await getRecentActivity([COMPANY_UUID], since)

    expect(vi.mocked(prisma.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          created_at: { gte: since },
        }),
      })
    )
  })

  it('bruger 24h fallback (siden-dato er for max 24+1 timer siden) når since udelades', async () => {
    const { prisma } = await import('@/lib/db')
    const beforeCall = new Date(Date.now() - 25 * 60 * 60 * 1000)

    await getRecentActivity([COMPANY_UUID])

    const callArg = vi.mocked(prisma.auditLog.findMany).mock.calls[0]?.[0] as {
      where: { created_at: { gte: Date } }
    }
    const usedSince = callArg.where.created_at.gte
    // since-datoen skal ligge EFTER for 25 timer siden (dvs. ca 24t)
    expect(usedSince.getTime()).toBeGreaterThan(beforeCall.getTime())
    // og INDEN for de seneste sekunder (ikke fremtid)
    expect(usedSince.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('returnerer tom liste ved ingen logs selvom since er sat', async () => {
    const result = await getRecentActivity([COMPANY_UUID], new Date())
    expect(result).toEqual([])
  })

  it('returnerer resource_type og resource_id på events', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: 'log-42',
        user_id: 'user-1',
        action: 'CREATE',
        resource_type: 'contract',
        resource_id: 'contract-99',
        created_at: new Date(),
      },
    ] as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'user-1', name: 'Philip', email: 'philip@example.com' },
    ] as never)

    const result = await getRecentActivity([COMPANY_UUID], new Date(0))

    expect(result[0]?.resource_type).toBe('contract')
    expect(result[0]?.resource_id).toBe('contract-99')
  })
})

// ─── eventHref routing-logik (replika fra ActivityPanel) ────────────────────

const RESOURCE_ROUTES: Record<string, string> = {
  case: '/cases',
  contract: '/contracts',
  task: '/tasks',
  company: '/companies',
  person: '/persons',
  document: '/documents',
}

function eventHref(resource_type: string, resource_id: string): string | null {
  const base = RESOURCE_ROUTES[resource_type]
  if (!base || !resource_id) return null
  return `${base}/${resource_id}`
}

describe('ActivityPanel eventHref — klikbare events', () => {
  it('contract → /contracts/[id]', () => {
    expect(eventHref('contract', 'abc-123')).toBe('/contracts/abc-123')
  })

  it('case → /cases/[id]', () => {
    expect(eventHref('case', 'case-id')).toBe('/cases/case-id')
  })

  it('task → /tasks/[id]', () => {
    expect(eventHref('task', 'task-id')).toBe('/tasks/task-id')
  })

  it('company → /companies/[id]', () => {
    expect(eventHref('company', 'comp-id')).toBe('/companies/comp-id')
  })

  it('person → /persons/[id]', () => {
    expect(eventHref('person', 'person-id')).toBe('/persons/person-id')
  })

  it('ukendt resource_type → null (ingen link)', () => {
    expect(eventHref('ownership', 'own-id')).toBeNull()
  })

  it('tom resource_id → null', () => {
    expect(eventHref('contract', '')).toBeNull()
  })
})

// ─── UrgencyPanel SECTION_SHORT_LABEL map ────────────────────────────────────

const SECTION_SHORT_LABEL: Record<string, string> = {
  Forfaldne: 'Frist',
  'I dag': 'I dag',
  'Denne uge': '7d',
  'Næste uge': '14d',
  'Næste 2 uger': '28d',
}

function getSectionLabel(sectionLabel: string): string {
  return SECTION_SHORT_LABEL[sectionLabel] ?? sectionLabel
}

describe('UrgencyPanel SECTION_SHORT_LABEL — akronymfri labels', () => {
  it('"Forfaldne" → "Frist" (ikke "Forfaldne" som split gav)', () => {
    expect(getSectionLabel('Forfaldne')).toBe('Frist')
  })

  it('"Denne uge" → "7d" (ikke "Denne")', () => {
    expect(getSectionLabel('Denne uge')).toBe('7d')
  })

  it('"Næste uge" → "14d" (ikke "Næste")', () => {
    expect(getSectionLabel('Næste uge')).toBe('14d')
  })

  it('"Næste 2 uger" → "28d" (ikke "Næste")', () => {
    expect(getSectionLabel('Næste 2 uger')).toBe('28d')
  })

  it('"I dag" → "I dag" (uændret)', () => {
    expect(getSectionLabel('I dag')).toBe('I dag')
  })

  it('ukendt label returneres som-er (sikker fallback)', () => {
    expect(getSectionLabel('Anden periode')).toBe('Anden periode')
  })
})
