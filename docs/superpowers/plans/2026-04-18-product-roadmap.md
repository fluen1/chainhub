# ChainHub — Produkt-roadmap til lancering + AI-strategi (v2)

**Type:** Strategisk roadmap. Dækker (1) tiered product-strategi, (2) system-modenhed og lancerings-klarhed, (3) AI-integration i tre niveauer, (4) reel cost-research (ikke antagelser), (5) Bedrock-analyse, (6) page-by-page audit af alle 27 top-level sider, (7) UX/UI-principper baseret på moderne forskning (2010+).

**Persistent opbevaring:** Straks efter godkendelse kopieres denne plan til `docs/superpowers/plans/2026-04-18-product-roadmap.md` og commits til git. Der er source of truth fremadrettet; ændringer sker via PR'er.

**Status:** v2 efter bruger-feedback på v1. Rettet: fjernet prissætnings-antagelser, udskudt Vercel/SSL/Resend til efter lokal-godkendelse, DPA→DBA, nyere UX-forskning, page-audit-track tilføjet, "no information overload AND no empty whitespace" som eksplicit design-krav.

---

## 1. Context

Efter 12 leverede tracks er ChainHub teknisk modent på backend-niveau. Tilbage er:

1. **Produkt-strategi:** 3 pakker — **Basis (manuel)**, **Plus (AI-assist)**, **Enterprise (Full AI med cross-company)**. Ikke alle kunder betaler for AI.
2. **Lancerings-klarhed:** Dashboard + kerne-flows skal være produktions-klare — ikke bare teknisk, men UX-teoretisk (intuitive, pædagogiske, elegante, uden information-overload OG uden unødvendig whitespace).
3. **AI end-to-end tænkt igennem:** Cost-model skal bygge på **målte, reelle tal** — ikke antagelser. Bedrock-migration reelt planlagt med verificeret pris-sammenligning.
4. **Lokal-godkendelse før deploy:** Vercel, custom-domain+SSL og Resend _venter_ indtil bruger bekræfter lokalt at app'en er færdig.

**Rækkefølge:** Manuel færdig og lokal-godkendt → Plus AI-assist → Enterprise Full AI.

**Kanoniske referencer som denne plan bygger på:**

- `docs/superpowers/specs/2026-04-09-ai-extraction-system-design.md` (autoritativ for extraction-pipeline)
- `docs/spec/SPEC-TILLAEG-v2.md` (17 Fase 0-beslutninger)
- `docs/spec/roller-og-tilladelser.md` (RBAC)
- `docs/status/PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`

---

## 2. Tre-tier produktmodel

### Tier 1 — **ChainHub Basis** (manuel, ingen AI)

**Hvem:** Mindre kædegrupper (5-15 lokationer), omkostningsfølsomme, eller juridisk-konservative der ikke vil have AI på legal data.

**Indhold:** Alt eksisterende manuelt — selskaber, 34 kontrakttyper, sager, opgaver, personer, dokumenter, besøg, governance, finans, dashboard (urgency + health), email-digest, global søgning, multi-tenancy, permissions, audit-log, sensitivity, brugerstyring.

**IKKE inkluderet:** Ingen AI-features overhovedet.

**Pris:** Fastsættes efter cost-research i Phase A.0 (se afsnit 6). Udgangspunkt: baseline-drift (Supabase + hosting + email + support) + margin.

### Tier 2 — **ChainHub Plus** (AI-assist)

**Hvem:** Mellemstore kædegrupper (15-40 lokationer) der vil spare manuelt data-arbejde.

**Indhold:** Tier 1 +

- Document-extraction (upload kontrakt-PDF → AI udlæser strukturerede felter, shadow-mode + review-UI)
- Per-company AI-insights (allerede bygget; wired til `/companies/[id]`)
- Konfidens-scoring + human-in-the-loop for legal-kritiske felter
- AI-feedback-loop (korrektioner forbedrer prompts)

**Pris:** Fastsættes efter målt cost pr. typisk kunde-workload i Phase B pilot. Se afsnit 6.

### Tier 3 — **ChainHub Enterprise** (Full AI)

**Hvem:** Store kædegrupper (40+ lokationer) der vil have strategisk overblik på tværs.

**Indhold:** Tier 2 +

- Cross-company portfolio-insights (AI læser på tværs, finder mønstre ingen enkelt-selskabs-view kan fange)
- Søg & Spørg (RAG)
- Contract-renewal-risk-scoring
- Visit-notes → action-items
- Anomaly-alerts i dashboard

**Pris:** Fastsættes efter Phase C pilot med 2-3 enterprise-kunder. Forventes forhandlet pr. kunde, 12-måneders commitment.

### Tiering-implementation

- `Organization.tier` enum (`BASIS | PLUS | ENTERPRISE`), default `BASIS`
- `isAIEnabled(orgId, feature)` checker tier + feature-flag før hvert AI-kald (gate eksisterer som stub; skal enforces i Phase A.0)
- Upgrade-flow: admin-UI viser tier + kontakt-sales-CTA (ikke self-service i første omgang)

---

## 3. System readiness — hvad skal til for **Tier 1 Basis** lokalt færdig + senere kommerciel

Produkt-modenhed i to gates: (i) **lokalt færdig** (bruger-bekræftet før deploy-arbejde), (ii) **kommerciel-klar** (efter deploy + legal + pilot).

