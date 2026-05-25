# Kom i gang med ChainHub

Denne guide fører dig fra nul til en kørende lokal instans af ChainHub.

---

## Forudsætninger

- **Node.js 20+** — tjek med `node --version`
- **Docker Desktop** — til lokal PostgreSQL
- **Git**
- En editor med TypeScript-support (anbefalet: VS Code)

---

## 1. Klonér repository

```bash
git clone <repo-url>
cd chainhub
```

---

## 2. Installér dependencies

```bash
npm ci
```

---

## 3. Opsæt miljøvariabler

Opret `.env.local` i rod-mappen med minimum-konfigurationen:

```env
# Database — lokal Docker
DATABASE_URL=postgresql://chainhub:chainhub@localhost:5432/chainhub_dev
DIRECT_URL=postgresql://chainhub:chainhub@localhost:5432/chainhub_dev

# Auth
NEXTAUTH_SECRET=<generer med: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
NEXTAUTH_URL=http://localhost:3000

# Valgfrit — AI-søgning (kan udelades, feature deaktiveres stille)
# OPENAI_API_KEY=sk-...
```

> Alle tilgængelige variabler er dokumenteret i `docs/build/RUNBOOK.md`.

---

## 4. Start lokal database

```bash
docker compose up -d
```

Dette starter PostgreSQL på port 5432 (`chainhub_dev`) og en E2E-database på port 5433 (`chainhub_e2e`).

Tjek at containere kører:

```bash
docker compose ps
```

---

## 5. Kør database setup

```bash
# Generér Prisma client
npx prisma generate

# Push schema til lokal DB
npx prisma db push

# Seed test-data
npx prisma db seed
```

---

## 6. Start dev server

```bash
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000).

---

## 7. Login med seed-bruger

| Email                       | Password      | Rolle                     |
| --------------------------- | ------------- | ------------------------- |
| `philip@chainhub.dk`        | `password123` | GROUP_OWNER (fuld adgang) |
| `maria@tandlaegegruppen.dk` | `password123` | GROUP_LEGAL               |

---

## 8. Kør tests

```bash
# Unit tests (Vitest) — ~1576 tests
npm test

# Watch-mode under udvikling
npm run test:watch

# Med coverage-rapport
npm run test:coverage

# E2E tests (Playwright) — kræver kørende app + E2E-database
npm run dev &
npx playwright test

# E2E med UI
npx playwright test --ui
```

> Første gang E2E bruges: `npm run e2e:install` for at installere browser-binaries.

---

## 9. Nyttige kommandoer

```bash
# TypeScript-check (ingen fejl forventet)
npx tsc --noEmit

# ESLint
npm run lint
npm run lint:fix

# Prettier
npm run format:check
npm run format

# Prisma
npx prisma studio              # Åbn GUI til databasen
npx prisma db push             # Push schema-ændringer
npx prisma migrate dev         # Kør migration (kræver DIRECT_URL)
npx prisma db seed             # Reseed test-data

# Byg til produktion
npm run build
```

---

## 10. Projektstruktur (kort oversigt)

```
src/
├── app/
│   ├── (auth)/login/          # Login-side
│   └── (dashboard)/           # Beskyttede sider (companies, contracts, cases m.fl.)
├── actions/                   # Server Actions — al forretningslogik
├── components/                # UI-komponenter
├── lib/
│   ├── auth/                  # NextAuth-konfiguration
│   ├── db/                    # Prisma client
│   ├── env.ts                 # Miljøvariabel-validering
│   ├── labels.ts              # Enum → dansk label
│   └── permissions/           # RBAC-helpers
└── __tests__/                 # Vitest unit tests
prisma/
├── schema.prisma              # Datamodel (36+ tabeller, 30+ enums)
└── seed.ts                    # Test-data
docs/
├── GETTING-STARTED.md         # Denne fil
├── build/                     # RUNBOOK, CONVENTIONS, SPRINT-PLAN
├── spec/                      # Datamodel, kontrakter, RBAC, UI-flows
└── status/                    # PROGRESS, BLOCKERS, DECISIONS
```

---

## 11. Vigtige konventioner

- **Server Actions, ikke REST API** — al CRUD sker via `src/actions/*.ts`
- **Multi-tenancy** — alle Prisma-queries skal have `organization_id`
- **Dansk UI** — labels, knapper og fejlbeskeder på dansk
- **Soft deletes** — aldrig hard delete på kontrakter, sager, selskaber, personer
- **Ingen `any`** — brug `unknown` + narrowing

Fuld konventionsbeskrivelse: `docs/build/CONVENTIONS.md`

---

## 12. Hjælp og referencer

| Dokument                             | Indhold                                  |
| ------------------------------------ | ---------------------------------------- |
| `docs/build/RUNBOOK.md`              | Drift, deployment, service-opsætning     |
| `docs/build/CONVENTIONS.md`          | Kodekonventioner (bindende)              |
| `docs/spec/DATABASE-SCHEMA.md`       | Komplet datamodel                        |
| `docs/spec/roller-og-tilladelser.md` | RBAC-model                               |
| `docs/status/PROGRESS.md`            | Sprint-status                            |
| `docs/status/BLOCKERS.md`            | Kendte problemer                         |
| `CLAUDE.md`                          | AI-assistant instruktioner for projektet |
