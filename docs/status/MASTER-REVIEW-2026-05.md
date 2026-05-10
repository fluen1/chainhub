# ChainHub Master Review — 2026-05-10

**Type:** Audit + fix-runde. Besvarer "er ChainHub klar til pilot-kunde?" på fem akser: side-for-side, UI/UX, kommercielt, redundans, arkitektur.

**Forrige audit:** `docs/status/PAGE-AUDIT-2026-04.md` (2026-04-18, 687 linjer, tech-fokuseret). Mange high-severity items er siden lukket via Mobile + Empty-states-track, Compliance + Data-export-track, Onboarding + UX Polish-track, R2 storage og axe-core CI.

**Spec:** `docs/superpowers/specs/2026-05-10-master-review-design.md`

---

## 1. Eksekutiv opsummering

_Skrives sidst — opsamler alle fund_

---

## 2. Arkitektonisk overblik

### 2.1 Repository-træ (top-level)

```
chainhub/
├── src/                    # Applikationskode (se 2.2)
├── prisma/                 # Schema, migrationer, seed
├── docs/                   # Spec, build-konventioner, status
│   ├── spec/               # Krav, schema, RBAC, contract-typer
│   ├── build/              # Conventions, sprint-plan, learnings, AI-cost-model
│   ├── status/             # Progress, blockers, decisions, audits (denne fil)
│   └── superpowers/        # Design-specs + execution-plans
├── scripts/                # Engangs-scripts (cost-research, seed-helpers)
├── tests/                  # Playwright E2E + a11y
├── worker/                 # pg-boss worker-proces (extract-document)
├── uploads/                # Lokal storage (dev) — erstattes af R2 i prod
├── screenshots/            # Playwright snapshots
├── instrumentation.ts      # Sentry instrumentation entry
├── sentry.{client,server,edge}.config.ts
└── tsconfig.worker.json    # Standalone worker build
```

### 2.2 src/-træ

```
src/
├── app/                              # Next.js App Router
│   ├── (auth)/login/                # NextAuth login-side
│   ├── (dashboard)/                 # Beskyttede routes (24 sider, se afsnit 3)
│   │   ├── layout.tsx               # AppSidebar + AppHeader + MobileSidebarWrapper
│   │   ├── dashboard/               # Portefølje-overblik (timeline + heatmap)
│   │   ├── companies/               # Selskaber (liste + detalje single-page)
│   │   ├── contracts/               # Kontrakter (liste + detalje + upload)
│   │   ├── cases/                   # Sager (liste + detalje + opret)
│   │   ├── tasks/                   # Opgaver (liste + detalje + kanban)
│   │   ├── persons/                 # Personer (HR-view + GDPR-panel)
│   │   ├── documents/               # Dokumentliste + AI review-UI
│   │   ├── visits/                  # Besøg (kun new + detalje; liste ligger på /calendar)
│   │   ├── calendar/                # Tværgående kalender
│   │   ├── search/                  # Global søgning (6 entitetstyper)
│   │   └── settings/                # Org + brugere + AI-usage
│   ├── api/                         # 9 endpoints (auth, upload, cron, export)
│   ├── global-error.tsx             # Top-level error boundary
│   └── globals.css                  # Tailwind + print-stylesheet
│
├── actions/                          # Server Actions (25 filer, primært CRUD)
│   # Pattern: session-check → Zod → permission → DB → revalidatePath → ActionResult<T>
│
├── components/                       # React-komponenter
│   ├── ui/                          # Genbrugelige primitiver (24 filer)
│   ├── layout/                      # AppSidebar, AppHeader, MobileSidebarWrapper, SkipToMain
│   ├── company-detail/              # 11 sektioner til /companies/[id] single-page
│   ├── task-detail/                 # 5 sektioner til /tasks/[id] single-page
│   ├── dashboard/                   # heatmap-grid, timeline-section, onboarding-panel
│   ├── companies/, contracts/, cases/, tasks/, persons/, visits/, finance/,
│   │   documents/, comments/, calendar/, settings/  # Modul-komponenter (forms etc.)
│   └── providers.tsx                # Toaster + andre client-providers
│
├── lib/                              # Forretningslogik + helpers
│   ├── auth/                        # NextAuth config
│   ├── db/                          # Prisma singleton
│   ├── permissions/                 # canAccessCompany/Sensitivity/Module
│   ├── validations/                 # Zod schemas pr. modul (8 filer)
│   ├── ai/                          # AI-pipeline (se 2.3)
│   ├── company-detail/, task-detail/  # Pure helpers per detail-page
│   ├── export/                      # CSV/JSON/ZIP + GDPR Article 15/17
│   ├── storage/                     # StorageProvider (LocalStorage + R2)
│   ├── notifications/, email/       # Daily digest (Resend)
│   ├── search/                      # Search constants
│   ├── labels.ts                    # 43 enums → dansk labels (single source of truth)
│   ├── nav-config.ts                # NAV_SECTIONS + NAV_ITEMS (sidebar + mobile)
│   ├── action-helpers.ts            # withActionLogging wrapper
│   ├── audit.ts                     # recordAuditEvent helper
│   ├── logger.ts                    # Pino structured logger + captureError
│   ├── pagination.ts, dashboard-helpers.ts, date-helpers.ts,
│   │   calendar-constants.ts, sidebar-data.ts, zod-enums.ts,
│   │   geocode.ts, utils.ts         # Domain helpers
│
├── types/                            # ActionResult<T>, UI types (NavItem, KpiCard, etc.)
└── __tests__/                        # Vitest unit-tests (mock-baseret pr. action)
```

