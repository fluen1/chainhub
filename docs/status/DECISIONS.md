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

## DEC-011: CompanyPerson.title og deletedAt mangler i Prisma-schema
**Status:** ACCEPTED
**Proposed by:** BA-09 (Performance-agent)
**Dato:** 2026-03-10
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — `title` (stillingsbetegnelse) og `deletedAt` (soft-delete) er nødvendige felter på CompanyPerson-modellen. Soft-delete er kritisk for audit-trail og GDPR-compliance. `title` er nødvendig for at adskille jobtitel fra rolle. Felterne tilføjes i schema.prisma og migreres.

**Forslag/Indsigelse:**
`src/actions/persons.ts` refererer til `CompanyPerson.title` og `CompanyPerson.deletedAt`, men disse felter eksisterer ikke i det nuværende Prisma-schema. Dette forårsager TypeScript-kompileringsfejl. Felterne skal enten tilføjes til schema eller koden skal tilpasses.

**Løsning:**
Tilføj til `CompanyPerson`-modellen i schema.prisma:
```
title     String?   // Stillingsbetegnelse (fri tekst)
deletedAt DateTime? // Soft-delete timestamp
```

---

## DEC-012: tenant-isolation.test.ts bruger ikke-eksisterende Group-model og groupId-felter
**Status:** ACCEPTED
**Proposed by:** BA-09 (Performance-agent)
**Dato:** 2026-03-10
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Integrationstesten antager en `Group`-model med `groupId`-felter på `Company`, `User` og `UserRoleAssignment`. Dette svarer til en multi-tenant group-struktur. Enten tilføjes `Group`-modellen til schema, eller testen omskrives til at bruge `Organization`-modellen som tenant-isoleringsmekanisme.

**Forslag/Indsigelse:**
`src/__tests__/integration/tenant-isolation.test.ts` bruger `prisma.group` og `groupId`-felter der ikke eksisterer i schema. Dette er et arkitekturspørgsmål: bruger systemet `Organization` eller `Group` som tenant-container?

**Løsning:**
Testen omskrives til at bruge `Organization` som tenant-isoleringsmekanisme, i overensstemmelse med det eksisterende schema. Se BA-10 (Tests-agent) for implementering.

---

## DEC-013: getUserRoleAssignments ikke eksporteret fra permissions-modulet
**Status:** ACCEPTED
**Proposed by:** BA-09 (Performance-agent)
**Dato:** 2026-03-10
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — `getUserRoleAssignments` skal eksporteres fra `src/lib/permissions.ts` så integrationstests kan verificere rolle-baseret tenant-isolation.

**Forslag/Indsigelse:**
`src/__tests__/integration/tenant-isolation.test.ts` importerer `getUserRoleAssignments` fra `@/lib/permissions`, men funktionen er ikke eksporteret. Funktionen eksisterer sandsynligvis men er kun brugt internt.

**Løsning:**
Tilføj `export` til `getUserRoleAssignments`-funktionen i `src/lib/permissions.ts`.