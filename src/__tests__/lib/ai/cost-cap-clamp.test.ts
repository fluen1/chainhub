import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock er hoisted — inline mock-factory undgår "Cannot access before initialization".
vi.mock('@/lib/db', () => {
  const tx = {
    organizationAISettings: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }
  return {
    prisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      organizationAISettings: tx.organizationAISettings,
      __tx: tx,
    },
  }
})

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { clampedRelease, commitAIUsage, releaseReservation } from '@/lib/ai/cost-cap'
import { prisma } from '@/lib/db'

// Hent mock-tx via den ekstra __tx-nøgle så vi kan asserte på de enkelte kald.
const mockTx = (
  prisma as unknown as {
    __tx: {
      organizationAISettings: {
        findUnique: ReturnType<typeof vi.fn>
        update: ReturnType<typeof vi.fn>
      }
    }
  }
).__tx

describe('clampedRelease (ren helper)', () => {
  it('returnerer current - released når resultatet er positivt', () => {
    expect(clampedRelease(10, 3)).toBe(7)
  })

  it('clamper til 0 når release er større end current', () => {
    expect(clampedRelease(2, 5)).toBe(0)
  })

  it('clamper til 0 ved exact match', () => {
    expect(clampedRelease(3, 3)).toBe(0)
  })

  it('clamper til 0 ved dobbelt-release (current allerede 0)', () => {
    expect(clampedRelease(0, 1.5)).toBe(0)
  })

  it('håndterer floating-point subtraktion korrekt', () => {
    expect(clampedRelease(0.3, 0.1)).toBeCloseTo(0.2, 10)
  })
})

describe('commitAIUsage — clamp i DB-transaktion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opdaterer til max(0, current - reserved)', async () => {
    mockTx.organizationAISettings.findUnique.mockResolvedValue({ reserved_cost_usd: 10 })
    mockTx.organizationAISettings.update.mockResolvedValue({})

    await commitAIUsage('org-1', 3, 2.5)

    expect(mockTx.organizationAISettings.update).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      data: { reserved_cost_usd: 7 },
    })
  })

  it('clamper til 0 når reserved > current (dobbelt-release)', async () => {
    mockTx.organizationAISettings.findUnique.mockResolvedValue({ reserved_cost_usd: 2 })
    mockTx.organizationAISettings.update.mockResolvedValue({})

    await commitAIUsage('org-1', 5, 4)

    expect(mockTx.organizationAISettings.update).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      data: { reserved_cost_usd: 0 },
    })
  })

  it('no-op hvis der ikke findes settings', async () => {
    mockTx.organizationAISettings.findUnique.mockResolvedValue(null)

    await commitAIUsage('org-missing', 5, 4)

    expect(mockTx.organizationAISettings.update).not.toHaveBeenCalled()
  })
})

describe('releaseReservation — clamp i DB-transaktion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opdaterer til max(0, current - reserved)', async () => {
    mockTx.organizationAISettings.findUnique.mockResolvedValue({ reserved_cost_usd: 8 })
    mockTx.organizationAISettings.update.mockResolvedValue({})

    await releaseReservation('org-1', 3)

    expect(mockTx.organizationAISettings.update).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      data: { reserved_cost_usd: 5 },
    })
  })

  it('clamper til 0 ved dobbelt-release', async () => {
    mockTx.organizationAISettings.findUnique.mockResolvedValue({ reserved_cost_usd: 0 })
    mockTx.organizationAISettings.update.mockResolvedValue({})

    await releaseReservation('org-1', 1.5)

    expect(mockTx.organizationAISettings.update).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      data: { reserved_cost_usd: 0 },
    })
  })
})