### 2.3 AI-modul (`src/lib/ai/`)

```
ai/
├── client/                  # Provider-abstraktion
│   ├── anthropic-direct.ts # Anthropic API-klient (current)
│   ├── index.ts            # Factory (env-switchable Direct ⇄ Bedrock når implementeret)
│   └── types.ts            # ClaudeClient interface
├── jobs/                    # Background-jobs
│   ├── company-insights.ts # /companies/[id] AI insight-kort (24h cache)
│   ├── extract-document.ts # PDF → strukturerede felter (5-pass pipeline)
│   └── extract-document-poc.ts  # Tidlig POC — kandidat til sletning?
├── pipeline/                # 5-pass extraction
│   ├── pass1-type-detection.ts
│   ├── pass2-schema-extraction.ts
│   ├── pass3-source-verification.ts (bruger fastest-levenshtein)
│   ├── pass4-sanity-checks.ts
│   ├── pass5-cross-validation.ts
│   ├── orchestrator.ts     # Sekventér passes
│   ├── confidence.ts       # Konfidens-score
│   └── types.ts
├── schemas/                 # Zod-schemas pr. kontrakttype
│   ├── ansaettelseskontrakt.ts, ejeraftale.ts, lejekontrakt.ts,
│   │   driftsaftale.ts, forsikring.ts, vedtaegter.ts, minimal.ts
│   ├── registry.ts         # Type → schema lookup
│   └── types.ts
├── review/
│   └── existing-values.ts  # Fetch eksisterende felter til review-UI
├── cache-control.ts         # Anthropic prompt-caching (5min TTL)
├── content-hash.ts          # Idempotens på extraction-jobs
├── content-loader.ts        # PDF/DOCX text extraction
├── cost-cap.ts              # Monthly USD cap pr. organisation
├── feature-flags.ts         # isAIEnabled(org, feature)
├── feedback.ts              # Korrektioner → prompt-tuning input
├── invalidate-cache.ts      # Bust CompanyInsightsCache
├── logger.ts                # Pino-pretty disabled i RSC (BLK-004 fix)
├── queue.ts                 # pg-boss send-helper
├── rate-limit.ts            # Per-org rate limit
└── usage.ts                 # recordAIUsage + getMonthlyUsage
```

### 2.4 Data-flow (request → respons)

