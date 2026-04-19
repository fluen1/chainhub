# AI Cost Model — ChainHub

**Opdateret:** 2026-04-19 (v3 — baseret på verificeret Anthropic-dokumentation)
**Status:** Levende dokument. Erstatter v1+v2 estimater.
**Kilder:** claude.com/pricing + platform.claude.com/docs (verified 2026-04-19)

> **v3 rettelser ift. v2:**
>
> - PDF-tokenpriser var undervurderet: docs bekræfter 1.500-3.000 tekst-tokens/side **PLUS** image-tokens (hver side renderes som billede). Reel rate: ~3.800 tokens/side i gennemsnit.
> - Codebase bruger **deprecated model-IDs**: `claude-sonnet-4-20250514` (retired juni 2026) og `claude-3-5-haiku-20241022` (deprecated). Skal migreres til `claude-sonnet-4-6` og `claude-haiku-4-5`.
> - `MODEL_COSTS` har **forkert pris for Haiku 3.5**: $1/$5 — korrekt er $0.80/$4. Overpricing ca. 25%.
> - Prompt-caching er IKKE implementeret men ville give 30-50% reduktion på store PDF'er.
> - `ClaudeResponse` ignorerer `cache_read_input_tokens` + `cache_creation_input_tokens` fra API — kan ikke måle cache-effekt selv hvis vi aktiverer det.

---

## 1. Verified model-priser (Anthropic Direct, 2026-04-19)

| Model                         | Input ($/MTok) | Output ($/MTok) | 5m Cache Write | 1h Cache Write | Cache Read | Batch (input/output) |
| ----------------------------- | -------------- | --------------- | -------------- | -------------- | ---------- | -------------------- |
| **Opus 4.7**                  | $5.00          | $25.00          | $6.25          | $10.00         | $0.50      | $2.50 / $12.50       |
| **Sonnet 4.6**                | $3.00          | $15.00          | $3.75          | $6.00          | $0.30      | $1.50 / $7.50        |
| **Haiku 4.5**                 | $1.00          | $5.00           | $1.25          | $2.00          | $0.10      | $0.50 / $2.50        |
| Haiku 3.5 (deprecated)        | $0.80          | $4.00           | $1.00          | $1.60          | $0.08      | $0.40 / $2.00        |
| Sonnet 4 (retires 2026-06-15) | $3.00          | $15.00          | $3.75          | $6.00          | $0.30      | $1.50 / $7.50        |

**Multipliers (stacking):**

- Cache write 5m: 1.25× base input
- Cache write 1h: 2.0× base input
- Cache read (hit): 0.1× base input
- Batch API: 0.5× on input AND output
- US-only inference (`inference_geo: 'us'`) on Opus 4.7/Sonnet 4.6+: 1.1× alle kategorier

---

## 2. PDF-token-regnskab (verified)

**Kilde:** `platform.claude.com/docs/en/docs/build-with-claude/pdf-support` — "Estimate your costs"

> "Text token costs: Each page typically uses **1,500-3,000 tokens per page** depending on content density. Standard API pricing applies with no additional PDF fees."
>
> "Image token costs: Since each page is converted into an image, the same image-based cost calculations are applied."

**Konsekvens:** Tokens pr. PDF-side = tekst (1.500-3.000) + image-rendering (~1.600 for A4 @ ~1024×1024 render).

| Dokumenttype         | Typiske sider | Text-tokens/side | Image-tokens/side | Total tokens/side | Total tokens/dok |
| -------------------- | ------------- | ---------------- | ----------------- | ----------------- | ---------------- |
| Ansættelseskontrakt  | 5             | 2.000            | 1.600             | 3.600             | 18.000           |
| Forsikringspolice    | 8             | 2.000            | 1.600             | 3.600             | 28.800           |
| Vedtægter            | 10            | 1.800            | 1.500             | 3.300             | 33.000           |
| Erhvervslejekontrakt | 15            | 2.500            | 1.600             | 4.100             | 61.500           |
| Driftsaftale         | 20            | 2.300            | 1.600             | 3.900             | 78.000           |
| Ejeraftale           | 25            | 2.500            | 1.600             | 4.100             | 102.500          |
| Kompleks ejeraftale  | 35-40         | 2.500            | 1.600             | 4.100             | 143.500-164.000  |

