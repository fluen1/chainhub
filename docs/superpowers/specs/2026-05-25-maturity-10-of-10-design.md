# ChainHub Modenhed: Alle Dimensioner → 10/10

**Dato:** 2026-05-25
**Baseline:** Modenhedsaudit 2026-05-25 — samlet score 7.7/10
**Mål:** 10/10 på alle 10 dimensioner
**Strategi:** 5 prioriterede sub-goals, udført i rækkefølge

---

## Nuværende scores

| #   | Dimension          | Score | Vigtigste gaps                                           |
| --- | ------------------ | ----- | -------------------------------------------------------- |
| 1   | Tilgængelighed     | 6.0   | Mobilnav, skip-link, keyboard E2E, focus-trap, kontrast  |
| 2   | Performance        | 6.5   | Prisma include→select, Leaflet lazy-load, client caching |
| 3   | Dokumentation      | 7.0   | RUNBOOK forældet, ingen dev onboarding, webhook docs     |
| 4   | Observability      | 7.5   | PostHog uklart, ingen business-metrics, ingen alerting   |
| 5   | Feature-komplethed | 7.5   | Kalender-redigering, dokument-godkendelse, PDF-preview   |
| 6   | CI/CD              | 8.0   | Dependabot, db:e2e:reset i CI, staging env               |
| 7   | Test               | 8.0   | DB-integration i CI, billing E2E, visits coverage        |
| 8   | Sikkerhed          | 8.5   | CSP nonce, middleware /visits matcher                    |
| 9   | Fejlhåndtering     | 8.5   | error.tsx /calendar, retry-logik, Pino→Sentry            |
| 10  | Kodekvalitet       | 9.0   | NextAuth v5, Prisma 6                                    |

---

## Goal 1: Production-Ready Foundations (Tilgængelighed + Performance → 10)

**Udførelsesrækkefølge: FØRST** — løfter de to laveste scores.

### 1A: Mobilnavigation (BLK-003)

- Responsiv sidebar med `Sheet`/drawer på viewports <768px
- Burger-menu i header, sheet slider fra venstre
- Alle sidebar-links og moduler tilgængelige på mobil
- Lukker automatisk ved navigation
- Test: Playwright mobile viewport (375px) navigationsflow

### 1B: Skip-to-content link

- `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-zinc-900">Spring til indhold</a>`
- Placeres som første element i `<body>` / root layout
- `id="main-content"` på main content area

### 1C: Keyboard navigation

- Verificér Tab-ordre i alle modaler og forms
- Focus-trap i dialog-komponenter (verificér shadcn Dialog allerede har det)
- Escape lukker modaler
- Playwright E2E: keyboard-only navigation through create-company flow

### 1D: Farvekontrast

- Kør axe-core i CI (allerede i a11y.spec.ts — udvid til alle sider)
- Fix eventuelle violations
- Minimum WCAG AA (4.5:1 normal tekst, 3:1 stor tekst)

### 1E: Prisma select-optimering

- Gennemgå alle `findMany`/`findFirst` i `src/actions/`
- Erstat brede `include:` med præcise `select:` der kun henter nødvendige felter
- Prioritér: companies, contracts, cases (mest data)
- Verificér at UI stadig renderer korrekt efter ændring

### 1F: Leaflet lazy-load

- `dynamic(() => import('@/components/visits/map'), { ssr: false })`
- Reducer initial bundle size for /visits

### 1G: Client-side caching

- SWR på sidebar counts (allerede har API endpoint)
- SWR på dashboard KPI-data
- `revalidateOnFocus: false` for stabile data

---

## Goal 2: Hardening (Sikkerhed + Fejlhåndtering + Test → 10)

**Udførelsesrækkefølge: ANDEN** — hardener eksisterende kode.

### 2A: CSP nonce

- Fjern `'unsafe-inline'` fra script-src og style-src
- Implementér nonce via Next.js middleware `headers()`
- Nonce propageres til inline scripts via `<Script nonce={nonce}>`
- Test: verificér CSP header i response, ingen console errors

### 2B: Middleware matcher

- Tilføj `/visits/:path*` til middleware.config matcher array
- Verificér at uautoriserede requests til /visits redirectes til /login

### 2C: error.tsx i /calendar

- Opret `src/app/(dashboard)/calendar/error.tsx` med ErrorBoundaryUI
- Samme pattern som andre modulers error.tsx

### 2D: Retry-logik

