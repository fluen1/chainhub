import { timingSafeEqual } from 'crypto'

/**
 * Timing-safe verifikation af cron-Bearer-token.
 *
 * Accepterer `CRON_SECRET` (Vercels standard, injiceres automatisk på cron-kald)
 * ELLER `DIGEST_CRON_SECRET` (bagudkompatibel — manuel curl + ældre opsætning).
 * Samme mønster som /api/cron/daily-digest.
 *
 * Returnerer true hvis mindst én konfigureret secret matcher det angivne
 * Authorization-header. Returnerer false hvis ingen secret er konfigureret.
 */
export function isCronAuthorized(authHeader: string | null): boolean {
  const provided = authHeader ?? ''

  const secrets = [process.env.CRON_SECRET, process.env.DIGEST_CRON_SECRET].filter(
    Boolean
  ) as string[]
  if (secrets.length === 0) return false

  return secrets.some((secret) => {
    const expected = `Bearer ${secret}`
    return (
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    )
  })
}
