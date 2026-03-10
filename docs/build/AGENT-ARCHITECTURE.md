# AGENT-ARCHITECTURE.md
# ChainHub — Multi-Agent Byggesystem
**Version 0.4 — spec-lås præciseret**

**Dette dokument definerer HVORDAN systemet bygges — ikke hvad det skal kunne.**
Alle agenter læser fra MD-dokumenter som kilde til sandhed. Kode skrives aldrig
fra hukommelse — altid fra spec.

---

## Grundprincip: Deliberativt netværk, ikke pipeline

Det her er **ikke** et pipeline hvor agent A afleverer til agent B som afleverer til agent C.
Det er et netværk hvor agenterne aktivt drøfter, udfordrer og itererer med hinanden,
inden noget betragtes som færdigt.

```
                    ┌─────────────────────┐
                    │    ORCHESTRATOR     │
                    │  (dirigerer + dømmer│
                    │   ved uenighed)     │
                    └──────────┬──────────┘
                               │ uddelegerer + samler
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
       │ SPECIALIST- │  │  SPECIALIST- │  │   QA-AGENT   │
       │  AGENT A    │◄─►  AGENT B    │◄─►  (challenger) │
       └─────────────┘  └──────────────┘  └──────────────┘
              ▲                ▲                ▲
              └────────────────┴────────────────┘
                    Alle skriver til og læser fra
                         /docs/status/
```

### Hvad "deliberation" betyder i praksis

Hver beslutning eller implementering gennemgår tre faser:

```
FASE 1 — PROPOSAL
  Specialist-agent foreslår en løsning og begrunder den.
  Skriver forslaget til DECISIONS.md med status: "PROPOSED"

FASE 2 — CHALLENGE  
  QA-agent (og evt. anden specialist-agent) læser forslaget og
  udfordrer aktivt:
    - "Dette design håndterer ikke edge case X"
    - "Det her bryder med roller-og-tilladelser.md afsnit Y"
    - "Schema-valget her vil give N+1 queries på dette flow"
  Skriver indsigelser til DECISIONS.md med status: "CHALLENGED"

FASE 3 — RESOLUTION
  Specialist-agent responderer på udfordringerne:
    - Enten: reviderer forslaget og markerer: "REVISED"
    - Eller: forsvarer og begrunder hvorfor indsigelsen ikke holder
  Orchestrator læser begge sider og træffer endelig beslutning: "ACCEPTED"
```

Ingen kode committes til et modul før dets beslutninger er "ACCEPTED" i DECISIONS.md.

### Iterationsregel

Ingen agent erklærer et modul færdigt selv. Et modul er færdigt når:
1. Feature-agent melder "klar til review"
2. QA-agent har gennemgået og enten godkendt eller rejst indsigelser
3. Alle indsigelser er resolved (ACCEPTED eller WONT-FIX med begrundelse)
4. Orchestrator opdaterer PROGRESS.md til "done"

Minimum to iterationer pr. modul. Komplekse moduler (auth, schema, permissions) minimum tre.

---

## MD-dokumenter som fælles hukommelse

```
MD-dokumenter  →  alle agenter læser  →  drøfter  →  itererer  →  kode
     ↑                                                               │
     └───────────────── agenter opdaterer løbende ──────────────────┘
```

Ingen agent begynder at skrive kode uden at have læst de relevante MD-filer.
Ingen agent afslutter et modul uden at validere mod spec.
MD-filerne er den eneste kilde til sandhed — ikke agenternes hukommelse.

---

## Dokument-hierarki (alle agenter kender dette)

