# Side 7: /companies/[id]/contracts — Redesign

**Dato:** 2026-03-27
**Status:** Godkendt
**Designretning:** Grupperet efter kontraktkategori (option B)

---

## Formål

Giv hovedkontoret et hurtigt overblik over alle kontrakter for ét selskab, organiseret efter kontraktkategori. Brugeren skal inden 3 sekunder kunne se: hvor mange kontrakter, hvilke typer, og om noget kræver opmærksomhed.

---

## Nuværende problemer

1. **Flat tabel** — ingen gruppering, svært at skelne typer ved 15+ kontrakter
2. **Afskårne datoer** — "5.4.2" i stedet for "5.4.2026" (kolonne for smal)
3. **Sensitivitet-kolonne** — for niche til listeoverblik, skaber clutter
4. **Ingen søgning** — problematisk ved skalerbarhed
5. **Status-badges** — alle er "Aktiv", giver intet visuelt hierarki
6. **Ingen konsistens** — bruger tabelformat mens /contracts og /cases bruger grupperet listeformat

---

## Design

### Layout: Grupperet liste

Kontrakter grupperes efter de 5 kategorier fra CONTRACT-TYPES.md:

| Kategori | ContractSystemType-værdier |
|----------|---------------------------|
| Ejerskab og selskabsret | EJERAFTALE, DIREKTOERKONTRAKT, OVERDRAGELSESAFTALE, AKTIONAERLAAN, PANTSAETNING, VEDTAEGTER |
| Ansættelse og personale | ANSAETTELSE_FUNKTIONAER, ANSAETTELSE_IKKE_FUNKTIONAER, VIKARAFTALE, UDDANNELSESAFTALE, FRATROEDELSESAFTALE, KONKURRENCEKLAUSUL, PERSONALHAANDBOG |
| Lokaler og udstyr | LEJEKONTRAKT_ERHVERV, LEASINGAFTALE |
| Kommercielle aftaler | LEVERANDOERKONTRAKT, SAMARBEJDSAFTALE, NDA, IT_SYSTEMAFTALE, DBA, VOA |
| Forsikring og governance | FORSIKRING, GF_REFERAT, BESTYRELSESREFERAT, FORRETNINGSORDEN, DIREKTIONSINSTRUKS |

Lag 2-typer (INTERN_SERVICEAFTALE, ROYALTY_LICENS, OPTIONSAFTALE, TILTRAEDELSESDOKUMENT, KASSEKREDIT, CASH_POOL, INTERCOMPANY_LAAN, SELSKABSGARANTI) grupperes under "Strukturaftaler" hvis de findes.

**Regler:**
- Tomme kategorier skjules
- Kategorier sorteres i ovenstående rækkefølge (fast)
- Inden for hver kategori: kontrakter med udløbsdato først (tidligst først), derefter løbende kontrakter alfabetisk

### Komponent: CollapsibleSection (genbruges)

Den eksisterende `CollapsibleSection`-komponent genbruges med `title`, `count`, og `defaultOpen={true}`.

### Rækkeformat: To-linje

```
[border-l-accent?] Kontraktnavn (display_name)          Dato / "Løbende"
                   Type-label · Status-tekst
```

- **Linje 1:** `display_name` i `text-sm font-medium text-gray-900`, dato i `text-sm tabular-nums` (højrejusteret)
- **Linje 2:** `getContractTypeLabel()` + `getContractStatusLabel()` i `text-xs text-gray-400`
- **Hele rækken** er et `<Link>` til `/contracts/[id]`
- **Hover:** `bg-gray-50/50`

### Urgency-visning

| Tilstand | Border-accent | Dato-farve | Alert-banner |
|----------|--------------|------------|-------------|
| Udløbet (< i dag) | `border-l-red-400` | `text-red-600 font-medium` | Ja (rød) |
| Urgent (≤14 dage) | `border-l-red-400` | `text-red-600 font-medium` | Ja (rød) |
| Advarsel (15-90 dage) | `border-l-amber-400` | `text-amber-600` | Nej |
| OK (>90 dage) | Ingen | `text-gray-500` | Nej |
| Løbende (ingen dato) | Ingen | `text-gray-300` | Nej |

Alert-banneret vises kun for udløbne/urgente kontrakter (≤14 dage), placeret mellem summary-bar og grupperingerne.

### Summary-bar

```
6 kontrakter · 3 kategorier · 1 kræver opmærksomhed    [Søg...] [+ Ny kontrakt]
```

- Counts i `text-sm text-gray-500`
- "X kræver opmærksomhed" i `text-red-600 font-medium` (kun hvis > 0)
- Søgefelt: client-side tekstfiltrering (kræver `"use client"` wrapper-komponent)
- "Ny kontrakt"-knap: `bg-gray-900 text-white`, linker til `/contracts/new?companyId={id}`

### Søgning (client-side)

En `ContractSearch`-komponent wrapper listen og filtrerer kontrakter baseret på `display_name`. Når filteret er aktivt, skjules grupper der ikke har matchende kontrakter.

Implementering: Server component henter data, sender som prop til client component der håndterer filtrering.

### Tom state

```
[FileText-ikon]
Ingen kontrakter endnu
Opret den første kontrakt for dette selskab.
```

Centreret med `border-dashed border-gray-200`, som nuværende.

### Fjernede elementer

- **Sensitivitet-kolonne** — ses på kontraktdetaljesiden, ikke nødvendig i listeoverblik
- **Status-badge (pill)** — erstattet med inline statustekst i linje 2 (da næsten alle er "Aktiv")
- **Tabel-layout** — erstattet med grupperet listeformat

---

## 12-punkt tjekliste

| # | Punkt | Status |
|---|-------|--------|
| 1 | Formål + brugerforventninger | ✅ Overblik over selskabets kontrakter, grupperet |
| 2 | Auth + permissions | ✅ Layout checker canAccessCompany, sensitivity-filtrering beholdes |
| 3 | Labels | ✅ Alt via labels.ts (getContractTypeLabel, getContractStatusLabel) |
| 4 | Søgning + filtrering | ✅ Client-side tekstsøgning tilføjet |
| 5 | Tom state | ✅ Meningsfuld besked + handlingsanvisning |
| 6 | Fejlhåndtering | ✅ Dansk, via ActionResult-mønster |
| 7 | Visuelt hierarki | ✅ Urgency-alerts → grupper → rækker |
| 8 | Interaktivitet | ✅ Hele rækken klikbar, hover-state, collapsible grupper |
| 9 | Responsivt | ✅ Listeformat skalerer bedre end tabel på mobile |
| 10 | Konsistens | ✅ Matcher /contracts og /cases grupperet mønster |
| 11 | Skalerbarhed | ✅ Collapsible grupper + søgning fungerer ved 50+ kontrakter |
| 12 | Rolle-bevidsthed | ✅ Server-side sensitivity-filtrering, "Ny kontrakt" vises for alle (action checker permissions) |

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/app/(dashboard)/companies/[id]/contracts/page.tsx` | Komplet redesign: gruppering, nyt layout |
| `src/lib/labels.ts` | Tilføj `CONTRACT_CATEGORY_MAP` og `getContractCategoryLabel()` |
| `src/components/contracts/ContractList.tsx` | Ny client-komponent med søgning + grupperet visning |

Ingen nye dependencies. Ingen schema-ændringer.
