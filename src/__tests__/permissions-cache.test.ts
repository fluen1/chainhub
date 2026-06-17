import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma FØR import af permissions-modulet
vi.mock('@/lib/db', () => ({
  prisma: {
    userRoleAssignment: {
      findMany: vi.fn(),
    },
  },
}))

// Mock React cache — vi.mock af 'react' ville bryde for meget,
// så vi tester via spy på prisma.userRoleAssignment.findMany direkte
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'

// NB: React cache() deduplikerer kun INDEN FOR én server-request/render-pass.
// I vitest findes ingen request-kontekst, så cache() falder igennem til at kalde
// funktionen hver gang — derfor kan selve dedup-tællingen IKKE unit-testes her.
// Optimeringen er reel i Server Components/Actions (prod). Disse tests sikrer i
// stedet at getUserRoles forespørger org-scoped og driver helpers korrekt, så
// cache()-refaktoren ikke ændrede adfærd.
describe('getUserRoles (cache-wrapped) — adfærd + org-scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Returner én GROUP_OWNER ALL-scope assignment
    vi.mocked(prisma.userRoleAssignment.findMany).mockResolvedValue([
      { role: 'GROUP_OWNER', scope: 'ALL', company_ids: [] },
    ] as never)
  })

  it('forespørger org-scoped (user_id + organization_id) og driver helpers korrekt', async () => {
    const userId = 'user-1'
    const orgId = 'org-1'

    const canAccess = await canAccessCompany(userId, 'company-1', orgId)
    expect(canAccess).toBe(true) // GROUP_OWNER ALL-scope

    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledWith({
      where: { user_id: userId, organization_id: orgId },
      select: { role: true, scope: true, company_ids: true },
    })
  })

  it('bruger forskellig cache-nøgle pr. userId — ingen cross-user leak', async () => {
    await canAccessCompany('user-A', 'company-1', 'org-1')
    await canAccessCompany('user-B', 'company-1', 'org-1')

    // Forskellige args ⇒ separate kald (ingen sammenblanding af brugeres roller)
    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledTimes(2)
    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-A', organization_id: 'org-1' } })
    )
    expect(prisma.userRoleAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-B', organization_id: 'org-1' } })
    )
  })
})
