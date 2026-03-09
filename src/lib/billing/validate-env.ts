/**
 * Validering af Stripe-relaterede environment variables ved startup.
 * Importeres i src/lib/stripe/index.ts og ved server startup.
 */

export function validateStripeEnv(): void {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_STARTER_PRICE_ID',
    'STRIPE_BUSINESS_PRICE_ID',
    'STRIPE_ENTERPRISE_PRICE_ID',
  ]

  const missing: string[] = []
  const warnings: string[] = []

  for (const key of required) {
    const value = process.env[key]
    if (!value) {
      missing.push(key)
      continue
    }

    // Tjek for trailing whitespace/newlines (kritisk for STRIPE_WEBHOOK_SECRET)
    if (value !== value.trim()) {
      warnings.push(
        `${key} har trailing whitespace/newlines — dette kan give stille fejl. Trim værdien.`
      )
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Manglende Stripe environment variables: ${missing.join(', ')}\n` +
        'Se .env.example for konfigurationsvejledning.'
    )
  }

  for (const warning of warnings) {
    console.warn(`[Stripe Config] ⚠️  ${warning}`)
  }
}

/**
 * Valider webhook URL format (brug i tests og CI).
 * KRITISK: www-prefix er påkrævet.
 */
export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  if (!url.startsWith('https://www.')) {
    return {
      valid: false,
      error:
        `Webhook URL mangler www-prefix.\n` +
        `KORREKT:  https://www.chainhub.dk/api/webhooks/stripe\n` +
        `FORKERT:  ${url}`,
    }
  }

  if (!url.endsWith('/api/webhooks/stripe')) {
    return {
      valid: false,
      error: `Webhook URL skal slutte med /api/webhooks/stripe. Fik: ${url}`,
    }
  }

  return { valid: true }
}