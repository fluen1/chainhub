# Plan 4C: Selskabs-detalje — Single-Page Rewrite med AI

**Dato:** 2026-04-12
**Status:** Design godkendt, klar til writing-plans
**Scope:** `/companies/[id]` rewrite fra 11 subpages til én proto-designet single-page med AI-genererede alerts og insight

---

## 1. Mål og kontekst

### Problem

`/companies/[id]` har i dag 11 subpages (cases, contracts, documents, employees, finance, governance, log, overview, ownership, stamdata, visits). Brugeren skal tab-navigere for at se et samlet billede. Baymard-research viser at 27% af brugere overser indhold bag tabs.

### Løsning

Single scroll-view der matcher brainstorm-proto'en `.superpowers/brainstorm/45074-1775072716/content/selskab-detail-v1.html` (461 linjer HTML) 100% — visuelt layout, sektion-rækkefølge, role-visibility og AI-intentioner.

AI-laget er "Lag 2: Relevans" fra det godkendte spec `docs/superpowers/specs/2026-03-30-ai-integrated-prototype-design.md`. AI genererer:

- **Alert-banners** (op til 5, vises som 3 øverst) — hurtige strukturerede signaler med kausal prosa
- **AI Insight** (én full-width card nederst) — strategisk anbefaling med klyngesammenligning

Begge respekterer princippet **"UX er arkitekten, AI er materialet"** — AI er embedded strukturelt, ikke chatbot, og foreslår aldrig auto-udfyldning af kritiske felter.

### Ikke-mål

- Dashboard-insights (Plan 4B ramte kun badges + inline KPIs — dashboard Indsigter kommer i en senere plan)
- Plan 4D scope: `/calendar`, `/tasks`, `/search`, `/settings` — hver sin brainstorm
- AI-insights til andre sider end `/companies/[id]` (deferred)
- Dismiss-funktionalitet på alerts/insight (proto har ingen dismiss-affordance)
- Audit log-sektion (proto har den ikke; `log/` slettes)
- Overview-sektion (proto har den ikke; `overview/` slettes — var kun et redirect)
- Mobile drawer (Plan 4B-regression BLK-003 udestår, adresseres ikke her)

---

## 2. Principper (nedarvet fra godkendt spec)

Fra `2026-03-30-ai-integrated-prototype-design.md`:

| Princip                                | Anvendelse i Plan 4C                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **UX er arkitekten, AI er materialet** | AI bruges KUN til alerts og insight — alt andet er regler.                                                               |
| **Siderne selv er intelligente**       | Alerts og insight er embedded i sidens struktur, ikke en tilkald-chatbot.                                                |
| **AI foreslår, mennesket beslutter**   | AI returnerer alerts med action-links men udfører ingen handling. Quick-actions er manuelle.                             |
| **En overflade, mange linser**         | Sektion-rækkefølgen er FAST. Rolle ændrer kun SYNLIGHED, aldrig orden.                                                   |
| **Dækningssprog, ikke fejlsprog**      | Gælder cross-portfolio views. På enkelt-selskab bruger proto rød ved aktivt kritisk og grøn ved sundt — det respekteres. |
| **Anti-automation-bias**               | Ingen pre-checked felter, ingen auto-udfyldning.                                                                         |

---

## 3. Layout (match med proto)

### Overordnet struktur

