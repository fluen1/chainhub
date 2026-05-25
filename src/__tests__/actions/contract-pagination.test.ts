import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
import { auth } from '@/lib/auth'
import { getContractsPaginated } from '@/actions/contracts'

describe('getContractsPaginated', () => {
  it('returnerer tom data uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getContractsPaginated({})
    expect(result).toEqual({ rows: [], totalCount: 0, page: 1, pageSize: 20 })
  })

  it('accepterer alle filter-parametre uden at fejle (ingen session)', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getContractsPaginated({
      page: 2,
      pageSize: 10,
      search: 'lejekontrakt',
      status: 'Aktiv',
      type: 'LEJEKONTRAKT',
      company: 'some-company-id',
    })
    // Ingen session → tom payload uanset parametre
    expect(result.rows).toHaveLength(0)
    expect(result.totalCount).toBe(0)
    expect(result.page).toBe(1)
  })

  it('returnerer korrekt pageSize-default', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getContractsPaginated({})
    expect(result.pageSize).toBe(20)
  })

  it('accepterer "Udløber 30d" status-filter uden at fejle', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getContractsPaginated({ status: 'Udløber 30d' })
    expect(result.rows).toHaveLength(0)
  })
})