```
/docs
  /spec
    kravspec-legalhub.md         ← Hvad systemet skal kunne (produkt)
    roller-og-tilladelser.md      ← Adgangsmodel (3 lag)
    DATABASE-SCHEMA.md           ← Komplet datamodel + relationer
    CONTRACT-TYPES.md            ← Alle kontrakttyper + metadata
    UI-FLOWS.md                  ← Brugerflows pr. modul
    API-SPEC.md                  ← Alle endpoints + request/response
  /build
    AGENT-ARCHITECTURE.md        ← Dette dokument
    SPRINT-PLAN.md               ← Hvad bygges hvornår
    CONVENTIONS.md               ← Kode-konventioner, navngivning, patterns
  /status
    PROGRESS.md                  ← Hvad er bygget, hvad mangler (auto-opdateret)
    BLOCKERS.md                  ← Aktive blokkere på tværs af agenter
    DECISIONS.md                 ← Arkitekturbeslutninger og begrundelser
```

**Regel:** Hvis information ikke er i et MD-dokument, bygges det ikke.
Agenter flagrer manglende spec som en blocker — de gætter ikke.

---

## Agent-roller

### Orchestrator
**Ansvar:** Koordinerer alle specialist-agenter, vedligeholder PROGRESS.md og BLOCKERS.md,
fordeler opgaver, løser konflikter mellem agenter.

**Læser altid:** Alle filer i `/docs/spec/` + SPRINT-PLAN.md + PROGRESS.md

**Kører:**
- Ved start af hver session: læs PROGRESS.md → identificér næste opgave
- Ved afslutning af hver session: opdater PROGRESS.md + BLOCKERS.md
- Aldrig: skriver applikationskode direkte

**Prompt-skabelon:**
```
Du er Orchestrator for ChainHub-projektet.

Læs følgende filer i rækkefølge:
1. /docs/status/PROGRESS.md
2. /docs/build/SPRINT-PLAN.md
3. /docs/status/BLOCKERS.md

Derefter:
- Identificér næste uafsluttede opgave i aktuelle sprint
- Tjek om der er uløste blokkere for opgaven
- Uddelegér til rette specialist-agent med præcis opgave-beskrivelse
- Angiv hvilke MD-filer specialist-agenten skal læse

Rapportér altid: [OPGAVE] [AGENT] [INPUT-FILER] [SUCCESKRITERIUM]
```

---

### Agent 1: Schema-agent
**Ansvar:** Database-schema, Prisma-migrationer, seed-data, multi-tenancy-lag.

**Læser:** DATABASE-SCHEMA.md, roller-og-tilladelser.md, CONVENTIONS.md

**Output:**
- `prisma/schema.prisma` (komplet, ingen TODOs)
- `prisma/migrations/` (alle migrationer navngivet semantisk)
- `prisma/seed.ts` (test-organisation + bruger + eksempel-selskab)

**Valideringsregler:**
- Alle tabeller har `organization_id` (multi-tenancy)
- Alle tabeller har `created_at`, `updated_at`, `created_by`
- Kritiske tabeller har `deleted_at` (soft delete)
- Alle relationer er eksplicitte (ingen implicitte foreign keys)
- Sensitivity-kolonne på: contracts, cases, documents

**Prompt-skabelon:**
```
Du er Schema-agent for ChainHub.

Læs disse filer FØR du skriver en linje kode:
- /docs/spec/DATABASE-SCHEMA.md
- /docs/spec/roller-og-tilladelser.md
- /docs/build/CONVENTIONS.md

Din opgave: [SPECIFIK OPGAVE FRA ORCHESTRATOR]

Valideringskrav:
- Alle tabeller har organization_id, created_at, updated_at, created_by
- Soft delete (deleted_at) på: organizations, companies, persons, contracts, cases, documents
- Sensitivity enum på: contracts, cases, documents
- Ingen hardcodede værdier — brug enums

Afslut med: Opdater /docs/status/PROGRESS.md med hvad der er færdigt.
```

---

### Agent 2: Auth-agent
**Ansvar:** NextAuth.js setup, Microsoft OAuth, session-håndtering,
middleware til route-beskyttelse, rolle-tjek helpers.

**Læser:** roller-og-tilladelser.md, DATABASE-SCHEMA.md, CONVENTIONS.md

**Output:**
- `src/lib/auth/` — NextAuth config, providers
- `src/lib/auth/permissions.ts` — rolle-tjek funktioner
- `src/middleware.ts` — route-beskyttelse
- `src/lib/auth/hooks.ts` — `usePermission()`, `useScope()` hooks

