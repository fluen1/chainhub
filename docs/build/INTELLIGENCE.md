# INTELLIGENCE.md — ChainHub Videnslag
Kendte fejlmønstre og learnings. Nyeste øverst.
---

## PERMANENT REGEL: Smoketest er obligatorisk — ikke-forhandlingsbart

```
Smoketest SKAL køres ved HVERT sprint, HVERT gennemløb, HVER commit.
Det er IKKE en feature i ét sprint — det er permanent DevOps-infrastruktur.

SMOKETEST-PROCEDURE (kører ALTID inden sprint markeres færdigt):
  1. start_process("npx next dev", 3001)
  2. wait_for_port(3001)
  3. For HVER route i listen nedenfor:
     a. http_request("GET", "http://localhost:3001/[route]")
     b. Verificér status 200 (eller 307 redirect for auth-beskyttede sider)
     c. browser_get_console_errors("http://localhost:3001/[route]")
     d. Verificér 0 console-fejl
  4. stop_process(3001)
  5. Hvis NOGEN route fejler → STOP. Ret fejlen. Kør smoketest igen.

ROUTES DER TESTES (udvides automatisk når nye moduler tilføjes):
  /login, /dashboard, /companies, /companies/[test-id],
  /companies/[test-id]/overview, /contracts, /cases, /tasks,
  /persons, /documents, /settings, /search?q=test,
  /visits (Sprint 8+), /calendar (Sprint 9+)

Sprint er ALDRIG færdigt uden bestået smoketest.
```

---

## PERMANENT REGEL: Skalerings-arkitektur — ikke-forhandlingsbart

```
ChainHub SKAL designes til 56+ lokationer med 20+ ansatte pr. lokation.
Det betyder potentielt 1.500+ kontrakter, 1.200+ personer, 500+ opgaver.

PAGINATION ALENE ER IKKE NOK. 75 sider med kontrakter er ubrugeligt.

HIERARKISK NAVIGATION ER PÅKRÆVET:
  Primær vej:  Dashboard → Klinik → Data i kontekst af klinikken
  Sekundær vej: Global liste → ALTID med selskabs-filter som default

REGLER FOR ALLE GLOBALE LISTER (/contracts, /tasks, /persons, /documents, /cases):

  1. SELSKABS-FILTER er OBLIGATORISK og PROMINENT
     Ikke et filter gemt i en dropdown — det er den FØRSTE interaktion.
     Mønster: "Viser: Alle selskaber ▼" → klik → vælg specifikt selskab
     Når et selskab er valgt: listen viser KUN det selskabs data.
     URL: /contracts?company=uuid → bookmarkbar, delbar.

  2. GRUPPERET VISNING som default (ikke flat liste)
     Kontrakter: Grupperet pr. selskab
       "Tandlæge Østerbro (12 kontrakter)"
       "Tandlæge Aarhus (8 kontrakter)"
     Personer: Grupperet pr. selskab eller pr. rolle
     Dokumenter: Grupperet pr. selskab
     Opgaver: Grupperet pr. kilde (besøg / sag / standalone)

  3. AGGREGEREDE COUNTS — ikke 1.500 rækker
     Global kontraktside viser IKKE alle 1.500 kontrakter.
     Den viser: 56 selskaber med count + alerts pr. selskab.
     Klik på selskab → se det selskabs kontrakter.

  4. SMART DEFAULTS baseret på brugeradfærd
     Hvis brugeren sidst kiggede på "Tandlæge Østerbro":
     /contracts åbner med Østerbro pre-valgt som filter.
     Sidebar "Senest besøgt" understøtter dette.

  5. KONTEKSTUEL NAVIGATION er primær
     En kædeleder navigerer sjældent til /contracts.
     De navigerer til /companies/[id] → Kontrakter-fane.
     Den globale liste er til tværgående søgning og rapportering.

  6. PERFORMANCE ved skala
     Globale count-queries SKAL bruge _count aggregering, ALDRIG findMany().
     Aldrig hent 1.500 records til klienten — brug server-side pagination.
     Grupperet visning loader kun collapsed counts, expandér on-demand.

DETTE PRINCIP GÆLDER FOR ALLE SIDER, ALLE FANER, ALLE MODULER.
UI SKAL testes med 50+ records, ikke 7.
```

---

## Kendte fejlmønstre

### 'use client' og server-side utility-funktioner (KRITISK — Sprint 7 læring)
Next.js App Router: Server Components kan IKKE importere funktioner fra
filer markeret med 'use client'. Selvom funktionen er en ren utility
(ingen React hooks), fejler importen med "is not a function" runtime-fejl.

**Regel:** Server-side utility-funktioner SKAL ligge i `src/lib/`.
Kun React-komponenter med hooks hører til `'use client'` filer.

### Interaktive kommandoer hænger — stdin er lukket (KRITISK)
Brug ALTID non-interaktive flags: `npx --yes`, `npm init --yes`.

### Supabase + Prisma — forbindelsesopsætning (KRITISK)
url = Pooled (port 6543, ?pgbouncer=true), directUrl = Direct (port 5432).

### Prisma Æ/Ø/Å-encoding (KRITISK)
Brug altid ASCII + @map(). Se DATABASE-SCHEMA.md.

### Repair-loop divergens
Når TS-fejl STIGER, STOP. Ret kilden først.

### Garblede enum-værdier ved write_file
Verificér med file_encoding_check umiddelbart efter write_file på schema.prisma.

### Dependency-regel
Ny import → pakke i package.json i samme handling.

### Prisma v7 breaking change
Pinned til prisma@5 og @prisma/client@5.

### useSearchParams() kræver Suspense
Pak komponent i `<Suspense fallback={null}>`.

### ESLint i next build
Ubrugte imports i test-filer fejler. Fjern dem.

### [Sprint 7] CompanyGetPayload type-assertion
Dynamisk where → brug `as Promise<CompanyGetPayload<{...}>>`.

### [Sprint 7] Company schema mangler tasks[] relation
Brug separat `prisma.task.count()` for opgave-count.

### [Sprint 7] CaseCompany mangler deleted_at
Filtrer via `case: { deleted_at: null }` i nested where.

### [Sprint 7] Windows CRLF line endings
Brug `l.trimEnd()` ved string-matching.
