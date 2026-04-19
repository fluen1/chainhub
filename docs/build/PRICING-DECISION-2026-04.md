# Pricing-beslutning — Phase A.2 (REVIDERET)

**Dato:** 2026-04-18
**Status:** Afventer bruger-beslutning
**Input:** `docs/build/AI-COST-MODEL.md` (verified priser + estimerede forbrug)

> **v2 (2026-04-18 kl. 18:xx):** Opdateret efter bruger-feedback om urealistiske estimater. Fejl i v1:
>
> - Company-insights: regnet med 10k tokens, realistisk snapshot er 15-20k
> - Document-extraction: regnet med 15k pr. pass, men faktisk sender pipelinen HELE dokumentet (20-100k tokens) gennem Pass 2 to gange med Sonnet
> - Gennemsnits-dokument-cost: **$0.55 (ikke $0.22-0.25)** — ~2.5× højere
> - L/XL-kunder på flat Plus-pris uholdbart — staffeling bliver KRITISK

---

## TL;DR — anbefalede prisintervaller (REVIDERET v2)

| Tier           | Forslag (DKK/måned) | AI-margin      | Hvem                                        |
| -------------- | ------------------- | -------------- | ------------------------------------------- |
| **Basis**      | 2.500–5.000         | N/A (ingen AI) | 5–15 lokationer, omkostningsfølsomme        |
| **Plus**       | 8.500–15.000        | 20–30% af pris | 15–40 lokationer, vil spare manuelt arbejde |
| **Enterprise** | 25.000–50.000       | 10–15% af pris | 40+ lokationer, strategisk overblik         |

**Anbefalede pris-ankre (midtpunkter — REVIDERET):**