```
┌─────────────────────────────────────────────┐
│ Breadcrumb: Selskaber › <Selskabsnavn>      │
├─────────────────────────────────────────────┤
│ COMPANY HEADER                              │
│  ┌─────────────────────┐  ┌──────────────┐ │
│  │ <Navn> [Status badge│  │ Opret opgave │ │
│  │ CVR · By · Status · │  │ Rediger stam │ │
│  │ Stiftet             │  └──────────────┘ │
│  │ ● Kontr ● Sag ● Øk ●│                   │
│  └─────────────────────┘                   │
├─────────────────────────────────────────────┤
│ ALERT BANNERS (AI-genereret, render max 3)  │
│ ┌─────────────────────────────────────────┐ │
│ │ ! <title> · <sub>          [action →]   │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ CONTENT GRID (2 columns, max-width 1100px)  │
│ ┌──────────────┐ ┌──────────────┐          │
│ │ Ejerskab     │ │ Kontrakter   │          │
│ └──────────────┘ └──────────────┘          │
│ ┌──────────────┐ ┌──────────────┐          │
│ │ Økonomi 2025 │ │ Åbne sager   │          │
│ └──────────────┘ └──────────────┘          │
│ ┌──────────────┐ ┌──────────────┐          │
│ │ Nøglepersoner│ │ Besøg & gov  │          │
│ └──────────────┘ └──────────────┘          │
│ ┌──────────────┐                           │
│ │ Dokumenter   │                           │
│ └──────────────┘                           │
│ ┌─────────────────────────────────────────┐ │
│ │ AI INSIGHT (full-width, lilla gradient) │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

- `max-width: 1100px`, centreret, `padding: 24px`
- Content grid: `grid-template-columns: 1fr 1fr; gap: 16px`
- Insight-sektion: `grid-column: 1 / -1` (full-width)
- Auto-flow af grid når sektioner skjules per rolle

### Sektion-rækkefølge (FAST — aldrig omordnet)

1. Ejerskab
2. Kontrakter
3. Økonomi 2025
4. Åbne sager
5. Nøglepersoner
6. Besøg & governance
7. Seneste dokumenter
8. AI Insight (full-width)

Stamdata (CVR, by, status, stiftelsesår) renderes i company-header meta-row, IKKE som separat sektion. Redigering sker via `EditStamdataDialog` (Client Component modal).

---

## 4. Rolle-visibilitet

Præcis match med proto's `roleConfig`:

| ChainHub-rolle   | Proto-rolle            | Sektioner synlige                                    | Alerts synlige?                           |
| ---------------- | ---------------------- | ---------------------------------------------------- | ----------------------------------------- |
| GROUP_OWNER      | owner                  | Alle 8                                               | Ja (alle alerts med `owner` tag)          |
| GROUP_LEGAL      | legal                  | Ejerskab, Kontrakter, Sager, Dokumenter, Insight (5) | Ja (alerts med `legal` tag)               |
| COMPANY_LEGAL    | legal                  | Samme som GROUP_LEGAL                                | Ja                                        |
| GROUP_FINANCE    | finance                | Kontrakter, Økonomi, Insight (3)                     | Ja (alerts med `finance` tag)             |
| GROUP_ADMIN      | admin                  | Ejerskab, Personer, Besøg, Dokumenter (4)            | Nej (proto har ingen admin-tagged alerts) |
| COMPANY_MANAGER  | manager                | Personer, Besøg (2)                                  | Nej                                       |
| GROUP_READONLY   | (fallback til owner)   | Alle 8 (read-only: quick-actions disabled)           | Ja                                        |
| COMPANY_READONLY | (fallback til manager) | Personer, Besøg (2, read-only)                       | Nej                                       |

Rolle-filtrering sker **server-side** i `getCompanyDetailData()`. Usynlige sektioner renderes IKKE (ingen `display: none`).

Hvis en bruger har flere role-assignments vælges den højeste prioritet via `pickHighestPriorityRole()` (genbruger `ROLE_PRIORITY`-mønsteret fra `src/actions/dashboard.ts`, prioriteret GROUP_OWNER > GROUP_ADMIN > GROUP_LEGAL=GROUP_FINANCE > GROUP_READONLY > COMPANY_MANAGER > COMPANY_LEGAL > COMPANY_READONLY).

---

## 5. Company-header detaljer

| Element                                    | Data-kilde                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Selskabsnavn                               | `company.name`                                                                        |
| Status-badge ("Kritisk"/"Advarsel"/"Sund") | `deriveStatusBadge(healthDimensions)` = max severity af 4 dims                        |
| Meta-row                                   | `company.cvr`, `company.city`, `company.status`, `company.founded_date.getFullYear()` |
| Health-dimensions (4 dots)                 | `deriveHealthDimensions()` — se §7                                                    |
| Quick-action "Opret opgave"                | Link til `/tasks/new?company=<id>` (eksisterer fra Plan 3)                            |
| Quick-action "Rediger stamdata"            | Åbner `EditStamdataDialog` (Client Component modal)                                   |

Health-dimensions skjules for COMPANY_MANAGER (per proto's JS: `healthDims.style.display = (role === 'manager') ? 'none' : 'flex'`).

---

## 6. Sektion-indhold

### Sektion 1 — Ejerskab

**Afledes fra `Ownership`-rows for selskabet.** Schema: `Ownership { owner_person_id, owner_company_id, ownership_pct Decimal(5,2) }`. Hver row repræsenterer enten en person-ejer eller et selskab-ejer.

**Data-rows (4):**

- Kædegruppe-andel: summen af `ownership_pct` for rows hvor `owner_company_id IS NOT NULL` (holdings-ejede), vist som `<total>%`
- Lokal partner: navnet på den `owner_person_id` med højeste `ownership_pct`, vist som `<person.first_name + ' ' + person.last_name> (<pct>%)`
- Ejeraftale: hentes separat som `Contract` med `system_type: 'EJERAFTALE'` for dette company_id. Rød "Udløbet DD. mon YYYY" hvis `expiry_date < today`, normal "Aktiv" hvis AKTIV, "Ingen" hvis rækken ikke findes.
- Holdingselskab: `company.name` af den `owner_company_id` med højeste `ownership_pct`

**Ownership-bar** (visuel split-bar):

```
[Kædegruppe <total_company_pct>%][Partnere <total_person_pct>%]
```

Prisma-queries:

```ts
prisma.ownership.findMany({
  where: { company_id, organization_id },
  include: { owner_person: true },
})
// Derefter separat company-lookup for unikke owner_company_ids:
prisma.company.findMany({
  where: { id: { in: ownerCompanyIds } },
  select: { id: true, name: true },
})
// Ejeraftale:
prisma.contract.findFirst({
  where: { company_id, organization_id, system_type: 'EJERAFTALE', deleted_at: null },
  orderBy: { effective_date: 'desc' },
})
```

Hvis der er 0 ownership-rows: sektionen vises tom med "Ingen ejerskabsdata registreret".

### Sektion 2 — Kontrakter

**Section badge:** `"<N> udløbet"` (rød) hvis der er udløbne aktive kontrakter, ellers `"<N> aktive"` (grøn).

**Item-rows (top 3 sorteret via `sortContractsByUrgency`):** Per item:

- Type-ikon (2-bogstavs forkortelse, farvekodet: rød for udløbet, grøn for aktiv)
- Navn: `contract.display_name`
- Meta: `"Udløbet DD. mon YYYY"` eller `"Udløber DD. mon YYYY"` eller `"Auto-fornyes DD. mon YYYY"`
- Badge: `"Udløbet"` (rød) / `"Udløber snart"` (amber) / `"Aktiv"` (grøn)

**"Vis alle X kontrakter →"** link til `/contracts?company=<id>` hvis total > 3.

Prisma-query:

```ts
prisma.contract.findMany({
  where: { company_id, organization_id, deleted_at: null, status: 'AKTIV' },
  orderBy: [{ expiry_date: 'asc' }],
  take: 5,
})
prisma.contract.count({ where: { ... } })
```

### Sektion 3 — Økonomi 2025

**Section badge:** `"Positiv"` (grøn) hvis EBITDA 2025 > 0, `"Underskud"` (rød) hvis EBITDA < 0, `"Presset"` (amber) hvis margin < 5%.

**Data-rows (4) med YoY-deltas:**

- Omsætning: `<value>M kr.` + `<delta>%` farvet efter fortegn
- EBITDA: `<value>K kr.` + `<delta>%` farvet efter fortegn
- EBITDA margin: `<pct>%` (ingen delta)
- Resultat: `<value>K kr.` (grøn hvis positiv, rød hvis negativ)

**Q1–Q4 bar chart:** 4 vertikale søjler, højder proportional til kvartals-omsætning, sidste kvartal mørkest blå.

Prisma-queries:

- 2025 hele året: `period_year: 2025, period_type: 'HELAAR', metric_type: { in: ['OMSAETNING', 'EBITDA', 'RESULTAT'] }`
- 2024 hele året: samme, year: 2024 (til YoY)
- 2025 kvartaler: `period_year: 2025, period_type: 'KVARTAL', metric_type: 'OMSAETNING'`

### Sektion 4 — Åbne sager

**Section badge:** `"<N> aktive"` (rød hvis >0, skjult hvis 0).

**Item-rows (top 3 sorteret via `sortCasesByUrgency`):** Per item:

- Type-ikon (1 bogstav, farvekodet efter case_type)
- Titel: `case.title`
- Meta: `"Oprettet DD. mon YYYY"` + optional `" · Eskaleret"` hvis i AFVENTER-status
- Badge: status-label farvekodet

Prisma-query:

```ts
prisma.case.findMany({
  where: {
    organization_id,
    deleted_at: null,
    status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
    case_companies: { some: { company_id } },
  },
  orderBy: { created_at: 'desc' },
  take: 5,
})
```

(Bemærk: `case_companies`-filter til tenant-safety, samme mønster som `dashboard.ts` efter Plan 4B scope-leak fix.)

### Sektion 5 — Nøglepersoner

**Item-rows (top 3 via `selectKeyPersons`):** Per person:

- Avatar (2 initialer)
- Navn: `person.first_name + ' ' + person.last_name`
- Rolle: `company_person.role`

**"Vis alle X medarbejdere →"** link til `/persons?company=<id>` hvis total > 3.

`selectKeyPersons` filtrerer `CompanyPerson[]` hvor `role` matcher en hardcoded hierarkisk whitelist af senior-roller (indexorden = prioritet):

```ts
const KEY_PERSON_ROLES = [
  'Partner',
  'Medejer',
  'CEO',
  'Direktør',
  'CFO',
  'Bestyrelsesformand',
  'Bestyrelsesmedlem',
  'Klinisk leder',
  'Klinikchef',
  'Stedfortræder',
]
```

Sortering: rolle-hierarki (laveste index først) → `anciennity_start asc` → alfabetisk. Top 3.

`totalCount` = total antal `CompanyPerson`-rows for selskabet (til "Vis alle X" linket — alle medarbejdere, ikke kun nøglepersoner).

### Sektion 6 — Besøg & governance

**Item-rows (top 3, seneste først):** Per visit:

- Type-ikon (1 bogstav "B", farvekodet efter visit_status)
- Type: `visit.visit_type` (dansk label via `labels.ts`)
- Meta: `"Planlagt DD. mon YYYY"` eller `"Gennemført DD. mon YYYY"`
- Badge: `"Planlagt"` (blå) / `"Gennemført"` (grøn) / `"Aflyst"` (grå)

Prisma-query:

```ts
prisma.visit.findMany({
  where: { company_id, organization_id, deleted_at: null },
  orderBy: { visit_date: 'desc' },
  take: 5,
})
```

### Sektion 7 — Seneste dokumenter

**Section badge:** `"<N> til review"` (lilla) hvis der er dokumenter med `DocumentExtraction.extraction_status === 'completed'` og `reviewed_at === null`.

**Item-rows (top 3, seneste uploaded_at først):** Per document:

- Ikon: `"AI"` (lilla) hvis `extraction` findes, ellers `"PDF"` (grå)
- Filnavn: `document.file_name`
- Meta: `"Uploadet <relativ tid> · AI-behandlet"` hvis ekstraktet, ellers `"Uploadet DD. mon YYYY"`
- Badge: `"Til review"` (lilla) hvis afventer review, `"Arkiveret"` (grøn) ellers

Prisma-query:

```ts
prisma.document.findMany({
  where: { company_id, organization_id, deleted_at: null },
  orderBy: { uploaded_at: 'desc' },
  take: 5,
  include: { extraction: { select: { extraction_status: true, reviewed_at: true } } },
})
```

### Sektion 8 — AI Insight (full-width)

**Visual:** lilla gradient card, `background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)`, "AI" badge-ikon (lilla), prosa-tekst.

**Indhold:**

- `headline_md` (max 80 tegn, kan indeholde `**bold**`) — renderes som første sætning, `<strong>` for bold
- `body_md` (max 280 tegn) — kausal analyse + konkret handling med tidsfrist

**Tom hvis AI fejler eller cache er tom** — sektionen skjules helt, ikke en loading state.

---

## 7. Helper-regler

### `deriveHealthDimensions(data)` → 4 dots

| Dimension      | Rød                                                                         | Amber                                                    | Grøn                             |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------- |
| **Kontrakter** | ≥1 aktiv kontrakt hvor `expiry_date < today`                                | ≥1 aktiv kontrakt hvor `today ≤ expiry_date < today+30d` | Alle aktive ok                   |
| **Sager**      | ≥1 åben sag i status NY eller AKTIV                                         | ≥1 sag i AFVENTER\_\* status                             | Ingen åbne                       |
| **Økonomi**    | EBITDA 2025 < 0                                                             | EBITDA-margin 2025 < 5% ELLER omsætning faldet >10% YoY  | Margin ≥5% og YoY stabil/positiv |
| **Governance** | Ingen besøg sidste 12 mdr (seneste visit_date > 365 dage gammel eller null) | Ingen besøg sidste 6 mdr                                 | Besøg inden for 6 mdr            |

Returnerer: `{ kontrakter: 'red' | 'amber' | 'green', sager: ..., oekonomi: ..., governance: ... }`

### `deriveStatusBadge(dims)` → `{ label, severity }`

- Max severity af de 4 dims
- `red` → `{ label: 'Kritisk', severity: 'critical' }`
- `amber` → `{ label: 'Advarsel', severity: 'warning' }`
- `green` → `{ label: 'Sund', severity: 'healthy' }`

### `sectionsForRole(role)` → `Set<SectionKey>`

Fast mapping, præcis match med proto's `roleConfig`. Se §4 for hver rolles sektion-liste. Fallback for ukendte roller: owner-set.

### `pickHighestPriorityRole(roleRows)` → `string`

Genbruger `ROLE_PRIORITY`-mønsteret fra `src/actions/dashboard.ts` (GROUP_OWNER=100 ned til COMPANY_READONLY=40). Returnerer `'GROUP_READONLY'` hvis `roleRows` er tom.

### `sortContractsByUrgency(contracts, today)` → `Contract[]`

```
1. Udløbet (expiry_date < today)         → sorteret efter expiry_date asc (mest udløbet først)
2. Udløber <30d (today ≤ expiry < 30d)   → sorteret efter expiry_date asc
3. Aktiv længere ude                      → sorteret efter expiry_date asc
```

### `sortCasesByUrgency(cases)` → `Case[]`

```
1. Status NY           → sorteret efter created_at desc
2. Status AKTIV        → sorteret efter created_at desc
3. Status AFVENTER_*   → sorteret efter created_at desc
```

### `selectKeyPersons(companyPersons)` → `CompanyPerson[]`

`CompanyPerson` har ingen ownership-felt — ejerskab lever på `Ownership`-modellen, ikke person-relationen. Sortering baseres derfor på rolle-hierarki og anciennitet:

1. Filter til `role` in `KEY_PERSON_ROLES`
2. Sortér primært efter `KEY_PERSON_ROLES.indexOf(role)` ascending (Partner > Direktør > Bestyrelsesmedlem > ...)
3. Sekundært efter `anciennity_start asc` (længst-tjenende først inden for samme rolle)
4. Tertiært alfabetisk på person-navn
5. Returnér top 3

---

## 8. AI-arkitektur

### Infrastruktur (genbruges fra Sprint 8B)

- `createClaudeClient()` fra `src/lib/ai/client/index.ts`
- `computeCostUsd` fra `src/lib/ai/client/types.ts`
- Logger fra `src/lib/ai/logger.ts`
- `.env.local` skal have `ANTHROPIC_API_KEY`

### Ny Prisma-model

```prisma
model CompanyInsightsCache {
  id              String   @id @default(uuid())
  organization_id String
  company_id      String   @unique
  alerts          Json     // Array af: { severity, title, sub, action_label, action_href, roles: string[] }
  insight         Json     // { headline_md, body_md } | null
  model_name      String
  total_cost_usd  Decimal  @db.Decimal(10, 4)
  generated_at    DateTime @default(now())

  organization Organization @relation(fields: [organization_id], references: [id])
  company      Company      @relation(fields: [company_id], references: [id])

  @@index([company_id, generated_at])
}
```

Tilsvarende back-relations på `Organization` og `Company`. Migration via `npx prisma migrate dev --name add_company_insights_cache`.

### AI Job: `src/lib/ai/jobs/company-insights.ts`

```ts
export interface CompanyAlert {
  severity: 'critical' | 'warning'
  title: string // max 60 tegn
  sub: string // max 100 tegn, kausal prosa med navne/tal
  action_label: string // max 20 tegn
  action_href: string // /contracts/<id>, /cases/<id>, etc.
  roles: Array<'owner' | 'legal' | 'finance' | 'admin' | 'manager'>
}