### 3.1 Gate 1 — Lokalt færdig (ingen deploy endnu)

| Feature                                                                    | Status                         | Kritikalitet                                  |
| -------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------- |
| Mobilnav (<1024px) — BLK-003                                               | Mangler                        | **Blokker** — kædeledere er mobile            |
| Onboarding-wizard ("opret første selskab")                                 | Delvist (dashboard-panel)      | **Blokker** — ny kunde må ikke møde tom skærm |
| Data-eksport (CSV/Excel for kontrakter/sager/opgaver/dokumenter/selskaber) | Mangler                        | **Blokker** — compliance-krav hos kunder      |
| GDPR data-sletnings-flow + audit                                           | Mangler                        | **Blokker** — lovkrav                         |
| Kunde-backup-download (zip af alle egne data)                              | Mangler                        | **Blokker** — contractual                     |
| Page-by-page audit af alle 27 top-level sider (afsnit 7)                   | Ikke startet                   | **Blokker**                                   |
| Dashboard-finalization (afsnit 5)                                          | Delvist                        | **Blokker**                                   |
| UX-audit heuristic + cognitive walkthrough                                 | Ikke startet                   | **Blokker**                                   |
| Performance-audit lokalt (Lighthouse >90 på alle top-pages)                | Ikke målt                      | **Blokker**                                   |
| A11y-retrofit: axe-core kørsel på alle sider + fix critical                | Delvist (WCAG Level A leveret) | **Blokker**                                   |

**Exit-kriterium (Gate 1 = lokalt færdig):**

- ✅ Alle "Blokker"-features ovenfor leveret
- ✅ Page-audit: 0 high-priority issues åbne
- ✅ Performance: Lighthouse >90 på dashboard + `/companies/[id]` + `/tasks` + `/contracts` + `/persons`
- ✅ A11y: axe-core fanger 0 critical på alle 27 sider
- ✅ Bruger klikker rundt lokalt og **bekræfter eksplicit** at app'en ser færdig ud

**Først efter Gate 1 starter Gate 2.**

### 3.2 Gate 2 — Kommerciel-klar (efter Gate 1 bekræftet)

| Krav                                                                           | Status                           |
| ------------------------------------------------------------------------------ | -------------------------------- |
| Vercel deploy + custom domain + SSL                                            | **Udskudt til Gate 2**           |
| Resend + domæne-verifikation (SPF/DKIM)                                        | **Udskudt til Gate 2**           |
| Supabase Pro + point-in-time recovery                                          | Skal opgraderes                  |
| Sentry alerts + support-inbox-integration                                      | Scaffolded, alerts-setup mangler |
| Uptime-monitor (BetterStack/UptimeRobot)                                       | Mangler                          |
| Status-side offentlig                                                          | Mangler                          |
| Runbook-opdatering + backup/DR-procedure                                       | Delvist                          |
| Support-SLA dokumenteret                                                       | Mangler                          |
| R2-produktionsstorage (erstatter lokal-upload)                                 | Mangler                          |
| **Databehandleraftaler (DBA)** med Supabase, Vercel, Resend, Anthropic, Sentry | Mangler — kræver advokat         |
| Servicevilkår til kunde                                                        | Mangler — kræver advokat         |
| DBA-skabelon til kunde                                                         | Mangler — kræver advokat         |
| Cookiepolitik + privatlivspolitik                                              | Mangler                          |
| Pricing-side + kontakt-flow                                                    | Mangler                          |
| Admin-onboarding-dokumentation (5-10 sider offentlig)                          | Mangler                          |
| 1 pilot-kunde aktivt bruger i 2 uger uden critical bugs                        | Blokker                          |

**Exit-kriterium (Gate 2 = Basis kommerciel-klar):** Alle Gate 2-krav opfyldt + pilot-kunde dogfood-valideret.

---

## 4. UX/UI-principper (moderne forskning, 2010+)

Bruger ønskede nyere videnskabelig forankring end 90'er/00'er-klassikere. Nedenstående er det moderne arbejds-canon, alle post-2010.

### 4.1 AI-specifikke UX-principper

**Primær reference: "Guidelines for Human-AI Interaction" — Amershi et al., CHI 2019** (Microsoft HAX Toolkit). 18 evidence-based retningslinjer struktureret i 4 faser:

**Initial interaction:**

1. Gør klart hvad systemet kan
2. Gør klart hvor godt systemet kan det (fejlrate, konfidens)

**During interaction:** 3. Tidsbestem services ud fra kontekst 4. Vis kontekstrelevant information 5. Match relevante sociale normer (dansk formalitet, du-form) 6. Afbødning af social bias

**When wrong:** 7. Support effektiv invokation (let at kalde AI) 8. Support effektiv dismissal (let at ignorere) 9. Support effektiv korrektion (let at redigere output) 10. Scope services ved tvivl (graceful degradation) 11. Gør klart hvorfor systemet gjorde som det gjorde

**Over time:** 12. Husk nylige interaktioner 13. Lær af brugeradfærd 14. Opdatér forsigtigt (ingen disruptive ændringer) 15. Opmuntr granulært feedback 16. Formidl konsekvenser af brugerhandlinger 17. Giv globale kontroller (kill-switch pr. feature) 18. Notificér om ændringer

**Sekundære moderne AI-UX-referencer:**

