import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Strip } from '@/components/ui/b/Strip'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

describe('Strip', () => {
  const basicCells = [
    { num: 12, label: 'Selskaber' },
    { num: 34, label: 'Kontrakter' },
    { num: 5, label: 'Sager' },
  ]

  it('renders all cells', () => {
    render(<Strip cells={basicCells} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Selskaber')).toBeInTheDocument()
    expect(screen.getByText('34')).toBeInTheDocument()
    expect(screen.getByText('Kontrakter')).toBeInTheDocument()
  })

  it('renders cells with href as anchor links', () => {
    render(<Strip cells={[{ num: 7, label: 'Kritiske', href: '/companies?urgency=critical' }]} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/companies?urgency=critical')
  })

  it('renders cells without href as divs (not links)', () => {
    render(<Strip cells={[{ num: 3, label: 'Uden link' }]} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('applies red color class for red tone', () => {
    const { container } = render(<Strip cells={[{ num: 5, label: 'Kritiske', color: 'red' }]} />)
    expect(container.querySelector('.text-b-red-fg')).toBeInTheDocument()
  })

  it('applies green color class for green tone', () => {
    const { container } = render(<Strip cells={[{ num: 10, label: 'Aktive', color: 'green' }]} />)
    expect(container.querySelector('.text-b-green-fg')).toBeInTheDocument()
  })

  it('applies grid with correct number of columns', () => {
    const { container } = render(<Strip cells={basicCells} />)
    const grid = container.firstChild as HTMLElement
    expect(grid.style.gridTemplateColumns).toContain('repeat(3')
  })

  it('renders ReactNode as num', () => {
    render(
      <Strip cells={[{ num: <strong data-testid="num-node">∞</strong>, label: 'Ubegrænset' }]} />
    )
    expect(screen.getByTestId('num-node')).toBeInTheDocument()
  })
})
