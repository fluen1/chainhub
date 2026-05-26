import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    alert: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
  }
  return { prismaMock }
})

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { auth } from '@/lib/auth'
import { getActiveAlerts, dismissAlert, getAlertStats } from '@/actions/alerts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockSession = {
  user: { id: 'user-1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '9999',
}

const mockAlert = {
  id: 'alert-1',
  severity: 'CRITICAL' as const,
  category: 'DEADLINE' as const,
  entity_type: 'contract',
  entity_id: 'contract-1',
  entity_name: 'Ejeraftale ApS',
  message: 'Kontrakten udløber om 3 dage',
  details: { daysLeft: 3 },
  created_at: new Date('2026-05-26'),
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getActiveAlerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer fejl hvis ingen session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getActiveAlerts()
    expect(result.error).toBeTruthy()
  })

  it('returnerer alerts for organisationen', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.findMany.mockResolvedValue([mockAlert])

    const result = await getActiveAlerts()

    expect(result.data).toHaveLength(1)
    expect(result.data![0]).toMatchObject({
      id: 'alert-1',
      severity: 'CRITICAL',
      category: 'DEADLINE',
      entityType: 'contract',
      entityId: 'contract-1',
      entityName: 'Ejeraftale ApS',
      message: 'Kontrakten udløber om 3 dage',
    })
  })

  it('respekterer limit-parameteren', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.findMany.mockResolvedValue([])

    await getActiveAlerts(5)

    expect(prismaMock.alert.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))
  })

  it('returnerer tom liste hvis ingen alerts', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.findMany.mockResolvedValue([])

    const result = await getActiveAlerts()
    expect(result.data).toEqual([])
  })

  it('filtrerer på dismissed_at: null', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.findMany.mockResolvedValue([])

    await getActiveAlerts()

    expect(prismaMock.alert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dismissed_at: null }),
      })
    )
  })
})

describe('dismissAlert', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer fejl hvis ingen session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await dismissAlert('alert-1')
    expect(result.error).toBeTruthy()
  })

  it('returnerer fejl hvis alerten ikke tilhører org', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.findFirst.mockResolvedValue(null)

    const result = await dismissAlert('alert-1')
    expect(result.error).toBeTruthy()
  })

  it('returnerer fejl hvis allerede afvist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.findFirst.mockResolvedValue({
      id: 'alert-1',
      dismissed_at: new Date(),
    })

    const result = await dismissAlert('alert-1')
    expect(result.error).toMatch(/allerede afvist/i)
  })

  it('opdaterer dismissed_at og returnerer id', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.findFirst.mockResolvedValue({ id: 'alert-1', dismissed_at: null })
    prismaMock.alert.update.mockResolvedValue({ id: 'alert-1' })

    const result = await dismissAlert('alert-1')

    expect(prismaMock.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alert-1' },
        data: expect.objectContaining({ dismissed_by: 'user-1' }),
      })
    )
    expect(result.data).toEqual({ id: 'alert-1' })
  })

  it('returnerer fejl ved ugyldigt alertId', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const result = await dismissAlert('')
    expect(result.error).toBeTruthy()
  })
})

describe('getAlertStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer fejl hvis ingen session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getAlertStats()
    expect(result.error).toBeTruthy()
  })

  it('summerer korrekt per alvorlighed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.groupBy.mockResolvedValue([
      { severity: 'CRITICAL', _count: { id: 3 } },
      { severity: 'WARNING', _count: { id: 5 } },
      { severity: 'INFO', _count: { id: 2 } },
    ])

    const result = await getAlertStats()

    expect(result.data).toEqual({ critical: 3, warning: 5, info: 2, total: 10 })
  })

  it('returnerer nul-stats ved ingen alerts', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    prismaMock.alert.groupBy.mockResolvedValue([])

    const result = await getAlertStats()

    expect(result.data).toEqual({ critical: 0, warning: 0, info: 0, total: 0 })
  })
})
