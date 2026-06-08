# Launch plan 1/4 — Gate 1-sweep + dental-sanering + oprydning

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjern alle dental-referencer fra seed/docs/tests, ryd stale worktrees, og gennemfør formel Gate 1-browsergennemgang af alle 27 sider med dokumenteret rapport.

**Architecture:** Ren string-sanering i seed + docs efterfulgt af destruktiv reseed af dev-DB (kun demo-data). Gate 1 køres som interaktiv Playwright-MCP-browsergennemgang med screenshots + console-tjek; fund logges i rapport og fixes i afsluttende fix-runde.

**Tech Stack:** Prisma seed (tsx), Playwright MCP, Vitest, Next.js 16

**Spec:** `docs/superpowers/specs/2026-06-08-launch-readiness-design.md`
**Branch:** `feat/launch-readiness`
**Efterfølgende planer:** 2/4 public-lag · 3/4 legal + docs · 4/4 deploy-forberedelse (skrives når denne plan er leveret)

> ⚠️ **Destruktivt trin:** Task 3 wiper dev-databasen (`prisma db push --force-reset`). Al manuelt oprettet test-data går tabt — kun seed-data genskabes. Godkendt præmis: DB'en indeholder kun demo-data.

---

### Task 1: Ryd stale agent-worktrees + branches

**Files:** ingen kodeændringer — git-housekeeping.

- [ ] **Step 1: Fjern de 5 låste worktrees**

```powershell
foreach ($w in @('agent-a0cfd5c1bc6ec9a0f','agent-a1320f2e2e563ba75','agent-a2c61ab0d606b559b','agent-a6826d1fd4077e84b','agent-a76244b9f7858ea9f')) {
  git -C C:\Users\birke\Projects\chainhub worktree remove --force ".claude/worktrees/$w"
}
git -C C:\Users\birke\Projects\chainhub worktree prune
```

- [ ] **Step 2: Slet de tilhørende branches** (alle peger på a2ca4ec som allerede er i master-historikken)

```powershell
foreach ($b in @('worktree-agent-a0cfd5c1bc6ec9a0f','worktree-agent-a1320f2e2e563ba75','worktree-agent-a2c61ab0d606b559b','worktree-agent-a6826d1fd4077e84b','worktree-agent-a76244b9f7858ea9f')) {
  git -C C:\Users\birke\Projects\chainhub branch -D $b
}
```

- [ ] **Step 3: Verificér**

Run: `git -C C:\Users\birke\Projects\chainhub worktree list; git -C C:\Users\birke\Projects\chainhub branch`
Expected: Kun hoved-worktree; branches: master, feat/launch-readiness, feat/ai-features, wip/cleanup-2026-06-05

---

### Task 2: Dental-sanering af seed-filer

**Files:**

- Modify: `prisma/seed.ts` (28 forekomster)
- Modify: `scripts/seed-extraction.ts` (3 forekomster)

**Rename-mapping (gælder begge filer):**

| Fra                   | Til                 | Dækker                                                                      |
| --------------------- | ------------------- | --------------------------------------------------------------------------- |
| `Tandlæge`            | `Optik`             | TandlægeGruppen→OptikGruppen, Tandlæge Østerbro ApS→Optik Østerbro ApS osv. |
| `tandlægepraksis`     | `optikerforretning` | case-beskrivelse linje 684                                                  |
| `tandlaegegruppen.dk` | `optikgruppen.dk`   | maria/thomas-emails + console.log                                           |

- [ ] **Step 1: Kør replace_all på `prisma/seed.ts`** — tre Edit-kald med `replace_all: true`: `Tandlæge`→`Optik`, `tandlægepraksis`→`optikerforretning`, `tandlaegegruppen.dk`→`optikgruppen.dk`

- [ ] **Step 2: Kør samme tre replace_all på `scripts/seed-extraction.ts`**

- [ ] **Step 3: Verificér 0 rest-forekomster**

Run: `Grep pattern "tandlæge|tandlaege|Tandlæge" path prisma/ scripts/ -i`
Expected: 0 hits

- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add prisma/seed.ts scripts/seed-extraction.ts
git -C C:\Users\birke\Projects\chainhub commit -m "chore: dental-sanering af seed-data — OptikGruppen som demo-vertikal"
```

---

### Task 3: Reseed dev-database (DESTRUKTIVT — bekræftet i plan-godkendelse)

**Files:** ingen — DB-operation.

- [ ] **Step 1: Wipe + genskab schema**

Run (fra `C:\Users\birke\Projects\chainhub`): `npx prisma db push --force-reset`
Expected: "Your database is now in sync with your Prisma schema"

- [ ] **Step 2: Seed**

Run: `npx prisma db seed`
Expected: console-output slutter med login-info for `philip@chainhub.dk` + `maria@optikgruppen.dk` + `thomas@optikgruppen.dk`

- [ ] **Step 3: Smoke-verificér i app**

(Verificeret 2026-06-08: de 3 compound-indexes ligger som `@@index` i `schema.prisma` linje 603/707/780 — `db push` genskaber dem automatisk, intet manuelt SQL-trin nødvendigt.)

Run: `npm run dev` → log ind som philip@chainhub.dk / password123 → `/companies`
Expected: 7 selskaber med Optik-navne, ingen Tandlæge-tekst

---

### Task 4: Dental-sanering af docs + e2e-tests

**Files:**

- Modify: `CLAUDE.md:5` (vertikal-liste), `CLAUDE.md:14` (analogi), `CLAUDE.md:183` (seed-brugere)
- Modify: `README.md:5`, `README.md:71`
- Modify: `tests/e2e/companies.spec.ts:24-26`, `tests/e2e/a11y.spec.ts:28`, `tests/e2e/search.spec.ts:4-11`, `tests/e2e/settings.spec.ts:9,24`

- [ ] **Step 1: CLAUDE.md — tre præcise edits**

Linje 5: `(tandlæge-, optiker-, fysio-, franchisekæder)` → `(optiker-, fysio-, læge- og franchisekæder)`
Linje 14: `**Lokal partner** (fx tandlægen)` → `**Lokal partner** (fx optikeren)`
Linje 183: `maria@tandlaegegruppen.dk` → `maria@optikgruppen.dk`

- [ ] **Step 2: README.md — to edits**

Linje 5: `(tandlæge-, optiker-, fysio-, franchise-)` → `(optiker-, fysio-, læge-, franchise-)`
Linje 71: `maria@tandlaegegruppen.dk` → `maria@optikgruppen.dk`

- [ ] **Step 3: E2E-specs — fire filer**

`companies.spec.ts`: `Tandlæge Østerbro ApS` → `Optik Østerbro ApS` (kommentar + getByText)
`a11y.spec.ts:28`: kommentar `(klinik Tandlæge Østerbro)` → `(butik Optik Østerbro)`
`search.spec.ts`: testnavn `søgning på "tandlæge"...` → `søgning på "optik"...`; søge-input udfyldes med `optik`; expect `Optik Østerbro ApS`
`settings.spec.ts:9`: `` `TandlægeGruppen E2E ${Date.now()}` `` → `` `OptikGruppen E2E ${Date.now()}` ``; linje 24 reset-navn `'TandlægeGruppen A/S'` → `'OptikGruppen A/S'`

- [ ] **Step 4: Verificér 0 forekomster i hele repoet (ekskl. historiske mockups + specs/plans)**

Run: `Grep "tandlæge|tandlaege" -i` på `src/`, `tests/`, `prisma/`, `scripts/`, `CLAUDE.md`, `README.md`
Expected: 0 hits. (`docs/design/`-mockups og gamle spec-dokumenter er bevidst undtaget — historiske artefakter.)

- [ ] **Step 5: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add CLAUDE.md README.md tests/
git -C C:\Users\birke\Projects\chainhub commit -m "chore: dental-sanering af docs + e2e-tests"
```

---

### Task 5: Kvalitetsgate efter sanering

- [ ] **Step 1: Unit-tests**

Run: `npm test` (fra projektroden)
Expected: 1190 passed, 0 failed (4 skipped OK)

- [ ] **Step 2: TypeScript + build**

Run: `npx tsc --noEmit; npx next build`
Expected: 0 TS-fejl; build GRØN

- [ ] **Step 3: E2E-suite mod reseedet DB**

Run: `npx playwright test`
Expected: alle specs grønne (search/companies/settings bruger nu Optik-navne)

- [ ] **Step 4: Fejler noget → fix før videre.** Brug superpowers:systematic-debugging pr. fejl; commit pr. fix.

---

### Task 6: Gate 1 browser-sweep — alle 27 sider

