import { describe, it, expect } from 'vitest'
import {
  deriveTaskUrgency,
  formatHistoryEntry,
  groupTasksByCompany,
  NO_COMPANY_KEY,
  TASK_SECTION_KEYS,
} from '@/lib/task-detail/helpers'

describe('deriveTaskUrgency', () => {
  const today = new Date('2026-04-18T12:00:00Z')

  it('returnerer "none" for lukket opgave uanset frist', () => {
    expect(deriveTaskUrgency({ status: 'LUKKET', due_date: new Date('2026-01-01') }, today)).toBe(
      'none'
    )
  })

  it('returnerer "none" når der ikke er due_date', () => {
    expect(deriveTaskUrgency({ status: 'NY', due_date: null }, today)).toBe('none')
  })

  it('returnerer "overdue" når due_date er passeret', () => {
    expect(
      deriveTaskUrgency({ status: 'AKTIV_TASK', due_date: new Date('2026-04-15') }, today)
    ).toBe('overdue')
  })

  it('returnerer "due-soon" når der er 0-3 dage til frist', () => {
    expect(deriveTaskUrgency({ status: 'NY', due_date: new Date('2026-04-20') }, today)).toBe(
      'due-soon'
    )
  })

  it('returnerer "upcoming" når der er mere end 3 dage til frist', () => {
    expect(deriveTaskUrgency({ status: 'NY', due_date: new Date('2026-05-01') }, today)).toBe(
      'upcoming'
    )
  })
})

describe('formatHistoryEntry', () => {
  const base = {
    id: 'h1',
    organization_id: 'org',
    task_id: 't1',
    changed_by: 'u1',
    changed_at: new Date('2026-04-18T14:00:00Z'),
    deleted_at: null,
    changedBy: { name: 'Philip Larsen' },
  }

  it('oversætter STATUS-ændring til dansk label', () => {
    const out = formatHistoryEntry({
      ...base,
      field_name: 'STATUS',
      old_value: 'NY',
      new_value: 'AKTIV_TASK',
    } as never)
    expect(out.fieldLabel).toBe('Status')
    expect(out.oldLabel).toBe('Ny')
    expect(out.newLabel).toBe('Aktiv')
    expect(out.changedByName).toBe('Philip Larsen')
  })

  it('oversætter PRIORITY-ændring', () => {
    const out = formatHistoryEntry({
      ...base,
      field_name: 'PRIORITY',
      old_value: 'LAV',
      new_value: 'KRITISK',
    } as never)
    expect(out.fieldLabel).toBe('Prioritet')
    expect(out.oldLabel).toBe('Lav')
    expect(out.newLabel).toBe('Kritisk')
  })

  it('viser "—" for null-værdier (fx frist fjernet)', () => {
    const out = formatHistoryEntry({
      ...base,
      field_name: 'DUE_DATE',
      old_value: '2026-04-20',
      new_value: null,
    } as never)
    expect(out.newLabel).toBe('—')
  })

  it('formaterer DUE_DATE til dansk dato', () => {
    const out = formatHistoryEntry({
      ...base,
      field_name: 'DUE_DATE',
      old_value: null,
      new_value: '2026-04-20',
    } as never)
    expect(out.newLabel).toContain('2026')
  })
})

describe('groupTasksByCompany', () => {
  it('grupperer pr. company_id og samler null under NO_COMPANY_KEY', () => {
    const tasks = [
      { id: 't1', company_id: 'c1' },
      { id: 't2', company_id: 'c1' },
      { id: 't3', company_id: 'c2' },
      { id: 't4', company_id: null },
    ]
    const grouped = groupTasksByCompany(tasks)
    expect(grouped.get('c1')).toHaveLength(2)
    expect(grouped.get('c2')).toHaveLength(1)
    expect(grouped.get(NO_COMPANY_KEY)).toHaveLength(1)
  })

  it('bevarer rækkefølgen inden for hver gruppe', () => {
    const tasks = [
      { id: 't1', company_id: 'c1' },
      { id: 't2', company_id: 'c1' },
      { id: 't3', company_id: 'c1' },
    ]
    const grouped = groupTasksByCompany(tasks)
    expect(grouped.get('c1')?.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
  })
})

describe('TASK_SECTION_KEYS', () => {
  it('indeholder præcis 5 sektioner i fast rækkefølge', () => {
    expect(TASK_SECTION_KEYS).toEqual(['header', 'context', 'description', 'history', 'comments'])
  })
})