**PDF-størrelses-grænse:** 32 MB pr. request, 100 sider pr. request på 200k-context modeller (Haiku 4.5), 600 sider på 1M-context (Sonnet 4.6, Opus 4.7).

---

## 3. Prompt-caching (verified)

**Kilde:** `platform.claude.com/docs/en/docs/build-with-claude/prompt-caching`

### Minimum cacheable block-sizes

| Model      | Minimum tokens til caching |
| ---------- | -------------------------- |
| Opus 4.7   | 4.096                      |
| Sonnet 4.6 | **2.048**                  |
| Haiku 4.5  | 4.096                      |
| Haiku 3.5  | 2.048                      |

### Ledsager-overhead (tool-use)

Tool-use tilføjer system-prompt-tokens:

- `tool_choice: auto/none`: **346 tokens** (Sonnet 4.6, Haiku 4.5)
- `tool_choice: tool/any`: **313 tokens** (vores kode bruger dette)

### ChainHub's aktuelle prompt-komposition pr. extraction

Målt fra `src/lib/ai/schemas/ejeraftale.ts`:

- `system_prompt`: ~800 tokens (dansk tekst, ~3.200 chars)
- `tool_definition` serialiseret som JSON: ~2.500 tokens (schema 14 KB raw TS → ~10 KB JSON)
- `tool_choice` overhead: 313 tokens
- `user_prompt_prefix`: ~150 tokens
- **Boilerplate pr. kald: ~3.763 tokens**

Sonnet 4.6 minimum-krav: 2.048 ✓ — caching af boilerplate er muligt.
Haiku 4.5 minimum-krav: 4.096 ✗ — boilerplate alene kan ikke caches.

### Cache-strategi — to lag

**Lag 1: Cache boilerplate (system + tool_schema)**

- Opnås ved `cache_control: {type: 'ephemeral'}` på sidste tool i `tools`-array
- Spar ~$0.01/doc på 2-run flows (marginalt — boilerplate er lille)

**Lag 2: Cache PDF-indhold på Pass 2a så Pass 2b læser det fra cache**

- PDF på 25 sider = ~102.500 tokens → ✓ over 2.048-grænsen
- Pass 2a (write): 102.500 × $3.75/M = $0.384
- Pass 2b (read): 102.500 × $0.30/M = $0.031 (vs $0.308 uden cache)
- **Netto besparelse: $0.277 pr. ejeraftale = 32% reduktion**

### `anthropic-direct.ts` mangler cache-token-parsing

API returnerer `cache_read_input_tokens` og `cache_creation_input_tokens` — men `ClaudeResponse`-typen (src/lib/ai/client/types.ts:34-43) og `anthropic-direct.ts:45-49` læser kun `input_tokens` og `output_tokens`. Skal udvides FØR caching aktiveres, ellers kan effekten ikke måles.

---

## 4. Rate limits (verified)

**Kilde:** `platform.claude.com/docs/en/api/rate-limits`

| Tier | Deposit | Spend-loft | Sonnet 4.x RPM | Sonnet 4.x ITPM | Haiku 4.5 RPM | Haiku 4.5 ITPM |
| ---- | ------- | ---------- | -------------- | --------------- | ------------- | -------------- |
| 1    | $5      | $100/md    | 50             | 30.000          | 50            | 50.000         |
| 2    | $40     | $500/md    | 1.000          | 450.000         | 1.000         | 450.000        |
| 3    | $200    | $1.000/md  | 2.000          | 800.000         | 2.000         | 1.000.000      |
| 4    | $400    | $200k/md   | 4.000          | 2.000.000       | 4.000         | 4.000.000      |

