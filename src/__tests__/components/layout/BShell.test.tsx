import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BShell } from '@/components/layout/b-shell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/layout/b-sidebar', () => ({
  BSidebar: ({ badges }: { badges: Record<string, unknown> }) => (
    <nav data-testid="sidebar">Sidebar</nav>
  ),
}))

vi.mock('@/components/ui/b', () => ({
  BrandMark: ({ withText }: { withText?: boolean }) => (
    <span data-testid="brandmark">{withText ? 'ChainHub' : '🔗'}</span>
  ),
}))

vi.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: ({ count }: { count: number }) => (
    <button aria-label={`${count} notifikationer`}>{count}</button>
  ),
}))

vi.mock('@/components/layout/ChatToggle', () => ({
  ChatToggle: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} aria-label="Åbn AI-assistent">
      AI
    </button>
  ),
}))

// ChatPanel er dynamically imported, mock det
vi.mock('next/dynamic', () => ({
  default: (fn: () => Promise<{ default: React.ComponentType }>) => {
    return function MockDynamic(props: Record<string, unknown>) {
      return null
    }
  },
}))

describe('BShell', () => {
  const defaultProps = {
    badges: {},
    children: <div data-testid="page-content">Sideindhold</div>,
  }

  it('renders children in main content area', () => {
    render(<BShell {...defaultProps} />)
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
  })

  it('renders main element with id main-content', () => {
    render(<BShell {...defaultProps} />)
    expect(document.getElementById('main-content')).toBeInTheDocument()
  })

  it('renders desktop sidebar', () => {
    render(<BShell {...defaultProps} />)
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('renders mobile hamburger button', () => {
    render(<BShell {...defaultProps} />)
    expect(screen.getByLabelText('Åbn hovedmenu')).toBeInTheDocument()
  })

  it('opens mobile drawer when hamburger is clicked', () => {
    render(<BShell {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Åbn hovedmenu'))
    expect(screen.getByRole('dialog', { name: 'Hovedmenu' })).toBeInTheDocument()
  })

  it('closes mobile drawer when Escape is pressed', () => {
    render(<BShell {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Åbn hovedmenu'))
    expect(screen.getByRole('dialog', { name: 'Hovedmenu' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Hovedmenu' })).not.toBeInTheDocument()
  })

  it('closes mobile drawer when backdrop is clicked', () => {
    render(<BShell {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Åbn hovedmenu'))
    fireEvent.click(screen.getByLabelText('Luk menu'))
    expect(screen.queryByRole('dialog', { name: 'Hovedmenu' })).not.toBeInTheDocument()
  })

  it('renders notification bell with alert count', () => {
    render(<BShell {...defaultProps} alertCount={5} />)
    // NotificationBell renders with count, look for the label
    expect(screen.getAllByLabelText('5 notifikationer').length).toBeGreaterThan(0)
  })
})
