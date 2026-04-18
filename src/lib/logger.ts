import pino from 'pino'
import * as Sentry from '@sentry/nextjs'

// Shared Pino-logger til hele app'en. Matcher mønstret fra src/lib/ai/logger.ts
// (som er AI-specifik). Bruger samme BLK-004-workaround: ingen transport i
// Next.js-runtime for at undgaa worker-thread-lifecycle-issues.

const insideNextjs = !!process.env.NEXT_RUNTIME
const isProd = process.env.NODE_ENV === 'production'

const transport =
  isProd || insideNextjs
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,module,namespace',
        },
      }

const baseLevel = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug')

/**
 * Root logger — brug denne hvis du ikke har en mere specifik namespace.
 */
export const logger = pino({
  level: baseLevel,
  base: { module: 'app' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(transport ? { transport } : {}),
})

/**
 * Opret en namespaced logger til et konkret modul eller action.
 *
 * @example
 * const log = createLogger('actions:tasks')
 * log.info({ userId, taskId }, 'task created')
 */
export function createLogger(namespace: string) {
  return pino({
    level: baseLevel,
    base: { module: 'app', namespace },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(transport ? { transport } : {}),
  })
}

/**
 * Hjælper til at serialisere Error-objekter på en læsbar måde.
 * Pino gør dette default, men vi sender også stack + digest når tilgængelige.
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      // Next.js App Router fejl har en digest-hash til fejl-korrelation
      ...('digest' in err && typeof err.digest === 'string' ? { digest: err.digest } : {}),
    }
  }
  return { raw: String(err) }
}

/**
 * Log fejl både til Pino (stdout) og til Sentry (hvis DSN er sat).
 * Sentry-integration er no-op hvis Sentry ikke er konfigureret.
 */
export function captureError(
  err: unknown,
  context?: { namespace?: string; extra?: Record<string, unknown> }
): void {
  const namespace = context?.namespace ?? 'app'
  const log = createLogger(namespace)
  log.error({ err: serializeError(err), ...context?.extra }, 'captured error')

  // Send til Sentry — Sentry er no-op hvis DSN ikke er sat (enabled=false i config)
  if (err instanceof Error) {
    Sentry.captureException(err, {
      tags: { namespace },
      extra: context?.extra,
    })
  } else {
    Sentry.captureMessage(String(err), {
      level: 'error',
      tags: { namespace },
      extra: context?.extra,
    })
  }
}
