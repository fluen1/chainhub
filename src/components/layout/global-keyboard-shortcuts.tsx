'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Lytter på ⌘K (mac) / Ctrl+K (windows) og navigerer til /search.
// Ignorerer hvis fokus allerede er i et input — så genvejen ikke
// stjæler søgning der allerede sker lokalt på siden.
export function GlobalKeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const active = document.activeElement
        const tag = active?.tagName?.toLowerCase()
        const isEditable =
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          (active as HTMLElement | null)?.isContentEditable
        if (isEditable) return
        e.preventDefault()
        router.push('/search')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

  return null
}