```
[Browser]
  │   form action / link / fetch
  ▼
[Next.js route] (src/app/.../page.tsx eller route.ts)
  │   1. Server Component eller Route Handler
  │   2. getServerSession() → bruger + organizationId
  ▼
[Server Action] (src/actions/<modul>.ts)
  │   1. Session-check (return error hvis null)
  │   2. Zod-validering på input
  │   3. Permission-check (canAccessCompany/Sensitivity/Module)
  │   4. withActionLogging wrapper (duration + Sentry on throw)
  ▼
[Prisma] (src/lib/db.ts)
  │   1. Query med organization_id + deleted_at: null
  │   2. PostgreSQL via PgBouncer (Supabase port 6543)
  ▼
[Side-effects]
  │   • recordAuditEvent (audit.ts) — fire-and-forget, sluger fejl
  │   • recordAIUsage (ai/usage.ts) — hvis AI-kald
  │   • storage.upload (storage/) — hvis filer
  │   • boss.send (ai/queue.ts) — hvis async-job (extraction)
  │   • captureError (logger.ts → Sentry) — på fejl
  ▼
[Cache invalidation]
  │   revalidatePath('/path') — kun cache der faktisk berøres
  ▼
[Return]
  │   ActionResult<T> = { ok: true, data } | { ok: false, error }
  ▼
[Client/Server Component]
  │   • Server Component: ny render-pass
  │   • Client Component: useTransition + toast.error/success
  ▼
[Browser-render]
```

### 2.5 Navigations-træ (sidebar + URL)

```
┌─ Top (Sidebar header)
│  └─ Søg (/search)              [globalt, alle entitetstyper]
│
├─ OVERBLIK
│  ├─ Dashboard (/dashboard)      [urgency + timeline + heatmap]
│  └─ Kalender (/calendar)        [tværgående events]
│
├─ PORTEFØLJE
│  ├─ Selskaber (/companies)      [→ /companies/new, /companies/[id]]
│  ├─ Kontrakter (/contracts)     [→ /contracts/new, /contracts/[id]]
│  ├─ Sager (/cases)              [→ /cases/new, /cases/[id]]
│  └─ Opgaver (/tasks)            [→ /tasks/new, /tasks/[id]]
│
├─ RESSOURCER
│  ├─ Dokumenter (/documents)     [→ /documents/review/[id] (AI Plus-tier)]
│  └─ Personer (/persons)         [→ /persons/new, /persons/[id] m. GDPR-panel]
│
└─ Bottom
   └─ Indstillinger (/settings)   [→ /settings/users, /settings/ai-usage]

Skjult fra sidebar:
   /visits/new, /visits/[id]      [kun nået via /calendar eller /companies/[id]]
```

**Observationer på navigation:**

- Sidebar er ren og hierarkisk — 3 grupper a 2-4 items + Søg + Indstillinger
- Mobile-nav (drawer) er flad liste med samme items + Søg + Indstillinger
- `/visits` har ingen entry i sidebaren (slettet i Plan 4D 2026-04-18) — al adgang via kalender
- `/dashboard/right-panels.tsx` er ikke route, men client-component der lever ved siden af `page.tsx`

---

## 3. Side-for-side review

_Score-rubric: 5=send-it · 4=næsten klar · 3=funktionel m. tydeligt hul · 2=risiko · 1=skjul_
_Kommerciel rolle: **wow**=overbeviser i demo · **nyttig**=daglig brug · **infra**=skal bare virke · **skjult**=bag detail-sider_
_Tier: B=Basis · +=Plus · ++=Enterprise_

### Resumé-tabel

