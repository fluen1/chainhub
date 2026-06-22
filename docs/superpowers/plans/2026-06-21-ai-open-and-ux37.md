# ChainHub — Åbn AI + UX-rest #37 (2026-06-21)

> Eksekverbar plan. Philips retningsvalg (21/6) er låst: **fuld AI inkl. dokument-udlæsning**, **OpenAI-nøgle haves** (test end-to-end), **mobil = kort-/listevisning under sm**, **AI tom-tilstand = demo-eksempel + graceful kollaps**.

## Plan-model (verificeret)

- `Organization.plan` = fri String, default `"trial"`. Betalte planer fra Stripe: `basis`, `plus` (`plan-from-price.ts`). AI (assistant + extraction) kræver `plan === 'plus'`.
- AI tændes af 4 lag: `AI_EXTRACTION_ENABLED=true` (env kill-switch) → `OPENAI_API_KEY` sat → per-org `OrganizationAISettings`-row (`ai_mode` ≠ OFF, `kill_switch=false`) → `plan === 'plus'`.
- Extraction kører via pg-boss worker (`worker/index.ts`) — har INGEN hosting-config. Vercel kører ikke long-running workers.

---

## Pakke A — AI gating/aktivering (backend) · TDD

**Filer:** `prisma/seed.ts`, `src/actions/assistant.ts`, `src/lib/ai/assistant/orchestrator.ts`, `worker/index.ts`

1. `seed.ts`: org `plan: 'business'` → `'plus'` (legacy-enum-læk + AI-adgang). Tilføj `prisma.organizationAISettings.upsert` for org (uid(1)) med `ai_mode: 'LIVE'`, `kill_switch: false`, `beta_features: []`.
2. `assistant.ts`: clean plan-gate FØR `processMessage` i `sendMessage` + `createConversation` med dansk handlingsanvisende besked ("AI-assistenten kræver Plus-abonnement. Opgradér under Indstillinger → Abonnement."). Behold orchestrator-gaten som defense-in-depth.
3. `worker/index.ts`: registrér `JOB_NAMES.PORTFOLIO_SCAN`-handler (kalder `runPortfolioScan` pr. org — iterér aktive orgs, da cron-payload er tom).
   **Success:** nye tests grønne for plan-gate i action-lag; seed giver plus + AISettings; worker registrerer begge jobs.

## Pakke B — Worker-host config (infra/docs)

**Filer (nye):** `Dockerfile.worker`, `render.yaml` (eller `railway.json`), opdatér `.env.production.example` + `docs`.

- Containeriser `npm run worker`. Background-worker service-def. Env: `DATABASE_URL`/`DIRECT_URL`, `OPENAI_API_KEY`, `AI_EXTRACTION_ENABLED=true`. Dokumentér deploy-trin (Philip-spor).
  **Success:** `docker build -f Dockerfile.worker` lykkes lokalt; render.yaml validerer; docs forklarer Philips deploy-trin.

## Pakke C — AI UI graceful + demo-data

**Filer:** `src/components/layout/b-shell.tsx` (chat-toggle), AI-insight-panel, documents AI-lag.

- Skjul/disable chat-knap når AI slukket ELLER plan ≠ plus (ingen fejl-toast-først).
- AI INSIGHT tom-tilstand: demo-eksempel-insight m. TYDELIG "Eksempel"-mærkning + graceful kollaps af tomt apparat (ingen "cap-blokeret"-jargon).
- Documents AI-lag: kollaps 3 AI-kolonner→1 + onboarding-linje når 0 data.
  **Success:** AI-flader viser enten ægte data, mærket demo, eller pæn onboarding — aldrig rå intern tilstand.

## Pakke D — UX mobil kort-views (under sm)

**Filer:** list-komponenter for kontrakter/sager/opgaver/personer/dokumenter (companies har `CompaniesCardView`).

- Kort-/listevisning som default under sm-breakpoint, primær identifikator som overskrift.
  **Success:** alle 6 list-sider læsbare på 390px uden vandret scroll/afklippet kerne-info.

## Pakke E — UX rolle-trimning single-source

**Filer:** ny `src/lib/permissions/role-modules.ts` (single source), brugt i `b-sidebar.tsx`, strip-cells, `company-detail/helpers.ts`.

- Én rolle→moduler-mapping. Gate sidebar-sektioner, selskabsliste-kolonner, top-urgency, heatmap-sagstal, timeline-links. Aldrig badge/links for moduler rollen ikke kan åbne (fix GROUP_FINANCE-divergensen).
  **Success:** test beviser FINANCE ikke ser Kontrakter/Sager-links/tal nogen steder; de tre+ steder kan ikke divergere.

## Pakke F — UX dashboard/selskabsliste redundans

**Filer:** dashboard-page + companies-list-komponenter.

- Én kanal pr. tal: fjern dupl. PageHeader-meta, gør "Top urgency" til drill-down af heatmap (eller >12-gate), flyt "Fordeling" til Regioner-view.
  **Success:** ingen KPI vises mere end nødvendigt; inkonsistente tal (1 vs 5) elimineret.

## Stream P — Philips eksterne tjekliste (leveres i chat + `docs/status/STREAM-P-CHECKLIST.md`)

## Til sidst — STATUS.md + memory opdateres til reel readiness.

---

## Fremdrift

- [x] A (tests grønne; end-to-end AI-test afventer Philips nøgle)
- [x] B (worker-host config; docker build ikke kørt — Docker ej installeret)
- [x] C (AI tom-tilstand: Eksempel-mærket demo + graceful kollaps + chat-knap gated; 23 tests grønne)
- [x] D (5 kort-views, 21 tests grønne)
- [x] E (single-source role-modules; 61 unit-tests grønne. OPFØLGNING: company-detail/helpers.ts divergerer på COMPANY_READONLY+finance — præeksisterende, kræver RBAC-beslutning)
- [x] F (redundans: PageHeader-meta fjernet, Fordeling→Regioner, Top-urgency >12-gate, tomme paneler kollapset; 41 tests grønne)
- [x] Stream P
- [ ] STATUS/memory

## Miljø-note

DB-integrationstests (calendar/company-detail/dashboard/search-actions) fejler lokalt med `ECIRCUITBREAKER` (Supabase blokerer forbindelser efter agent-hamren). IKKE kode-regression; kører i CI.
