import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookupByCvr } from '@/lib/integrations/cvr/client'

describe('lookupByCvr', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returnerer virksomhedsdata ved gyldigt CVR', async () => {
    const mockResponse = {
      vat: '12345678',
      name: 'Test ApS',
      address: 'Testvej 1',
      zipcode: '2100',
      city: 'København Ø',
      type: 'ApS',
      startdate: '2010-01-01',
      capital: 50000,
      status: 'NORMAL',
      companydesc: 'Tegnes af direktøren',
    }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await lookupByCvr('12345678')

    expect(result.found).toBe(true)
    expect(result.source).toBe('cvr_api')
    expect(result.data).toMatchObject({
      cvr: '12345678',
      name: 'Test ApS',
      address: 'Testvej 1',
      city: 'København Ø',
      postalCode: '2100',
      companyType: 'ApS',
      foundedDate: '2010-01-01',
      capital: 50000,
      status: 'NORMAL',
      signingRule: 'Tegnes af direktøren',
    })
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('returnerer not-found ved ugyldigt CVR uden at kalde fetch', async () => {
    global.fetch = vi.fn()

    const results = await Promise.all([
      lookupByCvr('1234567'), // 7 cifre
      lookupByCvr('123456789'), // 9 cifre
      lookupByCvr('abcdefgh'), // bogstaver
      lookupByCvr(''), // tom
    ])

    for (const result of results) {
      expect(result.found).toBe(false)
      expect(result.data).toBeNull()
      expect(result.source).toBe('cvr_api')
    }
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returnerer not-found ved 404-svar', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    const result = await lookupByCvr('99999999')

    expect(result.found).toBe(false)
    expect(result.data).toBeNull()
    expect(result.source).toBe('cvr_api')
  })

  it('returnerer not-found ved netværksfejl (graceful)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await lookupByCvr('12345678')

    expect(result.found).toBe(false)
    expect(result.data).toBeNull()
    expect(result.source).toBe('cvr_api')
  })

  it('returnerer not-found hvis API-svar mangler name', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vat: '12345678' }),
    } as Response)

    const result = await lookupByCvr('12345678')

    expect(result.found).toBe(false)
  })
})
