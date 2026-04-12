import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiInsightCard } from '@/components/company-detail/ai-insight-card'

describe('AiInsightCard', () => {
  it('renderer headline og body', () => {
    render(<AiInsightCard headlineMd="Vigtig anbefaling." bodyMd="Uddybende forklaring." />)
    expect(screen.getByText(/Vigtig anbefaling/)).toBeInTheDocument()
    expect(screen.getByText(/Uddybende forklaring/)).toBeInTheDocument()
  })

  it('konverterer **bold** til <strong>', () => {
    const { container } = render(
      <AiInsightCard headlineMd="**Ejeraftalen** boer prioriteres." bodyMd="resten." />
    )
    const strong = container.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong!.textContent).toBe('Ejeraftalen')
  })

  it('viser AI-ikonet', () => {
    render(<AiInsightCard headlineMd="h" bodyMd="b" />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('haandterer tekst uden bold', () => {
    render(<AiInsightCard headlineMd="Ingen bold her" bodyMd="heller ikke her" />)
    expect(screen.getByText(/Ingen bold her/)).toBeInTheDocument()
  })
})
