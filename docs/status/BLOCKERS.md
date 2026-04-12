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

## BLK-004: Pino logger crasher i Next.js RSC worker — LØST (2026-04-12)
**Opdaget:** Plan 4C, under Playwright audit af `/companies/[id]`
**Beskrivelse:** `src/lib/ai/logger.ts` brugte `transport: { target: 'pino-pretty' }` i dev-mode. Pino's thread-stream transport spawner en worker-tråd der dør når Next.js App Router river modul-konteksten ned mellem requests/HMR. Efterfølgende `log.*()`-kald skrev til den døde worker og kastede `"Error: the worker has exited"`, hvilket maskerede den faktiske Anthropic API-fejl i `AnthropicDirectClient.complete`.
**Løsning:** Disablet pino-pretty transport i Next.js-runtime via `NEXT_RUNTIME` env-variabel-check. Pino falder tilbage til synkron NDJSON-output til stdout — RSC-sikkert, ingen worker. Standalone workers udenfor Next.js beholder pino-pretty. Ændringen er kommenteret i `src/lib/ai/logger.ts`.
**Verificeret:** Dev-server restart + Playwright-audit viste at pino-fejlen er væk og den reelle Anthropic-fejl nu surfacer i stdout — se BLK-005 for den efterfølgende billing-fejl der tidligere var skjult.

## BLK-005: Anthropic credit balance for lav
**Status:** AKTIV — brugerhandling påkrævet
**Opdaget:** 2026-04-12, umiddelbart efter BLK-004 blev løst
**Beskrivelse:** Efter BLK-004 fix viste den faktiske Anthropic API-response sig som `400 invalid_request_error: Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.` (request_id req_011CZy6e4ZC9dB4K5yyUHAfg).
**Konsekvens:** `generateCompanyInsights` fejler graceful, `getCompanyDetailData` returnerer `alerts: []` og `aiInsight: null`, og `/companies/[id]` renderer de 7 strukturerede sektioner uden AI Insight-sektionen. Plan 4C's AI-feature kan ikke valideres end-to-end før kontoen har credit.
**Løsning:** Top op Anthropic-kontoen via https://console.anthropic.com/settings/billing og verificér at kontoen der ejer `ANTHROPIC_API_KEY` i `.env.local` har saldo. Test ved at genindlæse `/companies/[id]` — den første request efter credit tilskud triggrer en synkron AI-call der cacher resultatet i `CompanyInsightsCache` i 24 timer.
**Workaround:** Ingen — graceful degradation er allerede implementeret i Plan 4C, sagen fungerer fint uden AI.

## BLK-003: Mobilnavigation fjernet i Plan 4B
**Status:** AKTIV — ikke-blokerende (desktop fungerer)
**Opdaget:** Plan 4B (2026-04-11)
**Beskrivelse:** `(dashboard)/layout.tsx` bruger `hidden lg:flex` på AppSidebar og har ingen MobileNav-erstatning. Under 1024px breakpoint mister brugeren al top-level navigation (Dashboard, Selskaber, Kontrakter, Sager, Opgaver, Dokumenter, Personer, Indstillinger) samt rollepanel og senest-besøgt liste. AppHeader renderer stadig, men der er ingen rute-navigation fra tablet/mobil.
**Plan-sanktioneret:** Plan 4B linje 1655 accepterer dette eksplicit ("proto design doesn't have a mobile nav variant... A mobile drawer can be added in a later polish task if needed").
**Beslutning nødvendig:** Er ChainHub desktop-only (≥1024px) eller skal der genskabes en mobile drawer?
**Workaround:** Brug ≥1024px viewport indtil beslutningen er truffet.
