# DECISIONS.md
# ChainHub — Arkitekturbeslutninger
**Skrives af:** Alle agenter (DEA + BA)
**Læses af:** BA-01 (Orchestrator)

## Statuser
PROPOSED / CHALLENGED / REVISED / ACCEPTED / WONT-FIX

## Rangering
KRITISK / VIGTIG / NICE-TO-HAVE

## Beslutninger

---

## DEC-001: Opbevaringspligt — must_retain_until mangler auto-beregning og lovhjemmel
**Status:** ACCEPTED
**Proposed by:** DEA-01 (Juridisk Rådgiver)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Lovpligtig opbevaring er non-negotiable. Implementeres som retention_rules-konfiguration per system_type i CONTRACT-TYPES.md. Auto-beregning bygges i Sprint 3 (kontraktstyring). Brugeren kan forlænge men aldrig forkorte. Spec opdateres.

**Forslag/Indsigelse:**
CONTRACT-TYPES.md har feltet `must_retain_until` men overlader det til brugeren at sætte datoen manuelt. Det er en compliance-risiko. Systemet bør auto-beregne baseret på `system_type` og `signed_date` / `termination_date`.

---

## DEC-002: Allonge/tillæg mangler som kontraktændringsmekanisme
**Status:** ACCEPTED
**Proposed by:** DEA-01 (Juridisk Rådgiver)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-003: Selskabsgaranti / kaution mangler som selvstændig kontrakttype
**Status:** ACCEPTED
**Proposed by:** DEA-01 (Juridisk Rådgiver)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-004: Ny klinik-onboarding mangler defineret kontraktrækkefølge
**Status:** ACCEPTED
**Proposed by:** DEA-02 (Franchise & Kædestruktur)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-005: 100% ejede klinikker har ikke-distinkt håndtering
**Status:** WONT-FIX
**Proposed by:** DEA-02 (Franchise & Kædestruktur)
**Dato:** 2026-03-08
**Rangering:** NICE-TO-HAVE
**Orchestrators afgørelse:** WONT-FIX

---

## DEC-006: MVP-prioritering af 33 kontrakttyper mangler
**Status:** ACCEPTED
**Proposed by:** DEA-03 (Kommerciel Produktstrateg)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-007: Starter pack til onboarding — aha-moment inden 10 minutter
**Status:** ACCEPTED
**Proposed by:** DEA-03 (Kommerciel Produktstrateg)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-008: FinancialMetric.metric_type bør være enum — ikke fri tekst
**Status:** ACCEPTED
**Proposed by:** DEA-04 (Finansiel Controller)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-009: Transfer pricing-felter på KT-27/KT-28 utilstrækkelige til TP-dokumentation
**Status:** ACCEPTED
**Proposed by:** DEA-04 (Finansiel Controller)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-010: Freelance/konsulentkontrakt som B-honorar mangler
**Status:** WONT-FIX
**Proposed by:** DEA-05 (HR & Ansættelsesret)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** WONT-FIX

---

## DEC-011: Automatisk opsigelsesvarsel-beregning baseret på anciennitet
**Status:** ACCEPTED
**Proposed by:** DEA-05 (HR & Ansættelsesret)
**Dato:** 2026-03-08
**Rangering:** NICE-TO-HAVE
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-012: Godkendelsesflow bør variere per sensitivity-niveau
**Status:** WONT-FIX
**Proposed by:** DEA-06 (Kontraktstyring-specialist)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** WONT-FIX

---

## DEC-013: Versionering mangler klassificering af ændringens karakter
**Status:** ACCEPTED
**Proposed by:** DEA-06 (Kontraktstyring-specialist)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-014: Reminder-defaults bør konfigureres per kontrakttype
**Status:** WONT-FIX
**Proposed by:** DEA-06 (Kontraktstyring-specialist)
**Dato:** 2026-03-08
**Rangering:** NICE-TO-HAVE
**Orchestrators afgørelse:** WONT-FIX

---

## DEC-015: Anonymiseringsstrategi mangler — GDPR vs. opbevaringspligt-konflikt
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-016: Junction-tabeller mangler organization_id — tenant isolation brudt
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED
**QA-verifikation Sprint 4:** IMPLEMENTERET ✅
**QA-verifikation Sprint 6:** BEKRÆFTET ✅ — organization_id på CaseCompany, CaseContract, CasePerson i schema