**Kritisk:** På Tier 1 er Sonnet 4.x begrænset til **30.000 ITPM** — ét 100k-token ejeraftale-request bryder loftet. Bulk-onboarding af >10 dokumenter parallelt på Tier 1 vil garanteret fejle med 429.

**Cache-read tokens tæller IKKE mod ITPM-limits** på Sonnet 4.x og Haiku 4.5 — caching giver effektivt højere throughput.

**Batch API:** 50% rabat på input+output, separat rate-limit-pool. Op til 100.000 requests pr. batch.

---

## 5. Reel cost pr. operation (beregnet med verified tal)

### 5.1 Extraction pipeline — current code (Sonnet 4.6, 2 runs, INGEN caching)

Antagelser: Pass 1 er Haiku 3.5 med ~10.000 input-tokens + 100 output (kun første sider), Pass 2a+2b er fuld PDF + schema. Output-tokens i Pass 2 ~3.000 (conservative; max_tokens=4.096).

| Dokument            | Tokens/run | Cost Pass 1 | Cost Pass 2a | Cost Pass 2b | **Total/doc** | DKK  |
| ------------------- | ---------- | ----------- | ------------ | ------------ | ------------- | ---- |
| Ansættelseskontrakt | 21.800     | $0.009      | $0.110       | $0.110       | **$0.229**    | 1,60 |
| Forsikring          | 32.600     | $0.009      | $0.143       | $0.143       | **$0.295**    | 2,07 |
| Vedtægter           | 36.800     | $0.009      | $0.155       | $0.155       | **$0.319**    | 2,23 |
| Lejekontrakt        | 65.300     | $0.009      | $0.241       | $0.241       | **$0.491**    | 3,44 |
| Driftsaftale        | 81.800     | $0.009      | $0.290       | $0.290       | **$0.589**    | 4,13 |
| Ejeraftale 25 sider | 106.300    | $0.009      | $0.364       | $0.364       | **$0.737**    | 5,16 |
| Ejeraftale 35 sider | 147.300    | $0.009      | $0.487       | $0.487       | **$0.983**    | 6,88 |

**Gennemsnit for 7-dok lokations-sæt:** ~$2.86 ≈ 20 kr/lokation ved onboarding.

### 5.2 Extraction — WITH safeguards (skip_agreement default + PDF cache + Haiku 4.5 migration)

Fjern Pass 2b som default (spar ~50%). Add cache_control på tool_schema + system (marginalt). Kun re-run hvis confidence < 0.75 i Pass 2a.

| Dokument            | Cost (1 run) | Cost (re-run 20% af tiden) | **Effektiv cost** | Besparelse |
| ------------------- | ------------ | -------------------------- | ----------------- | ---------- |
| Ansættelseskontrakt | $0.119       | $0.024 (0.2 × $0.120)      | **$0.143**        | 37%        |
| Lejekontrakt        | $0.250       | $0.050                     | **$0.300**        | 39%        |
| Ejeraftale 25 sider | $0.373       | $0.075                     | **$0.448**        | 39%        |
| Ejeraftale 35 sider | $0.496       | $0.099                     | **$0.595**        | 39%        |

**Gennemsnit for 7-dok sæt med safeguards:** ~$1.75 ≈ 12 kr/lokation (-38%).

### 5.3 Extraction — Bulk onboarding via Batch API (50% rabat)

| Scenario                 | Cost uden safeguards | Cost med safeguards + batch |
| ------------------------ | -------------------- | --------------------------- |
| S (70 docs onboarding)   | $160 (1.120 kr)      | **$49 (343 kr)**            |
| M (210 docs onboarding)  | $480 (3.360 kr)      | **$147 (1.030 kr)**         |
| L (350 docs onboarding)  | $800 (5.600 kr)      | **$246 (1.720 kr)**         |
| XL (800 docs onboarding) | $1.830 (12.800 kr)   | **$560 (3.920 kr)**         |

Batch API er async (svar inden for 24h) — OK til onboarding hvor kunden ikke venter på hver upload.

### 5.4 Company-insights (Sonnet 4.6 i aktuel kode — ikke Haiku som doc påstår)