**Kernefunktioner der SKAL implementeres:**
```typescript
// Tjek om bruger har adgang til specifikt selskab
canAccessCompany(userId, companyId): Promise<boolean>

// Tjek om bruger må se data med givet sensitivitetsniveau
canAccessSensitivity(userId, level: SensitivityLevel): Promise<boolean>

// Tjek om bruger har specifik modul-adgang
canAccessModule(userId, module: ModuleName): Promise<boolean>

// Hent liste af selskaber bruger må se
getAccessibleCompanies(userId): Promise<Company[]>
```

---

### Agent 3: UI-agent
**Ansvar:** Komponenter, layout, navigation, designsystem. Ingen business logic.

**Læser:** kravspec-legalhub.md, UI-FLOWS.md, CONVENTIONS.md

**Output:**
- `src/components/ui/` — shadcn/ui + custom komponenter
- `src/components/layout/` — sidebar, header, navigation
- `src/app/(dashboard)/layout.tsx` — dashboard shell

**Regler:**
- Kun Tailwind utility-classes — ingen inline styles
- Alle tekster på dansk
- Tomme states for alle lister (ingen blank screen)
- Loading states på alle async operationer
- Mobile-responsive (men desktop-first)

---

### Agent 4: Feature-agent (instansieres pr. modul)
**Ansvar:** Ét modul ad gangen — server actions, API routes, page-komponenter.

**Læser:** kravspec-legalhub.md (relevant sektion), DATABASE-SCHEMA.md, API-SPEC.md,
UI-FLOWS.md (relevant sektion), roller-og-tilladelser.md

**Moduler (bygges i denne rækkefølge):**
```
1. Selskabsprofil + stamdata
2. Persondatabase
3. Kontraktstyring
4. Sagsstyring
5. Opgavestyring
6. Økonomi-overblik
7. Dokumenthåndtering
8. Portfolio-dashboard (samler data fra 1-7)
```

**Prompt-skabelon:**
```
Du er Feature-agent for modulet: [MODUL-NAVN]

Læs disse filer FØR du skriver en linje kode:
- /docs/spec/kravspec-legalhub.md — sektion [X.X]
- /docs/spec/DATABASE-SCHEMA.md — tabeller: [LISTE]
- /docs/spec/API-SPEC.md — endpoints: [LISTE]
- /docs/spec/UI-FLOWS.md — flows: [LISTE]
- /docs/spec/roller-og-tilladelser.md 
  fra src/lib/auth/permissions.ts før data returneres
- Brug server actions (ikke client-side fetch) til mutationer
- Brug Prisma direkte — ingen ORM-abstraktionslag ovenpå
- Skriv TypeScript med strict mode

Output:
- src/app/(dashboard)/[modul]/ — page + loading + error
- src/lib/actions/[modul].ts — server actions
- src/components/[modul]/ — modul-specifikke komponenter

Afslut med: Opdater /docs/status/PROGRESS.md
```

---

### Agent 5: Integration-agent
**Ansvar:** Microsoft 365 / Graph API, Stripe Billing, email.

**Læser:** kravspec-legalhub.md (sektion 5.9 + 7), CONVENTIONS.md

**Output:**
- `src/lib/integrations/microsoft/` — Graph API client, calendar sync, email
- `src/lib/integrations/stripe/` — subscription management, webhooks
- `src/app/api/webhooks/` — Stripe + Microsoft webhook handlers

---

### Agent 6: QA-agent
**Ansvar:** Validerer at bygget kode matcher spec. Finder gaps og inkonsistenser.
Skriver aldrig ny feature-kode — kun rettelser og manglende edge cases.

**Læser:** Alle spec-filer + den relevante kode

**Kører:** Efter hver feature-agent er færdig med et modul

