'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { BSidebar } from './b-sidebar'
import type { SidebarBadge } from '@/types/ui'

// ────────────────────────────────────────────────────────────────────────────
// BShell — den nye B-stil app-shell.
//
// Forskelle fra det gamle MobileSidebarWrapper:
//   • Ingen global AppHeader på desktop — pages renderer deres egen topbar.
//   • Lys sidebar (#f6f7f9) i stedet for mørk slate-900.
//   • Mobile-drawer beholder samme accessibility (Escape, focus-trap,
//     focus-restore, route-skift-close, body scroll-lock).
//   • Mobile-toolbar = minimal hamburger + brand. Ingen KPIs eller søg.
//
// KPIs/strip-data ligger nu i selve siden (typisk via <Strip />).
// ────────────────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  badges: Record<string, SidebarBadge | null>
  children: React.ReactNode
}

export function BShell({ badges, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const drawerRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

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

  useEffect(() => {
    if (!drawerOpen) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

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
    <div className="flex min-h-screen bg-b-canvas text-b-1">
      {/* Desktop sidebar (lg+) */}
      <div className="hidden lg:block print-hide">
        <BSidebar badges={badges} />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- Escape håndteres via document keydown; backdrop-klik via role=button */}
          <div
            role="button"
            tabIndex={-1}
            aria-label="Luk menu"
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Hovedmenu"
            className="lg:hidden fixed inset-y-0 left-0 z-50 shadow-xl"
          >
            <BSidebar badges={badges} />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-toolbar — minimal hamburger + brand (kun <lg) */}
        <div className="lg:hidden flex h-12 items-center gap-3 border-b border-b-border bg-b-panel px-3 print-hide">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-b-border-strong bg-white text-b-2 hover:bg-b-row-hover"
            aria-label="Åbn hovedmenu"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-[13px] font-semibold text-b-1">▣ ChainHub</span>
        </div>

        <main
          id="main-content"
          className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-3.5"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
