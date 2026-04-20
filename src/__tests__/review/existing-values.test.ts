import { describe, it, expect } from 'vitest'
import type { Contract, ContractParty, Person, Ownership } from '@prisma/client'
import { getExistingValue } from '@/lib/ai/review/existing-values'

type ContractWithRelations = Contract & {
  parties: (ContractParty & { person: Person | null })[]
  ownerships: Ownership[]
}

function buildContract(overrides: Partial<ContractWithRelations> = {}): ContractWithRelations {
  const base: ContractWithRelations = {
    id: 'c-1',
    organization_id: 'org-1',
    company_id: 'co-1',
    system_type: 'EJERAFTALE' as never,
    display_name: 'Test-kontrakt',
    status: 'AKTIV' as never,
    sensitivity: 'STANDARD' as never,
    deadline_type: 'INGEN' as never,
    version_source: 'CUSTOM' as never,
    collective_agreement: null,
    parent_contract_id: null,
    triggered_by_id: null,
    effective_date: null,
    expiry_date: null,
    signed_date: null,
    notice_period_days: null,
    termination_date: null,
    anciennity_start: null,
    reminder_90_days: true,
    reminder_30_days: true,
    reminder_7_days: true,
    reminder_recipients: [],
    must_retain_until: null,
    type_data: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'user-1',
    last_viewed_at: null,
    last_viewed_by: null,
    deleted_at: null,
    parties: [],
    ownerships: [],
  } as unknown as ContractWithRelations
  return { ...base, ...overrides }
}

describe('getExistingValue', () => {
  it('returnerer null hvis contract er null', () => {
    expect(getExistingValue('effective_date', null, 'EJERAFTALE')).toBeNull()
  })

  it('mapper effective_date som ISO-dato yyyy-mm-dd', () => {
    const contract = buildContract({ effective_date: new Date('2026-03-15T10:00:00Z') })
    expect(getExistingValue('effective_date', contract, 'EJERAFTALE')).toBe('2026-03-15')
  })

  it('mapper expiry_date + signed_date som ISO-dato', () => {
    const contract = buildContract({
      expiry_date: new Date('2030-12-31T23:59:59Z'),
      signed_date: new Date('2026-02-10T10:00:00Z'),
    })
    expect(getExistingValue('expiry_date', contract, 'EJERAFTALE')).toBe('2030-12-31')
    expect(getExistingValue('signed_date', contract, 'EJERAFTALE')).toBe('2026-02-10')
  })

  it('konverterer notice_period_days til termination_notice_months', () => {
    const contract = buildContract({ notice_period_days: 90 })
    expect(getExistingValue('termination_notice_months', contract, 'EJERAFTALE')).toBe('3')
  })

  it('returnerer null for felt uden værdi', () => {
    const contract = buildContract({ effective_date: null })
    expect(getExistingValue('effective_date', contract, 'EJERAFTALE')).toBeNull()
  })

  it('mapper parties ved counterparty_name + person.name join', () => {
    const contract = buildContract({
      parties: [
        {
          id: 'p1',
          organization_id: 'org-1',
          contract_id: 'c-1',
          person_id: null,
          is_signer: true,
          counterparty_name: 'Kædegruppen A/S',
          role_in_contract: null,
          created_at: new Date(),
          person: null,
        },
        {
          id: 'p2',
          organization_id: 'org-1',
          contract_id: 'c-1',
          person_id: 'person-1',
          is_signer: true,
          counterparty_name: null,
          role_in_contract: null,
          created_at: new Date(),
          person: { id: 'person-1', first_name: 'Henrik', last_name: 'Munk' } as unknown as Person,
        },
      ],
    })
    expect(getExistingValue('parties', contract, 'EJERAFTALE')).toBe('Kædegruppen A/S, Henrik Munk')
  })

  it('mapper ownerships via ownership_pct + owner-navn', () => {
    const contract = buildContract({
      ownerships: [
        {
          id: 'o1',
          organization_id: 'org-1',
          company_id: 'co-1',
          owner_person_id: null,
          owner_company_id: 'co-owner-1',
          ownership_pct: { toString: () => '60.00' } as never,
          share_class: null,
          effective_date: null,
          end_date: null,
          contract_id: 'c-1',
          created_at: new Date(),
          created_by: 'user-1',
        } as unknown as Ownership,
      ],
    })
    const result = getExistingValue('ownership_split', contract, 'EJERAFTALE')
    expect(result).toBe('60.00%')
  })

  it('læser fra type_data JSON for schema-felter ikke i direct/relation map', () => {
    const contract = buildContract({
      type_data: { non_compete: '24 måneder inden for 15 km', drag_along: 'Ja' },
    })
    expect(getExistingValue('non_compete', contract, 'EJERAFTALE')).toBe(
      '24 måneder inden for 15 km'
    )
    expect(getExistingValue('drag_along', contract, 'EJERAFTALE')).toBe('Ja')
  })

  it('returnerer null for ukendt felt når type_data mangler', () => {
    const contract = buildContract({ type_data: null })
    expect(getExistingValue('non_compete', contract, 'EJERAFTALE')).toBeNull()
  })
})