- `withRetry(fn, { maxAttempts: 3, backoff: 'exponential' })` utility
- Bruges i actions der kalder eksterne services (Stripe, email)
- IKKE på Prisma-queries (de fejler af gode grunde)

### 2E: Pino → Sentry breadcrumbs

- Pino transport der sender logs som Sentry breadcrumbs
- Giver kontekst i Sentry error reports uden separat log-sink

### 2F: DB-integration tests i CI

- GitHub Actions e2e-job har allerede Postgres-service
- Tilføj `npm run db:e2e:reset` som trin før E2E
- Fjern `runIf(!!DATABASE_URL)` guards i relevante tests

### 2G: Billing E2E

- Playwright test med Stripe test-mode
- Flow: naviger til /billing → klik "Vælg Starter" → verificér redirect til Stripe Checkout
- Verificér success-banner ved return med `?success=1`

### 2H: Visits testdækning

- Unit tests for alle exports i `src/actions/visits.ts`
- Mønster: no-session, org_id filter, happy path

---

## Goal 3: Feature Completion (Feature-komplethed → 10)

**Udførelsesrækkefølge: TREDJE** — nye features ovenpå stabil base.

### 3A: Kalender-redigering

- Klik på besøg i kalender åbner edit-modal
- Felter: dato, tid, selskab, noter, status
- Server action: `updateCalendarEvent`
- Optimistisk UI med `useOptimistic`

### 3B: Dokument-godkendelsesworkflow

- Ny status-enum: `DRAFT → PENDING_REVIEW → APPROVED | REJECTED`
- `DocumentReview` Prisma-model med reviewer, kommentar, beslutning, dato
- UI: "Send til godkendelse" knap, review-panel med godkend/afvis
- Audit trail: hvem godkendte/afviste hvornår

### 3C: Export PDF-preview

- Modal der viser preview af export før download
- Server-side PDF-generation via eksisterende export-action
- Preview i `<iframe>` eller `@react-pdf/renderer` inline

---

## Goal 4: Observability + Dokumentation + CI/CD → 10

**Udførelsesrækkefølge: FJERDE** — infra og docs.

### 4A: RUNBOOK opdatering

- Tilføj sektioner: Stripe webhook setup, Sentry DSN, Google OAuth config, PostHog
- Opdater fra sprint 6-niveau til aktuel stack

### 4B: Developer onboarding guide

- `docs/GETTING-STARTED.md`: 0 → kørende app i 10 trin
- Inkludér: prerequisites, clone, env vars, Docker, seed, dev server

### 4C: Webhook API docs

- Dokumentér Stripe webhook endpoint: URL, events, payload-format, retry-policy
- Tilføj til API-SPEC.md

### 4D: PostHog konfiguration

- Verificér at PostHog er aktivt konfigureret
- Tilføj tracking events for kerneflows: signup, create-company, create-contract, checkout
- Dokumentér event-naming convention

### 4E: Business-metrics dashboard

- PostHog dashboard med: aktive subscriptions, DAU/MAU, signup-rate, churn
- Eller Sentry Performance dashboard for API-latency

### 4F: Alerting

- Sentry alert rules: error-rate > threshold, ny unhandled exception
- Vercel uptime monitor på /api/health

### 4G: Dependabot

- `.github/dependabot.yml` med weekly schedule for npm

### 4H: Staging environment

- Vercel preview branches med separat Supabase branch-DB
- Dokumentér workflow: feature branch → preview → review → merge

---

## Goal 5: Kodekvalitet Polish → 10

**Udførelsesrækkefølge: SIDST** — high-risk upgrades.

### 5A: NextAuth v5 migration

- `next-auth@5` → `@auth/nextjs`
- Estimeret 84 filer påvirket
- Breaking changes: nye imports, ændret session-type, middleware-config
- Kræver fuld test-suite pass efter migration

### 5B: Prisma 6 upgrade

- `prisma@6` + `@prisma/client@6`
- Breaking changes: ESM-first, ændrede typer
- Kræver `prisma generate` + fuld test pass

---

## Afhængigheder

```
Goal 1 (a11y + perf) ← ingen afhængigheder
Goal 2 (hardening) ← ingen afhængigheder, kan parallelles med Goal 1
Goal 3 (features) ← bør komme efter Goal 2 (stabil base)
Goal 4 (docs + obs) ← bør komme efter Goal 3 (dokumentér færdige features)
Goal 5 (upgrades) ← SIDST (breaker potentielt alt)
```

## Succeskriterium

Alle 10 dimensioner scorer 10/10 i en ny modenhedsanalyse efter Goal 5 er færdig.
