# BLOCKERS.md — ChainHub

## BLK-001: Supabase database — LØST
**Status:** LØST (2026-03-25)
**Opdaget:** Sprint 1
**Beskrivelse:** Supabase projekt var paused — `prisma db push` fejlede med P1001.
**Løsning:** Supabase genaktiveret via MCP. Schema synkroniseret, seed-data indlæst.
**Alternativ:** `docker-compose.yml` er klar til lokal PostgreSQL (kræver Docker Desktop).

## BLK-002: Docker Desktop ikke installeret
**Status:** AKTIV — ikke-blokerende (Supabase fungerer)
**Beskrivelse:** Docker Desktop er ikke installeret på denne maskine.
`docker-compose.yml` er oprettet med lokal PostgreSQL-opsætning, men kan ikke bruges endnu.
**Workaround:** Brug Supabase direkte til development. Installér Docker Desktop når offline-dev er nødvendigt.

## BLK-004: Pino logger crasher i Next.js RSC worker
**Status:** AKTIV — ikke-blokerende (graceful degradation virker)
**Opdaget:** Plan 4C (2026-04-12), under Playwright audit af `/companies/[id]`
**Beskrivelse:** `src/lib/ai/client/anthropic-direct.ts` bruger `pino`-logger med thread-stream transport. I Next.js dev-mode Server Components fejler pino's worker-tråd ("Error: the worker has exited") når `log.error()` kaldes inde i Anthropic-clientens catch-block. Det maskerer den oprindelige Anthropic-fejl (`generateCompanyInsights` fanger pino-fejlen i stedet for API-fejlen) og forhindrer enhver AI-call fra RSC-kontekst.
**Observation:** `getCompanyDetailData()` returnerer graceful-degradation (`alerts: []`, `aiInsight: null`) som specificeret, så `/companies/[id]` renderer fint uden AI Insight-sektionen. Alle 7 grid-sektioner + header + alerts-plads fungerer.
**Workaround (ikke påkrævet for Plan 4C):** Page renders korrekt uden AI. Side effects fra cache-miss hver request (fejl-retry loop) kan fylde stderr-loggen.
**Løsningsforslag:**
1. Skift pino til synkron destination i Next.js-kontekst: `pino({...}, pino.destination({ sync: true }))`
2. Erstat pino med en RSC-kompatibel logger (console eller custom)
3. Wrappe `log.error` i try/catch i `AnthropicDirectClient.complete` så pino-fejl ikke overtager
**Reference:** Next.js issue tracker har flere tråde om pino + App Router + RSC inkompatibilitet.

## BLK-003: Mobilnavigation fjernet i Plan 4B
**Status:** AKTIV — ikke-blokerende (desktop fungerer)
**Opdaget:** Plan 4B (2026-04-11)
**Beskrivelse:** `(dashboard)/layout.tsx` bruger `hidden lg:flex` på AppSidebar og har ingen MobileNav-erstatning. Under 1024px breakpoint mister brugeren al top-level navigation (Dashboard, Selskaber, Kontrakter, Sager, Opgaver, Dokumenter, Personer, Indstillinger) samt rollepanel og senest-besøgt liste. AppHeader renderer stadig, men der er ingen rute-navigation fra tablet/mobil.
**Plan-sanktioneret:** Plan 4B linje 1655 accepterer dette eksplicit ("proto design doesn't have a mobile nav variant... A mobile drawer can be added in a later polish task if needed").
**Beslutning nødvendig:** Er ChainHub desktop-only (≥1024px) eller skal der genskabes en mobile drawer?
**Workaround:** Brug ≥1024px viewport indtil beslutningen er truffet.
