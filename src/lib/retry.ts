interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  shouldRetry?: (error: unknown) => boolean
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 500, shouldRetry } = options ?? {}

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (shouldRetry && !shouldRetry(err)) throw err
      if (attempt === maxAttempts) throw err
      const delay = initialDelayMs * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}
