# Kravspecifikation: ChainHub — as-built

**Version 3.0 · 20. juni 2026 · as-built reference**
**Afløser:** `kravspec-legalhub.md` v2.3 (forældet — gammelt produktnavn, fiktiv Microsoft-integration, forkerte priser, AI markeret som Fase 2).

> Dette dokument beskriver **hvad ChainHub ER lige nu** — verificeret mod den faktiske kode (`fluen1/chainhub`, master, 20-06-2026), ikke mod ambitioner. Afvigelser mellem kode og hensigt er dokumenteret eksplicit i afsnit 10. Sproget er teknisk-præcist; målgruppen er teamet selv, fremtidig udvikling og overlevering.

---

## 1. Produkt & formål

ChainHub er et web-baseret B2B SaaS-system til **kædegrupper der co-ejer lokationsselskaber** med lokale partnere (optiker-, fysio-, læge-, franchisekæder). Det samler kontraktstyring, governance, sagshåndtering, økonomi-overblik og personrelationer i ét dashboard, set **fra hovedkontorets perspektiv**.

Arkitektur-analogien (McDonald's-modellen):

```
McDonald's Corp.     →  Kædegruppen          (brugerne / tenant)
McDonald's lokation  →  Lokationsselskabet   (ApS med CVR)
Franchise-ejer       →  Lokal partner        (fx optikeren)
McDonald's som part  →  Holdingselskabet     (medejer via ejeraftale)
```

**Formål:** ét samlet overblik og fuld kontrol over alle lokationer — erstatter Excel/email-workflows ved 5–56+ lokationer hvor flade lister bliver ubrugelige og hierarkisk navigation er påkrævet. Produktet er **generisk** (ikke branche-specifikt) — alle kæder med co-ownership-struktur.

**Driftsstatus (20-06-2026):** 🚀 live i staged-tilstand på `chainhub-five.vercel.app`. Kernen er bygget og testet; billing (Stripe) og AI (OpenAI) er bevidst slukket indtil nøgler sættes (se afsnit 8.9).

---

## 2. Tech stack (as-built)

| Lag           | Teknologi                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Frontend      | Next.js **16** (App Router, Turbopack), React 19, TypeScript 5 (strict, no-`any`), Tailwind CSS                              |
| Backend       | Next.js **Server Actions** (primært mønster), API routes kun til auth/upload/webhooks/cron/export/health                     |
| Auth          | **NextAuth 5** (JWT, 8t sessions); Credentials (bcrypt) + **Google OAuth** (valgfri). _Ingen_ Microsoft/Graph-integration.   |
| Database      | PostgreSQL (**Supabase**), Prisma 6 ORM. `DATABASE_URL` = pooled (PgBouncer 6543), `DIRECT_URL` = direct (5432, migrationer) |
| Filer         | Pluggbar storage: `local` (default) eller **Cloudflare R2** (`STORAGE_PROVIDER`)                                             |
| Email         | **Resend** (invitationer, password-reset, kontakt, daglig digest)                                                            |
| Betaling      | **Stripe** (Checkout + Customer Portal + webhooks)                                                                           |
| Rate-limit    | **Upstash Redis** (login + OAuth-signup; sikkerhedskritisk)                                                                  |
| AI            | **OpenAI** (gpt-5-familien, Responses API, structured outputs); jobs via **pg-boss**-kø                                      |
| Analytics     | **PostHog** (samtykke-gated, cookieless-venlig)                                                                              |
| Observability | **Sentry** (DSN-gated), `/api/health` DB-check                                                                               |
| Hosting       | **Vercel** (region `fra1` Frankfurt), auto-deploy fra master via Vercels Git-integration                                     |
| Validering    | **Zod** på al brugerinput                                                                                                    |

---

## 3. Funktionelle krav (moduler)

Tværgående mønster i alle moduler: server-side pagination via URL-params, `ActionResult<T>`-returns, multi-tenant + permission-gated, soft delete. Listevisninger har typisk 3 view-modes (tabel/grupperet/kanban eller kort), filtre + reset, og CSV-eksport.

### 3.1 Dashboard (forside)

Porteføljens overblik. Server action `getDashboardData`.

- **Health-model:** `critical` ved enhver forfalden opgave, ellers `warning` ved åben sag, ellers `healthy`.
- **Urgency-tidslinje:** 4 sektioner (overskredet / i dag / denne uge / næste uge) der aggregerer forfaldne+fremtidige opgaver, udløbende+udløbne kontrakter, åbne sager, kommende besøg, nye dokumenter.
- **Rolle-baserede KPI'er:** LEGAL ser Udløbende/Sager/Forfaldne; FINANCE ser Omsætning/EBITDA/Margin/Forfaldne; OWNER ser Selskaber/Udløbende/Sager/Forfaldne.
- Paneler: Onboarding, Urgency, Heatmap, Alerts, Activity.

### 3.2 Selskaber (companies)

CRUD + 360°-detaljevisning af co-ejede lokationsselskaber (porteføljens kerne).

- Liste: 3 view-modes (tabel/regioner/kort), kritisk-toggle, CSV-eksport, sortering, co-ejet vs 100%-ejet.
- Detalje (single-page panel-layout, **ikke faner**): ejerskab (m. ejeraftale-status, tilføj/afslut ejer), personer, aktive kontrakter, åbne sager, dokumenter, økonomi (EBITDA/omsætning), health-banner, AI-insight-kort.
- Actions: `createCompany`, `updateCompany`, `deleteCompany`, `updateCompanyStamdata`, `getCompaniesPageData`.

### 3.3 Kontrakter (contracts)

**34 kontrakttyper** (jf. `CONTRACT-TYPES.md` + `validations/contract.ts`) med status-livscyklus, parter, versioner, påmindelser.

- To-lags katalog: Lag 1 universelle typer (alle), Lag 2 strukturtyper (aktiveres ved kæde/co-ownership). Hver type: `system_type` (driver logik/alerts/relationer) + fritekst `display_name`.
- Pr. type: sensitivitets-minimum, deadline-type (ABSOLUT/OPERATIONEL/INGEN), lovpligtig opbevaring (`must_retain_until`), parter/underskrivere, parent/triggered-by-kæder.
- Status-flow: `UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV → UDLOEBET / OPSAGT / FORNYET / ARKIVERET`.
- Liste: 3 view-modes (flad/grupperet/kanban med 4 status-kolonner), påmindelses-toggles (90/30/7 dage), sensitivitets-badges.

### 3.4 Sager (cases)

Sager/tvister med status-flow, eskalering, multi-selskab-kobling.

- Typer (`SagsType` + `SagsSubtype`): TRANSAKTION, TVIST, COMPLIANCE, KONTRAKT, GOVERNANCE, ANDET.
- Status: `ÅBEN → I_GANG → AFVENTER → LUKKET / ANNULLERET`. Tidsregistrering (`TimeEntry`, timer × timepris).
- Actions: `createCase`, `updateCaseStatus`, `closeCase`, `escalateCase`, `getCasesPageData`.

### 3.5 Opgaver (tasks)

Opgavestyring med prioritet, ansvarlig, forfald.

- Status: `NY → AKTIV → AFVENTER → LUKKET`. Felt-ændringslog (`TaskHistory`).
- Inline-opdatering af status/prioritet/ansvarlig/forfald; 3 view-modes; CSV-eksport (gated via `canExport`).

### 3.6 Dokumenter (documents) — m. AI-læsning + review

- **Liste:** pagineret, slet, links til review.
- **Upload:** drag-drop, fil-validering via magic-bytes (PDF/DOCX/PNG/JPEG, max 10 MB), selskabs-tilknytning, sti-traversal-sikker nøgle `{orgId}/{documentId}/{navn}`, IDOR-tjek, audit. Udløser valgfrit AI-ekstraktion (fail-silent).
- **Review:** AI-ekstraherede felter med konfidens-niveauer (high/medium/low), per-felt godkend/afvis, hel-godkend, afvis ekstraktion. Se afsnit 6.5.

### 3.7 Personer (persons)

Central kontaktbog på tværs af selskaber. Én person kan have roller i flere selskaber.

- Tilføj/afslut rolle, tilføj ejerandel, person-søgning; 3 view-modes; rolle-tone-badges.

### 3.8 Søgning (search)

Global søgning på tværs af 6 entitetstyper (selskaber, kontrakter, sager, personer, opgaver, dokumenter) parallelt — scoped til tilgængelige selskaber + sensitivitet. Action `runSearch`.

### 3.9 Kalender (calendar)

Måneds-visning der aggregerer daterede events (udløb, deadline, møde, sag, fornyelse) fra hele systemet. Måneds-navigation via `?month=YYYY-MM`, agenda-toggle.

### 3.10 Besøg (visits)

Selskabsbesøg (type, status-livscyklus, resumé). Ingen egen liste — eksponeres via dashboard-tidslinje, kalender og selskabsdetalje.

### 3.11 Billing

Abonnementsstyring via Stripe (Checkout + Customer Portal). Actions `getBillingPageData`, `createCheckoutSession`, `createPortalSession`. Se afsnit 8.1 + priser i afsnit 8.10.

### 3.12 Indstillinger (settings)

Sektions-navigeret: Organisation, Brugere & adgang, AI-brug (m. eget `ai-usage`-dashboard). "Coming soon"-paneler: Notifikationer, Integrationer, Sikkerhed, Abonnement.

### 3.13 Auth / signup / onboarding

- Login (NextAuth), glemt/nulstil password, invite-accept.
- 2-trins signup: konto → organisation. Google-signup auto-opretter org + GROUP_OWNER + 14-dages trial.
- Onboarding-status: 3 trin (har selskab, har kontrakt, inviteret kollega); panel vises kun når org < 14 dage og ikke alle trin er fuldført.

---

## 3A. Kerne-flows (proces-sekvenser)

As-built proces-flows for de vigtigste brugerrejser. Detaljerede skærm-for-skærm-flows i `UI-FLOWS.md` — **men bemærk:** den fil indeholder forældede Microsoft-SSO/Outlook-import-flows der IKKE er bygget (auth er Google, ikke Microsoft). Nedenstående er as-built.

**F1 — Onboarding (ny tenant)**
`signup` (konto: navn/email/password + accept af vilkår+DBA) → `signup/organization` (org-navn, evt. CVR) → org + GROUP_OWNER-rolle + 14-dages trial oprettes (`terms_accepted_at`/`dpa_accepted_at` sættes) → onboarding-panel: opret 1. selskab → tilføj 1. kontrakt → invitér kollega.

**F2 — Login & session**
`/login` (Credentials bcrypt, login-rate-limit via Upstash; afvist hvis email matcher >1 tenant) ELLER Google OAuth (auto-org ved 1. gang) → JWT-session (8t) → `jwtCallback` re-validerer `active`/`deleted_at` på **hver** request → middleware (`proxy.ts`) gater alt undtagen PUBLIC_PATHS → rolle+sensitivitet bestemmer synlige moduler/felter.

**F3 — Kontrakt-livscyklus**
Opret kontrakt (vælg `system_type` af 34 + fritekst `display_name`, sensitivitet, parter) → upload fil (`ContractVersion`) → status `UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV` → `Reminder`-rows + dashboard-urgency adviserer 90/30/7 dage før udløb → `UDLOEBET`/`OPSAGT`/`FORNYET`/`ARKIVERET`. Soft-delete bevarer historik (lovpligtig opbevaring via `must_retain_until`).

**F4 — Dokument → AI-læsning → menneske-review**
Upload dokument (magic-bytes-valideret) → hvis `isAIEnabled('extraction')` + plan=plus: pg-boss-job → 6-pass-pipeline ekstraherer felter → `DocumentExtraction` (konfidens pr. felt) → bruger åbner `documents/review/[id]` → afgør opmærksomheds-felter (use_ai/keep_existing/manual) → godkend → `AIFieldCorrection` logges (feedback-loop). Cost-cap ($50/md/org) kan blokere før kald.

**F5 — Sagshåndtering**
Opret sag (`SagsType` + subtype, ansvarlig, sensitivitet INTERN) → knyt selskaber/kontrakter/personer (`CaseCompany`/`CaseContract`/`CasePerson`) → noter, frister, opgaver (delsager), tidsregistrering (`TimeEntry`) → status `ÅBEN → I_GANG → AFVENTER → LUKKET`/`ANNULLERET`.

**F6 — Abonnement (billing)**
Vælg plan på `/pricing` → `/kontakt` (salg via demo, ingen self-service) → `createCheckoutSession` → Stripe Checkout → webhook (`checkout.session.completed` m. idempotens via `ProcessedStripeEvent`) → `Subscription` oprettes/opdateres → selvbetjent ændring via Stripe Customer Portal (`createPortalSession`).

---

## 4. Roller & adgang

### 4.1 De 8 roller

**Gruppe-niveau (scope ALL — hele gruppen):**
| Rolle | Kan |
|---|---|
| `GROUP_OWNER` | Alt inkl. fakturering + brugerstyring; eneste rolle der kan eksportere (m. ALL-scope) |
| `GROUP_ADMIN` | Alt undtagen fakturering; brugerstyring; eksport |
| `GROUP_LEGAL` | Kontrakter + sager på tværs; **intet økonomi-modul** |
| `GROUP_FINANCE` | Økonomi-overblik på tværs; **ingen kontrakter/sager** |
| `GROUP_READONLY` | Kun læse (revisor/ekstern rådgiver) |

**Selskabs-niveau (scope ASSIGNED/OWN — kun tildelte selskaber):**
| Rolle | Kan |
|---|---|
| `COMPANY_MANAGER` | Fuld adgang til tildelte selskaber (inkl. økonomi) |
| `COMPANY_LEGAL` | Kontrakter + sager for tildelte selskaber; ingen økonomi; max INTERN-sensitivitet |
| `COMPANY_READONLY` | Kun læse for tildelte selskaber |

Én bruger kan have flere tildelinger via `UserRoleAssignment`. (`EXTERNAL_PARTNER`/`EXTERNAL_EMPLOYEE` er Fase-2, **ikke** i enum'en → ikke bygget.)

### 4.2 3-lags adgangskontrol (`src/lib/permissions/index.ts`)

En bruger ser kun data der ligger inden for **alle tre** lag:

1. **`canAccessCompany`** — scope-tjek (ALL-rolle, eller selskab i `company_ids[]`). Roller hentes via `getUserRoles` filtreret på `organization_id` (forhindrer cross-tenant-lækage ved UUID-kollision).
2. **`canAccessSensitivity`** — STRENGT_FORTROLIG → kun OWNER/ADMIN/LEGAL; FORTROLIG → + FINANCE/READONLY/COMPANY_MANAGER; INTERN/STANDARD/PUBLIC → enhver med selskabsadgang.
3. **`canAccessModule`** — fail-closed. `billing` → OWNER; `settings`/`user_management` → OWNER/ADMIN; `finance` → alle undt. GROUP_LEGAL/COMPANY_LEGAL; `cases`/`contracts` → alle undt. GROUP_FINANCE; `companies`/`persons`/`documents`/`tasks` → alle. Data-eksport er hårdt begrænset til OWNER/ADMIN m. ALL-scope.

Det er denne model der gør, at **GROUP_FINANCE på en selskabsside ikke ser Kontrakter, Sager og Ejerskab** (demonstreret 20-06).

### 4.3 De 5 sensitivitetsniveauer

`PUBLIC < STANDARD < INTERN < FORTROLIG < STRENGT_FORTROLIG`. Default: kontrakter STANDARD, sager INTERN, dokumenter STANDARD.

---

## 5. Datamodel

**33 modeller / tabeller, 35 enums** (`prisma/schema.prisma`). _Bemærk:_ skema-headeren siger "30+ tabeller, 43 enums" — det er forældet; faktisk 33 tabeller / 35 enums.

| Domæne             | Tabeller                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identitet/Org/Auth | `Organization`, `User`, `UserRoleAssignment`, `Account`, `PasswordResetToken`, `InviteToken`                                                          |
| Selskaber/Ejerskab | `Company`, `CompanyNote`, `Ownership`, `Person`, `CompanyPerson`                                                                                      |
| Kontrakter         | `Contract`, `ContractParty`, `ContractVersion`, `ContractAttachment`, `ContractRelation`                                                              |
| Sager              | `Case`, `CaseCompany`, `CaseContract`, `CasePerson`, `TimeEntry`                                                                                      |
| Opgaver            | `Task`, `TaskHistory`, `Comment`, `Deadline`                                                                                                          |
| Dokumenter         | `Document`                                                                                                                                            |
| Økonomi/Billing    | `FinancialMetric`, `Subscription`, `ProcessedStripeEvent`                                                                                             |
| Besøg              | `Visit`                                                                                                                                               |
| AI                 | `OrganizationAISettings`, `AIUsageLog`, `DocumentExtraction`, `AIFieldCorrection`, `CompanyInsightsCache`, `Conversation`, `Message`, `PendingAction` |
| Audit/Påmindelser  | `AuditLog`, `Reminder`, `Alert`                                                                                                                       |

**Tværgående mønstre:**

- **Multi-tenancy:** `organization_id` på alle tenant-tabeller (også join-tabeller), typisk med compound-index ledet af `organization_id`.
- **Soft-delete:** `deleted_at` på alle kerne-entiteter (forekommer 38× i skemaet); join/audit/billing/AI-logs er hårde records. List-queries filtrerer altid `deleted_at: null`.
- **Audit:** `AuditLog` m. `changes` (JSON), `sensitivity`, `ip_address`, og dedikeret `(organization_id, resource_company_id, created_at)`-index til den RBAC-scopede aktivitetsfeed.
- **Danske enum-værdier:** ASCII-identifiers med danske tegn via `@map()` (fx `UDLOEBET @map("UDLOBET")`).

> Fuld kolonne-for-kolonne-skema (felter, typer, relationer, indekser): se **`DATABASE-SCHEMA.md`** + den autoritative `prisma/schema.prisma`. Denne kravspec holder datamodellen på struktur-/relations-niveau bevidst — ikke en DDL-kopi.

---

## 6. AI-arkitektur

AI gates i tre lag overalt: global env-flag → `isAIEnabled(orgId, feature)` → plan-gate (`plan === 'plus'`) → cost-cap/reservation.

### 6.1 Funktioner

| Funktion                 | LLM?    | Hvad                                                                                              | Gating                                                |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Dokument-ekstraktion** | Ja      | Multi-pass pipeline udtrækker typede felter fra PDF/DOCX til strukturerede data                   | `isAIEnabled('extraction')` **+ plan=plus**           |
| **Selskabs-AI-indsigt**  | Ja      | 0–5 rolle-scopede alerts + 1 strategisk indsigt pr. selskab; cachet 24t                           | `isAIEnabled('insights')` + cost-cap                  |
| **Assistent-chat**       | Ja      | Samtale-assistent m. læse-værktøjer + skrive-værktøjer (menneske-bekræftede `PendingAction`s)     | `isAIEnabled('assistant')` **+ plan=plus**            |
| **Entitets-matching**    | Ja      | Matcher ekstraheret indhold mod kendte selskaber/personer (CVR/navn)                              | `isAIEnabled('entity_matching')` (i ekstraktions-job) |
| **Autofill**             | **Nej** | Foreslår feltværdier fra CVR-API / interne selskaber / tidligere ekstraktioner (ingen model-kald) | kun `canAccessModule('companies')`                    |
| **Person-AI**            | **Nej** | Læser allerede-ekstraherede kontraktfelter for en persons kontrakter                              | ingen AI-gate                                         |
| **Portfolio-scan**       | **Nej** | Regel-baserede `Alert`-rows (deadlines, manglende docs, forfald); dagligt 06:00 UTC               | ingen                                                 |

### 6.2 Pipeline & kø

- **Kø:** `pg-boss` (`EXTRACT_DOCUMENT='extraction.full'`, `PORTFOLIO_SCAN='alerts.portfolio-scan'`), via `DIRECT_URL`.
- **Worker:** standalone proces (`worker/index.ts`) der kører ekstraktions-jobs; graceful shutdown.
- **Ekstraktions-pipeline (6 passes):** type-detektion (gpt-5-nano) → skema-ekstraktion (gpt-5-mini, temp 0.2) → konfidens-gated 2. kørsel → kilde-verifikation → sanity-checks → kryds-validering → entitets-matching. Checkpointing/resume via `pipeline_checkpoint`; SHA-256 content-hash-dedup genbruger identiske re-uploads.

### 6.3 OpenAI-klient — central nøgle

- **Én central nøgle** fra `env.OPENAI_API_KEY` for hele platformen — **ingen per-org nøgle**. Kunderne kører på platformens (din) konto.
- **Responses API** + structured outputs (strict json_schema). Modeller: `gpt-5-nano` / `gpt-5-mini` / `gpt-5`.
- **`OPENAI_BASE_URL`-override** → kan pege på OpenAIs **EU-endpoint** (`eu.api.openai.com`) for EU-dataresidens. ⚠️ Det er IKKE bare et URL-skift: kræver (1) forhåndsgodkendelse af OpenAI sales, (2) godkendt abuse-monitoring + en **Zero Data Retention-tillægsaftale** (påkrævet for enhver ikke-US-region), (3) et projekt oprettet med EU-region, og (4) `eu.api.openai.com`-prefix på hvert kald. ~10% pris-tillæg for residency-modeller. Standard er `api.openai.com`. Relevant for GDPR — se afsnit 7.2. (Verificeret mod OpenAI-docs 20-06-2026.)

### 6.4 Per-organisation styring (`OrganizationAISettings`)

| Felt                   | Default | Funktion                                                                                                   |
| ---------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `ai_mode`              | `OFF`   | OFF/SHADOW/LIVE/BETA — tænd/sluk pr. kunde                                                                 |
| `monthly_cost_cap_usd` | **$50** | Loft; `checkCostCap` blokerer ved overskridelse (race-sikker `reserveAIBudget` i SERIALIZABLE-transaktion) |
| `rate_limit_per_day`   | 1000    | _(se afsnit 10 — ikke håndhævet som reel daglig limiter)_                                                  |
| `kill_switch`          | false   | Nødstop                                                                                                    |

Brug logges pr. kald i `AIUsageLog` (tokens, `cost_usd`, feature, model — **intet prompt-indhold**). Det reelle upload-rate-limit er en separat in-memory token-bucket (10/min/org).

### 6.5 Menneske-i-løkken review

Route `documents/review/[id]`: split-layout (kilde-preview + felter grupperet i "Kræver opmærksomhed" / "Manglende klausuler" / "Høj konfidens · auto-godkendt"). Per-felt-beslutninger (`use_ai`/`keep_existing`/`manual`/…) skrives til `AIFieldCorrection` (ai_value vs user_value — feedback-loop). Godkend er låst til alle opmærksomheds-felter er afgjort.

---

## 7. Ikke-funktionelle krav

### 7.1 Sikkerhed (`src/proxy.ts` middleware)

- **CSP m. per-request nonce**, `strict-dynamic`, allowlistet `connect-src` (Sentry/Supabase/Stripe/PostHog), `frame-ancestors 'none'`.
- **PUBLIC_PATHS-allowlist** (`/`, `/pricing`, `/kontakt`, `/status`, `/legal`, `/docs`, `/terms`, `/privacy`, `/login`, `/signup`, `/invite`, `/reset-password`); alt andet kræver session → redirect til login. **Nye offentlige routes skal tilføjes her.**
- **Cron Bearer-token-auth** (`DIGEST_CRON_SECRET`), constant-time-sammenligning. OAuth-signup rate-limit (3/t/IP).
- Multi-tenancy håndhævet på alle queries; bcrypt password-hashing; login afvises hvis email matcher >1 tenant; `jwtCallback` re-validerer `active`/`deleted_at` på **hver request** (deaktiverede brugere mister adgang straks).

### 7.2 GDPR / compliance

- **Data-eksport:** CSV pr. entitet, fuld org-backup (ZIP), og **GDPR Art. 15-bundle pr. person** (`/api/export/gdpr/[personId]`, admin-only, `no-store`, audit før fetch).
- **Soft-deletes** på alle persondata; aldrig hard-delete på kontrakter/sager/selskaber/personer/dokumenter.
- **Samtykke:** cookie-banner (localStorage `chainhub-cookie-consent`) driver PostHog opt-in/out; tilbagetræknings-UI i indstillinger.
- **Art. 28-bevis:** `Organization.terms_accepted_at` + `dpa_accepted_at` sættes ved signup.
- **Legal-sider:** `/legal/{cookies,vilkaar,databehandleraftale,privatliv}`.
- **Underdatabehandlere:** OpenAI (EU-residens muligt men gated — kræver ZDR-aftale + EU-projekt, se afsnit 6.3), Supabase, Resend, Vercel, Sentry, Upstash, Stripe — skal alle fremgå af databehandleraftalen. **NB:** uden EU-residens-opsætningen behandles AI-data som udgangspunkt i US → relevant for DBA + privatlivspolitik.

### 7.3 Performance & tilgængelighed

- Server-side pagination overalt; React `cache()` på rolle-opslag; `unstable_cache` på tunge aggregeringer.
- **A11y:** WCAG 2.1 AA-mål; axe-core via Playwright (10 top-sider + 5 detaljesider, fejler på critical/serious); `eslint-plugin-jsx-a11y`.

### 7.4 Multi-tenancy & kodekvalitet

- `organization_id` på alle queries (CLAUDE.md-regel, tenant-isolation-tests). TS strict + no-`any`. Zod på al input. `ActionResult<T>`-mønster.

---

## 8. Integrationer & drift

### 8.1 Stripe

Webhook (`/api/webhooks/stripe`) verificerer signatur + idempotens via `ProcessedStripeEvent`; håndterer checkout/subscription/invoice-events. Checkout + Customer Portal via actions. Klient returnerer `null` når ukonfigureret (graceful).

### 8.2 Resend

Invitation/reset/kontakt-mails + daglig digest-cron (forfaldne/kommende opgaver, udløbende kontrakter 7/30/90-dage). BOM-strip på nøglen (defensiv mod build-crash).

### 8.3 Upstash Redis

Login-rate-limit (5/15m) + OAuth-signup (3/t) — sliding windows. In-memory fallback (dev-only, advarer eksplicit). **Sikkerhedskritisk → altid påkrævet i prod.**

### 8.4 Supabase/PostgreSQL + Prisma

Singleton-klient; pooled vs direct URL-split.

### 8.5 Filstorage

`local` (default) eller R2 via `STORAGE_PROVIDER`; magic-bytes-validering på upload.

### 8.6 NextAuth 5 + Google

JWT 8t; Credentials + valgfri Google (auto-org-oprettelse + 14-dages trial).

### 8.7 PostHog

Samtykke-gated analytics.

### 8.8 Deploy

Vercel auto-deploy fra master (Git-integration; intet GitHub Actions deploy-job). Region `fra1`. Én cron: `POST /api/cron/daily-digest` kl. 06:00 UTC. `prisma generate` ved install (postinstall).

### 8.9 Staged launch (`src/lib/env.ts`)

`STAGED_LAUNCH = true` (hardcoded). Gør i prod **valgfrit**: `OPENAI_API_KEY`, `DIGEST_CRON_SECRET`, alle `STRIPE_*` (lazy+guarded → "slukket" til nøgler sættes). **Altid påkrævet** uanset staged-launch: `DATABASE_URL`, `NEXTAUTH_SECRET/URL`, **`UPSTASH_*`** (sikkerhedskontrol). ⚠️ Sæt `STAGED_LAUNCH = false` før første betalende kunde.

### 8.10 Priser (`src/lib/pricing.ts`)

| Plan           | Pris                           | Noter                                        |
| -------------- | ------------------------------ | -------------------------------------------- |
| **Basis**      | 3.500 kr./md                   | Alle kernemoduler                            |
| **Plus**       | 9.500 kr./md                   | + AI (50 ekstraktioner inkl., 75 kr./ekstra) |
| **Enterprise** | fra 32.000 kr./md (forhandles) | fair-use 500 ekstraktioner/md                |

Onboarding-gebyr: 1 kr./dokument ved import (max 2.500 kr.). Salg via demo — ingen self-service.

---

## 9. Test & kvalitet

- **Unit:** Vitest — ~2.257 test-assertions over 164 filer (`src/__tests__/`).
- **E2E:** Playwright — 13 specs (auth, companies, cases, contracts, persons, tasks, settings, search, billing, public, a11y, keyboard-nav). Kører i container + Postgres-service; **gater nu master/PR** (fixet 20-06).
- **CI:** 3 jobs (lint+tsc+vitest / build / e2e), Node 24.
- **Observability:** Sentry (DSN-gated, stripper cookie/auth-headers), `/api/health` (DB SELECT 1).

---

## 10. Kendte afvigelser (as-built ærlighed)

Dokumenteret så intet er skjult:

1. **Ingen Enterprise-tier i AI-koden** — kun `plan === 'plus'` gates. Prissiden viser Enterprise, men kode-gating skelner ikke Plus/Enterprise. _Skal lukkes før Enterprise-salg._
2. **`rate_limit_per_day` håndhæves ikke** som reel daglig limiter — kun et display-tal i indstillinger. Reel beskyttelse er in-memory 10/min upload-bucket (ikke Redis → svag i serverless multi-instans).
3. **`PORTFOLIO_SCAN` har ingen worker-consumer** i `worker/index.ts` — jobbet schedules men køres kun direkte i tests.
4. **Microsoft 365/Outlook-integration findes ikke** (den gamle spec lovede det) — auth er Google, email er Resend.
5. **`AIUsageLog.provider`-kommentar siger 'anthropic'/'bedrock'**, men koden skriver `'openai'` (kosmetisk; env er autoritativ).
6. **Upload-kommentar nævner "Anthropic"** — leverandøren er OpenAI.

---

## 11. Afgrænsning / ikke bygget (Fase 2)

E-signatur (Penneo), ekstern partner-portal (EXTERNAL\_\*-roller), regnskabs-integration (e-conomic/Billy), generalforsamlings-modul, mobil-app, avanceret BI. AI-kontraktanalyse er **bygget** (ikke længere Fase 2).

---

## Changelog

```
v3.0 (2026-06-20): Komplet as-built-omskrivning verificeret mod kode (4-agent
   kodebase-mapping). Afløser kravspec-legalhub.md v2.3. Rettet: tech stack
   (Next 16, NextAuth 5 + Google, INGEN Microsoft), priser (flat 3.500/9.500/
   32.000 ikke per-seat), AI flyttet fra Fase 2 → bygget kerne. Tilføjet: AI-
   arkitektur, sikkerhed/CSP, GDPR/eksport, staged-launch, test/CI, datamodel
   (33 tabeller/35 enums), afsnit 10 kendte afvigelser.
   Tilføjet senere s.d.: afsnit 3A Kerne-flows (6 as-built proces-flows),
   DB-schema-link i afsnit 5, og præciseret OpenAI EU-residens (ikke et
   simpelt URL-skift — kræver OpenAI-godkendelse + Zero Data Retention-aftale
   + EU-projekt; verificeret mod OpenAI-docs).
Tidligere historik: se kravspec-legalhub.md.
```

_KRAVSPEC-CHAINHUB-2026-06.md v3.0 — as-built reference_
