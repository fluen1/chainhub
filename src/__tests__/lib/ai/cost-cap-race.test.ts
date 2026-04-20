import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { reserveAIBudget } from '@/lib/ai/cost-cap'

// Denne test kræver en live database (Supabase eller lokal Postgres) HVOR
// migration 20260419000002_cost_cap_reservation er kørt. Standard: SKIP.
// Kør manuelt med `RUN_DB_RACE_TEST=1 npm test` efter migration er applied
// for at verificere race-condition-sikkerhed.
const canRunDbTests = !!process.env.RUN_DB_RACE_TEST

describe.skipIf(!canRunDbTests)('cost-cap — race-condition sikkerhed', () => {
  const orgId = '00000000-0000-0000-0000-000000000099'

  beforeEach(async () => {
    // Sikr at org eksisterer først (DB har FK-constraint). Hvis connection
    // fejler, kaster beforeEach — men describe.skipIf ovenfor forsøger at
    // undgå det.
    await prisma.organization.upsert({
      where: { id: orgId },
      create: { id: orgId, name: 'Race Test Org' },
      update: {},
    })
    await prisma.aIUsageLog.deleteMany({ where: { organization_id: orgId } })
    await prisma.organizationAISettings.upsert({
      where: { organization_id: orgId },
      create: {
        organization_id: orgId,
        monthly_cost_cap_usd: 10,
        reserved_cost_usd: 0,
        ai_mode: 'LIVE',
      },
      update: { monthly_cost_cap_usd: 10, reserved_cost_usd: 0 },
    })
  })

  it('10 parallelle reservationer på $1.50 hver stopper ved cap $10', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() => reserveAIBudget(orgId, 1.5))
    )
    const approved = results.filter((r) => r.reserved).length

    // Kerne-invariant: cap må ALDRIG overskrides
    expect(approved * 1.5).toBeLessThanOrEqual(10)

    // Systemet skal forblive funktionelt (ikke alle afvist af retry-udtømning)
    expect(approved).toBeGreaterThanOrEqual(1)

    // Med retry-logic bør vi nærme os det teoretiske maks på 6
    // (6 × 1.5 = 9.0 ≤ 10; den 7. ville give 10.5 > 10 → afvist).
    // Under høj SERIALIZABLE-contention rammer vi måske ikke 6 selv med retries,
    // men vi må aldrig overskride det.
    expect(approved).toBeLessThanOrEqual(6)

    // Verificer at faktisk DB-state matcher: reserved_cost_usd = approved × 1.5
    const settings = await prisma.organizationAISettings.findUnique({
      where: { organization_id: orgId },
    })
    expect(Number(settings!.reserved_cost_usd)).toBeCloseTo(approved * 1.5, 2)
  })
})
