import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UrgencyList } from '@/components/ui/urgency-list'
import type { UrgencyItem } from '@/types/ui'

const items: UrgencyItem[] = [
  { id: 'u1', name: 'Ejeraftale Nordklinik', subtitle: 'Nordklinik ApS', days: '3d over', indicator: 'red', overdue: true },
  { id: 'u2', name: 'Huslejekontrakt Sundby', subtitle: 'Sundby Dental', days: '14 dage', indicator: 'amber' },
]

describe('UrgencyList', () => {
  it('renderer title', () => {
    render(<UrgencyList title="Kræver handling" items={items} />)
    expect(screen.getByText('Kræver handling')).toBeInTheDocument()
  })

  it('renderer alle items', () => {
    render(<UrgencyList title="Test" items={items} />)
    expect(screen.getByText('Ejeraftale Nordklinik')).toBeInTheDocument()
    expect(screen.getByText('Huslejekontrakt Sundby')).toBeInTheDocument()
  })

  it('overdue items har rød tekst på days', () => {
    render(<UrgencyList title="Test" items={items} />)
    const days = screen.getByText('3d over')
    expect(days).toHaveClass('text-red-600')
  })

  it('viser viewAllHref link når angivet', () => {
    render(<UrgencyList title="Test" items={items} viewAllHref="/tasks" />)
    const link = screen.getByRole('link', { name: /Se alle/ })
    expect(link).toHaveAttribute('href', '/tasks')
  })

  it('viser tom-state når items er tomme', () => {
    render(<UrgencyList title="Tom liste" items={[]} />)
    expect(screen.getByText('Ingen punkter')).toBeInTheDocument()
  })
})