export interface AiInsight {
  headline_md: string // max 80 tegn, kan have **bold**
  body_md: string // max 280 tegn, kausal analyse + handling
}

export interface CompanyInsightsResult {
  alerts: CompanyAlert[] // op til 5
  insight: AiInsight | null
}

export async function generateCompanyInsights(
  snapshot: CompanySnapshot
): Promise<
  | { ok: true; data: CompanyInsightsResult; cost_usd: number; model_name: string }
  | { ok: false; error: string }
>
```

- Timeout: 8s (fallback via `Promise.race`)
- Model: `claude-sonnet-4-6` (resonering over flere dimensioner)
- Output-validering via Zod schema
- Fejl fanges og logges, returnerer `{ ok: false, error }`

### CompanySnapshot (input til AI)

```ts
interface CompanySnapshot {
  company: { name; cvr; city; status; founded_year; company_type }
  cluster: {
    name: string // "Odense", "Tandlæge-klyngen", etc.
    peers: Array<{ name: string; omsaetning_2025: number }>
  }
  contracts: Array<{
    id: string
    type: string
    status: string
    expiry_date: string | null
    days_until_expiry: number | null
    parties: string[] // person-navne
  }>
  cases: Array<{
    id: string
    title: string
    type: string
    status: string
    days_open: number
  }>
  finance: {
    omsaetning_2025
    omsaetning_2024
    ebitda_2025
    ebitda_2024
    margin_2025
    margin_2024
    margin_delta_pp
  } | null
  visits: {
    last_visit_date: string | null
    days_since_last: number | null
    planned_count: number
  }
  persons: Array<{ name: string; role: string }>
  documents: {
    total: number
    recently_uploaded: number
    awaiting_review: number
  }
}
```

### Cluster-definition

Peers = andre selskaber i samme `organization_id` med samme `city`. Hvis færre end 3 peers i city, udvid til samme `company_type` i hele organisationen. Top 5 sorteret efter 2025 omsætning.

Henter via separat Prisma-query inden AI-call (inkluderes i snapshot).

Hvis cluster har <3 peers: prompten får instruktion om ikke at lave klynge-sammenligninger.

### System prompt (dansk)

```
Du analyserer ét selskab i en kædegruppes portefølje og identificerer hvad
hovedkontoret bør vide. Returnér JSON med to felter:

