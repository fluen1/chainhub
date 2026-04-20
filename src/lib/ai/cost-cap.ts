import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('ai-cost-cap')

export const DEFAULT_MONTHLY_COST_CAP_USD = 50.0

export interface CostCapCheckResult {
  allowed: boolean
  reason?: string
}

export interface CostCapStatus {
  capUsd: number
  currentUsd: number
  percentage: number
  threshold: 'none' | '50-info' | '75-warn' | '90-alert' | 'exceeded'
}

/**
 * Tjekker om organisation har nået månedlig cost-cap. Bruges FØR hver AI-kald.
 * Returnerer {allowed: false} hvis capped — AI-kald bør afvises med brugervenlig besked.
 */
export async function checkCostCap(organizationId: string): Promise<CostCapCheckResult> {
  const status = await getCostCapStatus(organizationId)
  if (status.currentUsd >= status.capUsd) {
    log.warn(
      { orgId: organizationId, current: status.currentUsd, cap: status.capUsd },
      'AI cost cap exceeded — blocking call'
    )
    return { allowed: false, reason: 'Månedlig AI-cap er nået — kontakt admin' }
  }
  return { allowed: true }
}

/**
 * Returnerer detaljeret status for cap-brug. Bruges af dashboard + soft-alerts.
 */
export async function getCostCapStatus(organizationId: string): Promise<CostCapStatus> {
  const settings = await prisma.organizationAISettings.findUnique({
    where: { organization_id: organizationId },
  })
  const capUsd = settings ? Number(settings.monthly_cost_cap_usd) : DEFAULT_MONTHLY_COST_CAP_USD

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const agg = await prisma.aIUsageLog.aggregate({
    where: { organization_id: organizationId, created_at: { gte: monthStart } },
    _sum: { cost_usd: true },
  })
  const currentUsd = Number(agg._sum.cost_usd ?? 0)

  const percentage = Math.round((currentUsd / capUsd) * 100)
  const threshold: CostCapStatus['threshold'] =
    percentage >= 100
      ? 'exceeded'
      : percentage >= 90
        ? '90-alert'
        : percentage >= 75
          ? '75-warn'
          : percentage >= 50
            ? '50-info'
            : 'none'

  return { capUsd, currentUsd, percentage, threshold }
}

// ============================================================
// PRE-DEBET RESERVATION (race-condition sikker)
// ============================================================
//
// Problem: checkCostCap() + efterfølgende recordAIUsage() er ikke atomisk.
// Ved burst af N parallelle jobs kan alle passere cap-checket samtidigt
// (alle læser same "currentUsd") og derefter skyde capen voldsomt over.
//
// Løsning: reserveAIBudget() i SERIALIZABLE-transaktion. Reservationen
// lagres på OrganizationAISettings.reserved_cost_usd; projected = used +
// reserved + estimate sammenlignes med cap i én DB-operation. Worker kalder
// commitAIUsage() efter succes (reservationen frigives; faktisk usage logges
// separat via recordAIUsage) eller releaseReservation() ved fejl.

export interface ReservationResult {
  reserved: boolean
  reservationId?: string
  reason?: string
}

/**
 * Reserver estimeret cost i budgettet FØR AI-kald startes. Atomisk: bruger
 * SERIALIZABLE-transaktion så (used + reserved + estimate) <= cap evalueres
 * uden race condition. Ved rollover til ny måned nulstilles reservationen.
 */
