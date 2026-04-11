import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimelineSection } from '@/components/dashboard/timeline-section'
import type { TimelineSectionData } from '@/actions/dashboard'

const section: TimelineSectionData = {
  id: 'overdue',
  label: 'Overskredet',
  dotType: 'overdue',
  items: [
    { id: 't1', letter: 'N', color: 'red', title: 'Ejeraftale Nordklinik', subtitle: 'Nordklinik · 3d over', time: '3d over', href: '/contracts/c1' },
    { id: 't2', letter: 'S', color: 'purple', title: 'Dokument', subtitle: 'Sundby · AI', aiExtracted: true, time: 'Ny', href: '/documents' },
  ],
}

describe('TimelineSection', () => {
  it('viser sektion-label', () => {
    render(<TimelineSection section={section} />)
    expect(screen.getByText('Overskredet')).toBeInTheDocument()
  })

  it('viser alle items', () => {
    render(<TimelineSection section={section} />)
    expect(screen.getByText('Ejeraftale Nordklinik')).toBeInTheDocument()
    expect(screen.getByText('Dokument')).toBeInTheDocument()
  })

  it('viser AI-badge for aiExtracted items', () => {
    render(<TimelineSection section={section} />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('links peger på item.href', () => {
    render(<TimelineSection section={section} />)
    const link = screen.getByRole('link', { name: /Ejeraftale Nordklinik/ })
    expect(link).toHaveAttribute('href', '/contracts/c1')
  })

  it('returnerer null for tom sektion', () => {
    const empty: TimelineSectionData = { ...section, items: [] }
    const { container } = render(<TimelineSection section={empty} />)
    expect(container.firstChild).toBeNull()
  })
})