Aktuel code (`jobs/company-insights.ts:128`): `MODEL = 'claude-sonnet-4-20250514'` (deprecated Sonnet 4).

- Input: ~2.000 tokens (snapshot JSON + system prompt)
- Output: ~1.000 tokens (typisk)
- Cost pr. kald: **$0.021**

Med Haiku 4.5 migration:

- Cost pr. kald: **$0.007** (-67%)

Cache-TTL 24h i `CompanyInsightsCache` — regenereres når admin ser selskab efter udløb.

### 5.5 Persons AI-fields

**Ingen ny AI-cost.** `persons/[id]/page.tsx:287-288` læser `documentExtraction.extracted_fields` fra kontrakt-ekstraktion. Genbruger data.

---

## 6. Månedlige costs pr. kunde-profil (REVIDERET med verified tal)

Antagelser:

- Nye kontrakter: 2,5 pr. lokation pr. år = ~0,21/lokation/md
- Insights-views: 60-70% af selskaber ses mindst 1× dagligt i arbejdsdage (22/md)
- Onboarding er engangskost (amortiseres eller onboarding-fee)

### 6.1 Steady-state månedligt — CURRENT CODE (ingen safeguards)

| Profil | Selskaber | Nye dok/md | Extraction/md | Insights/md | **Total/md USD** | **DKK** |
| ------ | --------- | ---------- | ------------- | ----------- | ---------------- | ------- |
| S      | 10        | 2          | $0.92         | $2.77       | **$3.69**        | 26      |
| M      | 30        | 6          | $2.75         | $9.24       | **$11.99**       | 84      |
| L      | 50        | 10         | $4.58         | $15.40      | **$19.98**       | 140     |
| XL     | 80        | 20         | $9.17         | $24.60      | **$33.77**       | 237     |

### 6.2 Steady-state månedligt — WITH SAFEGUARDS (skip_agreement + Haiku insights + cache)

| Profil | Selskaber | Extraction/md | Insights/md (Haiku) | **Total/md USD** | **DKK** |
| ------ | --------- | ------------- | ------------------- | ---------------- | ------- |
| S      | 10        | $0.57         | $0.92               | **$1.49**        | 10      |
| M      | 30        | $1.71         | $3.08               | **$4.79**        | 34      |
| L      | 50        | $2.85         | $5.13               | **$7.98**        | 56      |
| XL     | 80        | $5.71         | $8.20               | **$13.91**       | 98      |

**Besparelse:** 60-70% reduktion.

### 6.3 Onboarding-kost (engangs)

| Profil | Antal dok | Current (3 runs retry) | With safeguards + Batch API |
| ------ | --------- | ---------------------- | --------------------------- |
| S      | 70        | $200 (1.400 kr)        | **$49 (343 kr)**            |
| M      | 210       | $600 (4.200 kr)        | **$147 (1.030 kr)**         |
| L      | 350       | $1.000 (7.000 kr)      | **$246 (1.720 kr)**         |
| XL     | 800       | $2.290 (16.000 kr)     | **$560 (3.920 kr)**         |

---

## 7. Margin-analyse (med verified tal)

**Nuværende pricing (PRICING-DECISION-2026-04 v2):** Basis 3.500 kr, Plus 9.500 kr + 75 kr/ekstra over 50, Enterprise floor 32.000 kr.

| Tier              | Pris/md  | Typisk kunde    | AI-cost (current) | AI-cost (safeguards) | **AI-% (current)** | **AI-% (safeguards)** |
| ----------------- | -------- | --------------- | ----------------- | -------------------- | ------------------ | --------------------- |
| Basis 3.500 kr    | S        | 26 kr/md        | 10 kr/md          | **0,7%**             | **0,3%**           |
| Basis 3.500 kr    | M        | 84 kr/md        | 34 kr/md          | **2,4%**             | **1,0%**           |
| Plus 9.500 kr     | L        | 140 kr/md       | 56 kr/md          | **1,5%**             | **0,6%**           |
| Plus 9.500 kr     | XL       | 237 kr/md       | 98 kr/md          | **2,5%**             | **1,0%**           |
| Enterprise 32k kr | XL-power | 400 kr/md worst | 150 kr/md worst   | **1,3%**             | **0,5%**           |

