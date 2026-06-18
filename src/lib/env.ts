import { z } from 'zod'

// `next build` sætter NODE_ENV=production men kører på dev/CI-maskiner uden
// produktions-secrets — runtime-krav håndhæves derfor kun udenfor build-fasen.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
const isProd = process.env.NODE_ENV === 'production' && !isBuildPhase

// STAGED LAUNCH (18/6): siden skal kunne STARTE i prod uden at ALLE
// forretnings-features er konfigureret endnu. Dækker KUN billing (Stripe), AI (OpenAI)
// og digest-cron — funktioner der er lazy+guarded og bare er slukket til nøglerne sættes.
// ⚠️ Dækker ALDRIG auth/sikkerheds-kontroller (se securityRequiredInProd nedenfor).
// ⚠️ SÆT STAGED_LAUNCH = false FØR FØRSTE BETALENDE KUNDE — så håndhæves Stripe m.fl. igen.
const STAGED_LAUNCH = true

const requiredInProd = (msg: string) =>
  isProd && !STAGED_LAUNCH
    ? z
        .string({ error: () => `${msg} — påkrævet i production` })
        .min(1, `${msg} — påkrævet i production`)
    : z.string().optional()

// Sikkerheds-kritiske vars: ALTID påkrævet i production, uafhængigt af STAGED_LAUNCH.
// Fx Upstash, der driver login-rate-limiting — uden den er in-memory-fallbacken
// virkningsløs på tværs af serverless-instanser (fail-open mod brute-force). Auth
// må aldrig kunne "staged-launches" væk.
const securityRequiredInProd = (msg: string) =>
  isProd
    ? z
        .string({ error: () => `${msg} — påkrævet i production (sikkerhedskontrol)` })
        .min(1, `${msg} — påkrævet i production (sikkerhedskontrol)`)
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
  UPSTASH_REDIS_REST_URL: securityRequiredInProd('UPSTASH_REDIS_REST_URL'),
  UPSTASH_REDIS_REST_TOKEN: securityRequiredInProd('UPSTASH_REDIS_REST_TOKEN'),
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