export async function reserveAIBudget(
  organizationId: string,
  estimatedCostUsd: number
): Promise<ReservationResult> {
  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const settings = await tx.organizationAISettings.findUnique({
            where: { organization_id: organizationId },
          })
          if (!settings) {
            return { reserved: false, reason: 'Ingen AI-settings for org' }
          }

          const cap = Number(settings.monthly_cost_cap_usd)
          const now = new Date()
          const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

          // Månedsrollover: hvis reservation_period stammer fra tidligere måned
          // er reservationen stale — start på 0 for denne måned.
          const currentReserved =
            settings.reservation_period < monthStart ? 0 : Number(settings.reserved_cost_usd)

          // Faktisk brugt (committed) denne måned — summeret fra AIUsageLog.
          const agg = await tx.aIUsageLog.aggregate({
            where: { organization_id: organizationId, created_at: { gte: monthStart } },
            _sum: { cost_usd: true },
          })
          const used = Number(agg._sum.cost_usd ?? 0)

          const projected = used + currentReserved + estimatedCostUsd
          if (projected > cap) {
            return {
              reserved: false,
              reason: `Cap ${cap} ville overskrides (${projected.toFixed(2)})`,
            }
          }

          await tx.organizationAISettings.update({
            where: { organization_id: organizationId },
            data: {
              reserved_cost_usd: currentReserved + estimatedCostUsd,
              reservation_period: monthStart,
            },
          })

          return {
            reserved: true,
            reservationId: `${organizationId}:${Date.now()}:${estimatedCostUsd}`,
          }
        },
        { isolationLevel: 'Serializable' }
      )
    } catch (err) {
      // Postgres SERIALIZABLE aborter konflikter med SQLSTATE 40001
      // (serialization_failure). Prisma wrapper det som P2034. Vi retry'er
      // kun denne specifikke fejl — andre fejl er fatale.
      const errCode =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: unknown }).code
          : undefined
      const isSerializationFailure =
        (err instanceof Error && err.message.includes('could not serialize')) ||
        (typeof errCode === 'string' && errCode === 'P2034')
      if (!isSerializationFailure || attempt === MAX_ATTEMPTS) {
        log.error({ err, orgId: organizationId, attempt }, 'reserveAIBudget fejlede endeligt')
        return { reserved: false, reason: 'Transaction fejl — prøv igen' }
      }
      const backoffMs = 20 * attempt + Math.random() * 20
      log.warn({ attempt, backoffMs, orgId: organizationId }, 'Serialisering-konflikt — retry')
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }
  return { reserved: false, reason: 'Max retries reached' }
}

/**
 * Hjælpefunktion: clampet decrement, så reservation aldrig går i minus.
 * Eksponeret for unit-test — se cost-cap-clamp.test.ts.
 */
export function clampedRelease(current: number, released: number): number {
  return Math.max(0, current - released)
}

/**
 * Frigiv reservation efter succes. Den faktiske omkostning logges separat via
 * recordAIUsage(); her dekrementeres kun reservationen.
 *
 * Bruger max(0, current - released) inde i transaktion så counteren ikke går
 * negativ ved race conditions eller dobbelt-release. Negativ reserved_cost_usd
 * ville ellers lydløst hæve future cap-allowances.
 */
export async function commitAIUsage(
  organizationId: string,
  reservedUsd: number,
  actualUsd: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const settings = await tx.organizationAISettings.findUnique({
      where: { organization_id: organizationId },
      select: { reserved_cost_usd: true },
    })
    if (!settings) return
    const current = Number(settings.reserved_cost_usd)
    const next = clampedRelease(current, reservedUsd)
    await tx.organizationAISettings.update({
      where: { organization_id: organizationId },
      data: { reserved_cost_usd: next },
    })
  })
  log.info({ orgId: organizationId, reservedUsd, actualUsd }, 'Reservation committed')
}

/**
 * Frigiv reservation uden at logge forbrug (fejl-/annulleringssti).
 * Clampes til ≥ 0 for at undgå negativ counter ved dobbelt-release.
 */
export async function releaseReservation(
  organizationId: string,
  reservedUsd: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const settings = await tx.organizationAISettings.findUnique({
      where: { organization_id: organizationId },
      select: { reserved_cost_usd: true },
    })
    if (!settings) return
    const current = Number(settings.reserved_cost_usd)
    const next = clampedRelease(current, reservedUsd)
    await tx.organizationAISettings.update({
      where: { organization_id: organizationId },
      data: { reserved_cost_usd: next },
    })
  })
  log.info({ orgId: organizationId, reservedUsd }, 'Reservation released')
}

/**
 * Konservativt cost-estimat for extraction baseret på sidetal. Bruges som
 * pre-debet før pipeline kører, så parallelle jobs ikke alle kan overskride
 * capen. Overestimat er sikrere end underestimat.
 *
 * Antagelser: 4000 tokens/side, Sonnet 4.6 pricing (~$3 input / $15 output
 * per M-token), default 2 runs, plus Haiku type-detection.
 */
export function estimateExtractionCost(pageCount: number): number {
  const inputTokens = pageCount * 4000
  const outputTokens = 3000
  const sonnetCost = (inputTokens * 3 + outputTokens * 15) / 1_000_000
  const haikuCost = 0.01
  return sonnetCost * 2 + haikuCost
}
