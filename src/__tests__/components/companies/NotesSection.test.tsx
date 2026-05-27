import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CompanyNoteWithAuthor } from '@/actions/company-notes'
import { NotesSection } from '@/components/companies/notes-section-b'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/actions/company-notes', () => ({
  createCompanyNote: vi.fn().mockResolvedValue({ data: {} }),
  toggleNotePin: vi.fn().mockResolvedValue({ data: {} }),
  deleteCompanyNote: vi.fn().mockResolvedValue({ data: {} }),
}))

vi.mock('@/components/ui/b', async () => {
  return {
    Panel: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="panel">{children}</div>
    ),
    PanelHeader: ({ title, meta }: { title: string; meta?: string }) => (
      <div data-testid="panel-header">
        <span>{title}</span>
        {meta && <span>{meta}</span>}
      </div>
    ),
  }
})

function makeNote(overrides: Partial<CompanyNoteWithAuthor> = {}): CompanyNoteWithAuthor {
  return {
    id: 'note-1',
    content: 'Test notat indhold',
    pinned: false,
    created_at: new Date('2025-01-01T10:00:00'),
    author: { id: 'user-1', name: 'Philip', email: 'philip@test.dk' },
    ...overrides,
  }
}

describe('NotesSection', () => {
  it('renders panel header with title "Noter"', () => {
    render(<NotesSection companyId="c1" notes={[]} />)
    expect(screen.getByText('Noter')).toBeInTheDocument()
  })

  it('shows note count in header meta', () => {
    const notes = [makeNote(), makeNote({ id: 'note-2' })]
    render(<NotesSection companyId="c1" notes={notes} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders textarea input when not readOnly', () => {
    render(<NotesSection companyId="c1" notes={[]} />)
    expect(screen.getByPlaceholderText('Skriv et notat...')).toBeInTheDocument()
  })

  it('does not render textarea when readOnly', () => {
    render(<NotesSection companyId="c1" notes={[]} readOnly />)
    expect(screen.queryByPlaceholderText('Skriv et notat...')).not.toBeInTheDocument()
  })

  it('renders add note button', () => {
    render(<NotesSection companyId="c1" notes={[]} />)
    expect(screen.getByRole('button', { name: 'Tilføj notat' })).toBeInTheDocument()
  })

  it('disables add button when textarea is empty', () => {
    render(<NotesSection companyId="c1" notes={[]} />)
    expect(screen.getByRole('button', { name: 'Tilføj notat' })).toBeDisabled()
  })

  it('enables add button when textarea has content', () => {
    render(<NotesSection companyId="c1" notes={[]} />)
    fireEvent.change(screen.getByPlaceholderText('Skriv et notat...'), {
      target: { value: 'Ny notat tekst' },
    })
    expect(screen.getByRole('button', { name: 'Tilføj notat' })).not.toBeDisabled()
  })

  it('renders existing notes', () => {
    const notes = [makeNote({ content: 'Eksisterende notat' })]
    render(<NotesSection companyId="c1" notes={notes} />)
    expect(screen.getByText('Eksisterende notat')).toBeInTheDocument()
  })

  it('renders author name for note', () => {
    const notes = [
      makeNote({ author: { id: 'user-2', name: 'Maria Jensen', email: 'maria@test.dk' } }),
    ]
    render(<NotesSection companyId="c1" notes={notes} />)
    expect(screen.getByText(/Maria Jensen/)).toBeInTheDocument()
  })

  it('renders pin and delete buttons for each note', () => {
    const notes = [makeNote()]
    render(<NotesSection companyId="c1" notes={notes} />)
    expect(screen.getByTitle('Fastgør')).toBeInTheDocument()
    expect(screen.getByTitle('Slet')).toBeInTheDocument()
  })

  it('does not render action buttons in readOnly mode', () => {
    const notes = [makeNote()]
    render(<NotesSection companyId="c1" notes={notes} readOnly />)
    expect(screen.queryByTitle('Fastgør')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Slet')).not.toBeInTheDocument()
  })

  it('shows "Ingen noter endnu" in readOnly mode with no notes', () => {
    render(<NotesSection companyId="c1" notes={[]} readOnly />)
    expect(screen.getByText('Ingen noter endnu')).toBeInTheDocument()
  })

  it('renders pinned note with amber styling', () => {
    const notes = [makeNote({ pinned: true })]
    const { container } = render(<NotesSection companyId="c1" notes={notes} />)
    expect(container.querySelector('.bg-amber-50')).toBeInTheDocument()
  })

  it('shows search input when more than 3 notes', () => {
    const notes = Array.from({ length: 4 }, (_, i) =>
      makeNote({ id: `note-${i}`, content: `Notat ${i}` })
    )
    render(<NotesSection companyId="c1" notes={notes} />)
    expect(screen.getByPlaceholderText('Søg i noter...')).toBeInTheDocument()
  })

  it('does not show search input when 3 or fewer notes', () => {
    const notes = [makeNote(), makeNote({ id: 'note-2' })]
    render(<NotesSection companyId="c1" notes={notes} />)
    expect(screen.queryByPlaceholderText('Søg i noter...')).not.toBeInTheDocument()
  })

  it('filters notes by search text', () => {
    const notes = Array.from({ length: 4 }, (_, i) =>
      makeNote({ id: `note-${i}`, content: i === 0 ? 'Unikt indhold her' : `Notat ${i}` })
    )
    render(<NotesSection companyId="c1" notes={notes} />)
    fireEvent.change(screen.getByPlaceholderText('Søg i noter...'), {
      target: { value: 'Unikt indhold' },
    })
    expect(screen.getByText('Unikt indhold her')).toBeInTheDocument()
    expect(screen.queryByText('Notat 1')).not.toBeInTheDocument()
  })
})
