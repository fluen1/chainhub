/**
 * Phase G — regression tests for 8 fixes (2026-05-14)
 *
 * 1. URL filter-state: alle 4 list-komponenter bruger useSearchParams (statisk)
 * 2. Calendar events har href-felt (type-test)
 * 3. Calendar action populerer href korrekt (statisk)
 * 4. Calendar-b bruger Link til events (statisk)
 * 5. /search/loading.tsx eksisterer
 * 6. Urgency-tasks linker til /tasks/[id] (dashboard-helpers)
 * 7. Strip-cells respekterer visibleSections (statisk)
 * 8. KbdHints fjernet fra BottomBar (statisk)
 */

import { describe, it, expect } from 'vitest'
import { buildTimelineSections } from '@/lib/dashboard-helpers'
import type { CalendarEvent } from '@/types/ui'

// ────────────────────────────────────────────────────────────────────────────
// Fix 1: URL filter-state — statisk check af import
// ────────────────────────────────────────────────────────────────────────────

describe('Fix 1: URL filter-state i 4 list-komponenter', () => {
  const lists = [
    'src/app/(dashboard)/contracts/contracts-list-b.tsx',
    'src/app/(dashboard)/cases/cases-list-b.tsx',
    'src/app/(dashboard)/tasks/tasks-list-b.tsx',
    'src/app/(dashboard)/persons/persons-list-b.tsx',
  ]

  for (const file of lists) {
    it(`${file.split('/').pop()} importerer useSearchParams og usePathname`, async () => {
      const fs = await import('fs')
      const path = await import('path')
      const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8')
      expect(content).toMatch(/useSearchParams/)
      expect(content).toMatch(/usePathname/)
      expect(content).toMatch(/useTransition/)
      expect(content).toMatch(/pushUrl/)
    })
  }
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 2: CalendarEvent type har href-felt
// ────────────────────────────────────────────────────────────────────────────

describe('Fix 2: CalendarEvent.href', () => {
  it('CalendarEvent type kan modtage href-felt', () => {
    const ev: CalendarEvent = {
      id: 'test-1',
      date: '2026-05-14',
      title: 'Test',
      subtitle: 'Sub',
      type: 'deadline',
      href: '/tasks/abc123',
    }
    expect(ev.href).toBe('/tasks/abc123')
  })

  it('href skal være en streng', () => {
    const ev: CalendarEvent = {
      id: 'x',
      date: '2026-01-01',
      title: 'T',
      subtitle: 'S',
      type: 'expiry',
      href: '/contracts/xyz',
    }
    expect(typeof ev.href).toBe('string')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 3: Calendar action populerer href
// ────────────────────────────────────────────────────────────────────────────

describe('Fix 3: calendar.ts populerer href', () => {
  it('calendar.ts indeholder /tasks/ og /contracts/ og /cases/ og /visits/ som href', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/calendar.ts'), 'utf-8')
    expect(content).toMatch(/href: `\/tasks\/\$\{t\.id\}`/)
    expect(content).toMatch(/href: `\/contracts\/\$\{c\.id\}`/)
    expect(content).toMatch(/href: `\/cases\/\$\{ca\.id\}`/)
    expect(content).toMatch(/href: `\/visits\/\$\{v\.id\}`/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 4: calendar-b.tsx bruger Link
// ────────────────────────────────────────────────────────────────────────────

describe('Fix 4: calendar-b.tsx bruger Link til events', () => {
  it('importerer og bruger Link fra next/link', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(dashboard)/calendar/calendar-b.tsx'),
      'utf-8'
    )
    expect(content).toMatch(/import Link from 'next\/link'/)
    expect(content).toMatch(/href=\{ev\.href\}/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 5: /search/loading.tsx eksisterer
// ────────────────────────────────────────────────────────────────────────────

describe('Fix 5: /search/loading.tsx eksisterer', () => {
  it('filen eksisterer og eksporterer en default funktion', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(process.cwd(), 'src/app/(dashboard)/search/loading.tsx')
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/export default/)
    expect(content).toMatch(/PageSkeleton/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 6: Urgency-tasks linker til /tasks/[id]
// ────────────────────────────────────────────────────────────────────────────

describe('Fix 6: Urgency-tasks linker til /tasks/[id]', () => {
  const today = new Date('2026-04-15T10:00:00')
  const weekEnd = new Date('2026-04-22T10:00:00')
  const companyMap = new Map([['a', { id: 'a', name: 'Alpha ApS' }]])

  it('overdue task href er /tasks/[id], ikke /tasks', () => {
    const sections = buildTimelineSections({
      overdueTasks: [
        {
          id: 'task-abc',
          title: 'Overdue opgave',
          due_date: new Date('2026-04-10'),
          company_id: 'a',
        },
      ],
      todayAndFutureTasks: [],
      expiringContracts: [],
      expiredContracts: [],
      openCases: [],
      upcomingVisits: [],
      recentDocuments: [],
      companyMap,
      today,
      weekEnd,
    })
    const overdue = sections.find((s) => s.id === 'overdue')!
    expect(overdue.items).toHaveLength(1)
    expect(overdue.items[0].href).toBe('/tasks/task-abc')
    expect(overdue.items[0].href).not.toBe('/tasks')
  })

  it('today task href er /tasks/[id], ikke /tasks', () => {
    const todayStart = new Date('2026-04-15T00:00:00')
    const sections = buildTimelineSections({
      overdueTasks: [],
      todayAndFutureTasks: [
        { id: 'task-today', title: 'Today opgave', due_date: todayStart, company_id: 'a' },
      ],
      expiringContracts: [],
      expiredContracts: [],
      openCases: [],
      upcomingVisits: [],
      recentDocuments: [],
      companyMap,
      today,
      weekEnd,
    })
    const todaySection = sections.find((s) => s.id === 'today')!
    const taskItem = todaySection.items.find((i) => i.id.startsWith('task-today'))
    expect(taskItem).toBeDefined()
    expect(taskItem!.href).toBe('/tasks/task-today')
    expect(taskItem!.href).not.toBe('/tasks')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 7: Strip-cells conditional render
// ────────────────────────────────────────────────────────────────────────────

describe('Fix 7: company-detail-b.tsx strip-cells er betinget', () => {
  it('stripCells bygges med spread-arrays og showContracts/showCases/showPersons guards', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(dashboard)/companies/[id]/company-detail-b.tsx'),
      'utf-8'
    )
    expect(content).toMatch(/showContracts/)
    expect(content).toMatch(/showCases/)
    expect(content).toMatch(/showPersons/)
    expect(content).toMatch(/showDocuments/)
    expect(content).toMatch(/showFinance/)
    // Spread-arrays bruges i stripCells
    expect(content).toMatch(/\.\.\.\(showContracts/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Fix 8: KbdHints fjernet fra BottomBar
// ────────────────────────────────────────────────────────────────────────────

describe('Fix 8: KbdHints ikke importeret i list-komponenter', () => {
  const lists = [
    'src/app/(dashboard)/contracts/contracts-list-b.tsx',
    'src/app/(dashboard)/cases/cases-list-b.tsx',
    'src/app/(dashboard)/tasks/tasks-list-b.tsx',
    'src/app/(dashboard)/persons/persons-list-b.tsx',
    'src/app/(dashboard)/calendar/calendar-b.tsx',
  ]

  for (const file of lists) {
    it(`${file.split('/').pop()} importerer ikke KbdHint`, async () => {
      const fs = await import('fs')
      const path = await import('path')
      const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8')
      expect(content).not.toMatch(/KbdHint/)
    })
  }
})
