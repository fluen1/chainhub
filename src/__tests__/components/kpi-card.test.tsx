import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KpiCard } from '@/components/ui/kpi-card'

describe('KpiCard', () => {
  it('renderer label og value', () => {
    render(<KpiCard label="Selskaber" value={7} />)
    expect(screen.getByText('Selskaber')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('bruger amber farve ved valueColor=warning', () => {
    render(<KpiCard label="Udløbende" value="3" valueColor="warning" />)
    expect(screen.getByText('3')).toHaveClass('text-amber-600')
  })

  it('bruger rød farve ved valueColor=danger', () => {
    render(<KpiCard label="Forfaldne" value="12" valueColor="danger" />)
    expect(screen.getByText('12')).toHaveClass('text-red-600')
  })

  it('kalder onClick når kortet klikkes', () => {
    const handleClick = vi.fn()
    render(<KpiCard label="Klik mig" value="42" onClick={handleClick} />)
    fireEvent.click(screen.getByText('42'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('viser trend-badge med korrekt farve', () => {
    render(<KpiCard label="Omsætning" value="28M" trend={{ text: '+8%', direction: 'up' }} />)
    expect(screen.getByText('+8%')).toHaveClass('bg-green-50')
  })
})