---

## DEC-017: Audit log bør inkludere feltændringer for STRENGT_FORTROLIG
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED
**QA-verifikation Sprint 4:** IMPLEMENTERET ✅

---

## DEC-018: ChainHub databehandlervilkår (DPA) mangler som spec-krav
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-019: FinancialMetric og TimeEntry mangler Organization-relation
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-020: Prisma enum-værdier bruger ASCII-erstatninger — matcher ikke spec
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** $queryRaw-queries og enum-sammenligninger returnerer 0 rækker i prod. Se DEC-041 for konkret manifestation i dashboard.ts.

---

## DEC-021: getUserRoleAssignments mangler organization_id filter
**Status:** ACCEPTED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** IMPLEMENTERET ✅ — se src/lib/permissions/index.ts linje ~80-92. organizationId-filter tilføjet. Bekræftet i PENTEST-002-fix.

---

## DEC-022: Auth config fil mangler — session-struktur kan ikke valideres
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** Uden src/lib/auth/index.ts kan session.user.organizationId ikke verificeres. Alle downstream permission-tjek er ubekræftede.

---

## DEC-023: Middleware validerer ikke organizationId i token
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — se PENTEST-004. Fix krævet: `return !!token && !!token.organizationId`

---

## DEC-024: Zod validation schemas leveret og valideret
**Status:** ACCEPTED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG

---

## DEC-025: companies.ts bruger `any` type i where-clauses
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-026: persons.ts bruger `any` type i where-clause
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-027: Validation-fil src/lib/validations/contract.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** Zod-schemas for kontrakt-oprettelse og -redigering er uverificerede.

---

## DEC-028: Validation-fil src/lib/validations/document.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-029: Retention helper src/lib/contracts/retention.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — DEC-001 auto-beregning afhænger af denne fil

---

## DEC-030: Storage helper src/lib/storage/index.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — PENTEST-012 MIME-whitelist og Content-Length afhænger af denne fil

---

## DEC-031: Adviserings-cron og Reminder-tabel ikke implementeret
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** Reminder-modellen er defineret i schema, men ingen cron-job sender advisering. Kontraktudløb adviseres ikke.

---

## DEC-032: Type-filer src/types/contract.ts og src/types/document.ts ikke leveret
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-033: getTasksForDigest() mangler organization_id filter — tenant data-lækage
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** Email-digest sender task-data på tværs af tenants. Se PENTEST-003 for angrebsscenarie.

---

## DEC-034: Sager uden tilknyttede selskaber omgår canAccessCompany()-tjek
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Fix:** Tilføj `companyIds: z.array(z.string().uuid()).min(1)` i createCaseSchema. Se PENTEST-008.

---

## DEC-035: Validation-fil src/lib/validations/case.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION

---

## DEC-036: Type-fil src/types/case.ts ikke leveret — CaseStatus-flow uverificerbart
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION

---

## DEC-037: Task-model mangler priority-felt — tasks.ts antager det eksisterer
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-038: getTasksForDigest() tjekker ikke advise_sent_at på Deadline-records
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-039: Validation-fil src/lib/validations/task.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-040: dashboard.ts bruger ugyldig ModuleType 'dashboard' — canAccessModule fejler altid
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** KRITISK
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** Alle brugere afvises ved dashboard-adgang fordi 'dashboard' ikke er en gyldig ModuleType. Gyldige værdier: companies|contracts|cases|tasks|persons|documents|finance|settings|user_management.

---

## DEC-041: dashboard.ts revenueRows $queryRaw bruger ASCII enum-værdier — returnerer altid 0 rækker
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** KRITISK
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** Alle dashboard-aggregeringer returnerer 0. Relateret til DEC-020.

---

## DEC-042: finance.ts update/delete Prisma-kald mangler organization_id i where-clause
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN — se PENTEST-006

---

## DEC-043: createTimeEntry mangler canAccessCompany()-tjek
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-044: finance.ts PeriodType.HELAAR matcher ikke spec-enum HELÅR
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN — relateret til DEC-020

---

## DEC-045: finance.ts listFinancialMetrics pagination-parametre uden for Zod-schema
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-046: Manglende filer — src/lib/validations/finance.ts, src/lib/cache/finance.ts, src/types/finance.ts
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN

---

