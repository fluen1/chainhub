# ChainHub — CLAUDE.md

## Hvad er ChainHub?

ChainHub er et B2B SaaS-system til kædegrupper (tandlæge-, optiker-, fysio-, franchisekæder) der co-ejer lokationsselskaber med lokale partnere. Systemet samler kontraktstyring, governance, sagshåndtering, økonomi og personrelationer i ét dashboard.

**Perspektivet er ALTID hovedkontorets.** Brugerne sidder i kædegruppen og styrer nedad. Lokale partnere og klinikpersonale er data i systemet — ikke primære brugere.

### Kernemodel (McDonald's-analogien)

- **Kædegruppen/hovedkontoret** (brugerne) = McDonald's Corp.
- **Lokationsselskabet** (ApS med CVR) = den enkelte restaurant
- **Lokal partner** (fx tandlægen) = franchisetageren
- **Holdingselskabet** (medejer via ejeraftale) = McDonald's som part

**Formål:** Giv hovedkontoret ét samlet overblik og fuld kontrol over alle lokationer — kontrakter, governance, økonomi og personrelationer. Erstatter Excel/email-workflows ved 5–56+ lokationer, hvor flat lists er ubrugelige og hierarkisk navigation er påkrævet.

**Generisk produkt:** ChainHub er IKKE branche-specifikt. Det skal kunne bruges af alle kæder med co-ownership-struktur.

**Domæne:** B2B SaaS / Portfolio Management
**Sprog:** Dansk UI, dansk kodekommentering, engelske variabelnavne
**Status:** Sprint 7 færdig. Sprint 8 (Accountability + Dokumenter) er næste.

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5 (strict), Tailwind CSS
- **Backend:** Next.js Server Actions (primært mønster), NextAuth 4 (JWT, 8h sessions)
- **Database:** PostgreSQL (Supabase), Prisma 5 ORM
- **UI:** shadcn/ui-inspirerede komponenter, Lucide icons, Sonner (toasts)
- **Validering:** Zod på al brugerinput
- **Test:** Vitest (48 unit tests), Playwright (E2E — setup klar)

---

## Kritiske Regler (ikke-forhandlingsbare)

### 1. Multi-tenancy

```typescript
// ALLE Prisma queries SKAL have organization_id
where: { organization_id: session.user.organizationId, deleted_at: null }
```

### 2. Server Actions (IKKE REST API)

Al CRUD bruger Server Actions i `src/actions/`. API routes kun til: auth, fil-upload, webhooks.

Pattern for alle actions:

1. Session-check → 2. Zod-validering → 3. Permission-check → 4. DB-operation → 5. `revalidatePath()` → 6. Return `ActionResult<T>`

### 3. Permissions (3 lag)

```typescript
canAccessCompany(userId, companyId) // Scope-check
canAccessSensitivity(userId, level) // Sensitivity-check
canAccessModule(userId, module) // Modul-check
// SKAL kaldes FØR data returneres — ingen undtagelser
```

### 4. Soft Deletes

Aldrig hard delete på: contracts, cases, companies, persons, documents. Brug `deleted_at: new Date()`.

### 5. Dansk UI

- Alle labels, knapper, fejlbeskeder på dansk
- Du-form: "Opret selskab", "Du har ingen sager"
- Enum-labels via `src/lib/labels.ts` — ALDRIG hardcoded strings
- Fejlbeskeder skal være handlingsanvisende

### 6. No `any`

Brug `unknown` + narrowing. Brug Prisma's genererede typer.

---

## Projektstruktur

```
src/
├── app/
│   ├── (auth)/login/           # Login-side
│   ├── (dashboard)/            # Beskyttede routes
│   │   ├── dashboard/          # Portfolio-dashboard (urgency + overblik)
│   │   ├── companies/          # Selskaber (CRUD, tabs, detaljer)
│   │   ├── contracts/          # Kontrakter (34 typer, status-flow)
│   │   ├── cases/              # Sager/tvister
│   │   ├── tasks/              # Opgaver
│   │   ├── persons/            # Persondatabase
│   │   ├── documents/          # Dokumenter
│   │   ├── search/             # Global søgning
│   │   └── settings/           # Indstillinger
│   └── api/                    # Kun auth + sidebar-data endpoints
├── actions/                    # Server Actions (1 fil pr. modul)
├── components/
│   ├── ui/                     # Basis-komponenter (Pagination, SearchAndFilter)
│   ├── layout/                 # Sidebar, Header
│   └── [modul]/                # Modul-specifikke komponenter
├── lib/
│   ├── auth/                   # NextAuth config
│   ├── db/                     # Prisma client singleton
│   ├── permissions/            # Adgangscheck-helpers
│   ├── validations/            # Zod schemas
│   ├── labels.ts               # Enum → dansk label mappings
│   ├── pagination.ts           # Pagination helpers
│   └── utils.ts                # cn() helper
├── types/                      # ActionResult<T> m.fl.
└── __tests__/                  # Vitest unit tests
prisma/
├── schema.prisma               # 30+ tabeller, 43 enums
└── seed.ts                     # Test-data
docs/
├── spec/                       # Kravspec, DB-schema, RBAC, UI-flows
├── build/                      # Conventions, sprint-plan, learnings
└── status/                     # Progress, blockers, decisions
```

