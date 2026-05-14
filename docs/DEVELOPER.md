# DEVELOPER.md — ChainHub onboarding

Detaljeret guide til nye udviklere. README giver overblikket; denne fil går dybere.

---

## Port-konflikter og NEXTAUTH_URL

Next.js vælger automatisk næste ledige port hvis 3000 er optaget (fx af en anden dev-server, Docker-container eller Teams). Det giver usynlige auth-fejl fordi `NEXTAUTH_URL` i `.env.local` stadig peger på port 3000.

**Symptomer:**

- Login-siden redirecter forkert efter autentificering
- NextAuth-callbacks returnerer 401 eller 404
- `getServerSession` returnerer `null` trods gyldigt login

**Fix:**

1. Se hvilken port dev-serveren faktisk bruger:

   ```
   npm run dev
   # Output: "ready - started server on 0.0.0.0:3001, url: http://localhost:3001"
   ```

2. Opdater `.env.local`:

   ```env
   NEXTAUTH_URL=http://localhost:3001
   ```

3. Genstart dev-serveren (`Ctrl+C` → `npm run dev`) så NextAuth læser den nye URL.

**Forebyg konflikten:**

Find og stop processen der bruger port 3000 (PowerShell):

```powershell
netstat -ano | findstr :3000
# Notér PID i sidste kolonne
taskkill /PID <PID> /F
```

**Runtime-advarsel (development-mode):**

I development-mode logger `src/lib/auth/index.ts` en advarsel i konsollen hvis `NEXTAUTH_URL` ikke matcher den faktiske request-origin. Hold øje med:

```
[ChainHub auth] NEXTAUTH_URL mismatch: env=http://localhost:3000, request=http://localhost:3001
```

---

## Windows + OneDrive

Projekt-dir ligger under OneDrive på den primære udviklers maskine. Det giver 3 kendte gotchas:

1. **`.next`-build mapper fejler** med `EINVAL: invalid argument, readlink` når OneDrive synkroniserer mid-build. Fix: `rm -rf .next` før `npx next build` eller `npm run dev`. Tilføj evt. `.next` til OneDrive-ignore-regler.

2. **Prisma DLL-genereringsfejl** på Windows:

   ```
   EPERM: operation not permitted, rename '.../query_engine-windows.dll.node'
   ```

   Skyldes at dev-server eller en anden proces holder DLL'en låst. Fix:

   ```bash
   # stop dev-server først
   rm -f node_modules/.prisma/client/query_engine-windows.dll.node*
   npx prisma generate
   ```

3. **`git add` LF/CRLF-advarsler** — løst via `.gitattributes` (alle filer forceres til LF). Hvis advarsler stadig dukker op: slet lokal fil, `git checkout -- <file>` for at genhente med korrekte line-endings.

---

## Database

### Supabase pooler pause

Supabase free-tier pauser efter inaktivitet. Symptom: `connect ECONNREFUSED` eller `too many connections`. Fix: gå til Supabase dashboard og wake projektet. Alternativt kør lokal PG via `docker compose up -d`.

### Migration-workflow — hvornår `db push` vs `migrate dev`

- **`prisma db push`** — hurtig schema-sync uden migrations-fil. Bruges til:
  - Prototype-fase (Sprint 1-4)
  - Små iterationer i dev
  - Når shadow-DB ikke virker (Supabase pooler giver `P3006` på `migrate dev`)
- **`prisma migrate dev --name <name>`** — genererer SQL-migration og kører den. Bruges til:
  - Produktions-ændringer (migrations bevares i `prisma/migrations/`)
  - Team-arbejde hvor schema-historik er vigtig

Lige nu bruger projektet primært `db push` pga. Supabase pooler + shadow-DB problemer. Ved deploy til produktion skal alle `db push`-ændringer samles i én initial migration.

### Seed-data

```bash
npx prisma db seed
```

Seed-brugere:

| Email                      | Rolle         | Password    |
| -------------------------- | ------------- | ----------- |
| philip@chainhub.dk         | GROUP_OWNER   | password123 |
| maria@tandlaegegruppen.dk  | GROUP_LEGAL   | password123 |
| thomas@tandlaegegruppen.dk | GROUP_ADMIN   | password123 |
| torben@tandlaegegruppen.dk | GROUP_FINANCE | password123 |

Seed-organisation: `TandlægeGruppen A/S` med 7 selskaber, 18 kontrakter, 4 sager, 10 opgaver, 8 dokumenter, 10 personer.

### Lokal PG med Docker

```bash
docker compose up -d       # port 5432
```

Sæt i `.env.local`:

```env
DATABASE_URL=postgresql://chainhub:chainhub@localhost:5432/chainhub
DIRECT_URL=postgresql://chainhub:chainhub@localhost:5432/chainhub
```

---

## Playwright smoke-test

Mod en kørende dev-server:

```bash
# Terminal 1
rm -rf .next && npm run dev

# Terminal 2 (med Playwright MCP eller separat)
# Login som philip@chainhub.dk / password123
# Klik gennem kritiske sider: /dashboard, /companies, /companies/[id],
# /contracts, /tasks, /tasks/[id], /cases, /persons, /calendar, /search,
# /settings
```

