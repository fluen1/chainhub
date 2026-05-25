import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
import { auth } from '@/lib/auth'
import { getPersonsPaginated } from '@/actions/persons'

describe('getPersonsPaginated', () => {
  it('returnerer tom data uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getPersonsPaginated({})
    expect(result).toEqual({ rows: [], totalCount: 0, page: 1, pageSize: 15 })
  })

  it('accepterer alle filter-parametre uden at fejle', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getPersonsPaginated({
      page: 2,
      pageSize: 10,
      search: 'test',
      status: 'Aktiv',
      rolle: 'direktoer',
      company: 'some-id',
    })
    // Ingen session → tom payload uanset parametre
    expect(result.rows).toHaveLength(0)
    expect(result.totalCount).toBe(0)
  })
})