## DEC-047: Ingen write-permission tjek på muterende server actions — COMPANY_READONLY kan skrive
**Status:** ACCEPTED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** KRITISK
**Sprint 6 QA-status:** IMPLEMENTERET ✅ — canWrite() implementeret i src/lib/permissions/index.ts. Skal stadig verificeres at det KALDES i alle muterende actions (companies.ts, contracts.ts, cases.ts, tasks.ts, finance.ts).
**Udestående:** Verifikation af at canWrite() faktisk anvendes i action-filerne — disse er ikke leveret til review.

**Forslag/Indsigelse:**
Alle muterende server actions (`createCompany`, `updateCompany`, `deleteCompany`, `createContract`, `updateContract`, `deleteContract`, `createCase`, `updateCase`, `deleteCase`, osv.) mangler tjek af om den kaldende bruger har skriveret.

`canAccessCompany()` verificerer at brugeren KAN SE selskabet, men ikke at de MÅ ÆNDRE det. En `COMPANY_READONLY` eller `GROUP_READONLY` bruger kan kalde alle muterende actions direkte som HTTP POST (Next.js server actions er POST endpoints).

Per spec (`roller-og-tilladelser.md`): `COMPANY_READONLY` og `GROUP_READONLY` har INGEN skriveadgang til nogen ressourcer.

**Anbefaling:**
Tilføj `canWrite()` helper i `src/lib/permissions/index.ts`:
```typescript
export async function canWrite(userId: string): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)
  const readonlyRoles: UserRole[] = ['GROUP_READONLY', 'COMPANY_READONLY']
  return roles.some((r) => !readonlyRoles.includes(r.role))
}
```

Kald `canWrite()` som FØRSTE tjek (efter session-validering) i ALLE muterende actions.

---

## DEC-048: IDOR på final update/delete Prisma-kald — organizationId mangler i where-clause
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN — se PENTEST-006

**Forslag/Indsigelse:**
Følgende funktioner verificerer ejerskab via `findFirst` (med `organizationId`) men udfører derefter `update`/`delete` med KUN id:

- `updateOwnership`: `prisma.ownership.update({ where: { id: ownershipId } })`
- `deleteOwnership`: `prisma.ownership.delete({ where: { id: ownershipId } })`
- `updateCompanyPerson`: `prisma.companyPerson.update({ where: { id: companyPersonId } })`
- `deleteCompanyPerson`: `prisma.companyPerson.delete({ where: { id: companyPersonId } })`
- `updateTask` (cases.ts): `prisma.task.update({ where: { id: taskId } })`
- `deleteTask` (cases.ts): soft-delete update `{ where: { id: taskId } }`
- `updateDeadline`: `prisma.deadline.update({ where: { id: deadlineId } })`
- `deleteDeadline`: soft-delete update `{ where: { id: deadlineId } }`
- `deleteContractVersion`: `prisma.contractVersion.delete({ where: { id: versionId } })`

TOCTOU-race condition: findFirst bekræfter adgang → ressource slettes/flyttes → update/delete rammer nu forkert tenant.

**Anbefaling:** Tilføj `organizationId: session.user.organizationId` til alle update/delete where-clauses.

---

## DEC-049: deleteContractVersion mangler sensitivity-adgangstjek
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN — se PENTEST-009

**Forslag/Indsigelse:**
`deleteContractVersion()` i `src/actions/contracts.ts` tjekker `canAccessCompany()` men IKKE `canAccessSensitivity()`. En `COMPANY_MANAGER` kan slette versioner af `STRENGT_FORTROLIG` kontrakter som de ikke har adgang til at SE.

**Anbefaling:**
```typescript
const hasSensitivityAccess = await canAccessSensitivity(
  session.user.id,
  version.contract.sensitivity
)
if (!hasSensitivityAccess) {
  return { error: 'Du har ikke adgang til denne kontrakts sensitivitetsniveau' }
}
```

---

## DEC-050: removeContractRelation mangler company-adgang og sensitivity-tjek
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN — se PENTEST-010

**Forslag/Indsigelse:**
`removeContractRelation()` i `src/actions/contracts.ts` tjekker kun `organizationId` på relationen men ikke adgang til de underliggende kontrakter (company-adgang og sensitivity). En bruger kan slette relationer mellem kontrakter de ikke har adgang til.

**Anbefaling:** Hent begge kontrakter og verificer `canAccessCompany()` + `canAccessSensitivity()` på begge.

