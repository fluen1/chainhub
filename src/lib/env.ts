import { z } from 'zod'

// `next build` sætter NODE_ENV=production men kører på dev/CI-maskiner uden
// produktions-secrets — runtime-krav håndhæves derfor kun udenfor build-fasen.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
const isProd = process.env.NODE_ENV === 'production' && !isBuildPhase

const requiredInProd = (msg: string) =>
  isProd ? z.string().min(1, `${msg} — påkrævet i production`) : z.string().optional()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL mangler — sæt den i .env.local'),
  DIRECT_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET mangler — sæt den i .env.local'),
  NEXTAUTH_URL: isProd
    ? z.string().url('NEXTAUTH_URL skal være en gyldig URL i production')
    : z.string().url('NEXTAUTH_URL skal være en gyldig URL').optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  DIGEST_CRON_SECRET: requiredInProd('DIGEST_CRON_SECRET'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  UPSTASH_REDIS_REST_URL: requiredInProd('UPSTASH_REDIS_REST_URL'),
  UPSTASH_REDIS_REST_TOKEN: requiredInProd('UPSTASH_REDIS_REST_TOKEN'),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  STRIPE_SECRET_KEY: requiredInProd('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: requiredInProd('STRIPE_WEBHOOK_SECRET'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_STARTER_PRICE_ID: z.string().optional(),
  STRIPE_PROFESSIONAL_PRICE_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  VERCEL_URL: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const errors = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Ugyldig miljøkonfiguration:\n${errors}`)
}

export const env = parsed.data

export const baseUrl =
  env.NEXTAUTH_URL ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3000')