---

## Kommandoer

```bash
docker compose up -d              # Start lokal PostgreSQL
docker compose down               # Stop lokal PostgreSQL
npm run dev                     # Start dev server (port 3000)
npm run build                   # Production build
npm test                        # Vitest (48 tests)
npx prisma generate             # Regenerér Prisma client
npx prisma db push              # Push schema til DB (kræver aktiv Supabase)
npx prisma migrate dev          # Kør migrationer (bruger DIRECT_URL)
npx prisma db seed              # Seed test-data
npx tsc --noEmit                # TypeScript-check

# Test email-digest (kræver RESEND_API_KEY + DIGEST_CRON_SECRET i .env.local):
curl -X POST http://localhost:3000/api/cron/daily-digest -H "Authorization: Bearer YOUR_SECRET"
```

---

## Database

- **Provider:** Supabase PostgreSQL (EU)
- **Pooling:** `DATABASE_URL` = port 6543 (PgBouncer), `DIRECT_URL` = port 5432 (migrationer)
- **Schema:** `prisma/schema.prisma` — 30+ tabeller, 43 enums
- **Sensitivity:** PUBLIC < STANDARD < INTERN < FORTROLIG < STRENGT_FORTROLIG
- **Roller:** GROUP_OWNER, GROUP_ADMIN, GROUP_LEGAL, GROUP_FINANCE, GROUP_READONLY, COMPANY_MANAGER, COMPANY_LEGAL, COMPANY_READONLY
- **Lokal dev:** `docker-compose.yml` klar til lokal PG (kræver Docker Desktop)
- **Seed-brugere:** philip@chainhub.dk / password123 (GROUP_OWNER), maria@tandlaegegruppen.dk / password123 (GROUP_LEGAL)

---

## Konventioner (reference)

Fuld detaljer i `docs/build/CONVENTIONS.md`. Kernepointer:

- **Filer:** Komponenter=PascalCase, Actions=camelCase, API=kebab-case
- **Styling:** KUN Tailwind — aldrig inline styles. Brug `cn()` til varianter
- **Komponenter:** Eksplicit Props-type, ingen business logic, ingen direkte Prisma-kald
- **Fejl:** `ActionResult<T>` return, `toast.error()` i UI, dansk besked
- **Test:** Happy path + uautoriseret + forkert tenant + ugyldig input pr. action
- **Git:** `[type]: beskrivelse på dansk` (feat/fix/chore/docs/refactor)

---

## Tjekliste inden commit

```
□ organization_id på alle Prisma queries
□ deleted_at: null på alle list-queries
□ canAccessCompany() / canAccessSensitivity() kaldt
□ Zod validation på al brugerinput
□ Loading + tom state implementeret
□ Fejlbeskeder på dansk, handlingsanvisende
□ Kun Tailwind — ingen inline styles
□ Ingen console.log i produktion
□ Nye imports har matchende pakke i package.json
□ npx next build gennemføres uden fejl
```

---

## Vigtig dokumentation

| Fil                                  | Indhold                            |
| ------------------------------------ | ---------------------------------- |
| `docs/spec/DATABASE-SCHEMA.md`       | Komplet schema + design-principper |
| `docs/spec/CONTRACT-TYPES.md`        | 34 kontrakttyper + metadata        |
| `docs/spec/roller-og-tilladelser.md` | RBAC-model (3-lags adgangskontrol) |
| `docs/spec/UI-FLOWS.md`              | 12 brugerflows                     |
| `docs/spec/API-SPEC.md`              | Alle endpoints + request/response  |
| `docs/spec/SPEC-TILLAEG-v2.md`       | Sprint 8+ features                 |
| `docs/build/CONVENTIONS.md`          | Kodekonventioner (bindende)        |
| `docs/build/SPRINT-PLAN.md`          | Sprint-plan og rækkefølge          |
| `docs/build/INTELLIGENCE.md`         | Kendte fejlmønstre og learnings    |
| `docs/status/PROGRESS.md`            | Sprint-status                      |
| `docs/status/DECISIONS.md`           | Arkitekturbeslutninger             |
| `docs/status/BLOCKERS.md`            | Kendte blockers                    |
