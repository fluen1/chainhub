# AI Cost Model — ChainHub

**Opdateret:** 2026-04-18
**Status:** Levende dokument. Opdateres pr. Phase B + Phase C pilot.
**Kilde til priser:** `claude.com/pricing` (verified 2026-04-18)

## 1. Verified model-priser (Anthropic Direct)

| Model             | Input ($/MTok) | Output ($/MTok) | Cache write | Cache read |
| ----------------- | -------------- | --------------- | ----------- | ---------- |
| Claude Opus 4.7   | $5             | $25             | $6.25       | $0.50      |
| Claude Sonnet 4.6 | $3             | $15             | $3.75       | $0.30      |
| Claude Haiku 4.5  | $1             | $5              | $1.25       | $0.10      |

- Batch processing: 50% rabat af input+output (ikke modelleret — anvendes pr. call-site hvis brugt)
- US-only inference: 1.1× multiplier (ikke modelleret)
- Prompt-caching TTL: 5 minutter

## 2. Målte tal (fra A.0 research)

### Company-insights (Haiku/Sonnet)

- **Antal kald (denne måned):** _[udfyld fra scripts/ai-cost-research.ts]_
- **Gennemsnit input-tokens:** _[udfyld]_
- **Gennemsnit output-tokens:** _[udfyld]_
- **Gennemsnit cost pr. kald:** _[udfyld]_
- **Cache-TTL i DB:** 24h via `CompanyInsightsCache` → typisk 1-30 regenerations pr. selskab/måned
- **Projektion pr. selskab/måned:** _[udfyld: snit-cost × forventet regens]_

### Document-extraction (Sonnet 4.6 + Haiku for pass 1/3/5)

**Status A.0:** Ikke målt. Pipeline er dormant. Estimeret fra token-budgetter i `src/lib/ai/pipeline/`:

- Pass 1 (type-detection, Haiku 4.5): ~15k input + 100 output = ~$0.015
- Pass 2 (schema-extraction, Sonnet 4.6 × 2 runs): 2 × (15k input + 3k output) = ~$0.180
- Pass 3 (source-verification, Haiku 4.5): ~$0.015
- Pass 4 (sanity-check, regel-baseret, 0 AI-cost)
- Pass 5 (cross-validation, Haiku 4.5): ~$0.015
- **Estimat pr. dokument:** ~$0.22-0.25
- **Worst-case (re-runs ved lav confidence):** ~$0.50

**Validering:** Skal måles i Phase B.1 med reel kontrakt-pipeline. Dette estimat genbesøges.

### Portfolio-insights (Phase C — ikke målt endnu)

Projektion: ~20k input + 3k output Haiku 4.5 pr. kald = ~$0.035.
Daglig refresh = ~$1.05/måned/org.

### RAG (Phase C — ikke målt endnu)

Projektion: ~5k input + 500 output Sonnet 4.6 pr. query + retrieval = ~$0.022.
100 queries/måned = ~$2.20.

## 3. Bedrock-priser — status

Verificerede offentlige priser (fra `aws.amazon.com/bedrock/pricing` 2026-04-18):

| Model                           | Region  | Input ($/MTok) | Output ($/MTok) |
| ------------------------------- | ------- | -------------- | --------------- |
| Claude 3.5 Sonnet v2            | US East | $6             | $30             |
| Claude 3.5 Sonnet (cache write) | US East | $7.50          | —               |
| Claude 3.5 Sonnet (cache read)  | US East | $0.60          | —               |
| Claude 3.5 Sonnet (batch)       | US East | $3             | $15             |

**Problem:** Bedrock-pricing-siden viser IKKE Haiku eller Opus; Frankfurt-priser er IKKE eksplicit listet. Provisioned Throughput kræver direkte AWS-kontakt.

**Dette skal undersøges direkte med AWS account team FØR Bedrock-migration kan prissættes nøjagtigt.**

## 4. Volume-modellering — skitse

_Skal udfyldes når målte tal fra sektion 2 er komplette._

Kunde-profiler:

| Profil | Selskaber | Kontrakter/måned | Forventet månedligt AI-cost |
| ------ | --------- | ---------------- | --------------------------- |
| S      | 10        | 2                | ~$\_?                       |
| M      | 30        | 5                | ~$\_?                       |
| L      | 50        | 10               | ~$\_?                       |
| XL     | 80        | 30               | ~$\_?                       |

## 5. Pricing-implikationer

Til endelig prissætning: AI-cost skal være <20% af Tier 2-pris og <15% af Tier 3-pris for sunde marginer (forslag — verificeres af dig).

**Endelig pris låses i Phase A.2 beslutning efter Phase B.1 måling.**

## 6. Beslutnings-triggere til Bedrock-migration

Migrér når mindst én rammer (se `2026-04-18-product-roadmap.md` afsnit 8.3):

- Kunde stiller eksplicit krav om EU data-residency
- Målt månedlig spend >$2.000 + Provisioned Throughput rabat ≥25%
- Rate-limits rammer i produktion
- Juridisk rådgivning kræver det

## 7. Bruger-actions / åbne spørgsmål

- [ ] Udfyld sektion 2 company-insights efter `/settings/ai-usage` viser data fra research-kørsel
- [ ] Verificér Bedrock Frankfurt + Haiku + Opus priser med AWS account team
- [ ] Kør extraction-cost-måling i Phase B.1 (erstatter estimatet i sektion 2)
- [ ] Fastlæg endelige margin-mål pr. tier (15% Tier 2 / 10% Tier 3?)

---

_Dette dokument er levende. Enhver ny måling opdateres her. Sidste ændring: 2026-04-18 Phase A.0._
