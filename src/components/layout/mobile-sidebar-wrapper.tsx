'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AppHeader } from './app-header'
import { AppSidebar } from './app-sidebar'
import type { InlineKpi, SidebarBadge } from '@/types/ui'

interface Props {
  userName: string
  userRoleLabel: string
  badges: Record<string, SidebarBadge | null>
  kpis: InlineKpi[]
  currentDate: Date
  children: React.ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Wrapper som renderer AppHeader + AppSidebar og håndterer mobile drawer-state.
 *
 * - Desktop (lg+): AppSidebar er altid synlig, uændret opførsel.
 * - Mobile (<lg): AppSidebar er skjult bag hamburger-knap i header.
 *   Drawer har aria-modal, focus-trap, Escape-close, backdrop-close,
 *   focus-restore og auto-close ved route-skift.
 */
export function MobileSidebarWrapper({
  userName,
  userRoleLabel,
  badges,
  kpis,
  currentDate,
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const drawerRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Auto-close ved route-skift
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Escape + body scroll-lock
  useEffect(() => {
    if (!drawerOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', handler)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = prevOverflow
    }
  }, [drawerOpen])

  // Focus-trap + focus-restore
  useEffect(() => {
    if (!drawerOpen) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    // Flyt focus til første fokusérbare element i drawer
    const first = drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)[0]
    first?.focus()

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !drawerRef.current) return
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusables.length === 0) return
      const firstEl = focusables[0]!
      const lastEl = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      previouslyFocused.current?.focus()
    }
  }, [drawerOpen])

  return (
    <>
      {/* Desktop sidebar (lg+) */}
      <div className="hidden lg:flex h-full">
        <AppSidebar userName={userName} userRoleLabel={userRoleLabel} badges={badges} />
      </div>

      {/* Mobile drawer + backdrop (<lg) — kun renderes når åben for at undgå
          dobbelt-sidebar i DOM på desktop */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- Escape håndteres via document keydown; backdrop-klik via role=button */}
          <div
            role="button"
            tabIndex={-1}
            aria-label="Luk menu"
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Hovedmenu"
            className="lg:hidden fixed inset-y-0 left-0 z-50 shadow-xl transition-transform duration-200 translate-x-0"
          >
            <AppSidebar userName={userName} userRoleLabel={userRoleLabel} badges={badges} />
          </div>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          userName={userName}
          kpis={kpis}
          currentDate={currentDate}
          onOpenMobileSidebar={() => setDrawerOpen(true)}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-[#f0f2f5] px-4 sm:px-6 lg:px-8 py-6"
        >
          {children}
        </main>
      </div>
    </>
  )
}