---

## DEC-051: Ingen rate limiting — brute force og DoS muligt
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** KRITISK
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** Login-endpoint kan brute-forces. API kan scrapes og DoS-angribes. Se PENTEST-005 for angrebsscenarier.

**Forslag/Indsigelse:**
Ingen rate limiting er implementeret på nogen endpoints, inkl.:
- `/api/auth/signin` — brute force passwords
- `/api/auth/forgot-password` — email flooding
- `/api/auth/reset-password` — brute force reset-tokens
- Alle server actions — systematisk data-scraping og DoS via tunge aggregeringer

**Anbefaling:** Implementer Upstash Redis-baseret rate limiting i `src/middleware.ts`:
- Auth endpoints: max 5 requests/minut per IP
- API generelt: max 100 requests/minut per bruger
- Download endpoints: max 20 downloads/minut per bruger

---

## DEC-052: verifyCaseAccess springer INTERN sensitivity-tjek over
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN — se PENTEST-007

**Forslag/Indsigelse:**
`verifyCaseAccess()` i `src/actions/cases.ts` springer sensitivity-tjek over for PUBLIC, STANDARD og INTERN. Dette bryder security-modellen for fase 2-roller og er unødvendigt da `canAccessSensitivity()` er korrekt implementeret.

**Anbefaling:** Fjern shortcut og kald `canAccessSensitivity()` for ALLE sensitivity-niveauer.

---

## DEC-053: Filupload mangler server-side MIME-type whitelist og storage-side størrelsesbegrænsning
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** VIGTIG
**Sprint 6 QA-status:** STADIG ÅBEN — se PENTEST-012. Afhænger af DEC-030 (storage helper).

**Forslag/Indsigelse:**
`requestUploadUrl()` validerer `fileType` via Zod men MIME-typen er client-kontrolleret. Signed upload URL konfigurerer ikke Content-Type eller Content-Length restrictions.

**Anbefaling:**
- Tilføj whitelist af tilladte MIME-typer
- Konfigurer signed upload URL med `Content-Type` og `Content-Length-Range` conditions
- Max filstørrelse: 50MB

---

## DEC-054: NEXTAUTH_SECRET vejledning i .env.example uverificerbar — minimum 32 tegn ikke bekræftet
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-17
**Rangering:** KRITISK
**Sprint 6 QA-status:** STADIG ÅBEN — BLOKERER PRODUKTION
**Konsekvens:** .env.example er ikke leveret til review. Kan ikke verificere at NEXTAUTH_SECRET vejledningen specificerer minimum 32 tegn. Startup-validering kan ikke bekræftes.
**Afhjælpning:** .env.example skal leveres og indeholde: `NEXTAUTH_SECRET=<generer med: openssl rand -base64 32>` med eksplicit kommentar om minimum 32 tegn.

---