**Prompt-skabelon:**
```
Du er QA-agent for ChainHub.

Sammenlign den implementerede kode i src/app/(dashboard)/[modul]/
og src/lib/actions/[modul].ts med:
- /docs/spec/kravspec-legalhub.md sektion [X.X]
- /docs/spec/roller-og-tilladelser.md

Tjek specifikt:
1. Er alle adgangstjek (canAccessCompany, canAccessSensitivity) på plads?
2. Mangler der funktionalitet beskrevet i kravspec?
3. Er der edge cases der ikke håndteres (tom liste, ikke-eksisterende ID, 
   forkert tenant, utilstrækkelige rettigheder)?
4. Er der TypeScript-fejl eller manglende error handling?

Output: Liste af gaps med prioritet (kritisk / vigtig / nice-to-have)
Opdater /docs/status/BLOCKERS.md med kritiske gaps.
```

---

## Session-protokol (kør dette ved start af HVER Claude Code-session)

```
1. Orchestrator læser PROGRESS.md og BLOCKERS.md
2. Orchestrator identificerer næste opgave
3. Orchestrator aktiverer relevant specialist-agent med:
   - Opgave-beskrivelse
   - Liste af MD-filer der skal læses
   - Succeskriterium
   - Hvad der skal opdateres i PROGRESS.md ved afslutning
4. Specialist-agent læser MD-filer, bygger, validerer
5. QA-agent validerer output
6. Orchestrator opdaterer PROGRESS.md + BLOCKERS.md
```

**Copy/paste til start af hver session:**
```
Læs /docs/status/PROGRESS.md og /docs/build/SPRINT-PLAN.md.
Identificér næste uafsluttede opgave. Aktivér relevant agent.
Husk: Ingen kode skrives uden at have læst de relevante MD spec-filer først.
```

---

## Iterations-princip

Alle moduler bygges i tre gennemløb:

```
Gennemløb 1 — Skeleton
  Feature-agent bygger: datastruktur + tom UI (ingen logik)
  Mål: Kan kompilere, ingen TypeScript-fejl

Gennemløb 2 — Functionality  
  Feature-agent tilføjer: server actions, permissions, data
  Mål: Fuld CRUD, korrekte adgangstjek, happy path virker

Gennemløb 3 — Polish + edge cases
  QA-agent + Feature-agent: tomme states, fejlhåndtering, 
  loading states, validering
  Mål: Produktionsklar
```

---

## Spec-fasen er en envejssluse

```
SPEC-FASE                         BUILD-FASE
─────────────────────────────────────────────────────────────
DEA-agenter challenger spec   │   BA-agenter bygger efter spec
Orchestrator afgør            │   Spec-dokumenter ændres IKKE
Spec opdateres                │   Kode er det eneste output
DEA re-reviewer               │
Gentages til 0 KRITISK        │
                              │
         ↓  GODKENDELSE  ↓   │
         Tegningen er låst.   │
         Slusen lukker.       │
─────────────────────────────────────────────────────────────
```

**Når slusen er lukket gælder disse regler uden undtagelse:**

1. **Spec-dokumenter genåbnes ikke.**
   En BA-agent der opdager en uklarhed ændrer ikke spec —
   den løser det i kode og logger beslutningen i DECISIONS.md.

2. **DEA-agenter er sparringspartnere, ikke dommere.**
   Hvis en BA-agent støder på en spec-gap under build, kan den
   aktivere den relevante DEA-agent for afklaring.
   DEA-agenten svarer med en anbefaling. BA-agenten omsætter
   svaret til kode. Spec-dokumentet røres ikke.
   Analogien: tømreren ringer til arkitekten — ikke for at
   lave tegningen om, men for at få et svar og komme videre.

3. **Logning er obligatorisk.**
   Alle afklaringer der opstår i build-fasen skrives til
   DECISIONS.md med status BUILD-CLARIFICATION og hvilken
   BA-agent der spurgte og hvilken DEA-agent der svarede.

---

## Sprint-gate — ikke-forhandlingsbart (MABS v0.3)

Efter hvert sprint kører BA-08 (DevOps-agent) følgende gate i rækkefølge.
Alle trin skal være grønne. Et enkelt fejltrin stopper sprintet.

