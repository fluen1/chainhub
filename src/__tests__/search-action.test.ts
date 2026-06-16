import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { runSearch } from '@/actions/search'
import { auth } from '@/lib/auth'
import { MIN_SEARCH_LENGTH } from '@/lib/search/constants'

// Smoke-test mod seed-data. Kræver aktiv DATABASE_URL og at seed-data er indlæst.
describe.runIf(!!process.env.DATABASE_URL)('runSearch', () => {
  const seedUserId = '00000000-0000-0000-0000-000000000010'
  const seedOrgId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: seedUserId, organizationId: seedOrgId },
    } as never)
  })

  it('returnerer null når query er under minimums-længde', async () => {
    const result = await runSearch('a')
    expect(result).toBeNull()
  })

  it('returnerer null når query er tom', async () => {
    const result = await runSearch('   ')
    expect(result).toBeNull()
  })

  it('finder seed-selskab "Tandlæge Østerbro" ved navne-søgning', async () => {
    const result = await runSearch('Østerbro')
    expect(result).not.toBeNull()
    expect(result!.companies.length).toBeGreaterThanOrEqual(1)
    expect(result!.companies.some((c) => c.name.toLowerCase().includes('østerbro'))).toBe(true)
  })

  it('finder opgaver ved titel-søgning', async () => {
    const result = await runSearch('GDPR')
    expect(result).not.toBeNull()
    expect(result!.tasks.length).toBeGreaterThanOrEqual(1)
  })

  it('returnerer alle 6 entitetstyper i shape', async () => {
    const result = await runSearch('tandlæge')
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('companies')
    expect(result).toHaveProperty('contracts')
    expect(result).toHaveProperty('cases')
    expect(result).toHaveProperty('persons')
    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('documents')
    expect(result).toHaveProperty('notes')
    expect(result).toHaveProperty('totalCount')
    expect(result).toHaveProperty('query')
  })

  it('returnerer 0 resultater for bruger uden accessible companies', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'nonexistent-user-id', organizationId: seedOrgId },
    } as never)
    const result = await runSearch('tandlæge')
    expect(result).not.toBeNull()
    expect(result!.totalCount).toBe(0)
  })

  it('MIN_SEARCH_LENGTH konstant er 2', () => {
    expect(MIN_SEARCH_LENGTH).toBe(2)
  })
})
