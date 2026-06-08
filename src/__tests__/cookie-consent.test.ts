import { describe, it, expect } from 'vitest'
import { COOKIE_CONSENT_KEY, isValidConsent } from '@/lib/cookie-consent'

describe('cookie-consent modul', () => {
  it('eksporterer en stabil localStorage-nøgle', () => {
    expect(COOKIE_CONSENT_KEY).toBe('chainhub-cookie-consent')
  })

  it('isValidConsent godtager kun granted/denied', () => {
    expect(isValidConsent('granted')).toBe(true)
    expect(isValidConsent('denied')).toBe(true)
    expect(isValidConsent(null)).toBe(false)
    expect(isValidConsent('maybe')).toBe(false)
  })
})
