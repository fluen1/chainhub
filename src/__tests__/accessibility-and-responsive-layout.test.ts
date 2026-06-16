/**
 * Phase I+J — Mobile + A11y WCAG 2.2 AA fixes (2026-05-15)
 *
 * Statiske og funktionelle tests for:
 * 1. BModal: useId til titleId + <h2> titel + max-w mobile
 * 2. BField: useId + htmlFor + aria-required + aria-invalid + aria-describedby + role=alert
 * 3. FilterRow: flex-wrap
 * 4. DataTable: overflow-x-auto + TableInner min-w
 * 5. b-shell: hamburger 44px
 * 6. globals.css: prefers-reduced-motion + text-b-2 kontrast
 * 7. ContractStatusButton: aria-expanded + aria-haspopup + role=listbox/option + keyboard
 * 8. tasks-list-b: aria-grabbed → aria-selected
 * 9. DeleteDocumentButton: text-slate-400 → text-slate-600
 * 10. heatmap-grid: aria-label på celler
 * 11. calendar-b: prev/next tap-target
 * 12. review-client: grid breakpoint mobil
 */

import * as fs from 'fs'
import { describe, it, expect } from 'vitest'

function read(relativePath: string): string {
  return fs.readFileSync(`${process.cwd()}/${relativePath}`, 'utf-8')
}