- Google PAIR "People + AI Guidebook" (2019, opdateret)
- Weisz et al. "Design Principles for Generative AI Applications" (CHI 2024)
- Hoffman et al. "Metrics for Explainable AI" (2018)

### 4.2 Dashboard- og information-density-principper

**Primær reference: Stephen Few — "Information Dashboard Design: Displaying Data for At-A-Glance Monitoring" (2013, 2. udg.)**

Kernebudskaber anvendt på ChainHub:

- Et dashboard er **ét skærmbillede** der besvarer "hvad har min opmærksomhed nu?" — ikke et sammensurium af grafer
- **Data-density er ikke fjenden** — uinformeret whitespace er. Tufte's "data-ink ratio" revurderet: ChainHub skal være information-rig men visuelt struktureret
- **Pre-attentive processing** (Ware 2013): Farve/form/position læses i <250ms. Brug dette til urgency-kodning, ikke dekoration
- **Gestalt-gruppering** som primær strukturering — relaterede KPIs klumpes, ikke ordnes i grid
- **Ingen sparklines uden baseline** — alle trends refererer til sammenlignelig baseline (peer, YoY, mål)

**Sekundær: Tamara Munzner — "Visualization Analysis & Design" (2014)**

- Task-driven design: start med spørgsmålet brugeren stiller, ikke dataen du har
- "Expressiveness + effectiveness" — visualiseringen skal kunne bære spørgsmålet, og gøre det effektivt

**Sekundær: Colin Ware — "Information Visualization: Perception for Design", 3. udg. (2013)**

- Perceptuel organisation går forud for kognitiv
- Attention er begrænset — dashboardet skal guide hvor øjet skal hen

### 4.3 Information-density vs whitespace — konkret ChainHub-regel

Bruger kravet: **"Ingen information-overload, men heller ikke unødvendig whitespace."**

Operationalisering:

**Tegn på information-overload (skal ELIMINERES):**

