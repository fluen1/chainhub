import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoverageBar } from '@/components/ui/coverage-bar'

describe('CoverageBar', () => {
  it('renderer label og procent', () => {
    render(<CoverageBar label="Ejeraftale" percentage={85} />)
    expect(screen.getByText('Ejeraftale')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('bruger grøn farve ved 100%', () => {
    const { container } = render(<CoverageBar label="Fuld dækning" percentage={100} />)
    const fill = container.querySelector('.bg-green-500')
    expect(fill).not.toBeNull()
  })

  it('bruger blå farve ved 75-99%', () => {
    const { container } = render(<CoverageBar label="Delvis" percentage={80} />)
    expect(container.querySelector('.bg-blue-500')).not.toBeNull()
  })

  it('bruger amber farve under 75%', () => {
    const { container } = render(<CoverageBar label="Lav" percentage={40} />)
    expect(container.querySelector('.bg-amber-500')).not.toBeNull()
  })

  it('sætter width inline style på fill-div', () => {
    const { container } = render(<CoverageBar label="Test" percentage={42} />)
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('42%')
  })
})
