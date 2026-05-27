import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Breadcrumb } from '@/components/ui/b/Breadcrumb'

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

describe('Breadcrumb', () => {
  it('renders the current page label', () => {
    render(<Breadcrumb trail={[]} current="Nuværende side" />)
    expect(screen.getByText('Nuværende side')).toBeInTheDocument()
  })

  it('renders trail links', () => {
    render(
      <Breadcrumb trail={[{ label: 'Kontrakter', href: '/contracts' }]} current="Lejekontrakt" />
    )
    expect(screen.getByRole('link', { name: 'Kontrakter' })).toHaveAttribute('href', '/contracts')
  })

  it('renders multiple trail steps', () => {
    render(
      <Breadcrumb
        trail={[
          { label: 'Selskaber', href: '/companies' },
          { label: 'Tandlæge ApS', href: '/companies/123' },
        ]}
        current="Kontrakter"
      />
    )
    expect(screen.getByRole('link', { name: 'Selskaber' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tandlæge ApS' })).toBeInTheDocument()
  })

  it('renders nav with aria-label Brødkrummer', () => {
    render(<Breadcrumb trail={[]} current="Test" />)
    expect(screen.getByRole('navigation', { name: 'Brødkrummer' })).toBeInTheDocument()
  })

  it('renders separator between trail and current', () => {
    render(<Breadcrumb trail={[{ label: 'Hjem', href: '/' }]} current="Nuværende" />)
    expect(screen.getByText('›')).toBeInTheDocument()
  })

  it('renders current as ReactNode (not just string)', () => {
    render(
      <Breadcrumb
        trail={[]}
        current={<strong data-testid="current-node">Fremhævet titel</strong>}
      />
    )
    expect(screen.getByTestId('current-node')).toBeInTheDocument()
  })
})
