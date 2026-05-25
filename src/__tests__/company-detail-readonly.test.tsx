// @vitest-environment jsdom
// Tester at readonly-gating skjuler +Opret/*-knapper for GROUP_READONLY-rolle.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/labels', () => ({
  getCompanyPersonRoleLabel: (r: string) => r,
  formatDate: (d: Date) => d.toISOString().slice(0, 10),
}))
vi.mock('@/lib/utils', () => ({
  cn: (...c: unknown[]) => (c as string[]).filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/b', async () => {
  return {
    Breadcrumb: () => null,
    PageHeader: ({ actions }: { actions?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'page-header' }, actions),
    MetaSep: () => React.createElement('span', null, '·'),
    BButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
      React.createElement('button', { onClick }, children),
    BAddButton: ({
      children,
      href,
      onClick,
    }: {
      children: React.ReactNode
      href?: string
      onClick?: () => void
    }) =>
      React.createElement(
        'button',
        { 'data-testid': 'add-btn', 'data-href': href, onClick },
        children
      ),
    Strip: () => null,
    AlertBar: () => null,
    Panel: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    PanelHeader: ({ title }: { title: React.ReactNode }) => React.createElement('div', null, title),
    PanelFooter: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    Badge: ({ children }: { children: React.ReactNode }) =>
      React.createElement('span', { 'data-testid': 'badge' }, children),
    AIInsightCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    PlusBadge: () => null,
    BottomBar: () => null,
    KbdHint: () => null,
    PanelEmpty: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    SlutLink: () => null,
  }
})

vi.mock('@/components/modals/b', () => ({
  AddOwnerModal: () => null,
  AddPersonModal: () => null,
  AddMetricModal: () => null,
  EndOwnershipRoleModal: () => null,
}))

// add-data-dropdown er en relativ import
vi.mock('@/app/(dashboard)/companies/[id]/add-data-dropdown', () => ({
  AddDataDropdown: () => null,
}))

vi.mock('@/components/companies/EditStamdataDialog', () => ({
  EditStamdataDialog: () => null,
}))

import { CompanyDetailB } from '@/app/(dashboard)/companies/[id]/company-detail-b'
import type { CompanyDetailData } from '@/actions/company-detail'

function makeData(role: string): CompanyDetailData {
  // Cast via unknown — vi tester kun readonly-UI-logik, ikke alle felter
  return {
    company: {
      id: 'co-1',
      name: 'TestSelskab ApS',
      cvr: '12345678',
      status: 'AKTIV',
      address: null,
      city: null,
      postal_code: null,
      founded_date: null,
    },
    role,
    visibleSections: new Set([
      'contracts',
      'cases',
      'visits',
      'documents',
      'ownership',
      'persons',
      'finance',
    ]) as CompanyDetailData['visibleSections'],
    healthDimensions: {
      kontrakter: 'ok',
      sager: 'ok',
      oekonomi: 'ok',
      governance: 'ok',
    } as unknown as CompanyDetailData['healthDimensions'],
    statusBadge: { label: 'Sund', severity: 'healthy' },
    alerts: [],
    contracts: { top: [], totalCount: 0 },
    cases: { top: [], totalCount: 0 },
    persons: { top: [], totalCount: 0 },
    visits: [],
    documents: { rows: [], awaitingReviewCount: 0 },
    finance: null,
    ownership: null,
    aiInsight: null,
  } as unknown as CompanyDetailData
}

const BASE_PROPS = {
  ownerships: [],
  companyPersons: [],
  metrics: [],
  persons: [],
  canSeeOwnership: true,
  expiringLease: null,
  notes: [],
}

describe('CompanyDetailB readonly-gating', () => {
  it('GROUP_OWNER viser add-knapper (inkl. Opret kontrakt, Opret sag, Planlæg besøg, Upload dokument)', () => {
    const data = makeData('GROUP_OWNER')
    render(<CompanyDetailB data={data} {...BASE_PROPS} />)
    const addBtns = screen.getAllByTestId('add-btn')
    const labels = addBtns.map((b) => b.textContent ?? '')
    expect(labels.some((l) => l.includes('Opret kontrakt'))).toBe(true)
    expect(labels.some((l) => l.includes('Opret sag'))).toBe(true)
    expect(labels.some((l) => l.includes('Planlæg besøg'))).toBe(true)
    expect(labels.some((l) => l.includes('Upload dokument'))).toBe(true)
  })

  it('GROUP_READONLY skjuler add-knapper (Opret kontrakt, Opret sag, Planlæg besøg, Upload dokument)', () => {
    const data = makeData('GROUP_READONLY')
    render(<CompanyDetailB data={data} {...BASE_PROPS} />)
    const addBtns = screen.queryAllByTestId('add-btn')
    const labels = addBtns.map((b) => b.textContent ?? '')
    expect(labels.some((l) => l.includes('Opret kontrakt'))).toBe(false)
    expect(labels.some((l) => l.includes('Opret sag'))).toBe(false)
    expect(labels.some((l) => l.includes('Planlæg besøg'))).toBe(false)
    expect(labels.some((l) => l.includes('Upload dokument'))).toBe(false)
  })
})
