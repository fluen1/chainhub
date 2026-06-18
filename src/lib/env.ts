import { z } from 'zod'

// `next build` sætter NODE_ENV=production men kører på dev/CI-maskiner uden
// produktions-secrets — runtime-krav håndhæves derfor kun udenfor build-fasen.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
const isProd = process.env.NODE_ENV === 'production' && !isBuildPhase

// STAGED LAUNCH (18/6): siden skal kunne STARTE i prod uden Stripe/Upstash/OpenAI/
// digest-cron endnu — de funktioner er slukket indtil nøglerne tilføjes (klienterne er
// lazy + guarded, så de fejler kun hvis funktionen faktisk bruges uden nøgle).
// DATABASE_URL + NEXTAUTH_SECRET/URL kræves stadig altid (de står uden for denne helper).
// ⚠️ SÆT STAGED_LAUNCH = false FØR FØRSTE BETALENDE KUNDE — så håndhæves Stripe m.fl. igen.
const STAGED_LAUNCH = true

const requiredInProd = (msg: string) =>
  isProd && !STAGED_LAUNCH
    ? z
        .string({ error: () => `${msg} — påkrævet i production` })
        .min(1, `${msg} — påkrævet i production`)
    : z.string().optional()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL mangler — sæt den i .env.local'),
  DIRECT_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET mangler — sæt den i .env.local'),
  NEXTAUTH_URL: isProd
    ? z.string().url('NEXTAUTH_URL skal være en gyldig URL i production')
    : z.string().url('NEXTAUTH_URL skal være en gyldig URL').optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OPENAI_API_KEY: requiredInProd('OPENAI_API_KEY'),
  AI_EXTRACTION_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  OPENAI_BASE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  CONTACT_TO_EMAIL: z.string().optional(),
  STORAGE_PROVIDER: z.enum(['local', 'r2']).optional().default('local'),
  DIGEST_FROM_EMAIL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  DIGEST_CRON_SECRET: requiredInProd('DIGEST_CRON_SECRET'),
  CRON_SECRET: z.string().optional(), // Vercels standard — injiceres automatisk ved cron-kald
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
  STRIPE_BASIS_PRICE_ID: requiredInProd('STRIPE_BASIS_PRICE_ID'),
  STRIPE_PLUS_PRICE_ID: requiredInProd('STRIPE_PLUS_PRICE_ID'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  CHAINHUB_CVR: z
    .string()
    .regex(/^\d{8}$/, 'CHAINHUB_CVR skal være 8 cifre')
    .optional(),
  CHAINHUB_ADDRESS: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const errors = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Ugyldig miljøkonfiguration:\n${errors}`)
}

export const env = parsed.data

export const baseUrl =
  env.NEXTAUTH_URL ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3000')