- Mere end 7±2 distinkte informations-chunks pr. viewport (Miller's Law opdateret af Cowan 2010: arbejdshukommelse = 4 chunks ved aktiv brug)
- Tekstblokker >3 linjer uden visuel break
- Konkurrerende primær-handlinger på samme skærm
- Farver der ikke kodér information (dekorativ farve = støj)
- Repeterede labels/ikoner uden proximity-gruppering

**Tegn på unødvendig whitespace (skal ELIMINERES):**

- `max-w-4xl` centrerede containere på skærme der kan bære mere data
- Padding >24px mellem sektioner der logisk hører sammen
- Tomme hjørner/kolonner i grid-layouts
- Hero-sektioner i data-visninger (hører hjemme på marketing-sider, ikke dashboards)
- Store ikoner uden informations-værdi

**Reference-eksempler** (studeres i audit):

- Linear.app (tætte lister, minimal chrome, stor data-density)
- Retool (enterprise dashboards, dense)
- Bloomberg Terminal (maksimal density, men velorganiseret)
- Stripe Dashboard (balance: dense hvor relevant, roligt hvor nødvendigt)

**Modeksempler** (undgå):

- Notion (bevidst blødt/luftigt — for lidt signal pr. skærm til operations-software)
- Marketing-SaaS-landingssider (hero + whitespace-dominant)

### 4.4 Interaktions-principper (opdateret fra klassisk)

Norman's "Design of Everyday Things" blev revideret 2013 (stadig gyldig). Nielsen's heuristikker blev suppleret af NN Group-opdateringer (2020-2024). Moderne tilføjelser:

- **Fitts's Law** — stadig sand; mobile-first gør den mere relevant (44×44pt minimum touch target, Apple HIG 2024)
- **Hick's Law** — stadig sand; modereret af progressive disclosure og predictive defaults
- **Cognitive Load Theory** (Sweller 2011-opdatering): tre typer load (intrinsic/extraneous/germane); reducér extraneous ved konsistens + progressive disclosure
- **Dual-coding theory** (Paivio, anvendt i moderne UX): ikon + tekst > kun ikon > kun tekst for scanning
- **Peak-End Rule** (Kahneman, 2011-bog "Thinking Fast and Slow"): onboarding og error-recovery er peak-momenter — invester her
- **Calm Technology** (Amber Case, 2015) — hvor meget opmærksomhed kræver interfacet? For kædegruppe-operations SaaS: så lidt som muligt, men så meget som nødvendigt

### 4.5 Tilgængelighed (moderne standarder)

- WCAG 2.2 (2023) — nyere krav end 2.1; ChainHub's a11y-track nåede 2.1 Level A, 2.2-delta er ikke stor
- W3C Cognitive Accessibility Task Force (COGA) guidelines (2021+)
- "Inclusive Design Principles" (Swan et al. 2021)

### 4.6 Dansk + ChainHub-specifik kontext

Fra bruger-memory (stadig gyldig):

- Skandinavisk minimalisme (tolket ift. information-density: MINIMAL dekoration, ikke minimal data)
- Urgency-first (specifikke items, aldrig counts — DEC-F0-006)
- Dansk du-form, dansk fejlbeskeder via `labels.ts`
- Tailwind-only

**Tilføjes:**

- Density-regel fra 4.3
- 18 HAX-guidelines i AI-UI
- Visuel rytme: skærme skal have "puls" — afvekslende tætte sektioner (lister) og "stille" sektioner (KPI-overskrifter) — ikke uniformt busy

---

## 5. Dashboard-audit + finalization

### 5.1 Nuværende tilstand

Dashboard indeholder:

- Portfolio-totals (KPIs øverst)
- Urgency-liste (specifikke items, aldrig counts — DEC-F0-005 + F0-006 + F0-008 + F0-009)
- Timeline-river grupperet pr. måned
- Heatmap-grid (selskaber × tid, health-farve)
- Rolle-adaptive højre-paneler
- Onboarding-panel de første 14 dage (DEC-F0-013)

### 5.2 Audit-spørgsmål der skal besvares (Phase A)

1. **Information-hierarki:** Overskygger KPI-blokken urgency-panelet? Eye-tracking eller heatmap-tool.
2. **Density vs whitespace:** Er der tomme hjørner? For lidt data pr. viewport? Sammenlign mod Linear/Retool-benchmarks (afsnit 4.3).
3. **Empty states (6 varianter):** 0 selskaber, 1 selskab, 0 kontrakter, 0 urgency-items, 0 besøg, 0 opgaver — hver skal have: tydelig CTA, ingen tom flade.
4. **Mobile layout (<1024px):** BLK-003 blokker — hele dashboardet skal have mobile-variant.
5. **Cognitive load:** 5-6 paneler samtidig — test om bruger finder "hvad er mest kritisk lige nu" inden for 5 sek (cognitive walkthrough).
6. **Onboarding-panel timing:** 14 dage eller 3 tasks completed — hvad er trigger? Skal testes.
7. **"Hvorfor er dette vigtigt?"** Urgency-items mangler kontekstuel "why-it-matters"-sentence (pædagogisk for nye brugere).
8. **Print-friendly:** Månedlig rapport-udskrift er plausibel use-case — `@media print`-stylesheet mangler.
9. **Datum-konsistens:** Efter tech-debt-session bruger alle datoer `formatDate`/`formatDanishDate` — verificér.
10. **Rolle-adaption:** Viser GROUP_LEGAL det rigtige? GROUP_FINANCE? Skal verificeres med faktisk bruger-test.

### 5.3 Dashboard-finalization-output (del af Phase A)

- UX-audit-rapport med severity-liste
- Finaliserede empty states (6 varianter)
- Mobile layout
- Print-stylesheet
- Information-density-målinger mod benchmark-dashboards

---

## 6. AI cost-model — **research-baseret, ikke antagelse**

Bruger-krav: stop med at gætte priser. Byg model på reelle målinger.

### 6.1 Verificerede priser (fra source, 2026-04-18)

**Anthropic Direct** (kilde: `claude.com/pricing` pr. 2026-04-18):

| Model             | Input ($/MTok) | Output ($/MTok) | Cache write | Cache read |
| ----------------- | -------------- | --------------- | ----------- | ---------- |
| Claude Opus 4.7   | $5             | $25             | $6.25       | $0.50      |
| Claude Sonnet 4.6 | $3             | $15             | $3.75       | $0.30      |
| Claude Haiku 4.5  | $1             | $5              | $1.25       | $0.10      |

- Batch processing: 50% rabat af standard-rater
- US-only inference: 1.1× multiplier
- Prompt-caching TTL: 5 minutter

**AWS Bedrock** (kilde: `aws.amazon.com/bedrock/pricing` pr. 2026-04-18):

Kun delvist verificerbart fra public pricing page:

| Model                           | Region                | Input ($/MTok) | Output ($/MTok) | Note                                    |
| ------------------------------- | --------------------- | -------------- | --------------- | --------------------------------------- |
| Claude 3.5 Sonnet v2            | US East (N. Virginia) | $6             | $30             | Public Extended Access, eff. 1 dec 2025 |
| Claude 3.5 Sonnet (cache write) | US East               | $7.50          | —               |                                         |
| Claude 3.5 Sonnet (cache read)  | US East               | $0.60          | —               |                                         |
| Claude 3.5 Sonnet (batch)       | US East               | $3             | $15             |                                         |

**Problem:** Bedrock-pricing-siden viser ikke Haiku eller Opus, og Frankfurt-priser er ikke eksplicit listet. Provisioned Throughput kræver direkte AWS-kontakt. **Dette skal undersøges direkte med AWS account team før Bedrock-migration kan prissættes nøjagtigt.**

Foreløbige observationer:

- Bedrock 3.5 Sonnet US East ($6/$30) er ~2× Anthropic Direct Sonnet 4.6 ($3/$15) — men det er **forskellige modeller**. Ikke apples-to-apples.
- Samme-model-sammenligning mellem Direct og Bedrock kræver at Anthropic publicerer og AWS publicerer samme model på begge — skal verificeres.

### 6.2 Cost-research-task (Phase A.0 — **FØRSTE konkrete leverance**)

Før nogen tier-prissætning kan låses, skal følgende udføres:

1. **Instrument real workloads** — kør 20 anonymiserede test-kontrakter gennem eksisterende extraction-pipeline (kræver pipelinen wired + credit + worker — også Phase A.0 leverance), log præcis token-forbrug pr. pass + total cost pr. dokument
2. **Måle company-insights** over 1 uges seed-data-brug — hvor mange regenerations, hvor mange tokens, hvor mange cents
3. **Bedrock-research:**
   - Kontakt AWS account team for Provisioned Throughput-priser pr. model i Frankfurt
   - Kør 10 samme dokumenter gennem Anthropic Direct OG (når Bedrock stub erstattes — Phase C) Bedrock for latency + cost-sammenligning
   - Dokumentér data-residency garantier (DBA-relevant)
4. **Volume-modellering:** Byg regneark med kunde-profiler (S: 10 selskaber / M: 30 / L: 50 / XL: 80+), kontrakt-upload-frekvens, RAG-query-volumen → output: cost/kunde/måned pr. tier
5. **Margin-målsætning:** Fastlæg mål for AI-cost som % af pris (forslag: Plus 15-25%, Enterprise 10-15%) — skal bekræftes af dig

**Output:** Dokument `docs/build/AI-COST-MODEL.md` med:

- Målte priser pr. operation
- Regneark-model pr. kunde-størrelse
- Prissætnings-anbefaling med eksplicit forudsætnings-liste

**Denne research er blokker for at låse Tier 2/3-pricing. Indtil den er lavet, er alle priser placeholder.**

### 6.3 Cost-beskyttelse (skal implementeres uanset prismodel)

- `OrganizationAISettings.monthly_cost_cap_usd` enforces i worker
- Soft-alerts ved 50/75/90% forbrug → admin-email
- Hard-cap: job afvises + admin notificeres
- Cost-dashboard i `/settings/ai-usage` (admin-only, viser forbrug per feature)
- Ingen kunde-UI-"timer" — det skaber friction; intern tracking + månedlig rapport

---

## 7. Page-by-page audit (alle 27 top-level sider)

Bruger-krav: gennemgå alle top-level + vurder om deeper-level sider er nødvendige eller kan gøres anderledes.

### 7.1 Metode

For hver top-level side (liste fra `src/app/(dashboard)/*`):

1. **Formål:** Hvilken opgave løser siden? (single-sentence)
2. **Information-density:** Density-check mod afsnit 4.3 — overload eller whitespace?
3. **Nielsen + HAX:** Checkliste-gennemgang
4. **Deeper pages:** Er `/[id]/` og `/[id]/<subpage>` nødvendige separate routes, eller kan de inlines? Fx single-page-design (som `/companies/[id]` i Plan 4C) vs subroute-design
5. **Cognitive walkthrough:** Kan brugeren løse primær-task inden for 5 sek?
6. **Mobile:** Bryder siden ned under 1024px?
7. **Empty states:** Defineret og testet?
8. **Performance:** Lighthouse-score?

### 7.2 Forventet side-inventar (verificeres i audit)

Top-level routes i `src/app/(dashboard)/`:

1. `/dashboard` — portefølje-overblik (audit afsnit 5)
2. `/companies` — portfolio-liste
3. `/companies/[id]` — single-page detalje (Plan 4C — evaluer om mønsteret holder)
4. `/contracts` — liste med grupperet/flat/kanban-view
5. `/contracts/[id]` — detalje med versioner
6. `/contracts/new` — opret
7. `/cases` — liste
8. `/cases/[id]` — detalje
9. `/cases/new` — opret
10. `/tasks` — liste (grouped/flat/kanban)
11. `/tasks/[id]` — single-page detalje (Sprint 8-rewrite)
12. `/tasks/new` — opret
13. `/persons` — portfolio-liste
14. `/persons/[id]` — detalje (HR-view)
15. `/persons/new` — opret
16. `/documents` — liste
17. `/documents/review/[id]` — AI review-UI (Plus-tier)
18. `/visits/[id]` — detalje
19. `/visits/new` — opret
20. `/calendar` — tværgående kalender
21. `/search` — global søgning
22. `/settings` — organisation + brugere
23. `/settings/users` — brugerstyring
24. `/settings/ai-usage` — (ny, Phase A.0) cost-dashboard
25. Auth: `/login`
26. API + cron (ikke UI, men tælles): `/api/cron/daily-digest`, `/api/upload`, `/api/uploads/[...path]`

(27. er lidt grænseoverskridende — vi afklarer faktisk optælling i audit)

### 7.3 Spørgsmål der skal besvares i audit

For hver `/[id]/`-route: Er der subroutes (fx `/companies/[id]/documents`, `/companies/[id]/contracts`)? Plan 4C kollapsede selskabs-detalje til én side. **Er det mønster udført konsekvent?** Tasks-detail fik samme behandling i Sprint 8. Skal cases, contracts, persons også?

Alternativer pr. route:

- **Tabs** (klassisk, god på mobile, kan bære mange sektioner)
- **Single-scroll med sticky section-headers** (som companies — god til at se alt, tung på data)
- **Master-detail side-om-side** (desktop-stærk, bruger plads godt)
- **Modal-drill-down** (god til edit, dårlig til informations-navigation)

Audit-output: Anbefaling pr. route + samlet konsistens-vurdering.

### 7.4 Leverance

`docs/status/PAGE-AUDIT-2026-04.md` med:

- Side-liste + formål
- Density-rating (overloaded / balanced / sparse)
- Mobile-rating (works / needs-work / missing)
- Anbefaling: behold struktur / flat til single-page / split til subroutes
- Prioriteret fix-liste

---

## 8. Bedrock-migration — konkret analyse

### 8.1 Hvorfor Bedrock kan være relevant

1. **EU data-residency** — Anthropic Direct routes gennem US; Bedrock Frankfurt (eu-central-1) holder data i EU under AWS's Standard Contractual Clauses. DBA-krav hos store danske kunder.
2. **Provisioned Throughput** — volume-commitments kan give rabat og garanteret kapacitet (ingen rate-limits i spikes). **Reel rabat-størrelse skal verificeres med AWS account team.**
3. **AWS-økosystem** — hvis øvrig infrastruktur flytter til AWS, samles billing + compliance + support.
4. **Compliance** — AWS's SOC2/ISO/HIPAA-attesteringer arves via Bedrock.

### 8.2 Hvorfor Bedrock måske IKKE er relevant

1. **Pris** — verificerede Bedrock-numre (afsnit 6.1) antyder Bedrock kan være dyrere end Anthropic Direct for ikke-provisioned brug. Skal verificeres model-for-model.
2. **Kompleksitet** — AWS SDK, IAM, model-access-ansøgning (2-4 ugers sagsbehandling)
3. **Model-lag** — Anthropic Direct har typisk nye modeller 1-4 uger før Bedrock
4. **Oversight** — direkte forhold til Anthropic kan være enklere ved support-eskalering

### 8.3 Beslutnings-trigger

Migrér til Bedrock når MINST én rammer:

- Første betalende kunde stiller eksplicit krav om EU data-residency (dokumenteret i DBA-forhandling)
- Målt månedlig spend >$2.000 og Provisioned Throughput tilbyder verificerbar rabat ≥25%
- Rate-limits rammer i produktion
- Juridisk rådgivning kræver det

### 8.4 Migration-plan (2 uger arbejde, trigges af én af ovenstående)

1. **AWS-opsætning (uge 1)**
   - AWS-konto + billing-alerts + cost-cap
   - Bedrock model-access-ansøgning (Sonnet + Haiku i Frankfurt)
   - IAM-role med scoped permissions (`bedrock:InvokeModel` kun)
   - Secrets i env (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` eller instance profile)
2. **Kode-implementation (uge 1-2)**
   - `npm install @aws-sdk/client-bedrock-runtime`
   - `src/lib/ai/client/bedrock.ts` opfylder `ClaudeClient`-interface (allerede defineret)
   - Factory-patch i `src/lib/ai/client/index.ts` (stub erstattes)
   - Cost-lookup opdateres til Bedrock-priser (pr. verificeret data)
3. **Regression-test (uge 2)**
   - Unit-tests (mocket AWS SDK)
   - Integration: 10 gold-standard-dokumenter gennem Bedrock vs Anthropic, >95% field-match accept
   - Cost-verifikation: 100 real requests, faktisk AWS-bill mod cost-tracking
4. **Gradvis rollout**
   - 1 pilot-kunde switches via `AI_PROVIDER=bedrock` env-override
   - Monitor latency (Bedrock EU +200-400ms forventet)
   - Efter 1 uges stabil drift: default-flip for nye kunder

### 8.5 Risici + mitigering

| Risiko                                                     | Mitigering                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Bedrock model-access-ansøgning afvises eller tager >4 uger | Start ansøgning som _forsikring_ tidligt — ikke forpligtende at bruge      |
| Output-divergens Direct vs Bedrock                         | Regression-suite + gradual rollout                                         |
| Højere latency                                             | pgboss async maskerer for bruger                                           |
| AWS billing-spike                                          | Billing-alerts + AWS cost-cap + Provisioned Throughput for forudsigelighed |
| Region-fallback                                            | Primær Frankfurt, fallback Ireland (eu-west-1)                             |

---

## 9. Samlet roadmap — 3 faser

### Phase A — **Basis lokalt færdig + kommerciel-klar** (est. 10-16 uger)

**Output:** Tier 1 Basis produktions-klar. Bruger har bekræftet app ser færdig ud lokalt → deploy startes.

**A.0 — Cost + AI-infrastructure research (2-3 uger, FØRSTE leverance)**

- Queue-worker-proces (`scripts/worker.ts`, Hetzner-klar)
- `isAIEnabled(org, feature)` enforces
- `monthly_cost_cap_usd` enforces
- Cost-dashboard `/settings/ai-usage`
- Kør AI-cost-research per afsnit 6.2 → `docs/build/AI-COST-MODEL.md`
- Start AWS Bedrock model-access-ansøgning som forsikring

**A.1 — Page-by-page audit (2-3 uger, parallel)**

- Alle 27 top-level sider gennemgås per afsnit 7.1 metode
- Output: `docs/status/PAGE-AUDIT-2026-04.md` med severity-liste
- Prioriteret fix-liste bliver input til A.3

**A.2 — Cost-research udfald → pricing-beslutning (1 uge, afhænger af A.0)**

- Review AI-cost-model-dokument
- Lås Tier 1/2/3-priser eller udskyd Tier 2/3 til efter pilot
- Bruger-godkendelse

**A.3 — Manglende features (3-4 uger, parallel)**

- Mobilnav (BLK-003)
- Data-eksport (CSV/Excel: kontrakter, sager, opgaver, dokumenter, selskaber)
- GDPR data-sletnings-flow + audit
- Kunde-backup-download
- Onboarding-wizard (3 steps, DEC-F0-013)
- R2-produktionsstorage (interface-klar; swap ved deploy)

**A.4 — UX/UI-audit + fixes (3-4 uger, parallel, afhænger af A.1)**

- Heuristic evaluation (HAX 18 + Nielsen opdateret + afsnit 4)
- Dashboard-finalization (afsnit 5)
- Density-analyse + fixes for information-overload OG empty-whitespace
- Empty states (6 varianter alle sider)
- Mobile layout alle top-pages
- Print-stylesheet
- A11y-retrofit til WCAG 2.2 Level AA (delta fra 2.1)
- Performance-audit Lighthouse ≥90 på alle top-pages
- Design-system-dokumentation: typography, spacing, density, color (eksplicit density-regel fra 4.3)

**A.5 — Bruger-godkendelse af Gate 1 (lokalt)**

- Bruger klikker grundigt rundt i app'en lokalt (seed-data)
- Verificerer alle 27 sider
- Godkender med eksplicit "det ser færdigt ud lokalt" — dokumenteret
- **Først herefter starter A.6**

**A.6 — Legal + compliance (2-3 uger, EFTER Gate 1, parallel med A.7)**

- DBA med Supabase, Vercel, Resend, Anthropic, Sentry (advokat)
- Servicevilkår til kunde (advokat)
- DBA-skabelon til kunde (advokat)
- Cookiepolitik + privatlivspolitik
- GDPR-compliance-dokumentation (data-flow-kort)

**A.7 — Deploy-infrastruktur (2-3 uger, EFTER Gate 1)**

- Vercel deploy + custom domain + SSL
- Resend + SPF/DKIM + deliverability-test
- Supabase Pro + PITR
- Sentry alerts + support-inbox
- Uptime-monitor + status-side
- Runbook-opdatering

**A.8 — Pilot + kommerciel-klar (2-3 uger)**

- 1 pilot-kunde onboardes + 2 ugers stabil drift
- Admin-onboarding-dokumentation (5-10 sider offentlig)
- Pricing-side + kontakt-formular
- Commercial launch når alle Gate 2-kriterier opfyldt

**Phase A gate-kriterier:**

- Gate 1 (lokalt færdig): alle A.0-A.5 leverancer + bruger-bekræftelse
- Gate 2 (kommerciel-klar): alle A.6-A.8 leverancer + pilot-valideret

---

### Phase B — **Tier 2 Plus AI-assist live** (est. 8-12 uger, efter Phase A Gate 2)

Bygger på `ai-extraction-system-design.md` Phase 1.

**B.1 — Document-extraction Phase 1 (4-6 uger)**

- Wire pipeline til upload-flow
- Review-UI på `/documents/review/[id]` (udvide eksisterende)
- Shadow mode
- Gold-standard-dataset (20-30 kontrakter, 3 typer: EJERAFTALE, LEJEKONTRAKT_ERHVERV, ANSAETTELSESKONTRAKT)
- Regression-suite: 90% field-accuracy på legal-kritiske felter
- Feedback-loop med analytics-rapport
- DocumentExtraction-UI på `/persons/[id]` (løn, opsigelsesvarsel, pension, non-compete)

**B.2 — Plus-pilot (2-3 uger parallelt)**

- 1-2 pilot-kunder på Tier 2 Plus (rabat)
- 2 uger shadow-mode først
- Graduate til human-in-the-loop
- Ugentlige feedback-samtaler

**B.3 — Post-pilot pricing-justering (1 uge)**

- Real-world cost pr. kunde måles
- Tier 2-pris låses (eller justeres fra A.2-udgangspunkt)
- Commercial launch af Plus

**Phase B exit-kriterier:**

- 2 pilot-kunder aktivt bruger Plus i 4+ uger, 0 critical AI-fejl
- Field-accuracy >90% på legal-kritiske felter
- AI-cost pr. kunde inden for budget fra cost-model
- 0 auto-accept af parter/datoer/ownership-% (lovkrav)
- Feedback-loop aktivt, >10 korrektioner/kunde/måned

---

### Phase C — **Tier 3 Enterprise Full AI + Bedrock** (est. 12-18 uger, efter Phase B exit)

**C.1 — Cross-company portfolio-insights (4-5 uger)**

- Ny `PortfolioInsightsCache`-model
- `generatePortfolioInsights` Haiku-job
- Dashboard-integration med 3-5 portefølje-kort
- Anomaly-detection (finansielle, contract-renewal, governance-gaps)
- Grounding: alle alerts linker til specifikke entities

**C.2 — Document-extraction Phase 2 (4-6 uger)**

- 3 ekstra schemas (FORSIKRING, DRIFTSAFTALE, VEDTAEGTER — prioriteret per pilot-efterspørgsel)
- Contract-renewal-risk-scoring
- Visit-notes → action-items

**C.3 — Bedrock-migration (2 uger, triggers fra 8.3)**

- Implementation per plan 8.4
- Regression-suite vs Anthropic Direct
- Gradual rollout

**C.4 — Søg & Spørg / RAG (4-6 uger)**

- pgvector-opsætning + embeddings-pipeline
- Retrieval + grounded response
- Query-type-detection
- UI i global-search-bar

**Phase C exit-kriterier:**

- 2-3 enterprise-pilot-kunder aktivt bruger Tier 3 i 8+ uger
- Bedrock <5% fejlrate (hvis migreret)
- RAG <2s median-latency, >80% user-rated relevans
- AI-cost pr. enterprise-kunde inden for budget

---

### Phase D — **Polish + ekspansion** (løbende)

- Task/case auto-kategorisering (volume-afhængig)
- Multi-language (engelsk)
- TaskParticipant + CompanyNote med sensitivity
- Cost-optimering (prompt-caching 5-min TTL, batch-processing 50%)
- E-conomic-integration
- Native mobile-apps (hvis markedsvalideret)
- Advanced dashboard-personalisering

---

## 10. Åbne beslutninger (kræver bruger-action)

| Beslutning                               | Deadline                   | Impact                       |
| ---------------------------------------- | -------------------------- | ---------------------------- |
| Godkend tre-tier-struktur                | Før Phase A starter        | Styrer feature-gating        |
| Godkend AI-cost-model-output (A.0 → A.2) | Phase A.2                  | Låser Tier 2/3-priser        |
| Pilot-kunde #1 til Basis (lokalt Gate 1) | Phase A slutning           | Blokker                      |
| Advokat-aftale: DBA + servicevilkår      | Phase A Gate 1+            | Blokker for Gate 2           |
| Sentry + Supabase Pro billing            | Phase A.7                  | Required for prod            |
| Hetzner/Fly.io-valg til worker-host      | Phase A.0                  | pg-boss worker deploy-target |
| AWS-konto + Bedrock-ansøgning            | Phase A.0 (som forsikring) | 2-4 ugers sagsbehandling     |
| Pilot-kunde #1+#2 til Plus               | Phase B start              | Blokker                      |
| Pilot-kunde #1-3 til Enterprise          | Phase C start              | Blokker                      |
| Support-stack (Intercom/email-inbox)     | Phase A.7                  | Commercial-klarhed           |

---

## 11. Risici + mitigering

| Risiko                                               | Sandsynlighed | Impact                | Mitigering                                             |
| ---------------------------------------------------- | ------------- | --------------------- | ------------------------------------------------------ |
| AI-cost-research afslører Tier 2-økonomi ikke holder | Medium        | Stor                  | A.2 gate — justér tiering før kommit                   |
| Page-audit afslører behov for store UX-ændringer     | Medium        | 3-5 ugers forsinkelse | Budget 2 ugers buffer i A.4                            |
| Ingen pilot-kunde klar til Gate 1/Gate 2             | Medium        | Blokker lancering     | Start outreach i A.3                                   |
| Bedrock-priser gør provider uinteressant             | Lav-medium    | Blokker EU-migration  | Bliv på Anthropic Direct; juridisk mitigation          |
| Performance-budget miss                              | Medium        | Gate 1-blokker        | Tidlig audit i A.4                                     |
| Legal DBA-forsinkelse                                | Høj           | Blokker Gate 2        | Start advokat uge 1 af Gate 2                          |
| Field-accuracy <90% på gold-standard                 | Høj ved start | Blokker Plus-launch   | Iterativ prompt-tuning + konservativ human-in-the-loop |
| Anthropic pris-hop eller policy-skift                | Lav           | Medium                | Provider-abstraction klar; multi-provider-muligt       |
| Kædegruppe-markedet mindre end antaget               | Lav-medium    | Forretning            | Markeds-research før Phase C                           |

---

## 12. Opsummering

**3 tiers:** Basis (manuel) · Plus (AI-assist) · Enterprise (Full AI cross-company)

**3 faser med 2 gates i Phase A:**

1. **Phase A — Basis** (10-16 uger): Gate 1 lokalt færdig (bruger bekræfter) → Gate 2 kommerciel-klar (deploy + legal + pilot)
2. **Phase B — Plus** (8-12 uger): Document-extraction live, pilot-valideret
3. **Phase C — Enterprise** (12-18 uger): Cross-company AI + Bedrock + RAG

Total: 30-46 uger til alle tre tiers kommercielle.

**Cost-strategi:** STOP med antagelser. Phase A.0 leverer målt AI-cost-model før pricing låses. Bedrock-priser skal verificeres med AWS account team.

**Pricing:** Fastsættes efter A.0 cost-model. Ingen placeholder-priser i denne plan.

**UX:** Moderne forskningsgrundlag — HAX 18 guidelines (Amershi 2019), Stephen Few (2013), Munzner (2014), Ware (2013), Cowan's opdaterede arbejdshukommelse (2010), WCAG 2.2 (2023). Eksplicit density-regel: ingen information-overload OG ingen unødvendig whitespace. Reference-benchmarks: Linear, Retool, Stripe Dashboard.

**Deploy:** Vercel/SSL/Resend venter til bruger bekræfter lokal-færdighed. Ingen antagelse om at deploy-arbejdet er næste skridt.

**Juridisk:** DBA (databehandleraftale) — ikke DPA. Advokat-involvering i Phase A Gate 2.

---

## 13. Næste skridt efter godkendelse

1. **Kopiér plan til `docs/superpowers/plans/2026-04-18-product-roadmap.md`** og commit til git (persistent hjemsted)
2. **Opret separate execution-planer** pr. Phase A sub-track (A.0, A.1, A.3, A.4) når vi er klar til at eksekvere
3. **Start AWS Bedrock model-access-ansøgning** (ekstern, som forsikring)
4. **Start advokat-samtaler** for DBA + servicevilkår (ekstern)

Denne plan erstatter ikke eksisterende autoritative specs (`SPEC-TILLAEG-v2.md`, `ai-extraction-system-design.md`) — den re-sekvenserer og udvider scope til kommerciel lancering + tiering + UX-modenhed. Spec'en for extraction-pipeline forbliver source of truth for detaljer.
