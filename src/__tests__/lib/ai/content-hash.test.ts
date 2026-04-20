import { describe, it, expect } from 'vitest'
import { sha256 } from '@/lib/ai/content-hash'

describe('content-hash', () => {
  it('producerer deterministisk hash for samme input', () => {
    const a = sha256(Buffer.from('hello world'))
    const b = sha256(Buffer.from('hello world'))
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })
  it('giver forskellige hashes for forskellige input', () => {
    expect(sha256(Buffer.from('a'))).not.toBe(sha256(Buffer.from('b')))
  })
})