| #   | Side                   | Score | Tier     | Rolle   | Kommentar                                                                                                            |
| --- | ---------------------- | ----: | -------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | /dashboard             | **4** | B        | **wow** | Print-stylesheet ✅, mobile responsive ✅, empty-states ✅. Mangler: rolle-test (har kun GROUP_OWNER-flow valideret) |
| 2   | /companies             | **4** | B        | **wow** | Map+list+rail responsive ✅. Mangler: 0-totalt empty-state, kort-view density                                        |
| 3   | /companies/[id]        | **5** | B (++AI) | **wow** | Plan 4C reference. AI Insight kommercielt definerende for Plus/Ent                                                   |
| 4   | /companies/new         | **4** | B        | infra   | Form max-w-3xl + 2-kol ✅ (Onboarding-track). Mangler kun visuel polish                                              |
| 5   | /contracts             | **3** | B        | nyttig  | Liste + chart, mangler 0-totalt empty-state + mobile card-stack                                                      |
| 6   | /contracts/[id]        | **3** | B (++AI) | nyttig  | Terms-grid responsive ✅. AI-extractions vises IKKE her — kun via /persons og /documents/review. **Hul**             |
| 7   | /contracts/new         | **4** | B        | infra   | Form opgraderet (Onboarding-track)                                                                                   |
| 8   | /cases                 | **4** | B        | nyttig  | Empty-states ✅. Mobile card-stack mangler                                                                           |
| 9   | /cases/[id]            | **5** | B        | nyttig  | Reference for responsive 2-col. Send-it                                                                              |
| 10  | /cases/new             | **4** | B        | infra   | Form opgraderet                                                                                                      |
| 11  | /tasks                 | **4** | B        | nyttig  | 3 view-modes (flat/grouped/kanban). Kanban-keyboard a11y ✅. Mobile-kanban: horizontal-scroll mangler                |
| 12  | /tasks/[id]            | **5** | B        | nyttig  | TaskHistory + comments + edit-dialog. Send-it                                                                        |
| 13  | /tasks/new             | **4** | B        | infra   | Form opgraderet, pre-filled fra calendar/case                                                                        |
| 14  | /persons               | **3** | B        | nyttig  | Kort-view stadig sparse (`p-5` med få datapunkter). Tabel-view OK                                                    |
| 15  | /persons/[id]          | **3** | B (+AI)  | **wow** | AI-extractions-section ✅ (B.1c). Men `max-w-4xl` trang, og linje 290 grid stadig non-responsive                     |
| 16  | /persons/new           | **4** | B        | infra   | Form opgraderet                                                                                                      |
| 17  | /documents             | **3** | B        | nyttig  | Filter-pill-row + liste. Empty-state og density-fix svag                                                             |
| 18  | /documents/review/[id] | **4** | +        | **wow** | Phase B.1b A+ leverance — pilot-ready review-UI. Desktop-only (split-view bryder <1024px)                            |
| 19  | /visits/new            | **4** | B        | skjult  | Form opgraderet                                                                                                      |
| 20  | /visits/[id]           | **5** | B        | skjult  | Plan 4C-konform 2-col responsive                                                                                     |
| 21  | /calendar              | **3** | B        | nyttig  | Erstatter /visits-listen. Måneds-grid bryder <400px — agenda-fallback mangler                                        |
| 22  | /search                | **5** | B        | nyttig  | 6 entitetstyper, sektioneret, dashed empty-state                                                                     |
| 23  | /settings              | **3** | B        | infra   | User-tabel + org-form + system-grid. System-grid halvtom (kun AI-usage-link)                                         |
| 24  | /settings/users        | **4** | B        | infra   | (Linket fra /settings — overlapper indholdsmæssigt med /settings user-tabel)                                         |
| 25  | /settings/ai-usage     | **4** | + / ++   | infra   | Cap-bar + breakdown. Kun relevant for Plus/Enterprise (Basis ser ingen AI-data)                                      |

**Gennemsnit pilot-readiness: ~3,9 / 5**

### Detaljer pr. side (kun hvor opdatering siden 2026-04 audit eller ny vinkel er relevant)

#### /dashboard — Score 4

**Status efter delta-tracks:** Mobile-grid responsive ✅ (`lg:grid-cols-[1fr_320px]`), print-stylesheet ✅ (`globals.css` + page.tsx:38), 7 sektioner har empty-states ✅, onboarding-panel ✅, positiv "Alt under kontrol"-empty-state ✅.

**Resterende:**

- Roll-adaptive paneler er kun valideret for GROUP_OWNER. GROUP_LEGAL og GROUP_FINANCE har egne `RightPanels`-grene men er ikke walked-through.
- Visuel rytme: Timeline + 320px right-rail er meget vertikal. Mangler en "puls" mellem tunge sektioner og rolige sektioner.

**Kommercielt:** Det vigtigste demo-skærmbillede. Ved første demo skal kunden se urgency-items + rolle-tilpasning + heatmap inden for 5 sek.

#### /companies — Score 4

**Status:** Map+list+right-rail responsive ✅ (`lg:grid-cols-[1fr_340px]`).

**Resterende:**

- 0-totalt empty-state mangler — ny kunde efter onboarding ser stadig potentielt tom map + tom liste uden CTA
- Kort-view density (linje 618: `grid grid-cols-2 gap-2.5`) kan være sparse på små portfolios

**Kommercielt:** Anden vigtigste demo-side efter dashboard. Her sælges "ét overblik over alle lokationer".

#### /companies/[id] — Score 5

**Status:** Single-page Plan 4C med 8 sektioner + AlertBanner + sticky header. Responsive ✅. AI Insight-kort med 24h cache ✅.

