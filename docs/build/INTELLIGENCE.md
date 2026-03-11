# INTELLIGENCE.md — ChainHub MABS Videnslag
Automatisk opdateret af orchestrator efter hver repair-cyklus.
Læses af alle agenter ved repair for at undgå kendte fejl.
Nyeste læring øverst.
---

## Kendte fejlmønstre

### Interaktive kommandoer hænger — stdin er lukket (KRITISK)
bash() toolen kører med stdin=DEVNULL. Kommandoer der prompter for input
(fx "Ok to proceed? (y)") vil HÆNGE eller FEJLE stille.

**Løsning:** Brug ALTID non-interaktive flags:
```bash
# npx — brug --yes for at auto-bekræfte pakke-installation
npx --yes create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm

# npm init — brug --yes
npm init --yes

# prisma — er allerede non-interaktiv, men brug altid --name på migrate:
npx prisma migrate dev --name init
```

**Windows-specifikt:**
- Brug `npx.cmd` / `npm.cmd` (orchestratoren gør dette automatisk)
- Undgå Linux-kommandoer: `tail`, `head`, `grep` → brug PowerShell-ækvivalenter eller search_in_files tool
- Pipe (`|`) virker, men `2>&1` opfanges allerede af orchestratoren

### Supabase + Prisma — forbindelsesopsætning (KRITISK)
ChainHub bruger Supabase PostgreSQL. Prisma KRÆVER to forskellige connection strings:

```prisma
// prisma/schema.prisma — datasource SKAL se sådan ud:
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Pooled (Transaction mode, port 6543)
  directUrl = env("DIRECT_URL")         // Direct (port 5432) — til migrationer
}
```

**Regler:**
- `DATABASE_URL` = Supabase Transaction Pooler URL (port 6543, med `?pgbouncer=true`)
- `DIRECT_URL` = Supabase Direct URL (port 5432) — bruges KUN af `prisma migrate dev`
- `prisma migrate dev` FEJLER hvis den kører mod pooler-URL'en
- `prisma generate` bruger ingen af dem (kun schema-parsing)
- `prisma db push` og `prisma migrate dev` KRÆVER `DIRECT_URL`

**Supabase connection pooler:**
- Supabase bruger PgBouncer i Transaction mode
- Prisma interactive transactions virker IKKE over pooler — brug `directUrl`
- Preview features: `previewFeatures = []` — tilføj KUN hvis nødvendigt

### Prisma Æ/Ø/Å-encoding (KRITISK)
Prisma accepterer IKKE danske specialtegn i enum-navne — `prisma generate` crasher.
Brug altid ASCII + @map() for at bevare danske DB-værdier:
```prisma
UDLOEBET   @map("UDLØBET")    // korrekt
UDLØBET                        // FEJL — crasher prisma generate
```
Alle korrekte ASCII-navne og @map-værdier: docs/spec/DATABASE-SCHEMA.md

### Repair-loop divergens
Når TS-fejl STIGER mellem iterationer (fx 109 → 160), STOP reparation.
Årsag: agenten retter symptomer i downstream-filer i stedet for kilden.
Løsning: Ret altid kilden først: prisma schema → prisma generate → types → downstream.
Aldrig ret 20 filer parallelt — ret én kilde og lad fejlene forsvinde nedstrøms.

### Garblede enum-værdier ved write_file
Tidligere kørsel producerede korrupte enum-navne med uønskede mellemrum
(fx `TILTRAE DELSESDOKUMENT` i stedet for `TILTRAEDELSESDOKUMENT`).
Årsag: sandsynligvis token-splitting i streaming output.
Forebyggelse: Verificér altid med `file_encoding_check` UMIDDELBART efter write_file
på prisma/schema.prisma.

### Dependency-regel
Enhver ny import KRÆVER at pakken tilføjes til package.json i samme handling.
Kode med imports til ikke-installerede pakker fejler ved `next build`.
Sprint-gate: `npm install --legacy-peer-deps` → `prisma generate` → `tsc --noEmit` → `next build`.

## [2026-03-10 22:53]
### Prisma v7 breaking change — datasource URL i schema (KRITISK)\nPrisma v7+ kræver connection URLs i prisma.config.ts, ikke i schema.prisma.\nVores setup bruger Prisma v5 som er kompatibel med url/directUrl i schema.prisma.\nLøsning: Pinned til prisma@5 og @prisma/client@5.

## [2026-03-10 23:41]
useSearchParams() i Next.js 14 kræver Suspense-boundary. Symptom: build fejler med "useSearchParams() should be wrapped in a suspense boundary". Fix: Pak den komponent der kalder useSearchParams() ind i &lt;Suspense fallback=&gt;. Pattern: eksportér en default page-komponent der wrapper form-komponenten i Suspense.

## [2026-03-10 23:56]
## [Sprint 6] ESLint i next build
Next.js `next build` kører ESLint på AL kode inkl. test-filer i src/.
Ubrugte imports i test-filer (`vi`, `beforeEach`) slår fejl.
Løsning: Fjern ubrugte imports fra test-imports, eller tilføj `// eslint-disable-next-line` på test-filer.
Alternativt: konfigurér ESLint til at ignorere __tests__/ mappen i .eslintrc.json.

## [2026-03-11 20:24]
## [Sprint 7] Prisma CompanyGetPayload type-assertion nødvendig ved dynamisk where
Når `prisma.company.findMany` kaldes med dynamisk `where`-objekt (fx `const where: Prisma.CompanyWhereInput = {}`),
infererer TypeScript ikke korrekt at result inkluderer `_count` og `company_persons`.
Løsning: Brug `as Promise<Prisma.CompanyGetPayload<{ include: {...} }>>` type-assertion på query-kaldet.
Pattern: Definer type med `type CompanyWithRelations = Prisma.CompanyGetPayload<{...}>` øverst i filen.

## [2026-03-11 20:24]
## [Sprint 7] Company schema har ikke tasks[] som relation
Company-modellen i Prisma-schema mangler `tasks Task[]` som reverse relation
(Task har company_id men ingen back-relation er defineret).
Konsekvens: `_count: { select: { tasks: true } }` fejler med TS-fejl.
Løsning: Brug separat `prisma.task.count({ where: { company_id } })` for opgave-count pr. selskab.
Alternativt: Tilføj `tasks Task[]` til Company-modellen i schema i Sprint 8 (BA-02).

## [2026-03-11 20:24]
## [Sprint 7] CaseCompany junction har ikke deleted_at kolonne
Prisma CaseCompany model mangler deleted_at. Queries der forsøger at filtrere på
`case.deleted_at` inde i `CaseCompany` nested where fejler med TS2353.
Workaround: Filtrer via `case: { deleted_at: null }` i nested relation where.
Eksempel: `prisma.caseCompany.count({ where: { case: { deleted_at: null } } })`

## [2026-03-11 20:24]
## [Sprint 7] Windows CRLF line endings i node file manipulation
Node.js read/write af filer på Windows producerer CRLF line endings (\r\n).
String-matching med `l !== '  Plus,'` fejler fordi den faktiske linje er `'  Plus,\r'`.
Fix: Brug `l.trimEnd() !== '  Plus,'` ELLER read/write med explicit encoding og line ending normalisering.
Pattern: `lines.filter(l => l.trimEnd() !== 'TARGET_LINE')`