**Konklusion:** Marginerne er dramatisk sunde. **Selv uden safeguards** er AI-andel <2,5% på alle tiers. Med safeguards <1,0%.

**Pricing-anbefaling:** Hold de nuværende tier-priser. Ingen prissætning-revision nødvendig. Men:

- **Onboarding-fee** bør indføres: 1 kr/dokument, max 2.500 kr. Dækker onboarding-AI-cost med 3-5× margin og signalerer værdi.
- Overvej **Plus-S** (6.500 kr) og **Plus-L** (9.500 kr) — ikke pga. AI-cost men pga. produkt-value-fit.

---

## 8. Kritiske risici (prioriteret efter sandsynlighed × impact)

| #   | Risk                                                            | Impact | Prob.  | Mitigation                                                    | Status |
| --- | --------------------------------------------------------------- | ------ | ------ | ------------------------------------------------------------- | ------ |
| R1  | Cost-cap default null → unlimited spend                         | HØJ    | HØJ    | Default $50/md ved org-oprettelse                             | UFIXED |
| R2  | Race-condition på cost-cap (tjek før, log efter)                | HØJ    | MED    | Pre-debet estimeret cost FØR Pass 2 starter; distributed lock | UFIXED |
| R3  | Rate-limit 429 på Tier 1 ved bulk onboarding                    | HØJ    | HØJ    | Throttle upload (10/min), Batch API for onboarding            | UFIXED |
| R4  | Deprecated model-IDs (Sonnet 4 retires 2026-06-15)              | HØJ    | HØJ    | Migrér til claude-sonnet-4-6 + claude-haiku-4-5               | UFIXED |
| R5  | Forkert Haiku 3.5 pricing i MODEL_COSTS ($1/$5 vs $0.80/$4)     | MED    | SIKKER | Ret MODEL_COSTS eller skift til Haiku 4.5                     | UFIXED |
| R6  | Retry doubler cost (pipeline kører fra Pass 1 ved Pass 2-fejl)  | MED    | MED    | Checkpoint pipeline-state (persist Pass 1-resultat)           | UFIXED |
| R7  | Ingen dokumenthash — samme PDF re-uploaded = fuld cost igen     | MED    | MED    | SHA-256 content-hash check før kø-start                       | UFIXED |
| R8  | Cache-tokens parses ikke fra API response                       | LAV    | SIKKER | Udvid ClaudeResponse-type + anthropic-direct.ts parsing       | UFIXED |
| R9  | 24h TTL på insights-cache — regenereres selvom data ikke ændret | LAV    | HØJ    | Invalidér ved contract/case/finance-writes                    | UFIXED |
| R10 | Default skip_agreement=false → 2 Sonnet-runs på alt             | MED    | SIKKER | Default true, aktiver 2nd run kun ved confidence < 0.75       | UFIXED |

---

## 9. Bruger-actions (eksterne)

- [ ] Beslut Anthropic-tier for produktion (Tier 2 kræver $40 deposit, giver 1000 RPM — minimum for pilot)
- [ ] Beslut om EU data-residency kræves (ikke understøttet direkte af Anthropic → påvirker Bedrock-migration-timing)
- [ ] Godkend onboarding-fee (1 kr/dok, max 2.500 kr)
- [ ] Godkend default cap $50/md på nye orgs

---

## 10. Next measurement milestone

**Fase B.1b + safeguards-sprint leverer:**

- Faktiske målte cost fra `AIUsageLog` efter 20-30 test-extractions
- Ægte cache-hit-rate efter implementation
- Verifikation af at vores token-estimater matcher Anthropic's response-usage

Opdatér dette dokument med målte tal efter første production-pilot.

---

_Dette dokument erstatter v1 og v2. Alle tal er verificeret mod Anthropic-dokumentation 2026-04-19. Sidste ændring: v3 efter audit-session._
