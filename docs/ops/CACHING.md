# ChainHub Caching-strategi
**Version:** 1.0
**Oprettet:** Performance-agent BA-09
**Status:** DRAFT

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

### Lag 2: Next.js Data Cache (revalidatePath/revalidateTag)
- Bruges til server actions med `revalidatePath()`
- Allerede implementeret i companies.ts og persons.ts
- **Anbefaling:** Tilføj `revalidateTag()` for mere granulær kontrol

### Lag 3: In-Memory Cache (fremtidig)
- Redis eller Node.js Map for hyppigt tilgåede data
- **Kandidater:**
  - Organization plan/features (ændrer sig sjældent)
  - User permissions (ændrer sig sjældent)
  - Enum-lookups (statiske)

---

## Cache-kandidater

### Høj prioritet (implementér nu)

| Data | TTL | Invalidering | Nøgle-format |
|------|-----|--------------|--------------|
| User permissions | 5 min | Ved rolle-ændring | `perm:${orgId}:${userId}` |
| Accessible companies | 5 min | Ved rolle-ændring | `access:${orgId}:${userId}` |
| Organization features | 15 min | Ved plan-ændring | `org:${orgId}:features` |

### Medium prioritet (implementér i v1.1)

| Data | TTL | Invalidering | Nøgle-format |
|------|-----|--------------|--------------|
| Company _count | 2 min | Ved contract/case-oprettelse | `company:${companyId}:counts` |
| Contract status counts | 2 min | Ved status-ændring | `contracts:${orgId}:status` |

### Lav prioritet (overvej i v2)

| Data | TTL | Invalidering | Nøgle-format |
|------|-----|--------------|--------------|
| Audit log aggregates | 10 min | Ved ny log-entry | `audit:${orgId}:daily` |
| Financial metrics | 1 time | Ved metric-opdatering | `finance:${companyId}:${year}` |

---

## Implementation Pattern

```typescript
// Eksempel: Cached permissions lookup
import { unstable_cache } from 'next/cache'

export const getCachedPermissions = unstable_cache(
  async (userId: string, organizationId: string) => {
    return await prisma.userRoleAssignment.findMany({
      where: { userId, organizationId },
    })
  },
  ['user-permissions'],
  {
    revalidate: 300, // 5 minutter
    tags: ['permissions'],
  }
)

// Invalidering ved rolle-ændring:
revalidateTag('permissions')
```

---

## Anti-patterns at undgå

```
❌ Cache hele resultatsæt fra listCompanies() - for store, personlige
❌ Cache uden organizationId i key - tenant-isolation-brud
❌ Cache audit logs - compliance-risiko
❌ Cache med lang TTL på kontrakt-status - forældet data
❌ Global cache for brugerspecifikke queries
```

---

## Monitoring (fremtidig)

- Cache hit/miss ratio per endpoint
- Cache memory usage
- Invalidation frequency
- Stale data incidents

---

## Changelog

```
v1.0:
  - Initial caching-strategi
  - Cache-kandidater identificeret
  - Anti-patterns dokumenteret
```