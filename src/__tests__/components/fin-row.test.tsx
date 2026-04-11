import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinRow } from '@/components/ui/fin-row'

describe('FinRow', () => {
  it('renderer label og value', () => {
    render(<FinRow label="Omsætning" value="28.6M" />)
    expect(screen.getByText('Omsætning')).toBeInTheDocument()
    expect(screen.getByText('28.6M')).toBeInTheDocument()
  })

  it('anvender valueColor inline style', () => {
    render(<FinRow label="Forfaldne" value="340k" valueColor="#ef4444" />)
    const val = screen.getByText('340k')
    expect(val).toHaveStyle({ color: '#ef4444' })
  })

  it('viser trend med grøn baggrund for up', () => {
    render(<FinRow label="EBITDA" value="5.6M" trend={{ text: '+12%', direction: 'up' }} />)
    const trend = screen.getByText('+12%')
    expect(trend).toHaveClass('bg-green-50', 'text-green-600')
  })

  it('viser trend med rød baggrund for down', () => {
    render(<FinRow label="Margin" value="8.4%" trend={{ text: '-3%', direction: 'down' }} />)
    const trend = screen.getByText('-3%')
    expect(trend).toHaveClass('bg-red-50', 'text-red-600')
  })

  it('skjuler trend når ikke angivet', () => {
    render(<FinRow label="Lokationer" value="7" />)
    expect(screen.queryByText(/%/)).toBeNull()
  })
})
