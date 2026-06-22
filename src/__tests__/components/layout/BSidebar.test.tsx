import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BSidebar } from '@/components/layout/b-sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'aria-current': ariaCurrent,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-current'?: string | undefined
  }) => (
    <a
      href={href}
      className={className}
      aria-current={ariaCurrent as React.AriaAttributes['aria-current']}
    >
      {children}
    </a>
  ),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Philip Birkenborg', email: 'philip@chainhub.dk' } },
    status: 'authenticated',
  }),
  signOut: vi.fn(),
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

describe('BSidebar', () => {
  const defaultBadges = {}

  it('renders navigation landmark', () => {
    render(<BSidebar badges={defaultBadges} />)
    expect(screen.getByRole('navigation', { name: 'Hovednavigation' })).toBeInTheDocument()
  })

  it('renders all section labels', () => {
    render(<BSidebar badges={defaultBadges} />)
    expect(screen.getByText('Overblik')).toBeInTheDocument()
    expect(screen.getByText('Portefølje')).toBeInTheDocument()
    expect(screen.getByText('Ressourcer')).toBeInTheDocument()
  })

  it('renders nav links for all routes', () => {
    render(<BSidebar badges={defaultBadges} />)
    expect(screen.getByRole('link', { name: 'Forside' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Selskaber' })).toHaveAttribute('href', '/companies')
    expect(screen.getByRole('link', { name: 'Kontrakter' })).toHaveAttribute('href', '/contracts')
    expect(screen.getByRole('link', { name: 'Sager' })).toHaveAttribute('href', '/cases')
    expect(screen.getByRole('link', { name: 'Opgaver' })).toHaveAttribute('href', '/tasks')
    expect(screen.getByRole('link', { name: 'Dokumenter' })).toHaveAttribute('href', '/documents')
    expect(screen.getByRole('link', { name: 'Personer' })).toHaveAttribute('href', '/persons')
    expect(screen.getByRole('link', { name: 'Indstillinger' })).toHaveAttribute('href', '/settings')
  })

  it('marks active link with aria-current=page', () => {
    render(<BSidebar badges={defaultBadges} />)
    // usePathname returns '/dashboard', so Forside should be active
    expect(screen.getByRole('link', { name: 'Forside' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark inactive links with aria-current', () => {
    render(<BSidebar badges={defaultBadges} />)
    expect(screen.getByRole('link', { name: 'Selskaber' })).not.toHaveAttribute('aria-current')
  })

  it('renders badge count when badge has count > 0', () => {
    render(<BSidebar badges={{ contracts: { count: 12, urgency: 'neutral' } }} />)
    expect(screen.getByLabelText('12 kontrakter')).toBeInTheDocument()
  })

  it('renders critical badge count in red', () => {
    const { container } = render(
      <BSidebar badges={{ contracts: { count: 3, urgency: 'critical' } }} />
    )
    expect(container.querySelector('.text-\\[\\#b91c1c\\]')).toBeInTheDocument()
  })

  it('does not render badge when count is 0', () => {
    render(<BSidebar badges={{ contracts: { count: 0, urgency: 'neutral' } }} />)
    expect(screen.queryByLabelText(/kontrakter/)).not.toBeInTheDocument()
  })

  it('renders user name in account section', () => {
    render(<BSidebar badges={defaultBadges} />)
    expect(screen.getByText('Philip Birkenborg')).toBeInTheDocument()
  })

  it('renders log out button', () => {
    render(<BSidebar badges={defaultBadges} />)
    expect(screen.getByRole('button', { name: /log ud/i })).toBeInTheDocument()
  })

  it('renders chat toggle when onChatOpen is provided', () => {
    const onChatOpen = vi.fn()
    render(<BSidebar badges={defaultBadges} onChatOpen={onChatOpen} />)
    expect(screen.getByLabelText('Åbn AI-assistent')).toBeInTheDocument()
  })

  it('calls onChatOpen when chat toggle is clicked', () => {
    const onChatOpen = vi.fn()
    render(<BSidebar badges={defaultBadges} onChatOpen={onChatOpen} />)
    fireEvent.click(screen.getByLabelText('Åbn AI-assistent'))
    expect(onChatOpen).toHaveBeenCalled()
  })

  // ─── Rolle-gating (UX-review #10) ───────────────────────────────────────────
  describe('rolle-gating af modul-links', () => {
    it('GROUP_FINANCE ser IKKE Kontrakter/Sager — heller ikke deres badge-tal', () => {
      render(
        <BSidebar
          badges={{
            contracts: { count: 18, urgency: 'neutral' },
            cases: { count: 4, urgency: 'neutral' },
          }}
          userRole="GROUP_FINANCE"
        />
      )
      expect(screen.queryByRole('link', { name: 'Kontrakter' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Sager' })).not.toBeInTheDocument()
      // Badge-tallene må heller ikke lække for moduler rollen ikke kan åbne.
      expect(screen.queryByLabelText('18 kontrakter')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('4 sager')).not.toBeInTheDocument()
      // Finance beholder Selskaber, Dokumenter, Personer, Opgaver.
      expect(screen.getByRole('link', { name: 'Selskaber' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Dokumenter' })).toBeInTheDocument()
    })

    it('GROUP_OWNER ser alle modul-links', () => {
      render(<BSidebar badges={defaultBadges} userRole="GROUP_OWNER" />)
      expect(screen.getByRole('link', { name: 'Kontrakter' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Sager' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Selskaber' })).toBeInTheDocument()
    })
  })
})
