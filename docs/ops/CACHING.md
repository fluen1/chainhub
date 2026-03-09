# ChainHub Caching-strategi
**Version:** 2.0
**Opdateret:** Performance-agent BA-09 — Sprint 5
**Status:** IMPLEMENTERET (delvist)

---

## Principper

```
1. Cache aldrig brugerspecifikke data på tværs af brugere
2. Cache kun data der ikke ændrer sig ofte
3. Invalidér altid ved mutation
4. Brug stale-while-revalidate hvor muligt
5. Multi-tenant isolation: cache-keys SKAL indeholde organizationId
```

---

## Cache-lag

### Lag 1: Next.js Request Memoization (automatisk)
- Samme request i samme render-cycle genbruges automatisk
- Ingen konfiguration nødvendig
- Gælder kun inden for én request

### Lag 2: Next.js Data Cache — `unstable_cache` (implementeret Sprint 5)

**Implementerede caches:**

| Funktion | TTL | Tags | Fil |
|----------|-----|------|-----|
| `getCachedFinancialMetrics()` | 3600s | `finance:{orgId}:{compId}` | `src/lib/cache/finance.ts` |
| `getCachedFinancialOverview()` | 3600s | `finance:{orgId}:{compId}` | `src/lib/cache/finance.ts` |
| `getCachedLatestMetricsByType()` | 3600s | `finance:{orgId}:{compId}` | `src/lib/cache/finance.ts` |
| `getDashboardSummaryCached()` | 120s | `dashboard:{orgId}` | `src/actions/dashboard.ts` |
| `getDashboardCompaniesCached()` | 120s | `dashboard:{orgId}` | `src/actions/dashboard.ts` |

**Invalidering:**

| Trigger | Funktion | Tags invalideret |
|---------|----------|-----------------|
| createFinancialMetric | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |
| updateFinancialMetric | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |
| deleteFinancialMetric | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |
| createInvoice | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |
| updateInvoice | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |
| deleteInvoice | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |
| createDividend | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |
| updateDividend | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |
| deleteDividend | `invalidateFinanceCache(orgId, compId)` | `finance:{orgId}:{compId}` |

**BEMÆRK:** `finance:{orgId}:{compId}`-tag invalideringen påvirker automatisk
`dashboard:{orgId}` fordi `getFinanceCacheTags()` inkluderer begge tags.

### Lag 3: Dashboard-cache (implementeret Sprint 5)

Dashboard-data caches separat med 2-minutters TTL fordi:
- Dashboard indlæses hyppigt (start-side)
- 2 minutter stale er acceptabelt for counts
- Cache-miss stadig kræver <500ms (3 queries med indexes)

```
dashboard:{orgId} → invalidateDashboardCache(organizationId)
```

**SKAL invalideres ved mutation af:**
- Selskaber (create/delete)
- Kontrakter (create/update status/delete)
- Sager (create/update status/delete)
- Opgaver (create/update status/delete)
- Frister (create/complete/delete)

---

## Dashboard Query Performance

### Strategi: 3 queries uanset antal selskaber (ingen N+1)

Alle dashboard-counts hentes i parallelle queries med `organizationId`-filter.
Indexes på `organizationId` + `status` sikrer <100ms per query.

---

## Redis (fremtidig — Sprint 7+)

Redis er ikke implementeret i MVP. Vurderes når:
- MAU > 500 eller
- Cache-miss rate > 20% eller
- p95 latency > 800ms

**Potentielle use cases:**
- Session-cache (erstatter JWT-lookup)
- Rate limiting
- Real-time notifications
- Distributed lock for concurrent mutations

---

## Performance-mål

| Endpoint | Mål (p95) | Cache-strategi |
|----------|-----------|----------------|
| Dashboard | <500ms | unstable_cache 120s |
| Selskabsliste | <300ms | ingen (indexes) |
| Selskabsdetalje | <400ms | ingen (indexes) |
| Finansielle metrics | <200ms | unstable_cache 3600s |
| Kontrakter | <400ms | ingen (indexes) |

---

## Noter

- `unstable_cache` er Next.js 14 API — stabil nok til produktion trods navn
- Cache-nøgler er deterministiske og inkluderer altid `organizationId` (tenant isolation)
- `revalidateTag()` bruges til granulær invalidering
- Ingen client-side cache udover React Query (fremtidig)