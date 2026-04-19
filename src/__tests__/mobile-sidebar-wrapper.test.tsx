// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileSidebarWrapper } from '@/components/layout/mobile-sidebar-wrapper'

// Mock pathname (stabil, så auto-close ved route-skift ikke trigges utilsigtet)
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

// Mock AppHeader + AppSidebar for at isolere wrapper-logikken
vi.mock('@/components/layout/app-header', () => ({
  AppHeader: ({ onOpenMobileSidebar }: { onOpenMobileSidebar?: () => void }) => (
    <button type="button" onClick={onOpenMobileSidebar} aria-label="Åbn hovedmenu">
      menu
    </button>
  ),
}))

vi.mock('@/components/layout/app-sidebar', () => ({
  AppSidebar: () => (
    <nav aria-label="Sidebar">
      <a href="/dashboard">dashboard</a>
    </nav>
  ),
}))

const baseProps = {
  userName: 'Test Bruger',
  userRoleLabel: 'Admin',
  badges: {},
  kpis: [],
  currentDate: new Date('2026-04-18T10:00:00Z'),
}

describe('MobileSidebarWrapper', () => {
  it('viser hamburger + content som udgangspunkt (ingen drawer i DOM)', () => {
    render(<MobileSidebarWrapper {...baseProps}>content</MobileSidebarWrapper>)
    expect(screen.getByText('content')).toBeDefined()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('åbner drawer når hamburger klikkes', () => {
    render(<MobileSidebarWrapper {...baseProps}>content</MobileSidebarWrapper>)
    fireEvent.click(screen.getByLabelText('Åbn hovedmenu'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Hovedmenu')
  })

  it('lukker drawer ved Escape', () => {
    render(<MobileSidebarWrapper {...baseProps}>content</MobileSidebarWrapper>)
    fireEvent.click(screen.getByLabelText('Åbn hovedmenu'))
    expect(screen.getByRole('dialog')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lukker drawer ved klik på backdrop', () => {
    render(<MobileSidebarWrapper {...baseProps}>content</MobileSidebarWrapper>)
    fireEvent.click(screen.getByLabelText('Åbn hovedmenu'))
    fireEvent.click(screen.getByLabelText('Luk menu'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