**Metode:** `npm run dev` kører; Playwright MCP-browser navigerer hver route som philip@chainhub.dk (1280×800). Pr. side: (1) screenshot, (2) `browser_console_messages` — noter errors/warnings, (3) verificér primært indhold renderer (ikke tom/fejl-state), (4) klik 1-2 kerneinteraktioner på interaktive sider.

**Rapport:** `docs/status/GATE1-2026-06.md` oprettes med tabel: route · status (✅/⚠️/❌) · console-fejl · fund · screenshot-navn. Screenshots i `screenshots/gate1/`.

- [ ] **Step 1: Opret rapport-skelet** med alle 27 routes:

`/login` · `/dashboard` · `/companies` · `/companies/new` · `/companies/[id]` (uid 1001) · `/contracts` (grouped + flat) · `/contracts/new` · `/contracts/[id]` (uid 5001) · `/cases` · `/cases/new` · `/cases/[id]` (uid 6001) · `/tasks` (grouped + flat + kanban) · `/tasks/new` · `/tasks/[id]` (uid 7001) · `/persons` · `/persons/new` · `/persons/[id]` (uid 2001) · `/documents` · `/documents/review/[id]` · `/calendar` · `/visits/new` · `/visits/[id]` · `/search?q=optik` · `/settings` · `/settings/users` · `/settings/ai-usage` · 404-side (ukendt URL)

- [ ] **Step 2: Sweep del 1** — login-flow + dashboard + companies-gruppen (7 routes). CRUD-stikprøve: opret testselskab via `/companies/new`, verificér det lander i listen.

- [ ] **Step 3: Sweep del 2** — contracts + cases + tasks (9 routes inkl. view-varianter). Stikprøve: flyt en task i kanban via drag/keyboard.

- [ ] **Step 4: Sweep del 3** — persons + documents + calendar + visits + search (8 routes). Stikprøve: global søgning Cmd+K.

- [ ] **Step 5: Sweep del 4** — settings-gruppen + 404 + mobile-stikprøve (375px: dashboard + companies + drawer-nav).

- [ ] **Step 6: Udfyld rapport** — alle 27 rækker har status; fund nummereres G1-001, G1-002 …

---

### Task 7: Fix-runde af Gate 1-fund

- [ ] **Step 1: Triagér fund** i rapporten: ❌ (blokerer launch — SKAL fixes) vs. ⚠️ (kosmetisk — fix hvis <30 min, ellers noteres som kendt issue)

- [ ] **Step 2: Fix hvert ❌-fund TDD-style** — failing test der reproducerer → minimal fix → grøn → commit pr. fund med besked `fix(gate1): G1-NNN <beskrivelse>`

- [ ] **Step 3: Re-sweep berørte sider** og opdatér rapport-status til ✅

- [ ] **Step 4: Afslut rapport** med konklusion: "Gate 1 bekræftet — alle 27 sider gennemgået [dato], N fund, alle ❌ lukket"

- [ ] **Step 5: Kør fuld gate igen**

Run: `npm test; npx tsc --noEmit; npx next build`
Expected: alt grønt

- [ ] **Step 6: Commit rapport**

```powershell
git -C C:\Users\birke\Projects\chainhub add docs/status/GATE1-2026-06.md screenshots/gate1/
git -C C:\Users\birke\Projects\chainhub commit -m "docs: Gate 1-rapport — 27 sider gennemgået og bekræftet"
```

---

### Task 8: Status-opdatering

- [ ] **Step 1: Opdatér `docs/status/PROGRESS.md`** — ny sektion "Launch-readiness plan 1 (2026-06-08)": worktree-oprydning, dental-sanering, Gate 1 bekræftet
- [ ] **Step 2: Opdatér `docs/status/BLOCKERS.md`** — BLK-003 markeres LØST (MobileSidebarWrapper, 2026-04-18)
- [ ] **Step 3: Trello** — flyt `[A.5] Formel Gate 1-bekræftelse` + `[A.5] Gate 1 bruger-bekræftelse` + `[BLK-003]` til Done; kommentar på pricing-kortene om at alle 4 v3-spørgsmål er besvaret 2026-06-07 (se spec)
- [ ] **Step 4: Commit**

```powershell
git -C C:\Users\birke\Projects\chainhub add docs/status/
git -C C:\Users\birke\Projects\chainhub commit -m "docs: PROGRESS + BLOCKERS opdateret efter plan 1"
```
