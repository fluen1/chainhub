# ChainHub

B2B SaaS til kædegruppers porteføljestyring — kontraktstyring, governance, sagshåndtering, økonomi og personrelationer i ét dashboard. Bygget til kæder (tandlæge-, optiker-, fysio-, franchise-) der co-ejer lokationsselskaber med lokale partnere.

**Perspektivet er ALTID hovedkontorets.** Se [CLAUDE.md](CLAUDE.md) for full kernemodel.

---

## Tech stack

- **Frontend**: Next.js 14 (App Router) · React 18 · TypeScript 5 (strict) · Tailwind CSS
- **Backend**: Next.js Server Actions · NextAuth 4 (JWT, 8h sessions)
- **Database**: PostgreSQL (Supabase) · Prisma 5 ORM
- **AI**: Anthropic Claude via `@anthropic-ai/sdk` (dokument-extraction)
- **Validering**: Zod
- **Test**: Vitest (unit + integration) · Playwright (E2E setup klar)
- **Observability**: Pino (structured logging) · Sentry (error tracking, opt-in)

---

## Kom i gang

### 1. Klon + install

```bash
git clone <repo-url>
cd chainhub
npm install
```

### 2. Environment-variabler

```bash
cp .env.example .env.local
# Åbn .env.local og udfyld DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET
```

Minimum for dev:

- `DATABASE_URL` + `DIRECT_URL` — Supabase PostgreSQL (eller lokal via `docker-compose up`)
- `NEXTAUTH_SECRET` — generér med `openssl rand -base64 32`
- `NEXTAUTH_URL=http://localhost:3000`
- `ANTHROPIC_API_KEY` — kun nødvendig hvis AI-extraction testes

Valgfri:

- `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` — error-tracking (deaktiveret uden DSN)
- `LOG_LEVEL=debug` — pretty Pino-output i dev
- `RESEND_API_KEY` + `DIGEST_CRON_SECRET` — daglig email-digest

### 3. Database

```bash
npx prisma db push           # Synk schema til DB (bruger DIRECT_URL)
npx prisma generate          # Regenerér Prisma client
npx prisma db seed           # Seed test-data (7 selskaber, 18 kontrakter m.m.)
```

### 4. Start dev-server

```bash
npm run dev
# → http://localhost:3000
```

Login med seed-bruger:

- `philip@chainhub.dk` / `password123` (GROUP_OWNER — fuld adgang)
- `maria@tandlaegegruppen.dk` / `password123` (GROUP_LEGAL)

---

## Kommandoer

```bash
npm run dev                # Dev-server på port 3000
npm run build              # Production build
npm start                  # Start production build
npm run lint               # ESLint (read-only)
npm run lint:fix           # ESLint med auto-fix
npm run format             # Prettier skriver ændringer
npm run format:check       # Prettier verificerer (CI)
npm run typecheck          # tsc --noEmit
npm test                   # Vitest run
npm run test:watch         # Vitest watch-mode
npm run test:coverage      # Vitest med coverage-rapport

# Prisma
npx prisma generate        # Regenerér client efter schema-ændringer
npx prisma db push         # Push schema til DB uden migration-fil
npx prisma migrate dev     # Lav + kør migration (kræver DIRECT_URL)
npx prisma db seed         # Seed test-data
npx prisma studio          # Åbn DB-UI

# Docker (lokal PostgreSQL alternativ til Supabase)
docker compose up -d       # Start lokal PG på port 5432
docker compose down        # Stop
```

---

## Arkitektur

- **Server Actions først** — al CRUD bruger `src/actions/*.ts`. API routes kun til auth, fil-upload, webhooks.
- **Multi-tenancy** — `organization_id` er påkrævet på alle Prisma-queries. Se [CLAUDE.md § Kritiske Regler](CLAUDE.md#kritiske-regler-ikke-forhandlingsbare).
- **Permissions** — 3-lag (`canAccessCompany`, `canAccessSensitivity`, `canAccessModule`) i `src/lib/permissions/`.
- **Soft deletes** — aldrig hard delete på kontrakter, sager, selskaber, personer, dokumenter.
- **Dansk UI** — alle brugervendte strenge via `src/lib/labels.ts`. Ingen hardcoded enum-værdier.
- **Observability** — structured Pino-logger i `src/lib/logger.ts`, Sentry wrapped i `src/lib/action-helpers.ts` `withActionLogging()`. Se [docs/build/LOGGING-GUIDE.md](docs/build/LOGGING-GUIDE.md).

Full arkitektur og konventioner i [docs/build/CONVENTIONS.md](docs/build/CONVENTIONS.md).

---

## Bidrag

### Commit-format

```
[type]: beskrivelse på dansk

Længere beskrivelse hvis nødvendigt.

Co-Authored-By: ... (valgfri)
```

Typer: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`, `perf`.

### Pre-commit

Husky + lint-staged kører Prettier + ESLint på stagede filer automatisk. Installeret via `npm install`.

### Test-krav pr. action

- Happy path
- Uautoriseret (session mangler)
- Forkert tenant (`organization_id`-leak)
- Ugyldig input (Zod-fejl)

---

## Dokumentation

| Sti                                                                       | Indhold                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                                    | Projekt-overblik + kritiske regler for AI-assistenter            |
| [docs/DEVELOPER.md](docs/DEVELOPER.md)                                    | Onboarding, trouble-shooting, workflow-guides                    |
| [docs/build/CONVENTIONS.md](docs/build/CONVENTIONS.md)                    | Kode-konventioner, mønstre, navngivning                          |
| [docs/build/LOGGING-GUIDE.md](docs/build/LOGGING-GUIDE.md)                | Hvordan man wrapper actions med struktureret logging             |
| [docs/build/SPRINT-PLAN.md](docs/build/SPRINT-PLAN.md)                    | Sprint-rækkefølge og mål                                         |
| [docs/spec/DATABASE-SCHEMA.md](docs/spec/DATABASE-SCHEMA.md)              | Schema + design-principper                                       |
| [docs/spec/CONTRACT-TYPES.md](docs/spec/CONTRACT-TYPES.md)                | 34 kontrakttyper + metadata                                      |
| [docs/spec/roller-og-tilladelser.md](docs/spec/roller-og-tilladelser.md)  | RBAC-model                                                       |
| [docs/spec/UI-FLOWS.md](docs/spec/UI-FLOWS.md)                            | 12 brugerflows                                                   |
| [docs/status/PROGRESS.md](docs/status/PROGRESS.md)                        | Sprint-status                                                    |
| [docs/status/DECISIONS.md](docs/status/DECISIONS.md)                      | Arkitekturbeslutninger                                           |
| [docs/status/BLOCKERS.md](docs/status/BLOCKERS.md)                        | Kendte blockers                                                  |
| [docs/ops/RUNBOOK.md](docs/ops/RUNBOOK.md)                                | Produktions-runbook                                              |

---

## Deploy

Vercel-optimeret, men ikke deployet endnu. Se [docs/ops/RUNBOOK.md](docs/ops/RUNBOOK.md) for produktions-checklist. Pt. eksisterer ingen Dockerfile — køres enten lokalt, mod Supabase EU, eller via Vercel når produktion bliver aktuel.

---

## Status

Se [docs/status/PROGRESS.md](docs/status/PROGRESS.md) for aktuel sprint-status. Kortfattet: Plan 4D er i praksis lukket (2026-04-18), Sprint 8 accountability leveret, foundation-lag for produktions-modenhed er under opbygning.
