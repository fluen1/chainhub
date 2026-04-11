import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import type { SidebarBadge } from '@/types/ui'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

const emptyBadges: Record<string, SidebarBadge | null> = {}

describe('AppSidebar', () => {
  it('viser ChainHub logo og sektioner', () => {
    render(<AppSidebar userName="Philip Larsen" userRoleLabel="Kædeejer" badges={emptyBadges} />)
    expect(screen.getByText('ChainHub')).toBeInTheDocument()
    expect(screen.getByText('Overblik')).toBeInTheDocument()
    expect(screen.getByText('Portefølje')).toBeInTheDocument()
    expect(screen.getByText('Ressourcer')).toBeInTheDocument()
  })

  it('viser alle nav-items', () => {
    render(<AppSidebar userName="Test" userRoleLabel="Admin" badges={emptyBadges} />)
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /Kalender/ })).toHaveAttribute('href', '/calendar')
    expect(screen.getByRole('link', { name: /Selskaber/ })).toHaveAttribute('href', '/companies')
    expect(screen.getByRole('link', { name: /Kontrakter/ })).toHaveAttribute('href', '/contracts')
    expect(screen.getByRole('link', { name: /Sager/ })).toHaveAttribute('href', '/cases')
    expect(screen.getByRole('link', { name: /Opgaver/ })).toHaveAttribute('href', '/tasks')
    expect(screen.getByRole('link', { name: /Dokumenter/ })).toHaveAttribute('href', '/documents')
    expect(screen.getByRole('link', { name: /Personer/ })).toHaveAttribute('href', '/persons')
  })

  it('viser brugerens initialer, navn og rolle-label', () => {
    render(<AppSidebar userName="Philip Larsen" userRoleLabel="Kædeejer" badges={emptyBadges} />)
    expect(screen.getByText('PL')).toBeInTheDocument()
    expect(screen.getByText('Philip Larsen')).toBeInTheDocument()
    expect(screen.getByText('Kædeejer')).toBeInTheDocument()
  })

  it('viser badge med count når urgency=critical', () => {
    const badges = { tasks: { count: 5, urgency: 'critical' as const } }
    render(<AppSidebar userName="T" userRoleLabel="R" badges={badges} />)
    const badge = screen.getByText('5')
    expect(badge).toHaveClass('bg-red-500/[0.15]', 'text-red-400')
  })

  it('viser neutral badge når urgency=neutral', () => {
    const badges = { tasks: { count: 3, urgency: 'neutral' as const } }
    render(<AppSidebar userName="T" userRoleLabel="R" badges={badges} />)
    const badge = screen.getByText('3')
    expect(badge).toHaveClass('bg-white/[0.08]', 'text-slate-400')
  })

  it('skjuler badge når count er 0', () => {
    const badges = { tasks: { count: 0, urgency: 'neutral' as const } }
    render(<AppSidebar userName="T" userRoleLabel="R" badges={badges} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})
