// @vitest-environment jsdom
/**
 * Tests for EditVisitModal — G1-012: dialog skal preloade eksisterende noter.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/actions/visits', () => ({
  updateVisit: vi.fn().mockResolvedValue({ data: { id: 'v-1' } }),
  deleteVisit: vi.fn().mockResolvedValue({ data: undefined }),
}))

import { EditVisitModal } from '@/components/calendar/edit-visit-modal'

const baseVisit = {
  id: 'v-1',
  title: 'Besøg — Alpha ApS',
  date: '2026-04-20',
  status: 'PLANLAGT',
  notes: 'Mød hos direktøren. Husk parkeringskort.',
  summary: 'God samtale om kontrakt',
}

describe('EditVisitModal (G1-012)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderer ikke noget når open=false', () => {
    const { container } = render(
      <EditVisitModal open={false} onClose={vi.fn()} visit={baseVisit} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renderer ikke noget når visit=null', () => {
    const { container } = render(<EditVisitModal open={true} onClose={vi.fn()} visit={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('preloader eksisterende noter i textarea (G1-012)', () => {
    render(<EditVisitModal open={true} onClose={vi.fn()} visit={baseVisit} />)

    const notesTextarea = screen.getByRole('textbox', { name: /noter/i })
    expect(notesTextarea).toHaveValue('Mød hos direktøren. Husk parkeringskort.')
  })

  it('preloader eksisterende opsummering i textarea (G1-012)', () => {
    render(<EditVisitModal open={true} onClose={vi.fn()} visit={baseVisit} />)

    const summaryTextarea = screen.getByRole('textbox', { name: /opsummering/i })
    expect(summaryTextarea).toHaveValue('God samtale om kontrakt')
  })

  it('viser tomt noter-felt når notes=null (nyt besøg)', () => {
    const visitNoNotes = { ...baseVisit, notes: null, summary: null }
    render(<EditVisitModal open={true} onClose={vi.fn()} visit={visitNoNotes} />)

    const notesTextarea = screen.getByRole('textbox', { name: /noter/i })
    expect(notesTextarea).toHaveValue('')
  })

  it('viser korrekt titel og dato i dialog', () => {
    render(<EditVisitModal open={true} onClose={vi.fn()} visit={baseVisit} />)

    expect(screen.getByText('Besøg — Alpha ApS')).toBeTruthy()
    expect(screen.getByText('2026-04-20')).toBeTruthy()
  })

  it('nulstiller form-state ved nyt besøg (key={visit.id})', () => {
    const { rerender } = render(<EditVisitModal open={true} onClose={vi.fn()} visit={baseVisit} />)

    const otherVisit = {
      ...baseVisit,
      id: 'v-2',
      notes: 'Andre noter til andet besøg',
    }
    rerender(<EditVisitModal open={true} onClose={vi.fn()} visit={otherVisit} />)

    const notesTextarea = screen.getByRole('textbox', { name: /noter/i })
    expect(notesTextarea).toHaveValue('Andre noter til andet besøg')
  })
})