1. "alerts": array af 0-5 advarsler. Hver advarsel skal have:
   - severity: "critical" | "warning"
   - title: max 60 tegn, kort kernen
   - sub: max 100 tegn, forklarer kontekst med navne/tal/kausalitet
   - action_label: max 20 tegn, fx "Se kontrakt"
   - action_href: peg på en relevant ChainHub-rute: /contracts/<id>, /cases/<id>,
     /companies/<id>/finance, /persons/<id>
   - roles: array af relevante roller fra: "owner", "legal", "finance",
     "admin", "manager". Roller der ikke er relevante inkluderes ikke.

2. "insight": én strategisk anbefaling (eller null hvis intet kritisk).
   - headline_md: max 80 tegn, første sætning, kan have **bold**
   - body_md: max 280 tegn, kausal analyse, sammenligning med klyngen,
     konkret handling med tidsfrist

Regler:
- Brug navne fra data (fx "Dr. Petersen") når du nævner personer
- Sammenlign tal mod klynge-peers og YoY når relevant
- Forklar kausalitet ("driftsomkostninger steget"), ikke kun fakta
- Du foreslår handlinger, du beslutter ikke for brugeren
- Dækningssprog: amber for gaps, ikke rød
- Returnér tom alerts-array og null insight hvis selskabet er sundt
```

User prompt: serialiseret `CompanySnapshot` som JSON.

### Cache-strategi

```
getCompanyDetailData() flow:
1. Batch-hent alle rå data inkl. CompanyInsightsCache-row
2. Hvis cache.generated_at er <24h gammel:
     → brug cache.alerts og cache.insight direkte
