# ChainHub — Runbook

**Formål:** Operationel reference for drift, deployment og konfiguration.
**Opdateret:** 2026-05-25

---

## Indholdsfortegnelse

1. [Miljøvariabler](#miljøvariabler)
2. [Lokal udvikling](#lokal-udvikling)
3. [Database](#database)
4. [Stripe webhook-opsætning](#stripe-webhook-opsætning)
5. [Sentry fejl-tracking](#sentry-fejl-tracking)
6. [Google OAuth](#google-oauth)
7. [PostHog analytics](#posthog-analytics)
8. [Resend e-mail](#resend-e-mail)
9. [Cloudflare R2 fillagring](#cloudflare-r2-fillagring)
10. [Upstash Redis (rate limiting)](#upstash-redis-rate-limiting)
11. [Vercel deployment](#vercel-deployment)
12. [Daglig e-mail digest](#daglig-e-mail-digest)
13. [Kendte driftsproblemer](#kendte-driftsproblemer)

---

## Miljøvariabler

Alle variabler valideres ved startup via `src/lib/env.ts`. Manglende påkrævede variabler kaster en fejl ved boot.

### Påkrævede (app starter ikke uden dem)

```env
DATABASE_URL=postgresql://chainhub:chainhub@localhost:6543/chainhub_dev?pgbouncer=true
DIRECT_URL=postgresql://chainhub:chainhub@localhost:5432/chainhub_dev
NEXTAUTH_SECRET=<generer med: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

### Valgfrie (features deaktiveres stille hvis de mangler)

```env
# AI-søgning
OPENAI_API_KEY=sk-...

# E-mail (digest + notifikationer)
RESEND_API_KEY=re_...
DIGEST_CRON_SECRET=<random string>

# Fejl-tracking
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

# Billing
STRIPE_SECRET_KEY=sk_live_... (eller sk_test_...)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (eller pk_test_...)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PROFESSIONAL_PRICE_ID=price_...

# Google OAuth
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Fillagring (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=chainhub-documents

# Rate limiting
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Lokal udvikling

```bash
# 1. Start PostgreSQL (kræver Docker Desktop)
docker compose up -d

# 2. Installer dependencies
npm ci

# 3. Opret .env.local med minimum-variabler (se ovenfor)

# 4. Push schema + seed
npx prisma generate
npx prisma db push
npx prisma db seed

# 5. Start dev server
npm run dev
# → http://localhost:3000
```

**Seed-brugere:**

- `philip@chainhub.dk` / `password123` (GROUP_OWNER)
- `maria@tandlaegegruppen.dk` / `password123` (GROUP_LEGAL)

---

## Database

| Variabel       | Formål                                                     |
| -------------- | ---------------------------------------------------------- |
| `DATABASE_URL` | PgBouncer-connection (port 6543) — bruges til alle queries |
| `DIRECT_URL`   | Direkte PostgreSQL (port 5432) — kun til migrationer       |

**Supabase auto-pause:** Gratis Supabase-projekter pauses efter 7 dages inaktivitet. Genaktiver via Supabase-dashboardet. Brug `DIRECT_URL` til `prisma migrate dev`.

**Lokal Docker:**

```
DATABASE_URL=postgresql://chainhub:chainhub@localhost:5432/chainhub_dev
DIRECT_URL=postgresql://chainhub:chainhub@localhost:5432/chainhub_dev
```

**Nyttige kommandoer:**

```bash
npx prisma generate          # Regenerér Prisma client efter schema-ændringer
npx prisma db push           # Push schema til DB uden migration-fil
npx prisma migrate dev       # Kør migrationer (kræver DIRECT_URL)
npx prisma db seed           # Seed test-data
npx prisma studio            # Åbn Prisma Studio (GUI)
```

---

## Stripe webhook-opsætning

### Events der håndteres

Webhook-handleren (`src/app/api/webhooks/stripe/route.ts`) lytter på:

| Event                           | Handling                                                 |
| ------------------------------- | -------------------------------------------------------- |
| `checkout.session.completed`    | Opretter/opdaterer abonnement efter succesfuldt checkout |
| `customer.subscription.updated` | Opdaterer abonnementsstatus, periode og plan             |
| `customer.subscription.deleted` | Sætter abonnement til `canceled`                         |
| `invoice.payment_failed`        | Sætter abonnement til `past_due`                         |

### Opsætning i Stripe Dashboard

1. Gå til **Developers → Webhooks** i [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Klik **Add endpoint**
3. Sæt endpoint URL:
   - Produktion: `https://app.chainhub.dk/api/webhooks/stripe`
   - Staging: `https://chainhub-staging.vercel.app/api/webhooks/stripe`
4. Vælg events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
5. Klik **Add endpoint** → kopiér **Signing secret** (starter med `whsec_`)
6. Sæt `STRIPE_WEBHOOK_SECRET=whsec_...` i miljø

### Test mode vs. live mode

- Test: `STRIPE_SECRET_KEY=sk_test_...`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- Live: `STRIPE_SECRET_KEY=sk_live_...`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
- Webhook secrets er separate for test og live — sæt korrekt `STRIPE_WEBHOOK_SECRET` per miljø

### Lokal webhook-test med Stripe CLI

```bash
# Installer Stripe CLI, log ind
stripe login

# Forward webhooks til lokal server
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# CLI printer et webhook secret — brug det som STRIPE_WEBHOOK_SECRET i .env.local
```

### Price IDs

Find price IDs under **Products** i Stripe Dashboard. Sæt dem i:

```env
STRIPE_STARTER_PRICE_ID=price_...     # Starter-plan (799 kr/md)
STRIPE_PROFESSIONAL_PRICE_ID=price_... # Professional-plan (1.999 kr/md)
```

---

## Sentry fejl-tracking

### Miljøvariabler

```env
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
```

Begge peger på samme DSN. `SENTRY_DSN` bruges server-side, `NEXT_PUBLIC_SENTRY_DSN` client-side.

### Tunnel-route

Appen bruger Sentry-tunnel via `/monitoring` for at omgå adblockers. Konfigureret i `next.config.ts` via `@sentry/nextjs`-wizard-output.

### Opsætning

1. Opret projekt på [sentry.io](https://sentry.io) (Next.js-type)
2. Kopiér DSN fra **Settings → Projects → [projekt] → Client Keys (DSN)**
3. Sæt begge miljøvariabler — hvis de mangler, kører appen uden fejl-tracking (ingen crash)

### Verificering

```bash
# Test at Sentry modtager fejl (development):
# Kast en bevidst fejl og tjek Sentry-dashboardet
```

---

## Google OAuth

### Miljøvariabler

```env
GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-<secret>
```

### Opsætning i Google Cloud Console

1. Gå til [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**
2. Klik **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Tilføj authorized redirect URIs:
   - Lokal: `http://localhost:3000/api/auth/callback/google`
   - Produktion: `https://app.chainhub.dk/api/auth/callback/google`
5. Kopiér **Client ID** og **Client Secret**

### OAuth-flow

- Login med Google er kun tilgængeligt for brugere, der allerede eksisterer i databasen (invitation-baseret)
- `Account`-model i Prisma knytter Google-konto til bruger
- Ved login redirectes brugeren til deres organisations dashboard

### Fejlsøgning

- **"OAuthAccountNotLinked"**: Brugeren har allerede en konto med samme email via credentials — to konti-typer kan ikke kombineres automatisk
- **Redirect URI mismatch**: Tjek at alle URIs er tilføjet i Google Console for det korrekte environment

---

## PostHog analytics

### Miljøvariabler

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_<key>
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com   # EU-region (GDPR)
```

### Opsætning

1. Opret projekt på [PostHog](https://eu.posthog.com) (EU-region anbefales af GDPR-hensyn)
2. Kopiér **Project API Key** fra **Settings → Project**
3. Sæt `NEXT_PUBLIC_POSTHOG_KEY` — appen starter uden tracking hvis nøglen mangler

### Implementering i appen

- **Provider:** `src/components/providers/PosthogProvider.tsx` — initialiserer PostHog client-side
- **Bruger-identifikation:** `src/components/providers/PosthogIdentify.tsx` — identificerer indloggede brugere
- **Automatisk tracking:** `capture_pageview: true`, `capture_pageleave: true`
- **Profiler:** `person_profiles: 'identified_only'` — tracker kun identificerede brugere (GDPR-venlig)

### Event-navngivningskonvention

Brug `snake_case` med kontekst-prefix:

```
company_created
contract_signed
case_opened
billing_checkout_started
billing_checkout_completed
search_performed
document_uploaded
```

### Tunnel (valgfrit)

For at omgå adblockers kan PostHog tunneles via Next.js rewrites. Tilføj i `next.config.ts`:

```js
async rewrites() {
  return [
    { source: '/ingest/static/:path*', destination: `${POSTHOG_HOST}/static/:path*` },
    { source: '/ingest/:path*', destination: `${POSTHOG_HOST}/:path*` },
  ]
}
```

Og sæt `NEXT_PUBLIC_POSTHOG_HOST=/ingest` i produktion.

---

## Resend e-mail

```env
RESEND_API_KEY=re_<key>
DIGEST_CRON_SECRET=<random secure string>
```

Bruges til daglig e-mail digest. Se [Daglig e-mail digest](#daglig-e-mail-digest).

---

## Cloudflare R2 fillagring

```env
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<R2 access key>
R2_SECRET_ACCESS_KEY=<R2 secret key>
R2_BUCKET=chainhub-documents
```

Dokumenter uploades via `src/app/api/upload/route.ts`. Hvis R2-variabler mangler, fejler upload-endpoints.

**Opret R2 bucket:**

1. Cloudflare Dashboard → **R2 → Create bucket** → navn: `chainhub-documents`
2. **Manage R2 API Tokens → Create API Token** med `Object Read & Write` på bucketen

---

## Upstash Redis (rate limiting)

```env
UPSTASH_REDIS_REST_URL=https://<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

Bruges til rate limiting på auth-endpoints. Hvis variabler mangler, er rate limiting deaktiveret.

**Opret database:**

1. [Upstash Console](https://console.upstash.com/) → **Create Database** → vælg EU-region
2. Kopiér **REST URL** og **REST Token**

---

## Vercel deployment

### Påkrævede environment variables i Vercel

Sæt alle variabler fra [Miljøvariabler](#miljøvariabler) i **Vercel Dashboard → Settings → Environment Variables**.

`NEXTAUTH_URL` behøves ikke i Vercel — `VERCEL_URL` sættes automatisk. `baseUrl` i `src/lib/env.ts` håndterer dette.

### Deploy

```bash
# Automatisk deploy ved push til main/master
git push origin main

# Manuel deploy
vercel --prod
```

---

## Daglig e-mail digest

Cron-endpoint der sender daglig aktivitetsoversigt til relevante brugere.

```bash
# Test lokalt (kræver RESEND_API_KEY + DIGEST_CRON_SECRET)
curl -X POST http://localhost:3000/api/cron/daily-digest \
  -H "Authorization: Bearer $DIGEST_CRON_SECRET"
```

**Vercel Cron:** Konfigurér i `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 7 * * 1-5"
    }
  ]
}
```

Vercel sætter automatisk `Authorization`-header med projekts cron-secret.

---

## Kendte driftsproblemer

| Problem                         | Symptom                                | Løsning                                                                         |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Supabase auto-pause             | DB-queries fejler med connection error | Genaktiver i Supabase dashboard                                                 |
| OneDrive `.next` sync-konflikt  | Build fejler på Windows                | Ekskludér `.next/` fra OneDrive-sync                                            |
| PgBouncer + prepared statements | Prisma fejl med `pgbouncer=true`       | Tjek at `pgbouncer=true` er i DATABASE_URL — og brug DIRECT_URL til migrationer |
| NextAuth JWT + Google           | OAuthAccountNotLinked-fejl             | Se [Google OAuth fejlsøgning](#fejlsøgning)                                     |
| Vitest + jsdom memory           | Tests løber langsomt                   | Kør `npm test -- --pool=forks`                                                  |