- **Basis: 3.500 DKK/måned** (ca. 500 EUR) — uændret
- **Plus: 9.500 DKK/måned** (ca. 1.275 EUR) — inkluderer **50** kontrakt-ekstraktioner, derefter **75 kr./ekstra** (v2 strammere end v1's 100+50)
- **Enterprise: forhandles pr. kunde, floor 32.000 DKK/måned** (ca. 4.300 EUR) — fair-use 500 extractions/måned, derefter forhandlet pakke

---

## Cost-grundlag (fra AI-COST-MODEL.md)

### Drift-cost pr. organisation (uanset tier)

- Supabase Pro: $25/måned (~175 kr.)
- Vercel Pro: $20/måned (~140 kr.)
- Resend: gratis tier (<3.000 mails/måned)
- Sentry: gratis tier
- BetterStack: gratis tier
- Domæne + DNS: ~$1/måned (~7 kr.)
- **Infrastruktur-baseline: ~325 kr./måned delt af alle kunder** (multi-tenant — Vercel/Supabase tiers dækker de første 10-20 kunder uden ekstra cost)

### AI-cost-estimater pr. kunde

**Company-insights (Haiku 4.5, ~$0.016/kald, 24h cache):**

- Typisk 30 selskaber × 30 regens/måned = ~$14.40/måned
- Heavy 50 selskaber = ~$24/måned

**Document-extraction (Sonnet 4.6 + Haiku-passes, ~$0.22–0.25/doc):**

- Typisk Plus-kunde: 3 dok × 30 selskaber = ~$22/måned
- Heavy Plus-kunde: 10 dok × 50 selskaber = ~$125/måned

**Portfolio-insights (Enterprise, Haiku, ~$0.035/kald daglig):**

- ~$1.05/måned/org (cheap — ét aggregeret kald)

**RAG Søg & Spørg (Enterprise, Sonnet, ~$0.022/query):**

- 200 queries/måned = ~$4.40/måned

### Samlede AI-costs pr. kunde/måned (REVIDERET v2)

Beregnet på:

- Document extraction: **~$0.55/dok** gennemsnit (typisk 30-siders kontrakt, 2× Sonnet-runs, Haiku classify + validate)
- Company-insights: **~$0.03/kald** (15k input + 3k output Haiku)
- Portfolio-insights: **~$0.05/kald** (20k input + 3k output Haiku, Enterprise daily)
- RAG-query: **~$0.04/query** (retrieval + Sonnet grounded svar)

| Kunde-profil                         | Tier 2 Plus         | Tier 3 Enterprise    |
| ------------------------------------ | ------------------- | -------------------- |
| **S** (10 selskaber, 2 dok/måned)    | ~$18 (125 kr.)      | ~$27 (190 kr.)       |
| **M** (30 selskaber, 5 dok/måned)    | ~$100 (700 kr.)     | ~$130 (910 kr.)      |
| **L** (50 selskaber, 10 dok/måned)   | ~$320 (2.250 kr.)   | ~$380 (2.660 kr.)    |
| **XL** (80+ selskaber, 30 dok/måned) | ~$1.400 (9.800 kr.) | ~$1.500 (10.500 kr.) |

**Realistiske scenarier er 2-2.5× højere** end første version. Dette ændrer pricing-strategi-konklusioner:

---

## Prissætnings-forslag (detaljeret)

### Tier 1 — ChainHub Basis

**Drift-cost pr. kunde/måned:** ~325 kr. (shared infrastructure)
**Ingen AI-cost** (tier excludes AI)
**Margin-mål:** 85% (standard SaaS)

**Anbefalet pris: 2.500–5.000 DKK/måned**

- 2.500 kr. = 87% margin — aggressiv indstigningspris
- 3.500 kr. = 91% margin — **anbefalet start**
- 5.000 kr. = 93.5% margin — for enterprise-only Basis-variant

### Tier 2 — ChainHub Plus (REVIDERET)

**Drift-cost pr. kunde/måned:** ~325 kr.
**AI-cost typisk kunde (M):** ~700 kr./måned (v2 — 2× højere end v1)
**Total cost-of-service:** ~1.025 kr./måned (for M-profile)
**Margin-mål:** 70–80% (AI-cost som 20–30% af pris)

**Anbefalet pris: 8.500–15.000 DKK/måned** (justeret opad fra 6-12k)

Tre modeller at vælge mellem:

**Model A — Flat månedspris (enkel):** ⚠ **RISIKO**

- 10.000 kr./måned ubegrænset
- På M (AI-cost $100): margin 86% ✅
- På L (AI-cost $320): margin 68% — grænseværdi
- På XL (AI-cost $1.400): **NEGATIVT margin** — uholdbart
- Kun realistisk hvis kunder caps sig selv på volumen

**Model B — Staffeling pr. upload:** ⭐ **STÆRKT ANBEFALET (kritisk nu)**

- 9.500 kr./måned inkluderet **50 kontrakt-ekstraktioner** (ikke 100 — baseret på faktisk cost)
- **75 kr. pr. ekstra ekstraktion** (vs. faktisk cost $0.55 = ~4 kr.; 19× margin på incremental)
- Typisk M-kunde (150 dok/måned): 9.500 + (100 × 75) = 17.000 kr./måned — dækker reel cost $100 × 8 = $800 = 20% af pris
- Heavy XL-kunde (2.400 dok/måned): 9.500 + (2.350 × 75) = 185.750 kr. — over-absurd; i praksis vil ingen uploade så mange, men staffeling beskytter os mod worst-case
- Gennemsigtigt — kunden ser præcis hvad de betaler for

**Model C — Forbrugs-baseret (ikke-anbefalet):**

- 6.000 kr./måned base + 100 kr./extraction
- For volatile for kunden at forudse (friction)
- Bedre til Enterprise-forhandlinger end markedsstandard

### Tier 3 — ChainHub Enterprise (REVIDERET)

**Drift-cost pr. kunde/måned:** ~325 kr.
**AI-cost typisk enterprise-kunde (L):** ~2.660 kr./måned (v2)
**Heavy (XL):** ~10.500 kr./måned (v2)
**Margin-mål:** 85–90% (enterprise-typical)

**Anbefalet pris: 25.000–50.000 DKK/måned** (forhandles pr. kunde, justeret opad)

- **Floor-pris: 32.000 kr./måned** (85% margin på L-kunde — tidligere 22.000 var for lavt)
- **Begrænsninger ved "ubegrænset"**: typisk fair-use-klausul (fx 500 extractions/måned inkluderet, derefter forhandles ekstra-pakke)
- 12-måneders commitment
- Enterprise XL-kunder bør sandsynligvis forhandles op til 50.000+ kr./måned hvis de genererer >1.000 extractions/måned

---

## Beslutnings-spørgsmål

Jeg har brug for dine svar til at låse endelige priser:

### Spørgsmål 1: Basis-prisen

Foreslået: **3.500 kr./måned**. Er dette:

- (a) For lavt — start ved 4.500 kr.
- (b) Rigtigt
- (c) For højt — start ved 2.500 kr.
- (d) Andet beløb (sig hvilket)

### Spørgsmål 2: Plus-modellen

Hvilken afregningsmodel for Tier 2 Plus?

- (A) Flat 8.000 kr./måned ubegrænset — enkel, risiko for heavy-kunder
- (B) **7.500 kr. + 50 kr./ekstra extraction over 100/måned** — retfærdig + gennemsigtig
- (C) Forbrugs-baseret (5.000 base + 75/extraction) — mest retfærdig, mest kompleks
- (D) Andet

### Spørgsmål 3: Enterprise floor

Floor-pris for Tier 3 Enterprise (forhandles op pr. kunde):

- (a) 18.000 kr./måned (aggressiv indstigning)
- (b) **22.000 kr./måned** (anbefalet — 85% margin på L-kunde)
- (c) 28.000 kr./måned (konservativt)
- (d) Andet

### Spørgsmål 4: Margin-mål

Accepterer du mine forudsatte margin-mål?

- Basis: 85–90%
- Plus: 70–80% (AI-cost 20–30% af pris)
- Enterprise: 85–90% (AI-cost 10–15%)

Hvis nej — hvad skal de være?

---

## Validerings-plan

Priserne er **foreløbige indtil reel måling** i Phase B.1 pilot:

1. 1–2 Plus-pilot-kunder får rabat (50% off i 3 mdr.) imod ugentligt feedback
2. Efter 3 mdr. måles faktisk AI-cost pr. kunde vs. estimat
3. Endelig pris justeres (+/- 15%) baseret på real-world data
4. Samme flow gentages for Enterprise i Phase C

---

## Næste skridt efter din beslutning

1. Svarer du på 4 spørgsmål ovenfor → jeg opdaterer `AI-COST-MODEL.md` + `product-roadmap.md` med låste priser
2. Genererer pricing-side-indhold (tekst til /pricing route) klar når du vil bygge den
3. Priserne låses i `Organization.tier` + feature-flag-logik
