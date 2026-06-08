import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/email/resend', () => ({
  sendContactEmail: vi.fn(),
}))

import { submitContactForm } from '@/actions/contact'
import { sendContactEmail } from '@/lib/email/resend'

const valid = {
  name: 'Test Tester',
  email: 'test@optikgruppen.dk',
  company: 'OptikGruppen',
  message: 'Vi vil gerne høre mere om Plus-planen.',
}

describe('submitContactForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: sender mail og returnerer { data: true }', async () => {
    vi.mocked(sendContactEmail).mockResolvedValueOnce(undefined)
    const res = await submitContactForm(valid)
    expect(res).toEqual({ data: true })
    expect(sendContactEmail).toHaveBeenCalledOnce()
  })

  it('Resend-fejl: returnerer handlingsanvisende fejl med mailto-adresse', async () => {
    vi.mocked(sendContactEmail).mockRejectedValueOnce(new Error('resend down'))
    const res = await submitContactForm(valid)
    expect('error' in res && res.error).toContain('kontakt@chainhub.dk')
  })

  it('honeypot udfyldt: silent success, ingen mail sendt (spam-guard)', async () => {
    const res = await submitContactForm({ ...valid, honeypot: 'http://spam.example' })
    expect(res).toEqual({ data: true })
    expect(sendContactEmail).not.toHaveBeenCalled()
  })

  it('ugyldig e-mail: valideringsfejl, ingen mail sendt', async () => {
    const res = await submitContactForm({ ...valid, email: 'ikke-en-email' })
    expect('error' in res).toBe(true)
    expect(sendContactEmail).not.toHaveBeenCalled()
  })
})
