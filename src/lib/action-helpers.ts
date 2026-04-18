import type { ActionResult } from '@/types/actions'
import { captureError, createLogger } from '@/lib/logger'

/**
 * Wrapper for server actions der logger start/succes/fejl med strukturerede
 * felter og sender fejl til Sentry. Returnerer uforandret ActionResult<T>.
 *
 * @example
 * export const createTask = (input: CreateTaskInput) =>
 *   withActionLogging('createTask', async () => {
 *     // ... action logic ...
 *     return { data: task }
 *   })
 */
export async function withActionLogging<T>(
  actionName: string,
  fn: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  const log = createLogger(`action:${actionName}`)
  const started = Date.now()
  log.debug({ actionName }, 'action start')

  try {
    const result = await fn()
    const duration = Date.now() - started
    if ('error' in result && result.error) {
      log.warn({ actionName, duration, error: result.error }, 'action returned error')
    } else {
      log.info({ actionName, duration }, 'action success')
    }
    return result
  } catch (err) {
    const duration = Date.now() - started
    captureError(err, {
      namespace: `action:${actionName}`,
      extra: { actionName, duration },
    })
    // Returnér generisk fejl i ActionResult-format — kald-site viser brugeren en toast
    return { error: 'Der opstod en uventet fejl — prøv igen' } as ActionResult<T>
  }
}
