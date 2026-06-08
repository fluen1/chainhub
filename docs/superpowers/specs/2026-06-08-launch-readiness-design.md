# Launch-readiness — fuld kommerciel launch af ChainHub

**Dato:** 2026-06-08
**Status:** Godkendt af Philip 2026-06-08
**Branch:** `feat/launch-readiness` (PR afstemmes med Rico før master, jf. CopenAI-regel)

## Mål

ChainHub gøres komplet klar til fuld kommerciel launch på **chainhub.dk**: produktionsdeploy-klar, kommercielt indhold (pricing, kontakt, docs), legal-dokumenter og kvalitets-gate gennemført. Kodebasen er allerede moden (1190 tests, hardening, GDPR, a11y) — dette er launch-operationalisering.

## Låste beslutninger (2026-06-07/08)

| Beslutning     | Værdi                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Navn + domæne  | **Chainhub / chainhub.dk** (ledigt, ~130 kr./år via simply.com). Rebrand genovervejes først ved international ekspansion. |
| Basis          | 3.500 kr./md (ingen AI)                                                                                                   |
| Plus           | 9.500 kr./md, 50 ekstraktioner inkl., 75 kr./ekstra. Én Plus-tier — S/L-split udskudt.                                    |
| Enterprise     | Forhandles, floor 32.000 kr./md, fair-use 500 ekstraktioner/md                                                            |
| Onboarding-fee | 1 kr./dokument ved initial import, max 2.500 kr. ("data-migrations-setup")                                                |
| AI cost-cap    | Default $50/md pr. ny org beholdes                                                                                        |
| Anthropic-tier | Tier 2 ($40 deposit, 1.000 RPM) ved prod-start — løser samtidig BLK-005                                                   |
| Legal-proces   | Claude udkaster komplette dokumenter; Philip (jurist) reviewer selv                                                       |
| Gate 1         | Claude kører grundig browser-gennemgang af alle 27 sider og dokumenterer                                                  |

## ⚠️ Bindende begrænsning: dental-eksklusion

Philip er Legal Counsel hos Tandlægen.dk. Tandklinikker uden for koncernen og koncernens leverandører må **aldrig** være kunder/targets uden skriftligt samtykke. Derfor:

1. ICP og alt kundevendt materiale nævner kun **optiker-, fysio-, læge- og franchisekæder** — aldrig dental
2. Seed-/demo-data omdøbes fra TandlægeGruppen til neutral vertikal
3. Indgående henvendelser fra tandlægekæder er en skriftligt-samtykke-sag — opsøges ikke
4. Kommerciel launch er bibeskæftigelse → Alexander+René orienteres (Philips ansvar)

## Arkitektur

### 1. Public-lag — ny `(public)` route group

Marketing-sider bygges i den eksisterende Next.js-app (valgt frem for separat site — ét deploy, delt design-system, genbrug af Resend):

```
src/app/(public)/
├── page.tsx                      # Forside (erstatter rod-redirect): værditilbud + Log ind
├── pricing/page.tsx              # Tier-tabel m. låste priser + onboarding-fee
├── kontakt/page.tsx              # Kontaktformular (Zod + Resend + mailto-fallback)
├── docs/                         # Onboarding-dokumentation (~7 sider)
└── legal/
    ├── vilkaar/page.tsx          # Servicevilkår (B2B, dansk ret)
    ├── privatliv/page.tsx        # Privatlivspolitik (GDPR)
    ├── cookies/page.tsx          # Cookiepolitik
    └── databehandleraftale/page.tsx  # DBA art. 28 + download
```

- `proxy.ts` opdateres: public routes kræver ikke session
- Samme Tailwind-design-system; public layout med egen header/footer (nav: Pricing, Docs, Kontakt, Log ind)
- Authenticated bruger på `/` redirectes IKKE — forsiden viser "Gå til dashboard"

### 2. Gate 1 — browser-gennemgang

Playwright-sweep af alle 27 dashboard-sider: console-fejl, brudte links, screenshots, CRUD-stikprøver. Fund fixes i samme track. Output: Gate 1-rapport i `docs/status/` som formel bekræftelse.

### 3. Dental-sanering

- `prisma/seed.ts` (28 forekomster): TandlægeGruppen Holding ApS → **OptikGruppen Holding ApS**, @tandlaegegruppen.dk → @optikgruppen.dk
- `scripts/seed-extraction.ts`, `CLAUDE.md`, `README.md`, e2e-tests opdateres tilsvarende
- Historiske design-mockups i `docs/design/` røres ikke
- 5 stale agent-worktrees i `.claude/worktrees/` + tilhørende branches slettes