```
1. npm install --legacy-peer-deps
2. npx prisma generate
3. npx tsc --noEmit
4. npx next build
```

**Regel:** Et sprint markeres **ikke** som færdigt i PROGRESS.md hvis build fejler.
Feature-agenten der ejer sprintet er ansvarlig for at gate passerer inden Orchestrator
opdaterer status.

**KRITISK — Prisma ASCII-regel:**
Prisma accepterer ikke Æ/Ø/Å i enum-navne. Trin 2 vil fejle ved sådanne navne.
Brug altid `@map()` for at bevare danske værdier i databasen:
```prisma
UDLOEBET   @map("UDLØBET")    ← korrekt
UDLØBET                        ← crasher prisma generate
```
Korrekte ASCII-navne og `@map`-værdier fremgår af `docs/spec/DATABASE-SCHEMA.md`.

---

## PROGRESS.md format (auto-opdateres af agenter)

```markdown
# Build Progress — ChainHub

Opdateret: [DATO] af [AGENT]

## Sprint 1 — Fundament
- [x] Projektopsætning + Next.js
- [x] Prisma schema v1
- [ ] Auth + middleware
- [ ] Seed data

## Sprint 2 — Kerneobjekter  
- [ ] Selskabsprofil (skeleton)
- [ ] Selskabsprofil (functionality)
- [ ] Selskabsprofil (polish)
...

## Kendte blokkere
→ Se BLOCKERS.md
```

---

## DECISIONS.md format (deliberationens kerndokument)

Alle ikke-trivielle beslutninger dokumenteres her. Det er dette dokument
der gør netværket deliberativt frem for sekventielt — agenternes drøftelser
er synlige, sporbare og kan genbesøges.

```markdown
# DECISIONS.md — Arkitekturbeslutninger

---

## DEC-001: [Beslutningsemne]
**Status:** PROPOSED | CHALLENGED | REVISED | ACCEPTED | WONT-FIX
**Proposed by:** [Agent-navn]
**Challenged by:** [Agent-navn] (hvis relevant)
**Dato:** [DATO]

**Forslag:**
[Hvad agenten foreslår og hvorfor]

**Udfordring:**
[Konkret indsigelse — hvad holder ikke, hvilken edge case mangler,
 hvilket krav fra spec brydes]

**Respons:**
[Enten: revideret forslag. Eller: forsvar med begrundelse]

**Orchestrators afgørelse:** [ACCEPTED / WONT-FIX + begrundelse]
```

**Eksempel på reel drøftelse:**
```
DEC-001: Sensitivity på row-niveau vs. kontrakttype-niveau
Proposed by: Schema-agent

Forslag: Sensitivity gemmes pr. record så brugere kan justere pr. kontrakt.

Udfordring fra QA-agent:
En company_manager kan se ejeraftalen hvis nogen ved fejl sætter den til
INTERN. Kontrakttyper med høj risiko bør have et gulv der ikke kan underrides.

Respons fra Schema-agent:
Enig — løser det med to-lags model: kontrakttype har minimum_sensitivity,
bruger kan kun hæve aldrig sænke under minimum.

Orchestrators afgørelse: ACCEPTED — implementér to-lags model.
```

---

## Deliberationsprotokol — hvornår skal agenter drøfte?

Ikke alt kræver fuld deliberation. Brug denne regel:

```
TRIVIELT (ingen drøftelse nødvendig):
  - Navngivning af variable og filer
  - UI-komponenter uden forretningslogik
  - Tekniske rettelser uden design-implikationer

STANDARD (én challenge-runde):
  - Alle nye database-tabeller og relationer
  - Nye API-endpoints
  - Nye UI-flows

KRITISK (minimum to challenge-runder + Orchestrator-afgørelse):
  - Ændringer til adgangs- og rollemodel
  - Ændringer til multi-tenancy-lag
  - Ændringer til sensitivity-systemet
  - Arkitekturbeslutninger der påvirker >1 modul
```

