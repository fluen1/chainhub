import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthBar } from '@/components/ui/health-bar'

describe('HealthBar', () => {
  it('viser alle tre tal med danske labels', () => {
    render(<HealthBar healthy={5} warning={2} critical={1} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Sund')).toBeInTheDocument()
    expect(screen.getByText('Advarsel')).toBeInTheDocument()
    expect(screen.getByText('Kritisk')).toBeInTheDocument()
  })

  it('sætter flex-ratio på segment-bars', () => {
    const { container } = render(<HealthBar healthy={10} warning={3} critical={2} />)
    const segments = container.querySelectorAll('.h-2 > div')
    expect(segments).toHaveLength(3)
    expect((segments[0] as HTMLElement).style.flex).toBe('10 1 0%')
    expect((segments[1] as HTMLElement).style.flex).toBe('3 1 0%')
    expect((segments[2] as HTMLElement).style.flex).toBe('2 1 0%')
  })

  it('håndterer nul-værdier', () => {
    render(<HealthBar healthy={0} warning={0} critical={0} />)
    const zeros = screen.getAllByText('0')
    expect(zeros).toHaveLength(3)
  })

  it('viser en neutral grå bar når alle værdier er 0', () => {
    const { container } = render(<HealthBar healthy={0} warning={0} critical={0} />)
    const barRow = container.querySelector('.h-2') as HTMLElement
    const segments = barRow.querySelectorAll(':scope > div')
    expect(segments).toHaveLength(1)
    expect(segments[0]).toHaveClass('bg-slate-100', 'flex-1')
  })
})
