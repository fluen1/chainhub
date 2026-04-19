# Pricing-beslutning — Phase A.2

**Dato:** 2026-04-18
**Status:** Afventer bruger-beslutning
**Input:** `docs/build/AI-COST-MODEL.md` (verified priser + estimerede forbrug)

---

## TL;DR — anbefalede prisintervaller

| Tier           | Forslag (DKK/måned) | AI-margin      | Hvem                                        |
| -------------- | ------------------- | -------------- | ------------------------------------------- |
| **Basis**      | 2.500–5.000         | N/A (ingen AI) | 5–15 lokationer, omkostningsfølsomme        |
| **Plus**       | 6.000–12.000        | 20–30% af pris | 15–40 lokationer, vil spare manuelt arbejde |
| **Enterprise** | 18.000–35.000       | 10–15% af pris | 40+ lokationer, strategisk overblik         |

**Anbefalet pris-ankre** (midtpunkter):

- **Basis: 3.500 DKK/måned** (ca. 500 EUR)
- **Plus: 9.000 DKK/måned** (ca. 1.200 EUR) — inkluderer 100 kontrakt-ekstraktioner/måned, derefter 50 DKK/ekstra
- **Enterprise: forhandles pr. kunde, floor 22.000 DKK/måned** (ca. 3.000 EUR) — flat, ubegrænset

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

### Samlede AI-costs pr. kunde/måned

| Kunde-profil                         | Tier 2 Plus       | Tier 3 Enterprise |
| ------------------------------------ | ----------------- | ----------------- |
| **S** (10 selskaber, 2 dok/måned)    | ~$9 (65 kr.)      | ~$15 (105 kr.)    |
| **M** (30 selskaber, 5 dok/måned)    | ~$52 (365 kr.)    | ~$70 (490 kr.)    |
| **L** (50 selskaber, 10 dok/måned)   | ~$150 (1.050 kr.) | ~$200 (1.400 kr.) |
| **XL** (80+ selskaber, 30 dok/måned) | ~$625 (4.375 kr.) | ~$700 (4.900 kr.) |

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

### Tier 2 — ChainHub Plus

**Drift-cost pr. kunde/måned:** ~325 kr.
**AI-cost typisk kunde (M):** ~365 kr./måned
**Total cost-of-service:** ~700 kr./måned (for M-profile)
**Margin-mål:** 70–80% (AI-cost som 20–30% af pris)

**Anbefalet pris: 6.000–12.000 DKK/måned**

Tre modeller at vælge mellem:

**Model A — Flat månedspris (enkel):**

- 8.000 kr./måned ubegrænset
- Risiko: XL-kunder koster meget (4.375 kr./måned AI-cost) → margin kun 44%
- Simpelt at forklare kunder

**Model B — Staffeling pr. upload (retfærdig):** ⭐ **anbefalet**

- 7.500 kr./måned inkluderet 100 kontrakt-ekstraktioner
- 50 kr. pr. ekstra ekstraktion
- Typisk M-kunde: 7.500 kr. (dækker 100 extractions = 90 kr. pr. kunde margin på ekstraktionen)
- Heavy XL-kunde: 7.500 + (300 × 50) = 22.500 kr. (dækker costs ved volumen)
- Gennemsigtigt — kunden ser hvad de betaler for

**Model C — Forbrugs-baseret (mest retfærdig, mest kompleks):**

- 5.000 kr./måned base
- - 75 kr. pr. extraction
- Typisk M: 5.000 + 5 × 30 × 75 = 16.250 kr. — dyrt
- Frarådes — friktion + svær at budget-planlægge for kunde

### Tier 3 — ChainHub Enterprise

**Drift-cost pr. kunde/måned:** ~325 kr.
**AI-cost typisk enterprise-kunde (L):** ~1.400 kr./måned
**Heavy (XL):** ~4.900 kr./måned
**Margin-mål:** 85–90% (enterprise-typical)

**Anbefalet pris: 18.000–35.000 DKK/måned** (forhandles pr. kunde)

- **Floor-pris: 22.000 kr./måned** (85% margin på L-kunde)
- **Ubegrænset** ekstraktioner + portfolio-insights + RAG
- 12-måneders commitment
- **Opt-outs kan tilbydes som rabat** (fx -10% for 24-måneders commitment)

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
