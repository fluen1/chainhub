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
**Beskrivelse:** `src/lib/ai/logger.ts` brugte `transport: { target: 'pino-pretty' }` i dev-mode. Pino's thread-stream transport spawner en worker-tråd der dør når Next.js App Router river modul-konteksten ned mellem requests/HMR. Efterfølgende `log.*()`-kald skrev til den døde worker og kastede `"Error: the worker has exited"`, hvilket maskerede den faktiske AI API-fejl i AI-klienten.
**Løsning:** Disablet pino-pretty transport i Next.js-runtime via `NEXT_RUNTIME` env-variabel-check. Pino falder tilbage til synkron NDJSON-output til stdout — RSC-sikkert, ingen worker. Standalone workers udenfor Next.js beholder pino-pretty. Ændringen er kommenteret i `src/lib/ai/logger.ts`.
**Verificeret:** Dev-server restart + Playwright-audit viste at pino-fejlen er væk og den reelle AI-fejl nu surfacer i stdout — se BLK-005 for den efterfølgende billing-fejl der tidligere var skjult.
**Historisk note:** Da BLK-004 blev skrevet kørte kodebasen Anthropic (`AnthropicDirectClient`). Koden er siden migreret til OpenAI (`OpenAIDirectClient`, `openai`-SDK).

## BLK-005: AI API credit balance for lav — HISTORISK (løst ved OpenAI-migration)

**Status:** HISTORISK — kodebasen er migreret til OpenAI; Anthropic-kontoen bruges ikke længere
**Opdaget:** 2026-04-12, umiddelbart efter BLK-004 blev løst
**Beskrivelse (historisk):** Efter BLK-004 fix viste den faktiske Anthropic API-response sig som `400 invalid_request_error: Your credit balance is too low to access the Anthropic API.` (request_id req_011CZy6e4ZC9dB4K5yyUHAfg).
**Konsekvens:** `generateCompanyInsights` fejlede graceful, `/companies/[id]` rendererede uden AI Insight-sektionen.
**Løsning:** Kodebasen er migreret til OpenAI-SDK (`OpenAIDirectClient`). Kontrollér at `OPENAI_API_KEY` er sat i `.env.local` og at OpenAI-kontoen har saldo. Graceful degradation er fortsat implementeret.
**Workaround:** Graceful degradation er implementeret — sagen fungerer fint uden AI.

## BLK-003: Mobilnavigation fjernet i Plan 4B — LØST (2026-04-18)

**Status:** LØST
**Opdaget:** Plan 4B (2026-04-11)
**Beskrivelse:** `(dashboard)/layout.tsx` brugte `hidden lg:flex` på AppSidebar uden MobileNav-erstatning; under 1024px mistede brugeren al top-level navigation.
**Løsning:** `MobileSidebarWrapper` med hamburger-knap i header (focus-trap, Escape-close, backdrop-click, auto-close ved route-skift) leveret i Mobile + Empty-states-track 2026-04-18. Genbekræftet under Gate 1-sweep 2026-06-08: burger-menu + drawer fungerer på 375px (screenshot gate1-37).
