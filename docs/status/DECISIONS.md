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

---

## DEC-021: getUserRoleAssignments mangler organization_id filter
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-022: Auth config fil mangler — session-struktur kan ikke valideres
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-023: Middleware validerer ikke organizationId i token
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN

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

---

## DEC-026: persons.ts bruger `any` type i where-clause
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG

---

## DEC-027: Validation-fil src/lib/validations/contract.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-028: Validation-fil src/lib/validations/document.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-029: Retention helper src/lib/contracts/retention.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-030: Storage helper src/lib/storage/index.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-031: Adviserings-cron og Reminder-tabel ikke implementeret
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-032: Type-filer src/types/contract.ts og src/types/document.ts ikke leveret
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-033: getTasksForDigest() mangler organization_id filter — tenant data-lækage
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-034: Sager uden tilknyttede selskaber omgår canAccessCompany()-tjek
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-035: Validation-fil src/lib/validations/case.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-036: Type-fil src/types/case.ts ikke leveret — CaseStatus-flow uverificerbart
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-037: Task-model mangler priority-felt — tasks.ts antager det eksisterer
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-038: getTasksForDigest() tjekker ikke advise_sent_at på Deadline-records
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-039: Validation-fil src/lib/validations/task.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG
**Sprint 5 QA-status:** STADIG ÅBEN

---

## DEC-040: dashboard.ts bruger ugyldig ModuleType 'dashboard' — canAccessModule fejler altid
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** KRITISK

---

## DEC-041: dashboard.ts revenueRows $queryRaw bruger ASCII enum-værdier — returnerer altid 0 rækker
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** KRITISK

---

## DEC-042: finance.ts update/delete Prisma-kald mangler organization_id i where-clause
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

---

## DEC-043: createTimeEntry mangler canAccessCompany()-tjek
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

---

## DEC-044: finance.ts PeriodType.HELAAR matcher ikke spec-enum HELÅR
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

---

## DEC-045: finance.ts listFinancialMetrics pagination-parametre uden for Zod-schema
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

---

## DEC-046: Manglende filer — src/lib/validations/finance.ts, src/lib/cache/finance.ts, src/types/finance.ts
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

---

## DEC-047: Ingen write-permission tjek på muterende server actions — COMPANY_READONLY kan skrive
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** KRITISK

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

Se `src/lib/permissions/index.ts` og rettede action-filer nedenfor.

---

## DEC-048: IDOR på final update/delete Prisma-kald — organizationId mangler i where-clause
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** VIGTIG

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

**Forslag/Indsigelse:**
`removeContractRelation()` i `src/actions/contracts.ts` tjekker kun `organizationId` på relationen men ikke adgang til de underliggende kontrakter (company-adgang og sensitivity). En bruger kan slette relationer mellem kontrakter de ikke har adgang til.

**Anbefaling:** Hent begge kontrakter og verificer `canAccessCompany()` + `canAccessSensitivity()` på begge.

---

## DEC-051: Ingen rate limiting — brute force og DoS muligt
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** KRITISK

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

**Forslag/Indsigelse:**
`verifyCaseAccess()` i `src/actions/cases.ts` springer sensitivity-tjek over for PUBLIC, STANDARD og INTERN:
```typescript
if (caseBase.sensitivity !== 'PUBLIC' && 
    caseBase.sensitivity !== 'STANDARD' && 
    caseBase.sensitivity !== 'INTERN') {
  // tjek kun for FORTROLIG og STRENGT_FORTROLIG
}
```

Dette er en shortcut der bryder security-modellen for fase 2-roller (`EXTERNAL_PARTNER`, `EXTERNAL_EMPLOYEE`) der muligvis IKKE skal have adgang til INTERN data. `canAccessSensitivity()` er allerede korrekt implementeret og returnerer `true` for disse niveauer for alle nuværende roller — kaldet er gratis og fremtidssikrer koden.

**Anbefaling:** Fjern shortcut og kald `canAccessSensitivity()` for ALLE sensitivity-niveauer.

---

## DEC-053: Filupload mangler server-side MIME-type whitelist og storage-side størrelsesbegrænsning
**Status:** CHALLENGED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2025-01-17
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
`requestUploadUrl()` validerer `fileType` via Zod men:
1. MIME-typen er client-kontrolleret — ingen whitelist af tilladte typer
2. Storage-siden (R2/S3) håndhæver ikke Content-Type eller Content-Length via signed URL conditions
3. En angriber kan uploade vilkårlige filtyper (executables, scripts) med gyldig MIME-type i request

**Anbefaling:**
- Tilføj whitelist af tilladte MIME-typer i `requestUploadUrlSchema`
- Konfigurer signed upload URL med `Content-Type` og `Content-Length-Range` conditions
- Max filstørrelse: 50MB (eller per konfiguration)