**Kommercielt:** Definerende side for Plus/Enterprise — AI Insight er det første kunden ser hvor "AI tilfører noget". Uden dette er der intet visuelt skifte mellem Basis og Plus.

#### /contracts/[id] — Score 3

**Status:** Terms-grid responsive ✅ (`sm:grid-cols-2 + lg:grid-cols-[180px_1fr]`).

**Hul:** AI-extractions fra ekstraheret kontrakt vises IKKE her, kun via `/persons/[id]` (B.1c) eller `/documents/review/[id]`. Det er en kommerciel uoverensstemmelse — bruger åbner en kontrakt, ikke en person, for at se kontrakt-felter. **Pilot-blocker for Plus-tier**.

#### /persons/[id] — Score 3

**Status:** AI-extractions-section ✅ (B.1c).

**Resterende:**

- `max-w-4xl` trang for desktop (ingen 2-col layout udnyttelse)
- Linje 290 `grid grid-cols-2` mangler responsive prefix — bryder på små skærme
- Person-detail er stadig delvist HR-orienteret. Ikke al rolle-info er tydelig (ejer vs medarbejder skift)

#### /documents/review/[id] — Score 4

**Status:** Phase B.1b A+ leverance (commit 34bca10). Pilot-ready review-UI med saveFieldDecision + manualValue + rejectDocumentExtraction + schema-metadata.

**Resterende:**

- Split-view bryder <1024px — desktop-only banner mangler
- Skal valideres efter første rigtige extraction (gold-standard data)

**Kommercielt:** Den vigtigste Plus-tier-side. Hvis denne ikke fungerer er hele AI-værdien død.

#### /persons (liste) — Score 3

**Status:** Kort/tabel-toggle, employees/all-toggle, EmptyState defined.

**Resterende:** Kort-layout (`p-5` + få datapunkter) ser sparse på desktop. Kunne komprimere email/phone som ikoner og vise selskab-counts i en chip-row.

#### /documents — Score 3

**Status:** Empty-state retrofit ✅ (compact + slate). Filter-pill-row + liste.

**Resterende:** Liste-layout udnytter ikke confidence-badge + attention-fields tydeligt. Reviewer ser tabel-data, ikke "her skal du kigge først".

#### /settings — Score 3

**Status:** Backup-knap ✅, organisations-form ✅.

**Resterende:** System-sektion (`grid sm:grid-cols-2`) har kun ét kort (AI-usage) → halvtom. Enten fyld med flere links eller kollapsi.

**Redundans-flag:** /settings og /settings/users overlapper — /settings har user-tabel som også er hovedindhold på /settings/users. Skal én af dem fjernes?

#### /calendar — Score 3

**Status:** FullCalendar med side-panel for selectedDay.

**Resterende:** Måneds-grid bryder <400px. Mangler agenda-list-fallback for mobile.

**Redundans-flag:** Erstatter `/visits`-list-page (slettet i Plan 4D 2026-04-18). Inkonsistens: /visits/new findes som standalone route mens /visits/[id] kun nås fra calendar — sidebar har ingen "Besøg" entry længere.

---

## 4. Redundans-katalog

### 4.1 Dead code — komponenter ikke importeret nogen steder

Verificeret med grep mod `from .*<komponent-navn>` i `src/`:

