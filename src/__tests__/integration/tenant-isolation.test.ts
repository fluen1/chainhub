import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'

const ORG_A = 'org-a-isolation-test'
const ORG_B = 'org-b-isolation-test'

describe('Tenant isolation', () => {
  beforeAll(async () => {
    // Opret to organisationer
    await prisma.organization.createMany({
      data: [
        { id: ORG_A, name: 'Org A Test', slug: 'org-a-test' },
        { id: ORG_B, name: 'Org B Test', slug: 'org-b-test' },
      ],
      skipDuplicates: true,
    })

    // Opret selskaber i hver organisation
    await prisma.company.createMany({
      data: [
        {
          id: 'comp-a1',
          name: 'Selskab A1',
          organizationId: ORG_A,
        },
        {
          id: 'comp-b1',
          name: 'Selskab B1',
          organizationId: ORG_B,
        },
      ],
      skipDuplicates: true,
    })

    // Opret brugere i hver organisation
    await prisma.user.createMany({
      data: [
        {
          id: 'user-a1',
          email: 'user-a1@test.com',
          name: 'User A1',
          organizationId: ORG_A,
        },
        {
          id: 'user-a2',
          email: 'user-a2@test.com',
          name: 'User A2',
          organizationId: ORG_A,
        },
        {
          id: 'user-b1',
          email: 'user-b1@test.com',
          name: 'User B1',
          organizationId: ORG_B,
        },
      ],
      skipDuplicates: true,
    })

    // Opret rolle-tildelinger
    await prisma.userRoleAssignment.createMany({
      data: [
        {
          id: 'role-a1',
          userId: 'user-a1',
          organizationId: ORG_A,
          role: 'GROUP_ADMIN',
          scope: 'ALL',
        },
        {
          id: 'role-a2',
          userId: 'user-a2',
          organizationId: ORG_A,
          role: 'GROUP_READONLY',
          scope: 'ALL',
        },
        {
          id: 'role-b1',
          userId: 'user-b1',
          organizationId: ORG_B,
          role: 'GROUP_ADMIN',
          scope: 'ALL',
        },
      ],
      skipDuplicates: true,
    })
  })

  afterAll(async () => {
    // Ryd op i omvendt rækkefølge pga. foreign keys
    await prisma.userRoleAssignment.deleteMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    })
    await prisma.user.deleteMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    })
    await prisma.company.deleteMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    })
    await prisma.organization.deleteMany({
      where: { id: { in: [ORG_A, ORG_B] } },
    })
  })

  it('Bruger fra org A kan se selskab A1', async () => {
    const result = await canAccessCompany('user-a1', 'comp-a1', ORG_A)
    expect(result).toBe(true)
  })

  it('Bruger fra org A kan IKKE se selskab B1', async () => {
    const result = await canAccessCompany('user-a1', 'comp-b1', ORG_A)
    expect(result).toBe(false)
  })

  it('Bruger fra org B kan se selskab B1', async () => {
    const result = await canAccessCompany('user-b1', 'comp-b1', ORG_B)
    expect(result).toBe(true)
  })

  it('Bruger fra org B kan IKKE se selskab A1', async () => {
    const result = await canAccessCompany('user-b1', 'comp-a1', ORG_B)
    expect(result).toBe(false)
  })

  // ── Ikke-forhandlingsbare tests ──────────────────────────────────────────

  it('tenant A cannot access tenant B companies', async () => {
    // user-a1 tilhører ORG_A — skal ikke kunne se comp-b1 (ORG_B)
    const result = await canAccessCompany('user-a1', 'comp-b1', ORG_A)
    expect(result).toBe(false)
  })

  it('COMPANY_MANAGER cannot see STRENGT_FORTROLIG', async () => {
    // Opret en COMPANY_MANAGER-bruger og tjek sensitivitets-adgang
    const { canAccessSensitivity } = await import('@/lib/permissions')

    // Opret testbruger med COMPANY_MANAGER rolle
    await prisma.user.upsert({
      where: { id: 'user-cm-test' },
      update: {},
      create: {
        id: 'user-cm-test',
        email: 'cm-test@test.com',
        name: 'CM Test',
        organizationId: ORG_A,
      },
    })

    await prisma.userRoleAssignment.upsert({
      where: { id: 'role-cm-test' },
      update: {},
      create: {
        id: 'role-cm-test',
        userId: 'user-cm-test',
        organizationId: ORG_A,
        role: 'COMPANY_MANAGER',
        scope: 'ALL',
      },
    })

    const result = await canAccessSensitivity('user-cm-test', 'STRENGT_FORTROLIG')
    expect(result).toBe(false)

    // Oprydning
    await prisma.userRoleAssignment.delete({ where: { id: 'role-cm-test' } })
    await prisma.user.delete({ where: { id: 'user-cm-test' } })
  })

  it('GROUP_ADMIN kan se STRENGT_FORTROLIG', async () => {
    const { canAccessSensitivity } = await import('@/lib/permissions')
    const result = await canAccessSensitivity('user-a1', 'STRENGT_FORTROLIG')
    expect(result).toBe(true)
  })

  it('GROUP_READONLY kan IKKE se STRENGT_FORTROLIG', async () => {
    const { canAccessSensitivity } = await import('@/lib/permissions')
    const result = await canAccessSensitivity('user-a2', 'STRENGT_FORTROLIG')
    expect(result).toBe(false)
  })
})