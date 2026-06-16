import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// jsdom implementerer ikke scrollIntoView — polyfill til tests
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/actions/assistant', () => ({
  createConversation: vi.fn().mockResolvedValue({ data: { id: 'conv-1' } }),
  sendMessage: vi.fn().mockResolvedValue({
    data: { response: 'Svar', toolResults: [], pendingActions: [] },
  }),
}))

vi.mock('@/components/assistant/ActionConfirmCard', () => ({
  ActionConfirmCard: () => <div data-testid="action-confirm-card" />,
}))

import { ChatPanel } from '@/components/assistant/ChatPanel'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChatPanel', () => {
  it('renderes ikke når open=false', () => {
    const { container } = render(<ChatPanel open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderes når open=true', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('viser "AI-assistent" overskrift', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByText('AI-assistent')).toBeInTheDocument()
  })

  it('viser velkomst-besked når der ingen beskeder er', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByText(/Hej! Jeg kan hjælpe/)).toBeInTheDocument()
  })

  it('har luk-knap', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Luk AI-assistent')).toBeInTheDocument()
  })

  it('luk-knap kalder onClose', async () => {
    const onClose = vi.fn()
    render(<ChatPanel open={true} onClose={onClose} />)
    screen.getByLabelText('Luk AI-assistent').click()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('har input-felt', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText('Stil et spørgsmål...')).toBeInTheDocument()
  })

  it('har send-knap', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Send besked')).toBeInTheDocument()
  })
})
