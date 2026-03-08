# Performance-rapport: Selskabs- og Personmodul
**Genereret af:** BA-09 (Performance-agent)
**Dato:** 2024-01-XX
**Scope:** src/actions/companies.ts, src/actions/persons.ts

---

## Executive Summary

Modulerne fungerer men har **3 kritiske** og **4 vigtige** performance-issues der bør adresseres før produktionslancering med >50 organisationer.

---

## KRITISK (fix før launch)

### K1: Manglende pagination på listCompanies()
**Fil:** `src/actions/companies.ts:112-143`  
**Problem:** Ingen limit på `findMany` - returnerer potentielt 1000+ selskaber  
**Impact:** Memory-spike, timeout ved store organisationer  
**Fix:**
```typescript
// Tilføj parameter
export async function listCompanies(
  options?: { limit?: number; offset?: number }
): Promise<ActionResult<{ companies: CompanyWithCounts[]; total: number }>>

// Brug i query
take: options?.limit ?? 50,
skip: options?.offset ?? 0,
```
**DEC-ref:** DEC-020

---

### K2: JavaScript-filter i listPersons() efter database-fetch
**Fil:** `src/actions/persons.ts:147-155`  
**Problem:** Henter ALLE personer, derefter filtrerer i JS baseret på company-adgang  
**Impact:** O(n) memory for data der kasseres  
**Fix:** Flyt filter til Prisma query:
```typescript
// I stedet for at filtrere efter fetch:
where: {
  organizationId: session.user.organizationId,
  deletedAt: null,
  companyPersons: {
    some: {
      companyId: { in: Array.from(accessibleCompanyIds) }
    }
  }
}
```
**DEC-ref:** DEC-024

---

### K3: Dual-query + JS-sort i getCompanyActivityLog()
**Fil:** `src/actions/companies.ts:365-390`  
**Problem:** To queries kombineres og sorteres i JavaScript  
**Impact:** 2x database roundtrips, ineffektiv sortering  
**Fix:** Kombinér til én query:
```typescript
const activities = await prisma.auditLog.findMany({
  where: {
    organizationId: session.user.organizationId,
    OR: [
      { resourceId: companyId, resourceType: 'company' },
      { resourceType: { in: ['ownership', 'company_person'] } }
    ]
  },
  orderBy: { createdAt: 'desc' },
  take: limit,
})
```
**DEC-ref:** DEC-025

---

## VIGTIG (fix i v1.1)

### V1: Manglende index på ownerships.owner_person_id
**Fil:** `prisma/schema.prisma:175`  
**Problem:** Kun `[organizationId, companyId]` index - mangler `[organizationId, ownerPersonId]`  
**Impact:** Fuld tabel-scan ved "find ejerskaber for person"  
**Fix:** Tilføj til schema:
```prisma
@@index([organizationId, ownerPersonId])
```
**DEC-ref:** DEC-023

---

### V2: getAccessibleCompanies() ikke cached
**Fil:** `src/lib/permissions.ts` (kaldt fra companies.ts:119, persons.ts:108)  
**Problem:** Permissions-query køres ved hver request  
**Impact:** Unødvendige database-kald for data der ændrer sig sjældent  
**Fix:** Implementér caching jf. CACHING.md
**DEC-ref:** DEC-022

---

### V3: listOwnerships() uden pagination
**Fil:** `src/actions/companies.ts:252-276`  
**Problem:** Returnerer alle ejerskaber uden limit  
**Impact:** Potentielt 100+ records ved kompleks ejerskabsstruktur  
**Fix:** Tilføj limit parameter (default: 50)
**DEC-ref:** DEC-021

---

### V4: listCompanyPersons() uden pagination
**Fil:** `src/actions/companies.ts:336-361`  
**Problem:** Returnerer alle company_persons uden limit  
**Impact:** Potentielt 500+ records ved stort selskab  
**Fix:** Tilføj limit parameter (default: 100)

---

## NICE-TO-HAVE (overvej i v2)

### N1: Cache company _count aggregates
**Fil:** `src/actions/companies.ts:125-132`  
**Problem:** `_count` beregnes ved hver list-request  
**Mulighed:** Cache counts med 2-min TTL, invalidér ved oprettelse

---

### N2: Prefetch related data i getCompany()
**Fil:** `src/actions/companies.ts:68-96`  
**Observation:** contracts fetches med `take: 10` - OK  
**Mulighed:** Tilføj parallel fetch af activity log i samme request

---

### N3: Batch audit log creates
**Observation:** Hver mutation laver separat `auditLog.create()`  
**Mulighed:** Batch ved bulk-operationer (import, etc.)

---

## Schema Index Status

| Tabel | Eksisterende indexes | Manglende |
|-------|---------------------|-----------|
| companies | `[orgId, deletedAt]`, `[orgId, status]` | ✅ OK |
| persons | `[orgId, deletedAt]` | ✅ OK |
| ownerships | `[orgId, companyId]` | `[orgId, ownerPersonId]` |
| companyPersons | `[orgId, companyId]`, `[orgId, personId]` | ✅ OK |
| auditLog | `[orgId, resourceType, resourceId]`, `[orgId, userId]`, `[createdAt]` | Overvej `[orgId, createdAt]` for retention |

---

## Pagination Status

| Funktion | Pagination | Status |
|----------|------------|--------|
| listCompanies | ❌ Ingen | KRITISK |
| listPersons | ✅ Har limit/offset | OK |
| listOwnerships | ❌ Ingen | VIGTIG |
| listCompanyPersons | ❌ Ingen | VIGTIG |
| getCompanyActivityLog | ✅ Har limit | OK |

---

## N+1 Status

| Funktion | N+1 Risk | Status |
|----------|----------|--------|
| listCompanies | ✅ Bruger _count | OK |
| getCompany | ✅ Enkelt query med include | OK |
| listPersons | ⚠️ JS-filter efter fetch | KRITISK |
| listOwnerships | ✅ Enkelt query med include | OK |
| getCompanyActivityLog | ⚠️ Dual query + JS sort | KRITISK |

---

## Anbefalinger prioriteret

1. **Uge 1:** Fix K1-K3 (kritiske) - estimat: 4 timer
2. **Uge 2:** Fix V1-V4 (vigtige) - estimat: 3 timer
3. **Uge 3:** Implementér caching (V2) - estimat: 2 timer
4. **v2:** Overvej N1-N3 baseret på metrics

---

## Test-anbefaling

Før launch, kør load-test med:
- 100 organisationer
- 500 selskaber pr. organisation
- 2000 personer pr. organisation
- 10.000 kontrakter total

Mål response-tider for:
- `GET /companies` < 200ms (p95)
- `GET /companies/[id]` < 100ms (p95)
- `GET /persons` < 300ms (p95)