### 4. Pricing-side + kontaktformular

- Tier-sammenligning med feature-matrix (Basis: kerne-CRM uden AI; Plus: + AI-ekstraktion/insights; Enterprise: + portfolio-AI, RAG, SLA)
- Onboarding-fee forklaret som data-migrations-setup
- Kontaktformular: server action, Zod-validering, Resend-mail til Philip + kvittering til afsender; Resend-fejl → handlingsanvisende fejlbesked med mailto-fallback
- CTA: "Book demo" → kontaktformular (ingen self-service signup i v1)

### 5. Legal-dokumenter

| Dokument          | Indhold                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Servicevilkår     | B2B SaaS, dansk ret/værneting, ansvarsbegrænsning, betalingsvilkår (tier + onboarding-fee), 12 mdr. Enterprise-commitment, fair-use, opsigelse, databehandling-reference |
| Privatlivspolitik | Dataansvarlig (kunde) vs. databehandler (ChainHub) afklaret; registreredes rettigheder; opbevaring                                                                       |
| Cookiepolitik     | Kun funktionelle cookies (session) — ingen tracking i v1                                                                                                                 |
| DBA-skabelon      | GDPR art. 28-konform; underdatabehandlere: Supabase (EU), Vercel, Resend, Anthropic, Sentry, Cloudflare; instruks, sikkerhed, audit, sletning                            |

Philip reviewer alle fire før publicering.

### 6. Onboarding-dokumentation (~7 sider under /docs)

Kom godt i gang · Selskaber & ejerskab · Kontrakter & AI-ekstraktion · Sager & opgaver · Brugere & roller · Eksport & GDPR · FAQ. Dansk, du-form, skærmbilleder fra saneret seed-data.

### 7. Deploy-forberedelse

- **R2-bucket** oprettes via Cloudflare MCP; swap er kode-klar (`STORAGE_PROVIDER=r2` + 4 env-vars)
- **Env-tjekliste**: `.env.production`-skabelon med alle påkrævede vars (valideres af `src/lib/env.ts`)
- **Resend DNS**: SPF/DKIM-records dokumenteres klar til domænekøb
- **BetterStack**: uptime-monitor + offentlig status-side (gratis tier) — lukker A.7 status-side-kortet
- **Bootstrap**: verificér/byg script til sikker oprettelse af første org + GROUP_OWNER i prod uden seed-data
- **Sentry-alerts**: alert-regler dokumenteres (oprettes når prod-DSN findes)

### 8. Eksterne actions (Philip) — samlet tjekliste leveres til sidst

Domænekøb chainhub.dk · Vercel Pro ($20/md) · Supabase Pro ($25/md) · Anthropic Tier 2 ($40) · BetterStack-konto · orientering af Alexander+René · AWS Bedrock (venter — trigger: EU-residency-krav eller spend >$2.000/md)

## Test & kvalitet

- Hver ny public route: unit-tests (rendering, form-validering) + tilføjes til axe-a11y-sweep og e2e-smoke
- Kontaktformular: happy path + Resend-fejl + spam-guard (honeypot)
- Gate ved hvert checkpoint: format, lint, tsc, build, alle tests grønne
- Gate 1-rapport som evidens før deploy

## Fejlhåndtering

- Kontaktformular degraderer til mailto ved Resend-fejl
- Public-sider har ingen DB-afhængighed (statisk indhold) — kan ikke fejle på Supabase-nedetid
- Eksisterende graceful AI-degradation uændret

## Rækkefølge

1. Gate 1-sweep + fixes
2. Dental-sanering + worktree-oprydning
3. Public-lag: forside, pricing, kontakt
4. Legal-dokumenter (4 stk.)
5. Onboarding-docs
6. Deploy-forberedelse (R2, env, bootstrap, DNS-doc)
7. Ekstern tjekliste + Trello-opdatering + PR til Rico

## Uden for scope

- Self-service signup/betaling (Stripe) — v2; salg sker via demo-booking
- Plus-S/L-split — afventer pilot-data
- AWS Bedrock-migration — trigger-styret
- Pilot-outreach (A.8) — ikke kode; sker efter deploy
- Rebrand — genovervejes ved international ekspansion