3. Hvis cache er stale eller fraværende:
     → kald generateCompanyInsights(snapshot) synkront med 8s timeout
     → hvis ok: skriv til cache (upsert), brug nye data
     → hvis fejl: render uden alerts/insight (graceful degradation),
       log fejl, prøv igen ved næste request
4. Filter alerts efter current user's rolle (alerts.roles inkluderer role)
5. Returnér filtered alerts og insight til page
```

### Cost-kontrol

- Én call pr. selskab pr. dag (24h TTL) — med 7 selskaber i seed = max 7 calls/dag
- Cost logges pr. call via `computeCostUsd` og gemmes på `CompanyInsightsCache.total_cost_usd`
- Ingen queue/background generation — synkron med timeout er tilstrækkelig ved small scale

### Graceful degradation

| Situation                                            | Adfærd                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| AI-call timer ud (>8s)                               | Render uden alerts/insight, log timeout, prøv igen ved næste request |
| AI returnerer malformed JSON                         | Samme som timeout                                                    |
| AI returnerer valid JSON der ikke matcher Zod schema | Samme som timeout                                                    |
| AI API-fejl (rate limit, 500, etc.)                  | Samme som timeout                                                    |
| `ANTHROPIC_API_KEY` mangler i env                    | Graceful degrade + warning i logger (ikke crash)                     |
| Cache findes men er ældre end 7 dage                 | Samme flow som stale (>24h) — regenerér                              |

---

## 9. Komponenter

```
src/components/company-detail/
  alert-banner.tsx             — NY: rød/amber banner (matcher proto .alert-banner)
                                  Props: { severity, title, sub, actionLabel, actionHref }
  ai-insight-card.tsx          — NY: lilla gradient card (matcher proto .insight-card)
                                  Props: { headlineMd, bodyMd }
  section-card.tsx             — NY: wrapper (header + badge + body + optional footer link)
                                  Props: { title, badge?, footerLinkHref?, footerLinkLabel?, children }
  company-header.tsx           — NY: Server Component
                                  Props: { company, statusBadge, healthDimensions, showHealthDims, role }
  ownership-section.tsx        — NY: Server Component
  contracts-section.tsx        — NY: Server Component
  finance-section.tsx          — NY: Server Component
  cases-section.tsx            — NY: Server Component
  persons-section.tsx          — NY: Server Component
  visits-section.tsx           — NY: Server Component
  documents-section.tsx        — NY: Server Component
  edit-stamdata-dialog.tsx     — NY: Client Component (modal med form)
