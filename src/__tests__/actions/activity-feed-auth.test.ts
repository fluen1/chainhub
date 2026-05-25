import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
import { auth } from '@/lib/auth'
import { getRecentActivity } from '@/actions/activity-feed'

describe('getRecentActivity auth', () => {
  it('returnerer tom liste hvis ingen session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const result = await getRecentActivity()
    expect(result).toEqual([])
  })
})
