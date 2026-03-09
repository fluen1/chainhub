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
**Orchestrators afgørelse:** WONT-FIX — Out of scope for MVP. Noteres som fase 2.

---

## DEC-011: Funktionærlovens §2a-godtgørelse mangler i fratrædelsesaftale
**Status:** ACCEPTED
**Proposed by:** DEA-05 (HR & Ansættelsesret)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-012: Konkurrenceklausuler mangler separat trackingfelt for udløbsdato
**Status:** ACCEPTED
**Proposed by:** DEA-05 (HR & Ansættelsesret)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED

---

## DEC-013: Manglende write-permission guard på alle muterende server actions
**Status:** ACCEPTED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2026-03-10
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Alle muterende server actions skal kalde `canWrite()` som første tjek efter auth. Se PENTEST-REPORT.md PENTEST-001.

**Forslag/Indsigelse:**
COMPANY_READONLY og GROUP_READONLY kan kalde muterende server actions direkte via HTTP POST. Ingen write-guard eksisterer. Implementér `canWrite(userId)` i `src/lib/permissions/index.ts` og tilføj tjek i alle actions.

---

## DEC-014: Cross-tenant IDOR via direkte resource-ID i server actions
**Status:** ACCEPTED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2026-03-10
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Alle resource-lookups skal filtrere på `groupId`. Se PENTEST-REPORT.md PENTEST-002 og PENTEST-004.

**Forslag/Indsigelse:**
Server actions der modtager companyId, contractId, caseId, versionId, attachmentId validerer ikke at ressourcen tilhører brugerens tenant. En angriber kan manipulere ID-parametre til at tilgå andre tenants data.

---

## DEC-015: Manglende rate limiting på auth-endpoints og server actions
**Status:** ACCEPTED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2026-03-10
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Implementér Upstash Ratelimit i middleware. Se PENTEST-REPORT.md PENTEST-003.

**Forslag/Indsigelse:**
Ingen rate limiting på `/api/auth/`, `/_next/action/` eller upload-endpoints. Muliggør brute-force, DoS og cost-based angreb mod AWS S3.

---

## DEC-016: CSRF origin-validering mangler på server actions
**Status:** ACCEPTED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2026-03-10
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Tilføj `allowedOrigins` i `next.config.js`. Se PENTEST-REPORT.md PENTEST-005.

**Forslag/Indsigelse:**
Next.js server actions uden origin-validering er sårbare over for CSRF fra tredjepartsdomæner mod autentificerede brugere.

---

## DEC-017: Audit log mangler på sikkerhedskritiske handlinger (GDPR Art. 30)
**Status:** ACCEPTED
**Proposed by:** BA-11 (Security Pentest-agent)
**Dato:** 2026-03-10
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — Audit log er GDPR-krav. Implementeres i Sprint 3. Se PENTEST-REPORT.md PENTEST-011.

**Forslag/Indsigelse:**
Ingen handlinger logger hvem der udførte dem, hvornår og fra hvilken IP. Compliance-risiko under GDPR Art. 30 og umuliggør incident response.