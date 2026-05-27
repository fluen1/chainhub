import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/actions/assistant', () => ({
  confirmAction: vi.fn().mockResolvedValue({ data: {} }),
  rejectAction: vi.fn().mockResolvedValue({ data: {} }),
  createConversation: vi.fn(),
  sendMessage: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { confirmAction, rejectAction } from '@/actions/assistant'
import { ActionConfirmCard } from '@/components/assistant/ActionConfirmCard'
import { toast } from 'sonner'

// ── helpers ──────────────────────────────────────────────────────────────────

const defaultProps = {
  actionId: 'action-1',
  actionType: 'create_task',
  actionLabel: 'Opret opgave: Gennemgå kontrakt',
  payload: { title: 'Gennemgå kontrakt', due: '2026-06-01' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ActionConfirmCard', () => {
  it('renderer actionLabel', () => {
    render(<ActionConfirmCard {...defaultProps} />)
    expect(screen.getByText('Opret opgave: Gennemgå kontrakt')).toBeInTheDocument()
  })

  it('renderer payload-felter', () => {
    render(<ActionConfirmCard {...defaultProps} />)
    expect(screen.getByText('title:')).toBeInTheDocument()
    expect(screen.getByText('Gennemgå kontrakt')).toBeInTheDocument()
    expect(screen.getByText('due:')).toBeInTheDocument()
    expect(screen.getByText('2026-06-01')).toBeInTheDocument()
  })

  it('renderer ikke payload-sektion ved tomt payload', () => {
    render(<ActionConfirmCard {...defaultProps} payload={{}} />)
    expect(screen.queryByRole('definition')).toBeNull()
  })

  it('viser Bekræft og Afvis knapper i pending-tilstand', () => {
    render(<ActionConfirmCard {...defaultProps} />)
    expect(screen.getByRole('button', { name: /bekræft/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /afvis/i })).toBeInTheDocument()
  })

  it('kalder confirmAction med actionId ved klik på Bekræft', async () => {
    render(<ActionConfirmCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /bekræft/i }))
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith('action-1'))
  })

  it('viser "✓ Udført" og skjuler knapper efter bekræftelse', async () => {
    render(<ActionConfirmCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /bekræft/i }))
    await waitFor(() => expect(screen.getByText('✓ Udført')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /bekræft/i })).toBeNull()
  })

  it('viser toast.success efter bekræftelse', async () => {
    render(<ActionConfirmCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /bekræft/i }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Handling udført'))
  })

  it('kalder rejectAction med actionId ved klik på Afvis', async () => {
    render(<ActionConfirmCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /afvis/i }))
    await waitFor(() => expect(rejectAction).toHaveBeenCalledWith('action-1'))
  })

  it('viser "✗ Afvist" og skjuler knapper efter afvisning', async () => {
    render(<ActionConfirmCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /afvis/i }))
    await waitFor(() => expect(screen.getByText('✗ Afvist')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /bekræft/i })).toBeNull()
  })

  it('viser toast.error ved fejl i bekræftelse', async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce({ error: 'Noget gik galt' })
    render(<ActionConfirmCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /bekræft/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Noget gik galt'))
    // Status ændres ikke — knapper stadig synlige
    expect(screen.getByRole('button', { name: /bekræft/i })).toBeInTheDocument()
  })

  it('viser toast.error ved fejl i afvisning', async () => {
    vi.mocked(rejectAction).mockResolvedValueOnce({ error: 'Afvisning fejlede' })
    render(<ActionConfirmCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /afvis/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Afvisning fejlede'))
    expect(screen.getByRole('button', { name: /afvis/i })).toBeInTheDocument()
  })

  it('deaktiverer knapper mens handling udføres', async () => {
    // Lad confirmAction hænge så loading-state er observerbar
    let resolveAction!: (v: { data: { success: boolean } }) => void
    vi.mocked(confirmAction).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve
      })
    )
    render(<ActionConfirmCard {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /bekræft/i }))
    expect(screen.getByRole('button', { name: /udfører/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /afvis/i })).toBeDisabled()
    resolveAction({ data: { success: true } })
    await waitFor(() => expect(screen.getByText('✓ Udført')).toBeInTheDocument())
  })
})
