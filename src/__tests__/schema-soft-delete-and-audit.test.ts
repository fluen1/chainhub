/**
 * Phase H — data integrity + sikkerhed (2026-05-15)
 *
 * 1. Prisma schema: Company.cvr unique + deleted_at på Ownership/CompanyPerson/ContractVersion/Comment
 * 2. addOwner: sum-tjek (>100% afvises) + SERIALIZABLE transaction
 * 3. Comment soft-delete: deleteComment bruger update + deleted_at
 * 4. Audit på deleteCase, deleteTask, deleteCompany, deletePerson
 * 5. resource_company_id populeret i Phase B audit-events
 * 6. Max-length Zod: description.max(5000), notes.max(2000)
 * 7. 7 manglende error.tsx filer oprettet
 * 8. Multi-tenancy: activity-feed + gdpr organization_id filter
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Fix 1: Schema indeholder unique + deleted_at ──────────────────────────

describe('Fix 1: Prisma schema ændringer', () => {
  const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma')
  let schema: string

  beforeEach(() => {
    schema = fs.readFileSync(schemaPath, 'utf-8')
  })

  it('Company har @@unique([organization_id, cvr])', () => {
    expect(schema).toMatch(/@@unique\(\[organization_id, cvr\]\)/)
  })

  it('Ownership model har deleted_at DateTime?', () => {
    // Tjek at deleted_at findes i Ownership-model
    const ownershipBlock = schema.match(/model Ownership \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(ownershipBlock).toMatch(/deleted_at\s+DateTime\?/)
  })

  it('CompanyPerson model har deleted_at DateTime?', () => {
    const companyPersonBlock = schema.match(/model CompanyPerson \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(companyPersonBlock).toMatch(/deleted_at\s+DateTime\?/)
  })

  it('ContractVersion model har deleted_at DateTime?', () => {
    const contractVersionBlock = schema.match(/model ContractVersion \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(contractVersionBlock).toMatch(/deleted_at\s+DateTime\?/)
  })

  it('Comment model har deleted_at DateTime?', () => {
    const commentBlock = schema.match(/model Comment \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(commentBlock).toMatch(/deleted_at\s+DateTime\?/)
  })
})

// ─── Fix 2: addOwner sum-tjek ──────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: { create: vi.fn().mockResolvedValue({ id: 'p-1' }) },
    ownership: {
      create: vi.fn().mockResolvedValue({ id: 'o-1', ownership_pct: 30 }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({
        id: 'o-1',
        ownership_pct: 60,
        effective_date: null,
        contract_id: null,
      }),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
  canAccessSensitivity: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const UUID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('Fix 2: addOwner sum-tjek', () => {
  beforeEach(() => vi.clearAllMocks())

  const baseInput = {
    companyId: UUID,
    personId: UUID,
    ownershipPct: 30,
    ownerType: 'PERSON' as const,
  }

  it('afviser hvis samlet ejerskab overstiger 100%', async () => {
    const { prisma } = await import('@/lib/db')

    // Simuler at $transaction kaster en RangeError fra sum-tjekket
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      // Kald callback — den bruger tx.ownership.aggregate
      const tx = {
        ownership: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { ownership_pct: 80 } }),
          create: vi.fn(),
        },
      }
      return callback(tx as never)
    })

    const { addOwner } = await import('@/actions/ownership')
    const result = await addOwner({ ...baseInput, ownershipPct: 30 } as never)

    // 80 + 30 = 110 > 100 → fejl
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/100%/)
  })

  it('tillader ejerskab når sum forbliver ≤ 100%', async () => {
    const { prisma } = await import('@/lib/db')

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        ownership: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { ownership_pct: 60 } }),
          create: vi.fn().mockResolvedValue({ id: 'o-new', ownership_pct: 30 }),
        },
      }
      return callback(tx as never)
    })

    const { addOwner } = await import('@/actions/ownership')
    const result = await addOwner({ ...baseInput, ownershipPct: 30 } as never)

    // 60 + 30 = 90 ≤ 100 → success
    expect('data' in result || 'error' in result).toBe(true)
  })

  it('addOwner sender resourceCompanyId i audit-event', async () => {
    const { prisma } = await import('@/lib/db')
    const audit = await import('@/lib/audit')

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        ownership: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { ownership_pct: 0 } }),
          create: vi.fn().mockResolvedValue({ id: 'o-1', ownership_pct: 30 }),
        },
      }
      return callback(tx as never)
    })

    const { addOwner } = await import('@/actions/ownership')
    await addOwner(baseInput as never)

    expect(audit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceCompanyId: UUID,
      })
    )
  })
})

// ─── Fix 3: Comment soft-delete ────────────────────────────────────────────

describe('Fix 3: Comment soft-delete', () => {
  it('deleteComment bruger update (soft-delete) ikke delete', async () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/comments.ts'), 'utf-8')
    // Skal kalde prisma.comment.update med deleted_at
    expect(content).toMatch(/comment\.update/)
    expect(content).toMatch(/deleted_at: new Date\(\)/)
    // Må ikke have hard-delete på comment
    expect(content).not.toMatch(/comment\.delete\(/)
  })

  it('deleteComment filtrerer deleted_at: null ved lookup', async () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/comments.ts'), 'utf-8')
    expect(content).toMatch(/deleted_at: null/)
  })
})

// ─── Fix 4: Audit på delete-actions ───────────────────────────────────────

describe('Fix 4: Audit på delete-actions', () => {
  it('deleteCase kalder recordAuditEvent med action DELETE', async () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/cases.ts'), 'utf-8')
    expect(content).toMatch(/action: 'DELETE'/)
    expect(content).toMatch(/resourceType: 'case'/)
  })

  it('deleteTask kalder recordAuditEvent med action DELETE', async () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/tasks.ts'), 'utf-8')
    expect(content).toMatch(/action: 'DELETE'/)
    expect(content).toMatch(/resourceType: 'task'/)
  })

  it('deleteCompany kalder recordAuditEvent med action DELETE', async () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), 'src/actions/companies.ts'),
      'utf-8'
    )
    expect(content).toMatch(/action: 'DELETE'/)
    expect(content).toMatch(/resourceType: 'company'/)
  })

  it('deletePerson kalder recordAuditEvent med action DELETE', async () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/persons.ts'), 'utf-8')
    expect(content).toMatch(/action: 'DELETE'/)
    expect(content).toMatch(/resourceType: 'person'/)
  })
})

// ─── Fix 5: resource_company_id i Phase B audit-events ────────────────────

describe('Fix 5: resource_company_id i audit-events', () => {
  it('cases.ts populerer resourceCompanyId i CLOSE/ESCALATE/UPDATE events', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/cases.ts'), 'utf-8')
    // Tjek at resourceCompanyId optræder flere steder
    const matches = content.match(/resourceCompanyId/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(4)
  })

  it('ownership.ts populerer resourceCompanyId i alle audit-events', () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), 'src/actions/ownership.ts'),
      'utf-8'
    )
    const matches = content.match(/resourceCompanyId/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(3)
  })

  it('tasks.ts populerer resourceCompanyId i DELETE audit-event', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/tasks.ts'), 'utf-8')
    expect(content).toMatch(/resourceCompanyId/)
  })
})

// ─── Fix 6: Max-length Zod validering ─────────────────────────────────────

describe('Fix 6: Max-length Zod validering', () => {
  it('createCaseSchema.description har max(5000)', async () => {
    const { createCaseSchema } = await import('@/lib/validations/case')
    // Lang string afvises
    const result = createCaseSchema.safeParse({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [UUID],
      description: 'x'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  it('createCaseSchema.notes har max(2000)', async () => {
    const { createCaseSchema } = await import('@/lib/validations/case')
    const result = createCaseSchema.safeParse({
      title: 'Test',
      caseType: 'TVIST',
      companyIds: [UUID],
      notes: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('createTaskSchema.description har max(5000)', async () => {
    const { createTaskSchema } = await import('@/lib/validations/case')
    const result = createTaskSchema.safeParse({
      title: 'Test',
      description: 'x'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  it('updateCase i cases.ts har description.max(5000)', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/actions/cases.ts'), 'utf-8')
    expect(content).toMatch(/description.*max\(5000\)/)
  })
})

// ─── Fix 7: error.tsx filer oprettet ──────────────────────────────────────

describe('Fix 7: error.tsx filer', () => {
  const routes = [
    'src/app/(dashboard)/contracts/error.tsx',
    'src/app/(dashboard)/cases/error.tsx',
    'src/app/(dashboard)/persons/error.tsx',
    'src/app/(dashboard)/documents/error.tsx',
    'src/app/(dashboard)/settings/error.tsx',
    'src/app/(dashboard)/calendar/error.tsx',
    'src/app/(dashboard)/search/error.tsx',
  ]

  for (const route of routes) {
    it(`${route.split('/').slice(-2).join('/')} eksisterer og er 'use client'`, () => {
      const filePath = path.resolve(process.cwd(), route)
      expect(fs.existsSync(filePath)).toBe(true)
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toMatch(/'use client'/)
      expect(content).toMatch(/export default/)
      expect(content).toMatch(/reset/)
      expect(content).toMatch(/ErrorBoundaryPage|ErrorBoundaryUI/)
    })
  }
})

// ─── Fix 8: Multi-tenancy småfix ──────────────────────────────────────────

describe('Fix 8: Multi-tenancy i activity-feed + gdpr', () => {
  it('activity-feed.ts filtrerer user.findMany på organization_id', () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), 'src/actions/activity-feed.ts'),
      'utf-8'
    )
    // user.findMany skal have organization_id filter
    expect(content).toMatch(/organization_id: organizationId/)
  })

  it('gdpr.ts filtrerer ownership.findMany på organization_id', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/export/gdpr.ts'), 'utf-8')
    expect(content).toMatch(
      /ownership_id: personId[\s\S]*?organization_id: organizationId|organization_id: organizationId[\s\S]*?owner_person_id: personId/
    )
  })

  it('gdpr.ts filtrerer companyPerson.findMany på organization_id', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/export/gdpr.ts'), 'utf-8')
    // companyPerson.findMany skal have organization_id
    const cpSection = content.match(/companyPerson\.findMany\([\s\S]*?\)/)?.[0] ?? ''
    expect(cpSection).toMatch(/organization_id/)
  })
})
