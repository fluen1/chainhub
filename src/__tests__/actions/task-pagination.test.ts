import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
import { auth } from '@/lib/auth'
import { getTasksPaginated } from '@/actions/tasks'

describe('getTasksPaginated', () => {
  it('returnerer tom data uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getTasksPaginated({})
    expect(result).toEqual({ rows: [], totalCount: 0, page: 1, pageSize: 20 })
  })

  it('accepterer alle filter-parametre uden at fejle', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getTasksPaginated({
      page: 2,
      pageSize: 10,
      search: 'test',
      status: 'NY',
      priority: 'KRITISK',
      sort: 'due_date',
      sortDir: 'desc',
      assignedToMe: true,
    })
    // Ingen session → tom payload uanset parametre
    expect(result.rows).toHaveLength(0)
    expect(result.totalCount).toBe(0)
  })
})
