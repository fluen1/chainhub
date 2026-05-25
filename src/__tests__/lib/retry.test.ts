import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '@/lib/retry'

describe('withRetry', () => {
  it('returnerer resultat ved første succesfulde kald', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('prøver igen ved fejl og lykkes på andet forsøg', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('kaster fejl efter max forsøg', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'))
    await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })).rejects.toThrow('persistent')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('bruger eksponentiel backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok')

    const start = Date.now()
    await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(20)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('stopper retry ved shouldRetry=false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'))
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        initialDelayMs: 1,
        shouldRetry: (err) => !(err instanceof Error && err.message === 'fatal'),
      })
    ).rejects.toThrow('fatal')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
