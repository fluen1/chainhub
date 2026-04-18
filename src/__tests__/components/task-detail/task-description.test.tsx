import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskDescription } from '@/components/task-detail/task-description'

describe('TaskDescription', () => {
  it('viser beskrivelsen', () => {
    render(<TaskDescription description="Kontrakten skal genforhandles inden d. 1. juni." />)
    expect(
      screen.getByText('Kontrakten skal genforhandles inden d. 1. juni.')
    ).toBeInTheDocument()
  })

  it('viser tom-state naar description er null', () => {
    render(<TaskDescription description={null} />)
    expect(screen.getByText('Ingen beskrivelse tilføjet')).toBeInTheDocument()
  })

  it('bevarer linjeskift i lange beskrivelser', () => {
    const text = 'Linje 1\nLinje 2'
    render(<TaskDescription description={text} />)
    const p = screen.getByText(/Linje 1/)
    expect(p).toHaveClass('whitespace-pre-wrap')
  })
})
