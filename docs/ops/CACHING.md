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

```sql
-- Query 1: Aggregeret summary (counts + deadlines)
SELECT
  COUNT(*) FILTER (WHERE "deletedAt" IS NULL) as company_count,
  COUNT(*) FILTER (WHERE status = 'AKTIV' AND "deletedAt" IS NULL) as active_contracts,
  COUNT(*) FILTER (WHERE status IN ('UDKAST','TIL_REVIEW') AND "deletedAt" IS NULL) as pending_contracts,
  COUNT(*) FILTER (WHERE "dueDate" < NOW() AND status != 'LUKKET' AND "deletedAt" IS NULL) as overdue_deadlines
FROM companies, contracts, deadlines
WHERE "organizationId" = $1;

-- Query 2: Top selskaber med kontrakt-counts
SELECT c.id, c.name, COUNT(k.id) as contract_count
FROM companies c
LEFT JOIN contracts k ON k."companyId" = c.id AND k."deletedAt" IS NULL
WHERE c."organizationId" = $1 AND c."deletedAt" IS NULL
GROUP BY c.id, c.name
ORDER BY contract_count DESC
LIMIT 10;

-- Query 3: Kommende frister (næste 30 dage)
SELECT id, title, "dueDate", priority, "companyId"
FROM deadlines
WHERE "organizationId" = $1
  AND "deletedAt" IS NULL
  AND status != 'LUKKET'
  AND "dueDate" BETWEEN NOW() AND NOW() + INTERVAL '30 days'
ORDER BY "dueDate" ASC
LIMIT 20;
```

### Forventet performance med indexes:
- Query 1: ~5ms (index scan på organizationId)
- Query 2: ~15ms (index scan + hash join)
- Query 3: ~8ms (composite index på organizationId + dueDate)
- **Total: <30ms** (parallelt via Promise.all)

---

## Index-strategi (Sprint 5)

### Composite indexes implementeret i schema.prisma:

```prisma
// Company
@@index([organizationId, deletedAt])
@@index([organizationId, status])

// Contract
@@index([organizationId, deletedAt])
@@index([organizationId, status])
@@index([organizationId, companyId])
@@index([organizationId, systemType])
@@index([expiresAt]) // deadline scanning

// Deadline
@@index([organizationId, deletedAt])
@@index([organizationId, status])
@@index([organizationId, dueDate])
@@index([companyId, status])

// FinancialMetric
@@index([organizationId, companyId])
@@index([organizationId, metricType])
@@index([companyId, recordedAt])

// AuditLog
@@index([organizationId, createdAt])
@@index([resourceType, resourceId])
```

### Begrundelse:
- `(organizationId, deletedAt)`: Soft-delete filter er universelt — composite index eliminerer full table scan
- `(organizationId, status)`: Status-filtrering er næst hyppigst forespurgt
- `(organizationId, dueDate)`: Dashboard deadline-query kræver range scan på dato

---

## Multi-tenant Cache Isolation

**REGEL:** Alle cache-keys SKAL indeholde `organizationId` som første segment.

```typescript
// KORREKT
const cacheKey = [`finance`, organizationId, companyId]

// FORKERT — sikkerhedsfejl
const cacheKey = [`finance`, companyId]
```

### Verifikation:
- Integration-tests i `src/__tests__/integration/tenant-isolation.test.ts` verificerer at:
  1. Organisation A kan ikke se Organisation B's data
  2. Cache for Organisation A returnerer ikke Organisation B's data
  3. Alle queries inkluderer `organizationId` i where-clause

---

## Connection Pooling

**Konfiguration** (`src/lib/db.ts`):
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})
```

**PgBouncer / Supabase Pooler:**
- Brug `?pgbouncer=true&connection_limit=1` på `DATABASE_URL` i produktionsmiljø
- Transaction mode anbefales til serverless (Next.js edge/serverless functions)
- Session mode til long-running queries (rapporter, bulk-import)

**Connection limits:**
| Miljø | Max connections | Pool size |
|-------|----------------|-----------|
| Development | 10 | 5 |
| Staging | 20 | 10 |
| Production | 100 | 25 |

---

## Monitoring & Alerting

### Slow Query Threshold: >500ms

```typescript
// src/lib/db.ts — query logging i development
prisma.$on('query', (e) => {
  if (e.duration > 500) {
    console.warn(`SLOW QUERY (${e.duration}ms):`, e.query)
  }
})
```

### Metrics at tracke:
- P50/P95/P99 query latency per endpoint
- Cache hit rate (target: >80% for dashboard)
- Connection pool utilization
- Slow queries (>500ms) per dag

---

## Sprint 5 — Implementeringsstatus

| Feature | Status | Fil |
|---------|--------|-----|
| Finance cache (`unstable_cache`) | ✅ Implementeret | `src/lib/cache/finance.ts` |
| Dashboard cache | ✅ Implementeret | `src/actions/dashboard.ts` |
| Cache invalidering (finance) | ✅ Implementeret | `src/lib/cache/finance.ts` |
| Cache invalidering (dashboard) | ✅ Implementeret | `src/actions/dashboard.ts` |
| Composite indexes (schema) | ✅ Implementeret | `prisma/schema.prisma` |
| Tenant isolation tests | ✅ Implementeret | `src/__tests__/integration/tenant-isolation.test.ts` |
| Connection pooling config | 📋 Dokumenteret | `docs/ops/CACHING.md` |
| Slow query monitoring | 📋 Dokumenteret | `docs/ops/CACHING.md` |

---