# DECISIONS.md
# ChainHub — Arkitektur-beslutninger
**Version:** 0.6
**Opdateret af:** BA-09 (Performance-agent)

---

## Aktive beslutninger

*(Eksisterende DEC-001 til DEC-019 bevares uændret)*

---

## Performance-relaterede beslutninger

### DEC-020: listCompanies pagination
**Status:** CHALLENGED  
**Dato:** 2024-01-XX  
**Kontekst:** `listCompanies()` i `src/actions/companies.ts` returnerer alle selskaber uden limit.  
**Problem:** Med 100+ selskaber pr. organisation vil response-tid stige og memory-forbrug øges.  
**Forslag:**  
- Tilføj `limit` og `offset` parametre (default limit: 50)
- Tilføj total count for pagination UI
**Risiko:** MEDIUM - påvirker alle company-list views  
**Afventer:** Frontend-team input om pagination-UI

---

### DEC-021: listOwnerships pagination
**Status:** CHALLENGED  
**Dato:** 2024-01-XX  
**Kontekst:** `listOwnerships()` returnerer alle ejerskaber for et selskab uden limit.  
**Problem:** Selskaber med kompleks ejerskabsstruktur kan have 50+ ownership records.  
**Forslag:** Tilføj pagination eller lazy-loading på frontend  
**Risiko:** LAV - ejerskab vises kun på detail-page  
**Afventer:** Product owner beslutning

---

### DEC-022: getAccessibleCompanies caching
**Status:** CHALLENGED  
**Dato:** 2024-01-XX  
**Kontekst:** `getAccessibleCompanies()` kaldes i `listCompanies()` og `listPersons()` - resultatet bruges til at filtrere data.  
**Problem:** Permissions ændrer sig sjældent men queries køres ved hver request.  
**Forslag:**  
- Cache result i 5 minutter med key `access:${orgId}:${userId}`
- Invalidér ved UserRoleAssignment mutation
**Risiko:** LAV - cache-invalidering er deterministisk  
**Implementering:** Se CACHING.md pattern

---

### DEC-023: Ownership missing index
**Status:** CHALLENGED  
**Dato:** 2024-01-XX  
**Kontekst:** `ownerships` tabel mangler index på `organization_id + owner_person_id`.  
**Problem:** Query "find alle ejerskaber for en person" scanner hele tabellen.  
**Forslag:** Tilføj index i næste migration:  
```prisma
@@index([organizationId, ownerPersonId])
```
**Risiko:** LAV - index-tilføjelse er non-breaking  
**Afventer:** DBA review

---

### DEC-024: Inefficient JavaScript filtering i listPersons
**Status:** CHALLENGED  
**Dato:** 2024-01-XX  
**Kontekst:** `listPersons()` henter alle personer og filtrerer `companyPersons` i JavaScript baseret på `accessibleCompanyIds`.  
**Problem:** N+1-lignende ineffektivitet - data hentes der aldrig bruges.  
**Forslag:**  
- Flyt filter til Prisma query med `where: { companyId: { in: accessibleCompanyIds } }`
- Alternativt: Brug raw SQL med subquery
**Risiko:** MEDIUM - kræver refactoring af query-logik  
**Afventer:** Performance-test med realistisk datasæt

---

### DEC-025: getCompanyActivityLog dual-query
**Status:** CHALLENGED  
**Dato:** 2024-01-XX  
**Kontekst:** `getCompanyActivityLog()` kører to separate queries og kombinerer i JavaScript.  
**Problem:** Ineffektivt ved store audit_log tabeller. Sorterer i JavaScript.  
**Forslag:**  
- Kombinér til én query med `OR` clause
- Eller: Brug UNION i raw SQL for bedre performance
**Risiko:** LAV - kun én side bruger denne funktion  
**Afventer:** Audit log volumen-analyse

---

## Index-anbefalinger (schema.prisma)

Følgende indexes mangler og bør tilføjes:

```prisma
// ownerships - tilføj
@@index([organizationId, ownerPersonId])

// companyPersons - eksisterer allerede: [organizationId, companyId], [organizationId, personId]

// auditLog - overvej partitionering ved >1M rows
@@index([organizationId, createdAt]) // for retention cleanup
```

---

## Changelog

```
v0.6 (Performance-review):
  DEC-020: listCompanies pagination CHALLENGED
  DEC-021: listOwnerships pagination CHALLENGED
  DEC-022: getAccessibleCompanies caching CHALLENGED
  DEC-023: Ownership missing index CHALLENGED
  DEC-024: listPersons JS filtering CHALLENGED
  DEC-025: getCompanyActivityLog dual-query CHALLENGED
```