## DEC-055: Stripe webhook www-prefix — dokumenteret men ikke bekræftet i deployment
**Status:** ACCEPTED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-17
**Rangering:** VIGTIG
**Sprint 6 QA-status:** DOKUMENTERET ✅ — www-prefix er eksplicit dokumenteret i src/app/api/webhooks/stripe/route.ts header-kommentar med korrekt URL (https://www.chainhub.dk/api/webhooks/stripe). RUNBOOK.md skal bekræfte at Stripe Dashboard er konfigureret med www-prefix.

--- FIL: docs/status/PROGRESS.md ---
# PROGRESS.md
# ChainHub — Projektfremskridt

⚠️ PRODUKTIONSSTATUS: IKKE PRODUKTIONSKLART — 2025-01-17
Årsag: 8 uløste KRITISKE beslutninger blokerer produktionssætning.
Se "Produktionsblokerende issues" nedenfor.

---

## Sprint-oversigt

- [x] Sprint 1 — Projektsetup og grundlæggende arkitektur
- [x] Sprint 2 — Databaseskema og migrations
- [x] Sprint 3 — Kontraktstyring (core)
- [x] Sprint 4 — Sager, opgaver og tenant isolation
- [x] Sprint 5 — Finance, dashboard og sikkerhedsgennemgang
- [ ] Sprint 6 — Final QA og produktionsforberedelse ← IGANGVÆRENDE

---

## Sprint 6 — Final QA Status

### Gennemførte verifikationer
- [x] DECISIONS.md gennemgået — 8 KRITISKE beslutninger er uløste (se nedenfor)
- [x] PENTEST-REPORT.md gennemgået — 3 af 5 KRITISKE fund stadig åbne
- [x] Stripe webhook www-prefix — dokumenteret i route.ts ✅
- [x] permissions/index.ts — tenant isolation implementeret (DEC-021 ✅, DEC-047 ✅)
- [x] organization_id på Prisma queries i permissions/index.ts ✅
- [x] Dansk sprog i brugervendte tekster — bekræftet i leverede filer ✅
- [ ] NEXTAUTH_SECRET minimum 32 tegn — .env.example ikke leveret ❌
- [ ] Auth config src/lib/auth/index.ts — ikke leveret ❌
- [ ] Rate limiting implementation — ikke implementeret ❌

### Ikke-forhandlingsbare tests
- [ ] Tenant isolation: getTasksForDigest cross-tenant test (PENTEST-003) ❌
- [ ] Middleware organizationId validering (PENTEST-004) ❌
- [ ] Write-permission i action-filer (canWrite() kald verificeret) — action-filer ikke leveret ⚠️
- [x] getUserRoleAssignments organization_id filter ✅
- [x] canWrite() implementeret og tilgængelig ✅
- [x] canAccessSensitivity() dækker alle niveauer ✅

---

## Produktionsblokerende issues

Følgende KRITISKE beslutninger SKAL løses inden produktion:

| ID | Beskrivelse | Konsekvens |
|---|---|---|
| DEC-020 | Prisma enum ASCII-erstatninger | $queryRaw returnerer 0 rækker — dashboard ødelagt |
| DEC-022 | Auth config mangler | Session-struktur uverificerbar |
| DEC-027 | contract.ts validation mangler | Kontrakt-oprettelse uverificerbar |
| DEC-031 | Adviserings-cron ikke implementeret | Kontraktudløb adviseres aldrig |
| DEC-033 | getTasksForDigest cross-tenant | KRITISK datasikkerhedsbrud — tenant-lækage |
| DEC-034 | Sager uden selskab omgår isolation | Tenant isolation brudt for sager |
| DEC-035 | case.ts validation mangler | Sag-oprettelse uverificerbar |
| DEC-036 | case.ts type-fil mangler | CaseStatus-flow uverificerbart |
| DEC-040 | dashboard.ts ugyldig ModuleType | Dashboard blokeret for alle brugere |
| DEC-041 | dashboard.ts ASCII enum-værdier | Dashboard-aggregeringer returnerer 0 |
| DEC-051 | Ingen rate limiting | Brute force og DoS muligt |
| DEC-054 | NEXTAUTH_SECRET vejledning uverificerbar | Auth-sikkerhed ubekræftet |

---

## Pentest-fund status

| Fund | Rangering | Status |
|---|---|---|
| PENTEST-001 Manglende write-permission | KRITISK | ✅ canWrite() implementeret |
| PENTEST-002 getUserRoleAssignments org-filter | KRITISK | ✅ Implementeret |
| PENTEST-003 getTasksForDigest cross-tenant | KRITISK | ❌ ÅBEN — blokerer |
| PENTEST-004 Middleware organizationId | KRITISK | ❌ ÅBEN — blokerer |
| PENTEST-005 Ingen rate limiting | KRITISK | ❌ ÅBEN — blokerer |
| PENTEST-006 IDOR update/delete without org_id | VIGTIG | ❌ ÅBEN |
| PENTEST-007 Sensitivity shortcut i verifyCaseAccess | VIGTIG | ❌ ÅBEN |
| PENTEST-008 Sager uden selskab omgår isolation | VIGTIG | ❌ ÅBEN |
| PENTEST-009 deleteContractVersion mangler sensitivity | VIGTIG | ❌ ÅBEN |
| PENTEST-010 removeContractRelation mangler tjek | VIGTIG | ❌ ÅBEN |
| PENTEST-011 Rate limiting på password-reset | VIGTIG | ❌ ÅBEN |
| PENTEST-012 MIME-type validering | VIGTIG | ❌ ÅBEN |
| PENTEST-013 XSS-risiko search-felter | NICE-TO-HAVE | ⏸ Fase 2 |

---

## Kendte begrænsninger (Known Limitations)

Følgende er accepterede begrænsninger der er dokumenteret som WONT-FIX eller udskudt:

1. **DEC-005** (WONT-FIX): 100% ejede klinikker har ikke-distinkt håndtering
2. **DEC-010** (WONT-FIX): Freelance/konsulentkontrakt som B-honorar mangler
3. **DEC-012** (WONT-FIX): Godkendelsesflow varierer ikke per sensitivity-niveau
4. **DEC-014** (WONT-FIX): Reminder-defaults konfigureres ikke per kontrakttype
5. **PENTEST-013** (Fase 2): XSS-gennemgang af JSONB typeData rendering udskudt
6. **EXTERNAL_PARTNER / EXTERNAL_EMPLOYEE roller** (Fase 2): Ikke implementeret i MVP
7. **CPR-håndtering** (Udskudt): Dedikeret beslutning kræves inden implementering
8. **Partitionering af Reminder-tabel** (Fremtid): Kan tilføjes ved høj volumen
9. **DEC-011**: Automatisk opsigelsesvarsel-beregning er NICE-TO-HAVE — ikke verificeret implementeret
10. **src/lib/storage/index.ts** (DEC-030): Ikke leveret til review — MIME-whitelist og filstørrelseshåndhævelse ubekræftet
11. **src/lib/contracts/retention.ts** (DEC-029): Ikke leveret til review — DEC-001 auto-beregning ubekræftet

---

## Næste skridt inden produktion

Sprint 7 (produktionsforberedelse) skal løse i prioriteret rækkefølge:

### Blok 1 — Sikkerhed (må ikke deployes uden)
1. Implementer rate limiting i middleware.ts (Upstash Redis) — DEC-051/PENTEST-005
2. Fix getTasksForDigest med organization_id filter — DEC-033/PENTEST-003
3. Fix middleware til at kræve organizationId i token — DEC-023/PENTEST-004
4. Tilføj companyIds.min(1) i createCaseSchema — DEC-034/PENTEST-008
5. Verificer canWrite() kaldes i alle muterende actions — DEC-047

### Blok 2 — Funktionalitet (blokerer kernefunktioner)
6. Fix dashboard.ts ModuleType til 'companies' eller fjern modul-tjek — DEC-040
7. Fix dashboard.ts $queryRaw enum-værdier til korrekte dansk enum-strenge — DEC-041
8. Lever auth config src/lib/auth/index.ts til review — DEC-022
9. Lever src/lib/validations/contract.ts — DEC-027
10. Lever src/lib/validations/case.ts — DEC-035
11. Lever src/types/case.ts — DEC-036

### Blok 3 — Compliance
12. Implementer adviserings-cron job — DEC-031
13. Lever src/lib/contracts/retention.ts — DEC-029
14. Verificer .env.example NEXTAUTH_SECRET vejledning — DEC-054

### Blok 4 — Forbedringer
15. Fix IDOR i update/delete kald (tilføj organizationId) — DEC-048/PENTEST-006
16. Fix sensitivity shortcut i verifyCaseAccess — DEC-052/PENTEST-007
17. Fix deleteContractVersion sensitivity-tjek — DEC-049/PENTEST-009
18. Fix removeContractRelation company+sensitivity tjek — DEC-050/PENTEST-010
19. Fix any-types i companies.ts og persons.ts — DEC-025, DEC-026
20. Lever manglende validerings- og type-filer — DEC-028, DEC-032, DEC-039, DEC-046
21. Implementer MIME-whitelist i storage helper — DEC-053/PENTEST-012

---

## Changelog

```
2025-01-17 Sprint 6 Final QA (BA-07):
  - DECISIONS.md opdateret med Sprint 6 status på alle beslutninger
  - DEC-021 markeret ACCEPTED (implementeret i permissions/index.ts)
  - DEC-047 markeret ACCEPTED (canWrite() implementeret)
  - DEC-055 tilføjet (Stripe www-prefix dokumenteret)
  - DEC-054 tilføjet (NEXTAUTH_SECRET vejledning uverificerbar)
  - PROGRESS.md opdateret med komplet produktionsblokeringsliste
  - Sprint 6 markeret som IGANGVÆRENDE (ikke færdig — blokeret af kritiske issues)
  - 12 produktionsblokerende issues identificeret og dokumenteret
  - 3 af 5 KRITISKE pentest-fund stadig åbne
```