// ────────────────────────────────────────────────────────────────────────────
// Fix 1: BModal useId + <h2>
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 1: BModal a11y fixes', () => {
  const src = read('src/components/ui/b/BModal.tsx')

  it('importerer useId fra react', () => {
    expect(src).toContain("import { useEffect, useId, useRef } from 'react'")
  })

  it('bruger useId() til at generere titleId', () => {
    expect(src).toContain('const generatedId = useId()')
    expect(src).toContain('const titleId = titleIdProp ?? generatedId')
  })

  it('titel renderes som <h2> i stedet for <div>', () => {
    expect(src).toContain('<h2 id={titleId}')
    expect(src).not.toContain('<div id={titleId}')
  })

  it('dialog-container har max-w-[calc(100vw-16px)] for mobilresponsivitet', () => {
    expect(src).toContain('max-w-[calc(100vw-16px)]')
  })

  it('dialog-container har w-full klasse', () => {
    expect(src).toContain('className="w-full overflow-hidden')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 2: BField useId + htmlFor + ARIA
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 2: BField a11y fixes', () => {
  const src = read('src/components/ui/b/BField.tsx')

  it('importerer useId fra react', () => {
    expect(src).toContain("import React, { useId } from 'react'")
  })

  it('genererer inputId via useId()', () => {
    expect(src).toContain('const generatedId = useId()')
    expect(src).toContain('const inputId = inputIdProp ?? generatedId')
  })

  it('label har htmlFor={inputId}', () => {
    expect(src).toContain('htmlFor={inputId}')
  })

  it('errorId er afledt af inputId', () => {
    expect(src).toContain('const errorId = `${inputId}-error`')
  })

  it('fejlbesked har id={errorId} og role=alert', () => {
    expect(src).toContain('id={errorId}')
    expect(src).toContain('role="alert"')
  })

  it('child klones med aria-required ved required=true', () => {
    expect(src).toContain("'aria-required': true")
  })

  it('child klones med aria-invalid og aria-describedby ved error', () => {
    expect(src).toContain("'aria-invalid': true")
    expect(src).toContain("'aria-describedby': errorId")
  })

  it('bruger React.cloneElement til at injicere attributter', () => {
    expect(src).toContain('React.cloneElement(child,')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 3: FilterRow flex-wrap
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 3: FilterRow flex-wrap', () => {
  const src = read('src/components/ui/b/FilterRow.tsx')

  it('bruger flex-wrap i stedet for flex-nowrap', () => {
    expect(src).toContain('flex-wrap')
    expect(src).not.toContain('flex-nowrap')
  })

  it('har gap-y-1.5 for vertikal wrapping spacing', () => {
    expect(src).toContain('gap-y-1.5')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 4: DataTable overflow-x-auto + TableInner
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 4: DataTable mobil scroll', () => {
  const src = read('src/components/ui/b/DataTable.tsx')

  it('TableWrap bruger overflow-x-auto i stedet for overflow-hidden', () => {
    expect(src).toContain('overflow-x-auto')
    // Kun det der er specifikt ændret (TableWrap container)
    expect(src).not.toMatch(/overflow-hidden rounded-\[4px\] border border-b-border bg-b-panel/)
  })

  it('eksporterer TableInner med min-w-[600px]', () => {
    expect(src).toContain('export function TableInner')
    expect(src).toContain('min-w-[600px]')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 5: b-shell hamburger 44px
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 5: b-shell hamburger tap-target 44px', () => {
  const src = read('src/components/layout/b-shell.tsx')

  it('hamburger-knap har h-11 w-11 klasse på mobile', () => {
    expect(src).toContain('h-11 w-11')
  })

  it('desktop-størrelse er stadig h-8 w-8', () => {
    expect(src).toContain('md:h-8 md:w-8')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 6: globals.css prefers-reduced-motion + text-b-2 kontrast
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 6: globals.css tilgængelighed', () => {
  const src = read('src/app/globals.css')

  it('har prefers-reduced-motion media query', () => {
    expect(src).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('sætter animation-duration til 0.01ms ved reduced motion', () => {
    expect(src).toContain('animation-duration: 0.01ms !important')
  })

  it('sætter transition-duration til 0.01ms ved reduced motion', () => {
    expect(src).toContain('transition-duration: 0.01ms !important')
  })

  it('text-b-2 har tilstrækkelig kontrast (ikke #6e7681)', () => {
    // Den originale #6e7681 er ~3:1 på hvid — utilstrækkelig.
    // Den nye farve skal være mørkere.
    expect(src).not.toContain('--b-text-2:       #6e7681')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 7: ContractStatusButton keyboard nav + ARIA
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 7: ContractStatusButton a11y', () => {
  const src = read('src/components/contracts/ContractStatusButton.tsx')

  it('trigger-button har aria-expanded', () => {
    expect(src).toContain('aria-expanded={open}')
  })

  it('trigger-button har aria-haspopup="listbox"', () => {
    expect(src).toContain('aria-haspopup="listbox"')
  })

  it('dropdown-container har role="listbox"', () => {
    expect(src).toContain('role="listbox"')
  })

  it('menu-items har role="option"', () => {
    expect(src).toContain('role="option"')
  })

  it('Escape lukker dropdown', () => {
    expect(src).toContain("e.key === 'Escape'")
  })

  it('ArrowDown/Up navigerer items', () => {
    expect(src).toContain("'ArrowDown'")
    expect(src).toContain("'ArrowUp'")
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 8: tasks-list-b aria-grabbed → aria-pressed (ARIA 1.2 kompatibelt på <button>)
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 8: tasks-list-b ARIA 1.2 pattern', () => {
  // Kanban-koden er udtrukket til TasksKanban.tsx (refactor: god-fil split)
  const src = read('src/components/tasks/TasksKanban.tsx')

  it('bruger aria-pressed i stedet for aria-grabbed (gyldig på <button>)', () => {
    expect(src).toContain('aria-pressed={isGrabbed}')
    expect(src).not.toContain('aria-grabbed={isGrabbed}')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 9: DeleteDocumentButton kontrast-fix
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 9: DeleteDocumentButton kontrast', () => {
  const src = read('src/components/documents/DeleteDocumentButton.tsx')

  it('bruger text-slate-600 i stedet for text-slate-400 (for kontrast)', () => {
    // text-slate-400 er for lys (#94a3b8, ~2.6:1 på hvid)
    expect(src).not.toContain('text-slate-400')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 10: heatmap-grid aria-label på celler
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 10: heatmap-grid aria-label', () => {
  const src = read('src/components/dashboard/heatmap-grid.tsx')

  it('celler har aria-label med selskabsnavn og status', () => {
    expect(src).toContain('aria-label=')
  })

  it('aria-label indeholder c.name eller c.healthStatus', () => {
    // Tjek at aria-label er dynamisk (bruger variabel)
    expect(src).toMatch(/aria-label=\{.*c\.(name|healthStatus)/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 11: calendar-b prev/next tap-target
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 11: calendar-b tap-target', () => {
  const src = read('src/app/(dashboard)/calendar/calendar-b.tsx')

  it('prev/next-knapper har responsivt padding til 44px touch-target', () => {
    expect(src).toContain('py-2 md:py-0.5')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 12: review-client grid breakpoint
// ────────────────────────────────────────────────────────────────────────────
describe('Fix 12: review-client grid breakpoint', () => {
  const src = read('src/app/(dashboard)/documents/review/[id]/review-client.tsx')

  it('split-layout stacker på mobil og viser side-om-side på lg+', () => {
    expect(src).toContain('grid-cols-1 lg:grid-cols-[1.6fr_1fr]')
  })

  it('bruger ikke den gamle statiske grid-cols-[1.6fr_1fr] uden breakpoint', () => {
    expect(src).not.toMatch(/grid grid-cols-\[1\.6fr_1fr\](?!\s*gap)/)
  })
})
