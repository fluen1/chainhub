# LOGGING-GUIDE.md — ChainHub

Sådan logger vi i ChainHub. Gælder både server actions, API routes, og pages.

---

## Setup

Vi bruger:

- **[Pino](https://github.com/pinojs/pino)** til structured NDJSON logging (stdout)
- **[Sentry](https://sentry.io)** til error tracking (opt-in via `SENTRY_DSN`)
- **`src/lib/logger.ts`** som shared entry point

Sentry er **deaktiveret uden DSN** — alle `captureError`/`captureException`-kald er no-ops. Det betyder at logger-pattern kan bruges overalt uden at kræve Sentry-setup.

---

## Grundlæggende brug

### Root logger

```typescript
import { logger } from '@/lib/logger'

logger.info({ userId: '123' }, 'user logged in')
logger.warn({ taskId }, 'task overdue')
logger.error({ err }, 'something failed')
```

### Namespaced logger

Foretrukket — giver filtrerbar kontekst:

```typescript
import { createLogger } from '@/lib/logger'

const log = createLogger('action:createTask')

log.debug({ input }, 'start')
log.info({ taskId: task.id, duration }, 'success')
```

### Fejl-capture med Sentry

```typescript
import { captureError } from '@/lib/logger'

try {
  await prisma.task.create(...)
} catch (err) {
  captureError(err, {
    namespace: 'action:createTask',
    extra: { userId, input },
  })
  return { error: 'Opgaven kunne ikke oprettes — prøv igen' }
}
```

`captureError` logger til Pino OG sender til Sentry (hvis DSN er sat).

---

## Server actions — anbefalet mønster

Wrap med `withActionLogging` for at få automatisk start/succes/fejl-logs + duration-tracking + Sentry på uventede throws.

```typescript
'use server'

import { withActionLogging } from '@/lib/action-helpers'
import { captureError } from '@/lib/logger'

export async function createTask(input: CreateTaskInput): Promise<ActionResult<Task>> {
  return withActionLogging('createTask', async () => {
    const session = await auth()
    if (!session) return { error: 'Ikke autoriseret' }

    // ... validation + permission ...

    try {
      const task = await prisma.task.create({ data: { ... } })
      revalidatePath('/tasks')
      return { data: task }
    } catch (err) {
      captureError(err, { namespace: 'action:createTask', extra: { userId } })
      return { error: 'Opgaven kunne ikke oprettes — prøv igen' }
    }
  })
}
```

**Resultat:**

```
DEBUG action:createTask action start
INFO action:createTask { actionName: 'createTask', duration: 43 } action success
```

Eller ved fejl:

```
WARN action:createTask action returned error
ERROR action:createTask captured error ... (+ Sentry event)
```

---

## Log-levels

| Level   | Hvornår?                                                         |
| ------- | ---------------------------------------------------------------- |
| `trace` | Meget detaljeret; kun ved deep debugging                         |
| `debug` | Dev-mode default; normal flow-tracking                           |
| `info`  | Prod-mode default; betydningsfulde success-events                |
| `warn`  | Noget gik uventet men app kan fortsætte (fx pagination cap ramt) |
| `error` | Exception fanget — brugeren kan se en fejl                       |
| `fatal` | App-niveau fejl, kræver restart/intervention                     |

Filter via env: `LOG_LEVEL=warn` viser kun `warn`+ i logs.

---

## Hvad skal med i logs

**Always:**

- `userId` og `organizationId` når tilgængelig (hjælper korrelation)
- Entity IDs (taskId, companyId, contractId)
- Duration for async operationer
- Error-objekt (Pino serialiserer automatisk stack + message)

**Never:**

- Passwords, tokens, session-cookies
- Fulde dokument-indhold (log kun metadata: filnavn, størrelse)
- PII som CPR-numre, fulde email-trådeindhold
- Input.description hvis det kan indeholde kunde-følsom tekst

Sentry's `beforeSend` i `sentry.client.config.ts` fjerner `cookie` + `authorization` headers automatisk, men PII i `extra`-felter skal du selv redacte.

---

## Log-eksempler

### God

```typescript
log.info({ userId, taskId: task.id, status: 'AKTIV' }, 'task status updated')
log.warn({ orgId, cappedTypes: ['contracts', 'tasks'] }, 'calendar hit event cap')
log.error({ err, userId }, 'organization update failed')
```

### Dårlig

```typescript
log.info('user did thing') // ingen kontekst
log.info({ user }, 'updated') // kan lække password_hash
console.log('debug', someObject) // ikke struktureret
```

---

## Sentry-events

Tags kan filtreres i Sentry-UI. Brug dem konsistent:

- `page` — fx `'dashboard'`, `'companies'`, `'tasks'` (sat af error boundaries)
- `namespace` — fx `'action:createTask'` (sat automatisk af `captureError`)

Extra-data er context der ikke kan filtreres men vises på event. Brug til entity IDs, input-data (redacted).

---

## Retrofit-plan

Pr. 2026-04-18 er `withActionLogging` kun demo-wired på `updateOrganization`. **34 silent catch-blocks** i `src/actions/` venter på at blive retrofittet. Det sker i session 2 som dedikeret sweep — indtil da er `captureError` valgfri i nye actions (men anbefalet).
