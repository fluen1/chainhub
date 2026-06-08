export const COOKIE_CONSENT_KEY = 'chainhub-cookie-consent'

export type CookieConsentChoice = 'granted' | 'denied'

export function isValidConsent(value: string | null): value is CookieConsentChoice {
  return value === 'granted' || value === 'denied'
}
