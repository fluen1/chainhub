/**
 * Phase C — regression tests for 5 kritiske fixes (2026-05-14)
 *
 * 1. UDLOBET SQL literal — Prisma @map-DB-navn (audit-fund var falsk positiv)
 * 2. Finance dynamisk år — getCompanyDetailData bruger currentYear, ikke hardcoded 2025/2024
 * 3. KEY_PERSON_ROLES lowercase DB-strings (via selectKeyPersons)
 * 4. addOwner — note sendes via audit-log
 * 5. endOwnership + endCompanyPerson — note sendes via audit-log
 */

import { describe, it, expect, vi } from 'vitest'

// ──────────────────────────────────────────────────────────────────────────────
// Fix 1: UDLOBET SQL literal — raw SQL bruger @map-DB-navnet, ikke Prisma-navnet
// Schema: enum ContractStatus { UDLOEBET @map("UDLOBET") } — DB-værdi er 'UDLOBET'
// Hotfix 941b415 reverterede Phase C's første-fix (audit var falsk positiv)
// ──────────────────────────────────────────────────────────────────────────────

describe('Fix 1: UDLOBET SQL literal (Prisma @map → DB-navn)', () => {
  it('companies/page.tsx bruger DB-værdien UDLOBET (uden E) i raw SQL', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(process.cwd(), 'src/app/(dashboard)/companies/page.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')
    // Raw SQL skal bruge DB-navnet 'UDLOBET' (uden E)
    expect(content).toMatch(/status\s*=\s*'UDLOBET'/)
    // ... og må IKKE bruge Prisma-navnet 'UDLOEBET' som SQL-literal
    expect(content).not.toMatch(/status\s*=\s*'UDLOEBET'/)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Fix 3: KEY_PERSON_ROLES lowercase DB-strings (ren modul-test — ingen mocks)
// ──────────────────────────────────────────────────────────────────────────────

describe('Fix 3: KEY_PERSON_ROLES matcher faktiske DB rolle-strings', () => {
  it('KEY_PERSON_ROLES indeholder kun lowercase strings (ingen PascalCase)', async () => {
    // Brug vi.resetModules for at undgå cached version
    vi.resetModules()
    const { KEY_PERSON_ROLES } = await import('@/lib/company-detail/helpers')
    for (const role of KEY_PERSON_ROLES) {
      expect(role).toBe(role.toLowerCase())
    }
  })

  it('direktoer er øverst i hierarkiet', async () => {
    vi.resetModules()
    const { KEY_PERSON_ROLES } = await import('@/lib/company-detail/helpers')
    expect(KEY_PERSON_ROLES[0]).toBe('direktoer')
  })

  it('selectKeyPersons filtrerer PascalCase roller fra (matcher ikke DB)', async () => {
    vi.resetModules()
    const { selectKeyPersons } = await import('@/lib/company-detail/helpers')
    const candidates = [
      {
        role: 'Partner', // gammelt PascalCase — skal filtreres
        anciennity_start: null,
        person: { first_name: 'A', last_name: 'A' },
      },
      {
        role: 'direktoer', // korrekt DB-string
        anciennity_start: null,
        person: { first_name: 'B', last_name: 'B' },
      },
    ]
    const result = selectKeyPersons(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('direktoer')
  })

  it('selectKeyPersons matcher leder-rollen (DB-streng)', async () => {
    vi.resetModules()
    const { selectKeyPersons } = await import('@/lib/company-detail/helpers')
    const candidates = [
      {
        role: 'leder',
        anciennity_start: new Date('2020-01-01'),
        person: { first_name: 'Lars', last_name: 'Leder' },
      },
    ]
    const result = selectKeyPersons(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('leder')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Fix 2: Finance dynamisk år — kildekode-verifikation
// ──────────────────────────────────────────────────────────────────────────────

describe('Fix 2: Finance år — dynamisk currentYear/previousYear', () => {
  it('company-detail.ts indeholder IKKE hardcoded period_year: 2025', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(process.cwd(), 'src/actions/company-detail.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).not.toMatch(/period_year:\s*2025/)
    expect(content).not.toMatch(/period_year:\s*2024/)
  })

  it('company-detail.ts bruger currentYear og previousYear variabler', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(process.cwd(), 'src/actions/company-detail.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/const currentYear = .+\.getFullYear\(\)/)
    expect(content).toMatch(/const previousYear = currentYear - 1/)
    expect(content).toMatch(/period_year: currentYear/)
    expect(content).toMatch(/period_year: previousYear/)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Fix 4 & 5: note sendes via audit-log — kildekode-verifikation + action-tests
// ──────────────────────────────────────────────────────────────────────────────

describe('Fix 4: addOwner schema accepterer note-felt', () => {
  it('addOwnerSchema inkluderer note som optional felt', async () => {
    vi.resetModules()
    const { addOwnerSchema } = await import('@/lib/validations/ownership')
    const validInput = {
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      personId: 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789',
      ownershipPct: 25,
      ownerType: 'PERSON' as const,
      note: 'Baggrund for tilkøb',
    }
    const result = addOwnerSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.note).toBe('Baggrund for tilkøb')
    }
  })

  it('addOwnerSchema fungerer uden note (note er valgfri)', async () => {
    vi.resetModules()
    const { addOwnerSchema } = await import('@/lib/validations/ownership')
    const validInput = {
      companyId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      personId: 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789',
      ownershipPct: 25,
      ownerType: 'PERSON' as const,
    }
    const result = addOwnerSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('ownership.ts sender note til audit.changes når note angivet', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(process.cwd(), 'src/actions/ownership.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    // Begge CREATE og END audit-calls skal sprede note hvis til stede
    expect(content).toMatch(/parsed\.data\.note/)
    expect(content).toMatch(/note: parsed\.data\.note/)
  })
})

describe('Fix 5: endOwnership/endCompanyPerson schema accepterer note-felt', () => {
  it('endOwnershipSchema inkluderer note som optional felt', async () => {
    vi.resetModules()
    const { endOwnershipSchema } = await import('@/lib/validations/ownership')
    const validInput = {
      ownershipId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      endDate: '2026-05-14',
      note: 'Salg til ny partner',
    }
    const result = endOwnershipSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.note).toBe('Salg til ny partner')
    }
  })

  it('endCompanyPersonSchema inkluderer note som optional felt', async () => {
    vi.resetModules()
    const { endCompanyPersonSchema } = await import('@/lib/validations/governance')
    const validInput = {
      companyPersonId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      endDate: '2026-05-14',
      note: 'Overdragelse til ny rolle',
    }
    const result = endCompanyPersonSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.note).toBe('Overdragelse til ny rolle')
    }
  })

  it('EndOwnershipRoleModal sender note.trim() til endOwnership', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(
      process.cwd(),
      'src/components/modals/b/EndOwnershipRoleModal.tsx'
    )
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/note: note\.trim\(\)/)
  })

  it('governance.ts sender note til audit.changes ved endCompanyPerson', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(process.cwd(), 'src/actions/governance.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/parsed\.data\.note/)
    expect(content).toMatch(/note: parsed\.data\.note/)
  })
})
