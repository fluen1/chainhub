/**
 * Single source of truth for rolle→modul-adgang (UX-review #10).
 *
 * Disse tests beviser at GROUP_FINANCE ALDRIG ser kontrakter/sager nogen steder,
 * og at GROUP_OWNER ser alt. Mappingen i role-modules.ts er den ENESTE kilde —
 * sidebar, selskabsliste-kolonner og dashboard-paneler gater alle på den.
 *
 * Reference: docs/spec/roller-og-tilladelser.md "Modul-adgang pr. rolle (MVP)".
 */

import { describe, it, expect } from 'vitest'
import {
  gateTimelineSectionsForRole,
  gateHeatmapForRole,
  moduleForHref,
  type HeatmapCompany,
  type TimelineSectionData,
} from '@/lib/dashboard-helpers'
import {
  roleCanAccessModule,
  modulesForRole,
  ALL_MODULES,
  type AppModule,
} from '@/lib/permissions/role-modules'

const ROLES = [
  'GROUP_OWNER',
  'GROUP_ADMIN',
  'GROUP_LEGAL',
  'GROUP_FINANCE',
  'GROUP_READONLY',
  'COMPANY_MANAGER',
  'COMPANY_LEGAL',
  'COMPANY_READONLY',
] as const

describe('roleCanAccessModule — single source of truth', () => {
  // ─── GROUP_FINANCE må IKKE se kontrakter/sager nogen steder ────────────────
  describe('GROUP_FINANCE (UX-review #10 — divergens-bug)', () => {
    it('kan IKKE tilgå contracts', () => {
      expect(roleCanAccessModule('GROUP_FINANCE', 'contracts')).toBe(false)
    })

    it('kan IKKE tilgå cases', () => {
      expect(roleCanAccessModule('GROUP_FINANCE', 'cases')).toBe(false)
    })

    it('kan IKKE tilgå ownership', () => {
      expect(roleCanAccessModule('GROUP_FINANCE', 'ownership')).toBe(false)
    })

    it('kan tilgå finance, companies, tasks, documents, persons, governance', () => {
      expect(roleCanAccessModule('GROUP_FINANCE', 'finance')).toBe(true)
      expect(roleCanAccessModule('GROUP_FINANCE', 'companies')).toBe(true)
      expect(roleCanAccessModule('GROUP_FINANCE', 'tasks')).toBe(true)
      expect(roleCanAccessModule('GROUP_FINANCE', 'documents')).toBe(true)
      expect(roleCanAccessModule('GROUP_FINANCE', 'persons')).toBe(true)
      expect(roleCanAccessModule('GROUP_FINANCE', 'governance')).toBe(true)
    })

    it('modulesForRole indeholder hverken contracts eller cases', () => {
      const mods = modulesForRole('GROUP_FINANCE')
      expect(mods.has('contracts')).toBe(false)
      expect(mods.has('cases')).toBe(false)
    })
  })

  // ─── GROUP_OWNER ser alt ───────────────────────────────────────────────────
  describe('GROUP_OWNER ser alt', () => {
    it.each(ALL_MODULES)('kan tilgå %s', (mod) => {
      expect(roleCanAccessModule('GROUP_OWNER', mod)).toBe(true)
    })

    it('modulesForRole indeholder alle moduler', () => {
      const mods = modulesForRole('GROUP_OWNER')
      for (const mod of ALL_MODULES) {
        expect(mods.has(mod)).toBe(true)
      }
    })
  })

  // ─── Matrix mod spec (docs/spec/roller-og-tilladelser.md) ──────────────────
  describe('matrix mod spec', () => {
    it('contracts/cases: kun roller med juridisk adgang (ikke FINANCE)', () => {
      expect(roleCanAccessModule('GROUP_LEGAL', 'contracts')).toBe(true)
      expect(roleCanAccessModule('GROUP_READONLY', 'cases')).toBe(true)
      expect(roleCanAccessModule('COMPANY_MANAGER', 'contracts')).toBe(true)
      expect(roleCanAccessModule('COMPANY_LEGAL', 'cases')).toBe(true)
      expect(roleCanAccessModule('COMPANY_READONLY', 'contracts')).toBe(true)
      // FINANCE er den eneste der mangler kontrakter/sager
      expect(roleCanAccessModule('GROUP_FINANCE', 'contracts')).toBe(false)
    })

    it('ownership: kun OWNER/ADMIN/LEGAL', () => {
      expect(roleCanAccessModule('GROUP_OWNER', 'ownership')).toBe(true)
      expect(roleCanAccessModule('GROUP_ADMIN', 'ownership')).toBe(true)
      expect(roleCanAccessModule('GROUP_LEGAL', 'ownership')).toBe(true)
      expect(roleCanAccessModule('GROUP_FINANCE', 'ownership')).toBe(false)
      expect(roleCanAccessModule('GROUP_READONLY', 'ownership')).toBe(false)
      expect(roleCanAccessModule('COMPANY_MANAGER', 'ownership')).toBe(false)
    })

    it('finance: ikke GROUP_LEGAL og ikke COMPANY_LEGAL', () => {
      expect(roleCanAccessModule('GROUP_LEGAL', 'finance')).toBe(false)
      expect(roleCanAccessModule('COMPANY_LEGAL', 'finance')).toBe(false)
      expect(roleCanAccessModule('GROUP_FINANCE', 'finance')).toBe(true)
    })

    it('companies/tasks/documents/persons/governance: alle roller', () => {
      for (const role of ROLES) {
        expect(roleCanAccessModule(role, 'companies')).toBe(true)
        expect(roleCanAccessModule(role, 'tasks')).toBe(true)
        expect(roleCanAccessModule(role, 'documents')).toBe(true)
        expect(roleCanAccessModule(role, 'persons')).toBe(true)
        expect(roleCanAccessModule(role, 'governance')).toBe(true)
      }
    })
  })

  // ─── Fail-closed på ukendt input ───────────────────────────────────────────
  describe('fail-closed', () => {
    it('ukendt rolle afvises', () => {
      expect(roleCanAccessModule('UKENDT' as never, 'contracts')).toBe(false)
    })

    it('ukendt modul afvises selv for OWNER', () => {
      expect(roleCanAccessModule('GROUP_OWNER', 'ukendt' as AppModule)).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard-gating: timeline-links + heatmap-sagstal (UX-review #10)
// ─────────────────────────────────────────────────────────────────────────────

function makeSections(): TimelineSectionData[] {
  return [
    {
      id: 'overdue',
      label: 'Overskredet',
      dotType: 'overdue',
      items: [
        {
          id: 't1',
          letter: 'A',
          color: 'red',
          title: 'Opgave',
          subtitle: '',
          time: '',
          href: '/tasks/t1',
        },
        {
          id: 'c1',
          letter: 'B',
          color: 'amber',
          title: 'Kontrakt',
          subtitle: '',
          time: '',
          href: '/contracts/c1',
        },
      ],
    },
    {
      id: 'nextweek',
      label: 'Næste uge',
      dotType: 'future',
      items: [
        {
          id: 's1',
          letter: 'C',
          color: 'purple',
          title: 'Sag',
          subtitle: '',
          time: '',
          href: '/cases/s1',
        },
        {
          id: 'v1',
          letter: 'D',
          color: 'blue',
          title: 'Besøg',
          subtitle: '',
          time: '',
          href: '/companies/co1',
        },
        {
          id: 'd1',
          letter: 'E',
          color: 'purple',
          title: 'Dok',
          subtitle: '',
          time: '',
          href: '/documents',
        },
      ],
    },
  ]
}

describe('moduleForHref', () => {
  it('mapper hrefs til moduler', () => {
    expect(moduleForHref('/contracts/abc')).toBe('contracts')
    expect(moduleForHref('/cases/abc')).toBe('cases')
    expect(moduleForHref('/tasks/abc')).toBe('tasks')
    expect(moduleForHref('/companies/abc')).toBeNull()
    expect(moduleForHref('/documents')).toBeNull()
  })
})

describe('gateTimelineSectionsForRole — GROUP_FINANCE ser ikke kontrakt-/sags-links', () => {
  it('fjerner contracts- og cases-links for FINANCE, beholder tasks/visits/docs', () => {
    const gated = gateTimelineSectionsForRole(makeSections(), 'GROUP_FINANCE')
    const hrefs = gated.flatMap((s) => s.items.map((i) => i.href))
    expect(hrefs).toContain('/tasks/t1')
    expect(hrefs).toContain('/companies/co1')
    expect(hrefs).toContain('/documents')
    // Forbudt for FINANCE:
    expect(hrefs).not.toContain('/contracts/c1')
    expect(hrefs).not.toContain('/cases/s1')
  })

  it('owner beholder alle links', () => {
    const gated = gateTimelineSectionsForRole(makeSections(), 'GROUP_OWNER')
    const hrefs = gated.flatMap((s) => s.items.map((i) => i.href))
    expect(hrefs).toContain('/contracts/c1')
    expect(hrefs).toContain('/cases/s1')
    expect(hrefs).toContain('/tasks/t1')
  })
})

describe('gateHeatmapForRole — sagstal skjules for roller uden cases-adgang', () => {
  const heatmap: HeatmapCompany[] = [
    { id: 'a', name: 'A', healthStatus: 'critical', openCaseCount: 3 },
    { id: 'b', name: 'B', healthStatus: 'warning', openCaseCount: 1 },
  ]

  it('GROUP_FINANCE: openCaseCount nulstilles', () => {
    const gated = gateHeatmapForRole(heatmap, 'GROUP_FINANCE')
    expect(gated.every((c) => c.openCaseCount === 0)).toBe(true)
  })

  it('GROUP_OWNER: sagstal bevares', () => {
    const gated = gateHeatmapForRole(heatmap, 'GROUP_OWNER')
    expect(gated[0]!.openCaseCount).toBe(3)
    expect(gated[1]!.openCaseCount).toBe(1)
  })
})