| #   | Fil                                                 | Erstattet af                                               | Sletbart     |
| --- | --------------------------------------------------- | ---------------------------------------------------------- | ------------ |
| 1   | `src/components/companies/EditCompanyForm.tsx`      | `company-detail/edit-stamdata-dialog.tsx`                  | ✅           |
| 2   | `src/components/companies/CompanyStatusBadge.tsx`   | _ingen — uused_                                            | ✅           |
| 3   | `src/components/companies/EmployeeList.tsx`         | `company-detail/persons-section.tsx` (pure read-only)      | ⚠ se 4.3     |
| 4   | `src/components/companies/CompanyPersonList.tsx`    | `company-detail/persons-section.tsx`                       | ⚠ se 4.3     |
| 5   | `src/components/companies/OwnershipList.tsx`        | `company-detail/ownership-section.tsx`                     | ⚠ se 4.3     |
| 6   | `src/components/companies/OwnershipListNew.tsx`     | `company-detail/ownership-section.tsx`                     | ⚠ se 4.3     |
| 7   | `src/components/companies/AddCompanyPersonForm.tsx` | _intet — handling fjernet fra UI_                          | ⚠ se 4.3     |
| 8   | `src/components/companies/AddOwnerForm.tsx`         | _intet — handling fjernet fra UI_                          | ⚠ se 4.3     |
| 9   | `src/components/contracts/ContractList.tsx`         | inline list i `contracts-client.tsx`                       | ✅           |
| 10  | `src/components/contracts/ContractStatusForm.tsx`   | _ikke fundet erstatning_                                   | 🔍           |
| 11  | `src/components/contracts/UploadVersionForm.tsx`    | _intet — handling fjernet fra UI_                          | ⚠ se 4.3     |
| 12  | `src/components/cases/CaseList.tsx`                 | inline tabel i `cases/page.tsx`                            | ✅           |
| 13  | `src/components/documents/DocumentList.tsx`         | `documents-client.tsx`                                     | ✅           |
| 14  | `src/components/finance/FinanceList.tsx`            | `company-detail/finance-section.tsx` (read-only)           | ⚠ se 4.3     |
| 15  | `src/components/finance/AddMetricForm.tsx`          | _intet — handling fjernet fra UI_                          | ⚠ se 4.3     |
| 16  | `src/components/layout/mobile-nav.tsx`              | `mobile-sidebar-wrapper.tsx` (Mobile + Empty-states track) | ✅           |
| 17  | `src/lib/ai/jobs/extract-document-poc.ts`           | `extract-document.ts` (Phase A.0)                          | ⚠ tjek tests |

**Sletbart med det samme (✅, 6 stk):** `EditCompanyForm`, `CompanyStatusBadge`, `ContractList`, `CaseList`, `DocumentList`, `mobile-nav.tsx`.

**Kræver beslutning (⚠, 11 stk):** Sletes som dead code, men afslører manglende UI-wiring (se 4.3).

### 4.2 Dead-action-kandidater

| Action                                     | Bruges i                  | Status                                               |
| ------------------------------------------ | ------------------------- | ---------------------------------------------------- |
| `getContractList` (`actions/contracts.ts`) | Kun unit-tests            | Kandidat til sletning eller wire til /contracts side |
| `extract-document-poc.ts` (job)            | Worker + integration test | POC bør slettes nu vi har real `extract-document.ts` |

### 4.3 ⚠ KRITISK — Manglende UI-wiring (P0 pilot-blocker)

Plan 4C/4D omskrev `/companies/[id]` til single-page med READ-ONLY sektioner. Server actions findes stadig, men ingen UI når dem længere:

| Server action                                           | Hvad den gør                          | UI-status                              |
| ------------------------------------------------------- | ------------------------------------- | -------------------------------------- |
| `addOwner` (`actions/ownership.ts`)                     | Tilføj ejer til selskab               | ❌ Ingen knap                          |
| `endOwnership`                                          | Slut ejerskab på dato                 | ❌ Ingen knap                          |
| `addCompanyPerson` (`actions/governance.ts`)            | Tilføj medarbejder/person til selskab | ❌ Ingen knap                          |
| `endCompanyPerson`                                      | Slut role på person                   | ❌ Ingen knap                          |
| `addMetric` (`actions/finance.ts`)                      | Tilføj finansiel KPI til selskab      | ❌ Ingen knap                          |
| Upload kontraktversion (`actions/contract-versions.ts`) | Upload ny version af kontrakt         | ❌ `UploadVersionForm` ikke importeret |

**Effekt på pilot:** Kunde opretter selskab via `/companies/new`. På `/companies/[id]` kan de _se_ ejerskab, medarbejdere og finans, men ikke _tilføje_ noget. Onboarding er teknisk umulig fra UI uden at skrive direkte i Prisma.

**Workaround:** Seed-data, men det er pilot-blocker.

### 4.4 Konkurrerende UI-mønstre

**Empty states:** Single source ✅ — `components/ui/empty-state.tsx` med `variant="compact"` + `theme="slate"`. Konsistent på tværs efter Mobile + Empty-states og Onboarding-tracks.

**Single-page detail-sider:** Konsistent ✅ — alle `/[id]`-sider følger Plan 4C-mønster (header + sticky breadcrumb + sektionerede 2-col grids + lokal Edit-dialog).