Verificér: ingen console errors, alle sider loader inden 2 sekunder, alle links virker. Playwright-drevet regression-suite er stadig TBD (planlagt i produktions-modenhed session 3).

---

## Tilføj en ny server action

Følg mønstret fra `src/actions/organizations.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { withActionLogging } from '@/lib/action-helpers'
import { captureError } from '@/lib/logger'
import { mySchema, type MyInput } from '@/lib/validations/my-schema'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'

export async function myAction(input: MyInput): Promise<ActionResult<MyType>> {
  return withActionLogging('myAction', async () => {
    // 1. Session
    const session = await auth()
    if (!session) return { error: 'Ikke autoriseret' }

    // 2. Permission
    const hasAccess = await canAccessModule(session.user.id, 'my-module')
    if (!hasAccess) return { error: 'Ingen adgang' }

    // 3. Validation
    const parsed = mySchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }
    }

    // 4. DB + revalidate
    try {
      const result = await prisma.myTable.create({
        data: {
          organization_id: session.user.organizationId,
          // ...
        },
      })
      revalidatePath('/my-page')
      return { data: result }
    } catch (err) {
      captureError(err, { namespace: 'action:myAction' })
      return { error: 'Handlingen kunne ikke udføres — prøv igen' }
    }
  })
}
```

Test-dækning (pr. action):

- Happy path → `{ data: ... }`
- Uautoriseret → `{ error: 'Ikke autoriseret' }`
- Forkert tenant — input med andet `organization_id` → afvises
- Ugyldig input → Zod-fejl returneres

---

## Tilføj ny sektion på `/companies/[id]` eller `/tasks/[id]`

Mønsteret er etableret i Plan 4C og 4D-rewrites. Tre dele:

1. **Server action** (fx `src/actions/company-detail.ts`):
   - Tilføj nyt felt til `CompanyDetailData`-interfacet
   - Tilføj ny Prisma-query til `Promise.all`-batchen
   - Map data til view-type

2. **Pure helper** (fx `src/lib/company-detail/helpers.ts`):
   - Tilføj afledt data-beregning hvis nødvendig (sortering, aggregering)
   - Eksportér + tilføj unit-tests i `src/__tests__/`

3. **Sektion-komponent** (fx `src/components/company-detail/my-section.tsx`):
   - Brug `SectionCard` wrapper fra `src/components/company-detail/section-card.tsx`
   - Ren presentational — ingen Prisma-kald
   - Tom-state eksplicit
   - Tilføj snapshot/rendering-test

4. **Wire ind** på page.tsx
   - `{data.visibleSections.has('my-section') && <MySection {...} />}`

---

## Debugging

### Logging

Structured logs via Pino:

```typescript
import { createLogger } from '@/lib/logger'
const log = createLogger('my-module')
log.info({ userId, taskId }, 'task created')
log.error({ err }, 'unexpected')
```

Output på stdout som NDJSON (prod) eller farvet tekst (dev med `LOG_LEVEL=debug`).

Levels: `trace` < `debug` < `info` < `warn` < `error` < `fatal`. Filter via `LOG_LEVEL` env-var.

### Sentry

Aktiveres automatisk når `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` er sat i `.env.local`. Uden DSN er Sentry helt deaktiveret (no-op) — ingen payload sendes.

Send manuelt fra en catch:

```typescript
import { captureError } from '@/lib/logger'
try {
  // ...
} catch (err) {
  captureError(err, {
    namespace: 'my-module',
    extra: { context: 'whatever' },
  })
  return { error: '...' }
}
```

### Error boundaries

`error.tsx` findes for `/dashboard`, `/companies`, `/tasks` samt global fallback. Triggéreh ved at throw'e i en action eller server component — næste render viser `ErrorBoundaryUI`-komponenten med "Prøv igen"-knap.

Test manuelt: tilføj midlertidigt `throw new Error('test')` i `getDashboardData` → refresh `/dashboard` → verificér error boundary vises.

---

## FAQ

**Q: Hvorfor bruges `db push` og ikke `migrate dev`?**

A: Supabase pooler (port 6543) kan ikke bruges som shadow-DB til `migrate dev`. Vi skifter til `migrate dev` før produktions-deploy.

**Q: Hvorfor er der ingen CI/CD?**

A: TBD. Planlagt som del af produktions-modenhed session 3. Lige nu kører tests lokalt.

**Q: Hvorfor er `/visits` list-siden slettet men `/visits/[id]` bevaret?**

A: `/calendar` dækker list-behovet. Detail-siden bruges stadig af `VisitsSection` på `/companies/[id]`. Se commit `887821f`.

**Q: Hvordan tilføjer jeg en ny sensitivity-gated ressource?**

A: 1) Tilføj `sensitivity SensitivityLevel` til Prisma-modellen. 2) Kald `canAccessSensitivity(userId, level)` i action før data returneres. 3) Filtrer i list-queries baseret på rolle.

---

## Get help

- Check [docs/status/BLOCKERS.md](status/BLOCKERS.md) for kendte problemer
- Check [docs/status/DECISIONS.md](status/DECISIONS.md) for hvorfor-beslutninger
- `git log --oneline -20` for seneste kontekst