**DEA-agenters rolle afhænger af hvilken fase systemet er i:**

```
I SPEC-FASEN:   DEA-agenter er dommere.
                De challenger, Orchestrator afgør, spec opdateres.
                Iteration er forventet og ønsket.

I BUILD-FASEN:  DEA-agenter er sparringspartnere.
                De svarer på konkrete spørgsmål fra BA-agenter.
                De ændrer ikke spec. De blokerer ikke build.
                Deres svar omsættes til kode, ikke til spec-rettelser.
```

---

## Hvad intelligent iteration ser ud som i praksis

```
SESSION-EKSEMPEL:

Orchestrator: "Schema-agent: Design user_role_assignments tabellen.
               Læs roller-og-tilladelser.md afsnit 2-4 først."

Schema-agent: [læser MD] "Foreslår denne struktur: [DEC-007 PROPOSED]"

QA-agent: [læser DEC-007] "Udfordring: Strukturen tillader ikke at en
          bruger har GROUP_LEGAL på tværs OG COMPANY_MANAGER på én klinik
          simultant. Det er et krav i roller-og-tilladelser.md afsnit 1."

Schema-agent: "Korrekt. Løser med et array af rolle-tildelinger pr. bruger
              frem for én enkelt rolle-kolonne. [DEC-007 REVISED]"

QA-agent: "REVISED version løser problemet. Ingen yderligere indsigelser."

Orchestrator: "[DEC-007 ACCEPTED] — Schema-agent: implementér nu."

Schema-agent: [skriver kode] "Færdig. PROGRESS.md opdateret."
```

---

## Changelog

```
v0.4 (spec-lås præciseret):
  [NY] Sektion "Spec-fasen er en envejssluse" tilføjet:
       Eksplicit envejssluse-model — spec ændres ikke i build-fasen.
       DEA-agenter er sparringspartnere (ikke dommere) i build-fasen.
       BUILD-CLARIFICATION log-krav i DECISIONS.md.
  [UPD] Deliberationsprotokol udvidet:
       Eksplicit skelnen mellem DEA-rolle i spec-fase vs. build-fase.

v0.3 (QA-R2-rettet):
  [M1] roller-og-tilladelser.md filnavn rettet — 10 forekomster i dokumentindhold:
       ROLLER-OG-TILLADELSER.md → roller-og-tilladelser.md
       (challenge-eksempel, dokument-hierarki, Schema-agent Læser,
        Schema-agent prompt, Auth-agent Læser, Feature-agent Læser,
        Feature-agent prompt, QA-agent prompt, SESSION-EKSEMPEL ×2)
       Changelog-reference linje 500 bevaret uændret (historisk).
  [M2] Sprint-gate sektion tilføjet (MABS v0.3):
       npm install → prisma generate → tsc --noEmit → next build
       Inkluderer Prisma ASCII-regel og @map()-krav.

v0.2 (QA-rettet):
  [K1] Forkert filnavn rettet — 6 forekomster:
       KRAVSPEC.md → kravspec-legalhub.md
       (dokument-hierarki, Agent 3 Læser, Agent 4 Læser,
        Agent 4 prompt, Agent 5 Læser, Agent 6 prompt)
  [K2] Forældet tabelnavn rettet — SESSION-EKSEMPEL:
       user_roles → user_role_assignments
       (match med DATABASE-SCHEMA.md v0.2 [K4],
        ROLLER-OG-TILLADELSER.md v0.2 [K2], UI-FLOWS.md v0.3 [K2])
  [K3] Engelsk sensitivity-enum rettet — DEC-001 eksempel:
       INTERNAL → INTERN
       (match med SensitivityLevel-enum i DATABASE-SCHEMA.md v0.2 [K1])
  [M1] Lowercase rollenavne rettet til SCREAMING_SNAKE_CASE
       i SESSION-EKSEMPEL (2 forekomster):
       group_legal → GROUP_LEGAL, company_manager → COMPANY_MANAGER

v0.1:
  Første udkast
```
