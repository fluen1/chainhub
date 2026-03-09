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

```
Query 1: company.findMany() — max 50 rækker
Query 2: $queryRaw GROUP BY company_id — counts per selskab
Query 3: $queryRaw DISTINCT ON company_id — seneste nøgletal per selskab
```

### `$queryRaw` parameterisering

**KORREKT (Prisma.sql — parameteriseret):**
```typescript
import { Prisma } from '@prisma/client'

prisma.$queryRaw(
  Prisma.sql`SELECT * FROM companies WHERE organization_id = ${organizationId}`
)
```

**FORKERT (aldrig string-interpolation):**
```typescript
// ❌ SQL-injection risiko — bruges ALDRIG
prisma.$queryRaw(`SELECT * FROM companies WHERE organization_id = '${organizationId}'`)
```

Alle `$queryRaw`-kald i `src/actions/dashboard.ts` og `src/lib/cache/finance.ts`
bruger udelukkende `Prisma.sql` template literals.

---

## Indexes tilføjet i Sprint 5

### `companies`
```sql
-- Dashboard compound index
CREATE INDEX idx_companies_org_status_deleted
  ON companies (organization_id, status, deleted_at);
```

### `contracts`
```sql
-- "Udløber inden 30 dage"-query
CREATE INDEX idx_contracts_org_status_expiry
  ON contracts (organization_id, status, expiry_date);
```

### `case_companies`
```sql
-- Dashboard JOIN på company_id for case-counts
CREATE INDEX idx_case_companies_org_company
  ON case_companies (organization_id, company_id);
```

### `tasks`
```sql
-- Dashboard task-count per selskab
CREATE INDEX idx_tasks_org_company_deleted
  ON tasks (organization_id, company_id, deleted_at);
```

### `deadlines`
```sql
-- "Overskrene frister"-query
CREATE INDEX idx_deadlines_org_completed_due
  ON deadlines (organization_id, completed_at, due_date);
```

### `financial_metrics`
```sql
-- DISTINCT ON query for seneste nøgletal
CREATE INDEX idx_financial_metrics_full
  ON financial_metrics (organization_id, company_id, metric_type, period_type, period_year);

-- Finance-oversigt sorteret på år
CREATE INDEX idx_financial_metrics_org_year
  ON financial_metrics (organization_id, period_year);
```

### `time_entries`
```sql
-- Date-range filter i listTimeEntries
CREATE INDEX idx_time_entries_org_case_date
  ON time_entries (organization_id, case_id, date);
```

---

## Pagination — implementeret Sprint 5

### Alle liste-views har nu pagination

| Action | Pagination | Page size |
|--------|-----------|-----------|
| `listFinancialMetrics()` | ✅ page + pageSize | default 20, max 100 |
| `listTimeEntries()` | ✅ page + pageSize | default 20, max 100 |
| `listInvoices()` | ✅ limit + offset | max 100 |
| `listDividends()` | ✅ page + pageSize | default 20, max 100 |

### Alle returnerer `{ total, hasMore, page, pageSize }` i response.

---

## Cache-kandidater (ikke implementeret — fremtidig)

### Medium prioritet (v1.1)

| Data | TTL | Invalidering | Nøgle-format |
|------|-----|--------------|--------------|
| User permissions | 5 min | Ved rolle-ændring | `perm:${orgId}:${userId}` |
| Accessible companies | 5 min | Ved rolle-ændring | `access:${orgId}:${userId}` |
| Organization features | 15 min | Ved plan-ændring | `org:${orgId}:features` |

### Lav prioritet (v2)

| Data | TTL | Invalidering | Nøgle-format |
|------|-----|--------------|--------------|
| Audit log aggregates | 10 min | Ved ny log-entry | `audit:${orgId}:daily` |

---

## Anti-patterns at undgå

```
❌ Cache hele resultatsæt fra listCompanies() — for store, personlige
❌ Cache uden organizationId i key — tenant-isolation-brud
❌ Cache audit logs — compliance-risiko
❌ Cache med lang TTL på kontrakt-status — forældet data
❌ Global cache for brugerspecifikke queries
❌ $queryRaw med string-interpolation — SQL-injection risiko
❌ $queryRaw uden Prisma.sql template literal
```

---

## Monitoring (fremtidig)

- Cache hit/miss ratio per endpoint
- Cache memory usage
- Invalidation frequency
- Stale data incidents
- Dashboard p95 load-time (mål: <2 sekunder)

---

## Changelog

```
v2.0 (Sprint 5):
  - Implementeret unstable_cache for financial metrics (TTL 1 time)
  - Implementeret dashboard-cache (TTL 2 minutter)
  - Finance-cache invalidering ved alle mutationer
  - Pagination tilføjet til alle liste-views der manglede det
  - 7 nye database-indexes for dashboard-query performance
  - $queryRaw dokumenteret med Prisma.sql parameterisering
  - src/lib/cache/finance.ts oprettet
  - src/actions/dashboard.ts oprettet

v1.0 (Sprint 3):
  - Initial caching-strategi
  - Cache-kandidater identificeret
  - Anti-patterns dokumenteret
```