# Gap-lukning + Google Auth — Design Spec

**Dato:** 2026-05-25
**Status:** Godkendt
**Scope:** 6 arbejdspakker der lukker alle identificerede modenhedshuller + tilføjer Google OAuth

---

## 1. Action-hardening (3 filer)

### 1.1 `src/actions/billing.ts`

- `createCheckoutSession(priceId)`: Tilføj Zod-validering af `priceId` (`.string().min(1)`). Tilføj `canAccessModule('billing')`.
- `createPortalSession`: Tilføj `canAccessModule('billing')`.
- `getBillingPageData`: Tilføj `canAccessModule('billing')`.

### 1.2 `src/actions/onboarding.ts`

- `getOnboardingStatus`: Tilføj `canAccessModule('onboarding')` check.

### 1.3 `src/actions/ai-usage.ts`

- `getSettingsAIUsage`: Tilføj `canAccessModule('settings')` check (matcher `getAIUsageDashboard` som allerede har det).

### Ikke i scope

`governance.ts`, `tasks.ts`, `ownership.ts`, `organizations.ts` har allerede Zod-validering via importerede schemas fra `@/lib/validations/` og permissions via `canAccessCompany`/`canAccessModule`. Ingen ændringer nødvendige.

---

## 2. Coverage-tærskel i CI

### Ændring i `vitest.config.ts`

```typescript
test: {
  coverage: {
    provider: 'v8',
    thresholds: {
      lines: 60,
      functions: 60,
    },
  },
}
```

### Ændring i `.github/workflows/ci.yml`

Erstat `npm test` med `npm run test:coverage` i `lint-test` jobbet, så tærsklen håndhæves i CI.

---

## 3. CSP-stramning

### Ændring i `next.config.mjs`

**Fjern:** `'unsafe-eval'` fra `script-src`.
**Tilføj:** `upgrade-insecure-requests` som separat direktiv.
**Behold:** `'unsafe-inline'` (krævet af Next.js App Router style-injection).

Resultat:

```
script-src 'self' 'unsafe-inline';
upgrade-insecure-requests;
```

---

## 4. Vercel Preview Deploys

### 4.1 Vercel-indstilling (manuelt)

Kobl GitHub-repo til Vercel-projekt. Preview deploys aktiveres automatisk på PRs.

### 4.2 Kodeændring: dynamisk `NEXTAUTH_URL`

I `src/lib/auth/index.ts` (eller env.ts): Brug `VERCEL_URL` som fallback for `NEXTAUTH_URL` i preview-deploys:

```typescript
// I auth config
url: process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
```

### 4.3 CI-ændring

Ingen ændring — deploy-jobbet deployer kun master. Preview deploys håndteres af Vercel direkte.

---

## 5. Generel rate limiting på Server Actions

### 5.1 Ny fil: `src/lib/rate-limit.ts`

Wrapper-funktion `checkActionRateLimit(organizationId: string)` der:

- Bruger Upstash Redis sliding window hvis konfigureret
- Falder tilbage til in-memory Map
- Grænse: 60 requests / 60 sekunder per organisation
- Returnerer `{ limited: boolean; retryAfter?: number }`

### 5.2 Integration

Tilføj `checkActionRateLimit` i muterende actions (create/update/delete). Ikke read-only queries.

Pattern:

```typescript
const rl = await checkActionRateLimit(session.user.organizationId)
if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }
```

### 5.3 Genbrug

Bruger samme `@upstash/ratelimit` + `@upstash/redis` dependencies som login rate limiting. Ingen nye packages.

---

## 6. Google OAuth

### 6.1 Prisma migration

Ny `Account`-model (NextAuth standard):

```prisma
model Account {
  id                String  @id @default(uuid())
  user_id           String
  type              String
  provider          String
  provider_account_id String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([provider, provider_account_id])
  @@map("accounts")
}
```

Tilføj `accounts Account[]` relation på `User`-modellen.

### 6.2 NextAuth config

Tilføj `GoogleProvider` ved siden af `CredentialsProvider`:

```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
})
```

### 6.3 Auth callbacks

**`signIn` callback:**

1. Find User via email (normaliseret)
2. Hvis User findes → tillad login, link Account
3. Hvis User IKKE findes → opret ny Organization (name fra Google profile), User (GROUP_OWNER rolle), Account. Sæt plan til `TRIAL` med 14 dage.
4. Afvis hvis email matcher >1 tenant (samme guard som credentials)

**`jwt` callback:** Uændret — henter `organizationId` fra User-opslag.

**`session` callback:** Uændret.

### 6.4 Login-side

- Erstat disabled Microsoft SSO-knap med aktiv Google-knap
- Brug `signIn('google', { callbackUrl })` onClick
- Google-ikon (SVG inline, ingen ekstern dependency)

### 6.5 Environment

Tilføj i `src/lib/env.ts`:

```typescript
GOOGLE_CLIENT_ID: z.string().optional(),
GOOGLE_CLIENT_SECRET: z.string().optional(),
```

Tilføj i `.env.example` med kommentar.

### 6.6 Signup-side

Tilføj Google-knap på `/signup`-siden med samme flow — opretter org + user via signIn callback.

---

## Afhængigheder

- Ingen nye npm-packages (alle deps er allerede installeret)
- Google OAuth kræver `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` fra Google Cloud Console
- Vercel Preview kræver GitHub-repo koblet til Vercel (manuelt)

## Ikke i scope

- Microsoft SSO (beholdes som disabled placeholder)
- Multi-browser E2E (kun Chromium)
- i18n-framework
- Public API
- Commitlint
