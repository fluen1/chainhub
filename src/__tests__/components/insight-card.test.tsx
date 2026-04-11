import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InsightCard } from '@/components/ui/insight-card'
import type { Insight } from '@/types/ui'

const sample: Insight = {
  id: 'i1',
  type: 'critical',
  icon: 'AlertTriangle',
  title: 'Ejeraftale mangler',
  description: 'Nordklinik ApS har ingen ejeraftale registreret',
  actionLabel: 'Opret nu',
  actionHref: '/contracts/new',
}

describe('InsightCard', () => {
  it('viser title, description og action-label', () => {
    render(<InsightCard insight={sample} />)
    expect(screen.getByText('Ejeraftale mangler')).toBeInTheDocument()
    expect(screen.getByText(/Nordklinik ApS/)).toBeInTheDocument()
    expect(screen.getByText('Opret nu')).toBeInTheDocument()
  })

  it('link peger på actionHref', () => {
    render(<InsightCard insight={sample} />)
    const link = screen.getByRole('link', { name: /Opret nu/ })
    expect(link).toHaveAttribute('href', '/contracts/new')
  })

  it('bruger rød venstre-border ved type=critical', () => {
    const { container } = render(<InsightCard insight={sample} />)
    expect(container.querySelector('.border-red-500')).not.toBeNull()
  })

  it('bruger amber border ved type=warning', () => {
    const warning: Insight = { ...sample, type: 'warning' }
    const { container } = render(<InsightCard insight={warning} />)
    expect(container.querySelector('.border-amber-500')).not.toBeNull()
  })

  it('fjernes fra DOM når luk-knap klikkes', () => {
    render(<InsightCard insight={sample} />)
    fireEvent.click(screen.getByRole('button', { name: 'Afvis' }))
    expect(screen.queryByText('Ejeraftale mangler')).toBeNull()
  })
})