```

Alle sektion-komponenter er **Server Components**. Ingen `'use client'`. Data kommer som props fra `page.tsx`. Sektion-komponenter indeholder ingen Prisma-kald.

`EditStamdataDialog` er den eneste Client Component — bruger `useState` til modal open/close og form state, kalder en eksisterende `updateCompanyStamdata` server action (som findes eller tilføjes som del af Task 6).

---

## 10. Data-lag

### `src/actions/company-detail.ts`

```ts
'use server'

export interface CompanyDetailData {
  company: Company
  visibleSections: Set<SectionKey>
  healthDimensions: HealthDimensions
  statusBadge: StatusBadge
  alerts: CompanyAlert[] // allerede role-filtreret
  aiInsight: AiInsight | null
  ownership: OwnershipData | null
  contracts: { top: ContractWithBadges[]; totalCount: number }
  finance: FinanceData | null
  cases: { top: CaseWithMeta[]; totalCount: number }
  persons: { top: PersonWithRole[]; totalCount: number }
  visits: VisitWithStatus[]
  documents: DocumentWithExtraction[]
  role: string
}

export async function getCompanyDetailData(
  companyId: string,
  userId: string,
  organizationId: string
): Promise<CompanyDetailData>
```

Flow: se §8 cache-strategi.

Tenant-safety: hver Prisma-query filterer på `organization_id`, `deleted_at: null` hvor relevant, og `company_id`. Adgangscheck via `getAccessibleCompanies(userId, organizationId)` før data hentes — hvis `companyId` ikke i sættet → `notFound()` (Next.js 14 `import { notFound } from 'next/navigation'`).

Sektioner der ikke er synlige for brugerens rolle: queries springes over (returnerer tomme arrays) for at spare DB-roundtrips. Dette betyder at `CompanyDetailData`-feltet for ikke-synlig sektion vil være tom/null, men page.tsx renderer kun baseret på `visibleSections`.

### Helpers placeres i `src/lib/company-detail/helpers.ts`

Pure funktioner, ingen Prisma, fuldt testbare:

- `sectionsForRole(role: string): Set<SectionKey>`
- `pickHighestPriorityRole(roleRows: Array<{ role: string }>): string`
- `deriveHealthDimensions(input): HealthDimensions`
- `deriveStatusBadge(dims): StatusBadge`
- `sortContractsByUrgency(contracts, today): Contract[]`
- `sortCasesByUrgency(cases): Case[]`
- `selectKeyPersons(companyPersons): CompanyPerson[]`

---

## 11. Page-struktur

### `src/app/(dashboard)/companies/[id]/page.tsx` (full rewrite)

```tsx
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getCompanyDetailData } from '@/actions/company-detail'
import { CompanyHeader } from '@/components/company-detail/company-header'
import { AlertBanner } from '@/components/company-detail/alert-banner'
import { OwnershipSection } from '@/components/company-detail/ownership-section'
import { ContractsSection } from '@/components/company-detail/contracts-section'
import { FinanceSection } from '@/components/company-detail/finance-section'
import { CasesSection } from '@/components/company-detail/cases-section'
import { PersonsSection } from '@/components/company-detail/persons-section'
import { VisitsSection } from '@/components/company-detail/visits-section'
import { DocumentsSection } from '@/components/company-detail/documents-section'
import { AiInsightCard } from '@/components/company-detail/ai-insight-card'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const data = await getCompanyDetailData(params.id, session.user.id, session.user.organizationId)
  if (!data) notFound()

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-gray-400">
        <a href="/companies" className="hover:text-blue-600">
          Selskaber
        </a>
        <span className="mx-2">›</span>
        <span className="text-slate-900 font-medium">{data.company.name}</span>
      </nav>

      {/* Header */}
      <CompanyHeader
        company={data.company}
        statusBadge={data.statusBadge}
        healthDimensions={data.healthDimensions}
        showHealthDims={data.role !== 'COMPANY_MANAGER'}
        role={data.role}
      />

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="my-3 flex flex-col gap-2">
          {data.alerts.slice(0, 3).map((alert, i) => (
            <AlertBanner key={i} {...alert} />
          ))}
        </div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-2 gap-4">
        {data.visibleSections.has('ownership') && data.ownership && (
          <OwnershipSection data={data.ownership} />
        )}
        {data.visibleSections.has('contracts') && (
          <ContractsSection
            contracts={data.contracts.top}
            totalCount={data.contracts.totalCount}
            companyId={data.company.id}
          />
        )}
        {data.visibleSections.has('finance') && data.finance && (
          <FinanceSection data={data.finance} />
        )}
        {data.visibleSections.has('cases') && (
          <CasesSection cases={data.cases.top} totalCount={data.cases.totalCount} />
        )}
        {data.visibleSections.has('persons') && (
          <PersonsSection
            persons={data.persons.top}
            totalCount={data.persons.totalCount}
            companyId={data.company.id}
          />
        )}
        {data.visibleSections.has('visits') && <VisitsSection visits={data.visits} />}
        {data.visibleSections.has('documents') && <DocumentsSection documents={data.documents} />}
        {data.visibleSections.has('insight') && data.aiInsight && (
          <div className="col-span-2">
            <AiInsightCard
              headlineMd={data.aiInsight.headline_md}
              bodyMd={data.aiInsight.body_md}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## 12. Edge cases

| Situation                                                 | Adfærd                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Selskab har ingen kontrakter                              | Sektion vises tom: "Ingen aktive kontrakter", ingen "Vis alle" link                                            |
| Selskab har ingen 2025 finansielle data                   | `data.finance` = null, FinanceSection skjules helt (selv for finance-rolle)                                    |
| Selskab har ingen besøg nogensinde                        | Governance-dim = rød, sektion vises tom: "Ingen besøg registreret"                                             |
| Selskab har 0 nøglepersoner (ingen matcher senior-roller) | Sektion vises tom: "Ingen nøglepersoner registreret", "Vis alle X medarbejdere →" link fungerer stadig         |
| AI-call fejler                                            | alerts og aiInsight tomme, sektioner skjules, page renderer fint                                               |
| AI-cache <24h gammel                                      | Brug cache uden at kalde AI                                                                                    |
| Cluster har <3 peers                                      | AI prompt får "klynge ikke tilstrækkelig — undgå sammenligninger" instruktion (stilles dynamisk i user prompt) |
| Bruger har ikke adgang til selskab                        | `notFound()` (404)                                                                                             |
| Bruger har ingen rolle-assignment                         | Fallback til `GROUP_READONLY` → owner-sektion-set med read-only quick-actions                                  |
| CompanyInsightsCache mangler på første visit              | Synkron AI-call kører første gang, cacher, viser resultat                                                      |
| EditStamdataDialog submit fejler                          | Toast error, modal forbliver åben, form state bevares                                                          |

---

## 13. Testing strategi

### Unit tests (pure helpers — ingen DB)

`src/__tests__/company-detail/helpers.test.ts`:

- `deriveHealthDimensions`: 16+ cases (hver dimension rød/amber/grøn, kombinationer)
- `deriveStatusBadge`: 3 cases (max severity)
- `sectionsForRole`: alle 8 rolle-mappings (inkl. fallbacks for unknown roles)
- `pickHighestPriorityRole`: priority-order respekteres, tomt array → GROUP_READONLY
- `sortContractsByUrgency`: udløbet-først, så udløber-snart, så længere-ude
- `sortCasesByUrgency`: NY → AKTIV → AFVENTER
- `selectKeyPersons`: tomt, top 3, >3 kandidater, ingen senior-roller, ejerandel-sortering

### Component tests (Vitest + Testing Library)

`src/__tests__/components/company-detail/`:

- `company-header.test.tsx` — name, status-badge variant, meta-row, health-dims skjult for manager, quick-actions
- `alert-banner.test.tsx` — critical vs warning variant, icon, action-link href
- `ai-insight-card.test.tsx` — headline_md + body_md rendering (markdown bold), tom state
- `section-card.test.tsx` — title, badge, body, footer link
- `ownership-section.test.tsx` — 4 data-rows, ownership-bar split
- `contracts-section.test.tsx` — top 3, "Vis alle X →" conditional link, tom state
- `finance-section.test.tsx` — YoY deltas, Q1-Q4 bars, positive/negative badge
- `cases-section.test.tsx` — top 3, badge farver, tom state
- `persons-section.test.tsx` — top 3 nøglepersoner, "Vis alle X medarbejdere →"
- `visits-section.test.tsx` — top 3, status badges, tom state
- `documents-section.test.tsx` — top 3, AI-badge når extraction findes, "Til review" badge
- `edit-stamdata-dialog.test.tsx` — form validation, submit success, cancel

### AI unit test (mocket Claude-client)

`src/__tests__/ai/company-insights.test.ts`:

- Happy path: mock returnerer valid JSON, parses korrekt via Zod schema
- Malformed JSON: fanges, returnerer `{ ok: false }`
- Timeout: 8s fires via fake timers, returnerer `{ ok: false }`
- Zod validation fejler: fanges som malformed
- Cost beregning via `computeCostUsd`

### Action smoke test (mod seed DB, skipper uden DATABASE_URL)

`src/__tests__/company-detail-actions.test.ts`:

- `getCompanyDetailData` returnerer forventet shape for philip@chainhub.dk + første seed-selskab
- `visibleSections` matcher GROUP_OWNER forventning
- `notFound` når `companyId` ikke i `getAccessibleCompanies`
- Graceful degradation: mock `createClaudeClient` til at fejle → alerts og aiInsight skal være tomme

---

## 14. Migration-rækkefølge

Tasks i eksekveringsrækkefølge (writing-plans-skill vil lave det til en task-by-task plan):

```
Task 0:  Prisma schema — CompanyInsightsCache model + migration
Task 1:  Pure helpers (src/lib/company-detail/helpers.ts) + unit tests
Task 2:  AlertBanner component + test
Task 3:  AiInsightCard component + test
Task 4:  SectionCard wrapper + test
Task 5:  CompanyHeader component + test
Task 6:  EditStamdataDialog + updateCompanyStamdata action + test
Task 7:  7 sektion-komponenter (ownership/contracts/finance/cases/persons/visits/documents)
         + tests — parallelliseres i subagent-mode
Task 8:  AI job src/lib/ai/jobs/company-insights.ts + test (mocket client)
Task 9:  Server Action src/actions/company-detail.ts + smoke test
Task 10: Page rewrite src/app/(dashboard)/companies/[id]/page.tsx
         Slet: layout.tsx, company-detail-client.tsx, CompanyTabs.tsx,
               11 subpage-mapper
Task 11: Full validate (test + typecheck + build + Playwright audit)
         Verificér: ingen lingering imports af slettede filer
                    alle roller kan logge ind og se deres forventede sektioner
                    AI-call cache virker (maks én call pr. selskab pr. dag)
```

Task 0 er prerequisite for Task 9. Tasks 1-8 kan parallelles i subagent-mode da de er uafhængige. Task 9 afhænger af Tasks 0-8. Task 10 afhænger af Task 9. Task 11 afhænger af alt.

---

## 15. Endelig fil-liste

**Opretter (1 migration + 16 kode-filer + 15 test-filer):**

```
prisma/migrations/<timestamp>_add_company_insights_cache/migration.sql

src/actions/company-detail.ts
src/lib/ai/jobs/company-insights.ts
src/lib/company-detail/helpers.ts

src/components/company-detail/alert-banner.tsx
src/components/company-detail/ai-insight-card.tsx
src/components/company-detail/section-card.tsx
src/components/company-detail/company-header.tsx
src/components/company-detail/ownership-section.tsx
src/components/company-detail/contracts-section.tsx
src/components/company-detail/finance-section.tsx
src/components/company-detail/cases-section.tsx
src/components/company-detail/persons-section.tsx
src/components/company-detail/visits-section.tsx
src/components/company-detail/documents-section.tsx
src/components/company-detail/edit-stamdata-dialog.tsx

src/__tests__/company-detail/helpers.test.ts
src/__tests__/components/company-detail/alert-banner.test.tsx
src/__tests__/components/company-detail/ai-insight-card.test.tsx
src/__tests__/components/company-detail/section-card.test.tsx
src/__tests__/components/company-detail/company-header.test.tsx
src/__tests__/components/company-detail/ownership-section.test.tsx
src/__tests__/components/company-detail/contracts-section.test.tsx
src/__tests__/components/company-detail/finance-section.test.tsx
src/__tests__/components/company-detail/cases-section.test.tsx
src/__tests__/components/company-detail/persons-section.test.tsx
src/__tests__/components/company-detail/visits-section.test.tsx
src/__tests__/components/company-detail/documents-section.test.tsx
src/__tests__/components/company-detail/edit-stamdata-dialog.test.tsx
src/__tests__/ai/company-insights.test.ts
src/__tests__/company-detail-actions.test.ts
```

**Modificerer (2 filer):**

```
prisma/schema.prisma                                    — CompanyInsightsCache model + relations på Organization og Company
src/app/(dashboard)/companies/[id]/page.tsx             — FULL REWRITE
```

**Sletter (14 stier):**

```
src/app/(dashboard)/companies/[id]/layout.tsx
src/app/(dashboard)/companies/[id]/company-detail-client.tsx
src/app/(dashboard)/companies/[id]/cases/
src/app/(dashboard)/companies/[id]/contracts/
src/app/(dashboard)/companies/[id]/documents/
src/app/(dashboard)/companies/[id]/employees/
src/app/(dashboard)/companies/[id]/finance/
src/app/(dashboard)/companies/[id]/governance/
src/app/(dashboard)/companies/[id]/log/
src/app/(dashboard)/companies/[id]/overview/
src/app/(dashboard)/companies/[id]/ownership/
src/app/(dashboard)/companies/[id]/stamdata/
src/app/(dashboard)/companies/[id]/visits/
src/components/companies/CompanyTabs.tsx
```

**Genbruges (intet nyt):**

- AppSidebar, AppHeader fra Plan 4B (via (dashboard)/layout.tsx)
- `createClaudeClient`, `computeCostUsd`, logger fra Sprint 8B
- `getAccessibleCompanies` fra permissions
- `ROLE_PRIORITY`-mønster fra `src/actions/dashboard.ts`
- Eksisterende list-sider til "Vis alle X →" links: `/contracts?company=`, `/cases?company=`, `/persons?company=`, `/documents?company=`

---

## 16. Åbne beslutninger

Ingen. Designet er fastlagt, brainstorm-fasen er færdig.

## 17. Referencer

- Proto HTML: `.superpowers/brainstorm/45074-1775072716/content/selskab-detail-v1.html`
- Godkendt AI-prototype spec: `docs/superpowers/specs/2026-03-30-ai-integrated-prototype-design.md`
- Database schema: `prisma/schema.prisma`
- Dashboard aggregator-mønster (genbruges): `src/actions/dashboard.ts`
- Permissions-helpers: `src/lib/permissions/index.ts`
- AI-client: `src/lib/ai/client/index.ts`
- Plan 4A/4B status: `docs/status/PROGRESS.md`
