import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CookieWithdrawPanel } from '@/components/settings/CookieWithdrawPanel'
import { COOKIE_CONSENT_KEY } from '@/lib/cookie-consent'

// posthog mock
vi.mock('posthog-js', () => ({
  default: {
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}))

import posthog from 'posthog-js'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('CookieWithdrawPanel', () => {
  it('viser "ikke givet" og Acceptér-knap når localStorage er tom', () => {
    render(<CookieWithdrawPanel />)
    expect(screen.getByText(/ikke givet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /acceptér analytics/i })).toBeInTheDocument()
  })

  it('viser "Givet" og Tilbagekald-knap når consent er "granted"', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'granted')
    render(<CookieWithdrawPanel />)
    expect(screen.getByText(/givet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tilbagekald samtykke/i })).toBeInTheDocument()
  })

  it('kalder posthog.opt_out_capturing og sætter localStorage til "denied" ved tilbagetrækning', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'granted')
    render(<CookieWithdrawPanel />)
    fireEvent.click(screen.getByRole('button', { name: /tilbagekald samtykke/i }))
    expect(posthog.opt_out_capturing).toHaveBeenCalledOnce()
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('denied')
  })

  it('har role="alert" på status-indikatoren', () => {
    render(<CookieWithdrawPanel />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
