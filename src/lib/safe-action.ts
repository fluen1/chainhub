import { toast } from 'sonner'
import type { ActionResult } from '@/types/actions'

/**
 * safeAction — client-side wrapper til server action-kald.
 *
 * Håndterer både ActionResult-fejl (logisk fejl returneret af action) og
 * netværks-/serialiseringsfejl (action-kaldet kaster selv en exception).
 *
 * @example
 * const data = await safeAction(createCase(input))
 * if (!data) return  // fejl er allerede vist som toast
 *
 * @param action   Promise der returnerer ActionResult<T>
 * @param errorMessage  Fallback-besked ved netværksfejl (dansk, handlingsanvisende)
 * @returns        T ved succes, null ved fejl
 */
export async function safeAction<T>(
  action: Promise<ActionResult<T>>,
  errorMessage = 'Noget gik galt — prøv igen.'
): Promise<T | null> {
  try {
    const result = await action
    if (result.error) {
      toast.error(result.error)
      return null
    }
    return result.data ?? null
  } catch {
    toast.error(errorMessage)
    return null
  }
}
