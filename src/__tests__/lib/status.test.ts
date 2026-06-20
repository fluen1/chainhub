import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryRaw = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}))

import { getSystemStatus } from '@/lib/status'

describe('getSystemStatus', () => {
  beforeEach(() => queryRaw.mockReset())

  it('rapporterer operational når databasen svarer', async () => {
    queryRaw.mockResolvedValueOnce([{ ok: 1 }])
    const s = await getSystemStatus()
    expect(s.overall).toBe('operational')
    expect(s.components.find((c) => c.name === 'Database')?.status).toBe('operational')
    expect(s.components.find((c) => c.name === 'Applikation')?.status).toBe('operational')
  })

  it('rapporterer down når databasen fejler', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connection refused'))
    const s = await getSystemStatus()
    expect(s.overall).toBe('down')
    expect(s.components.find((c) => c.name === 'Database')?.status).toBe('down')
  })

  it('inkluderer ISO-tidsstempel for hvornår status blev tjekket', async () => {
    queryRaw.mockResolvedValueOnce([{ ok: 1 }])
    const s = await getSystemStatus(new Date('2026-06-20T10:00:00.000Z'))
    expect(s.checkedAt).toBe('2026-06-20T10:00:00.000Z')
  })
})