**Forms:** Konsistent ✅ — alle 6 Create-forms ligner hinanden efter Onboarding-track (`max-w-3xl`, 2-kol relaterede felter, 44px tap-targets).

**Modaler:** ✅ Single source — `accessible-dialog.tsx` (focus-trap + aria-labelledby + Escape-close).

**Status-badges:** ⚠ Stadig let inkonsistent. `CompanyStatusBadge.tsx` (dead) eksisterer som standalone, men live-sider bruger inline `<span>` med `bg-*`-klasser. Ekstraktion til en fælles `<StatusBadge>`-komponent ville reducere ~12 inline-versioner.

### 4.5 Navigation-overlap

| Issue                                       | Detalje                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/settings` user-tabel vs `/settings/users` | Begge sider viser brugere. `/settings` har inline-tabel (`page.tsx:98-104`), `/settings/users` har dedicated. Skal `/settings` linke til `/settings/users` i stedet for at duplikere? |
| `/visits` ingen list-page                   | Slettet i Plan 4D — adgang kun via `/calendar`. Sidebar har ingen "Besøg"-entry. Inkonsistens: `/visits/new` er standalone route + linkbar fra calendar.                              |
| `/persons` employees vs all-toggle          | Velvalg, men den default-state (employees=true) skjuler alle non-employees uden tydeligt visuel cue.                                                                                  |

### 4.6 Doc-redundans

`docs/superpowers/specs/` har ~8 design-specs. Et par er rent historiske (Plan 4C-design, dashboard-redesign-design). De er fine som arkiv, men én root-DOC der siger _"start her for at forstå hvilken spec er aktuel"_ ville hjælpe nye sessions. **Lav prioritet.**

---

## 5. Fix-prioritering

### P0 — Pilot-blockers (skal med før første kunde)

| #    | Fix                                                                                                                   | Estimat | Kilde             |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------: | ----------------- |
| P0-1 | Wire `AddOwnerForm` til `/companies/[id]` ownership-section (eller dedikeret modal)                                   |    2-3t | 4.3               |
| P0-2 | Wire `AddCompanyPersonForm` til `/companies/[id]` persons-section                                                     |    2-3t | 4.3               |
| P0-3 | Wire `AddMetricForm` til `/companies/[id]` finance-section                                                            |    2-3t | 4.3               |
| P0-4 | Wire `UploadVersionForm` til `/contracts/[id]` (versions-historik)                                                    |    1-2t | 4.3               |
| P0-5 | Vis AI-extractions på `/contracts/[id]` (i dag kun på persons + review-UI)                                            |    4-6t | §3 contracts/[id] |
| P0-6 | End-knapper for ejerskab + company-person (`endOwnership`, `endCompanyPerson`) — minimum tilgængelige fra detail-side |    2-3t | 4.3               |

**Total P0: ~13-20 timer.** Uden disse kan en pilot-kunde ikke onboarde sig selv.

### P1 — Quick wins (denne session)

| #    | Fix                                                                                                                        | Estimat | Kilde           |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------: | --------------- |
| P1-1 | Slet 6 sikre dead-code komponenter (EditCompanyForm, CompanyStatusBadge, ContractList, CaseList, DocumentList, mobile-nav) |  30 min | 4.1             |
| P1-2 | Slet `extract-document-poc.ts` (+ poc-test)                                                                                |  15 min | 4.1             |
| P1-3 | `/persons/[id]` linje 290: tilføj `lg:grid-cols-2` for responsive                                                          |   5 min | §3 persons/[id] |
| P1-4 | `/persons/[id]` `max-w-4xl` → `max-w-6xl` (udnyt desktop)                                                                  |   5 min | §3 persons/[id] |
| P1-5 | `/settings` System-sektion: udfyld eller kollapsi til single-col                                                           |  15 min | §3 settings     |
| P1-6 | `/settings` user-tabel: link til /settings/users i stedet for duplikering                                                  |  20 min | 4.5             |

**Total P1: ~1,5 timer**, vi har plads til alle 6.

### P2 — Næste sprint (kræver dedikeret tid)

| #     | Fix                                                                                                                                                                                                         |         Estimat |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------: |
| P2-1  | `/calendar` mobile agenda-list-fallback                                                                                                                                                                     |            4-5t |
| P2-2  | `/documents/review/[id]` mobile-banner ("brug desktop")                                                                                                                                                     |          30 min |
| P2-3  | `/cases` + `/tasks` mobile card-stack under sm                                                                                                                                                              |            3-4t |
| P2-4  | `/companies` 0-totalt empty-state (ny kunde)                                                                                                                                                                |              2t |
| P2-5  | `/contracts` 0-totalt empty-state                                                                                                                                                                           |              1t |
| P2-6  | `/persons` kort-view density (komprimer email/phone)                                                                                                                                                        |            2-3t |
| P2-7  | `/documents` density: confidence-badge + attention-fields tydeligere                                                                                                                                        |            3-4t |
| P2-8  | Ekstrakt `<StatusBadge>` fra ~12 inline-versioner                                                                                                                                                           |            2-3t |
| P2-9  | Slet de 11 ⚠-markerede komponenter EFTER P0-wiring (de gamle list-varianter er overflødige når company-detail-sektionerne får edit-handling — eller behold som reference for `addX`-modal-implementeringen) | _decision-task_ |
| P2-10 | Performance-audit (Lighthouse ≥90)                                                                                                                                                                          |            4-6t |
| P2-11 | Tests for alle P0-fixes                                                                                                                                                                                     |            3-4t |
| P2-12 | Verificér rolle-adaptive dashboard (GROUP_LEGAL, GROUP_FINANCE) walked-through                                                                                                                              |            1-2t |

**Total P2: 25-35 timer** — kandidat til 1-2 ugers sprint.

### P3 — Nice-to-have (post-launch)

- WCAG 2.2 AA delta over 2.1 A
- E2E Playwright suite-udvidelse (kun a11y i dag)
- Bedrock-migration (trigges af pilot-krav)
- RAG / Søg-og-spørg
- Cross-company portfolio-insights
- Native mobile-apps
- Multi-language (engelsk)

---

## 6. Tier-vurdering kommercielt

### Basis (manuel, ingen AI)

**Nuværende tilstand:** Funktionelt et **3,5/5** — produktet kan vise data, men kunden kan ikke onboarde sig selv pga. P0-wiring-hullerne. Når P0 er fixet: solid **4/5** og pilot-klar.

**Salgsfortælling:** "Ét overblik over alle dine lokationer — kontrakter, sager, opgaver, økonomi, personer. Erstatter Excel og email-tråde."

**Demo-flow (efter P0-fix):**

1. /dashboard (urgency + onboarding-panel) → wow
2. /companies (map + portfolio) → wow
3. /companies/[id] (ét samlet selskabsbillede med ejerskab, kontrakter, sager) → wow
4. /tasks kanban + /calendar → nyttig
5. /search → demonstrer fart

### Plus (AI-assist)

**Nuværende tilstand:** **3/5** — Phase B.1a/b/c leveret (extraction-trigger, review-UI, AI-extractions på persons). MEN: AI-extractions vises ikke på /contracts/[id] (P0-5), hvor kunden naturligt vil se dem. Hul i salgsfortællingen.

**Salgsfortælling:** "Upload kontrakter — ChainHub læser løn, opsigelsesvarsel, pension, og finder mønstre du ikke selv kan se."

**Demo-flow:**

1. Plus-kunde uploader kontrakt på /contracts/[id]
2. Auto-extraction trigges (pg-boss)
3. Indenfor sek. ses AI-extracted felter med konfidens-badges
4. Klik på review-CTA → /documents/review/[id] (split-view, A+ leverance)

**Pilot-blocker:** P0-5 (vis extractions på contracts/[id]) før Plus-pilot kan startes.

### Enterprise (Full AI cross-company)

**Nuværende tilstand:** **1/5** — kun infrastruktur (cost-cap, AI-usage, schema). Cross-company insights, RAG, anomaly-detection er ikke startet (Phase C i roadmap).

**Salgsfortælling:** "Strategisk overblik på tværs af 50+ lokationer — find mønstre i kontrakts-vilkår, governance-gaps, anomalier i økonomi. Bedrock EU-residency."

**Pilot-deadline:** Phase B exit (Plus pilot-valideret) før Enterprise-arbejde kan starte. Realistisk Q3 2026.

---

---
