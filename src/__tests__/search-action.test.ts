import { describe, it, expect } from 'vitest'
import { runSearch } from '@/actions/search'
import { MIN_SEARCH_LENGTH } from '@/lib/search/constants'

// Smoke-test mod seed-data. Kræver aktiv DATABASE_URL og at seed-data er indlæst.
describe.runIf(!!process.env.DATABASE_URL)('runSearch', () => {
  const seedUserId = '00000000-0000-0000-0000-000000000010'
  const seedOrgId = '00000000-0000-0000-0000-000000000001'

  it('returnerer null når query er under minimums-længde', async () => {
    const result = await runSearch('a', seedUserId, seedOrgId)
    expect(result).toBeNull()
  })

  it('returnerer null når query er tom', async () => {
    const result = await runSearch('   ', seedUserId, seedOrgId)
    expect(result).toBeNull()
  })

  it('finder seed-selskab "Tandlæge Østerbro" ved navne-søgning', async () => {
    const result = await runSearch('Østerbro', seedUserId, seedOrgId)
    expect(result).not.toBeNull()
    expect(result!.companies.length).toBeGreaterThanOrEqual(1)
    expect(
      result!.companies.some((c) => c.name.toLowerCase().includes('østerbro'))
    ).toBe(true)
  })

  it('finder opgaver ved titel-søgning', async () => {
    const result = await runSearch('GDPR', seedUserId, seedOrgId)
    expect(result).not.toBeNull()
    expect(result!.tasks.length).toBeGreaterThanOrEqual(1)
  })

  it('returnerer alle 6 entitetstyper i shape', async () => {
    const result = await runSearch('tandlæge', seedUserId, seedOrgId)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('companies')
    expect(result).toHaveProperty('contracts')
    expect(result).toHaveProperty('cases')
    expect(result).toHaveProperty('persons')
    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('documents')
    expect(result).toHaveProperty('totalCount')
    expect(result).toHaveProperty('query')
  })

  it('returnerer 0 resultater for ukendt bruger (ingen accessible companies)', async () => {
    const result = await runSearch('tandlæge', 'nonexistent-user-id', seedOrgId)
    expect(result).not.toBeNull()
    expect(result!.totalCount).toBe(0)
  })

  it('MIN_SEARCH_LENGTH konstant er 2', () => {
    expect(MIN_SEARCH_LENGTH).toBe(2)
  })
})
