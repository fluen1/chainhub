'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'

export interface OnboardingStatus {
  shouldShow: boolean
  hasCompany: boolean
  hasContract: boolean
  hasAdditionalUser: boolean
  completedCount: number // 0-3
  totalCount: number // altid 3
  orgAgeInDays: number
}

const EMPTY_STATUS: OnboardingStatus = {
  shouldShow: false,
  hasCompany: false,
  hasContract: false,
  hasAdditionalUser: false,
  completedCount: 0,
  totalCount: 3,
  orgAgeInDays: 0,
}

/**
 * Returnerer onboarding-progression for den loggede brugers organization.
 * Panelet vises kun hvis org er <14 dage gammel OG ikke alle 3 steps er
 * gennemført. Alle fejltilstande (ingen session, db-fejl) returnerer en
 * sikker fallback med shouldShow=false, så UI aldrig bryder.
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const session = await auth()
  if (!session) {
    return EMPTY_STATUS
  }

  try {
    const orgId = session.user.organizationId
    const [organization, companyCount, contractCount, userCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { created_at: true },
      }),
      prisma.company.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.contract.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.user.count({ where: { organization_id: orgId, deleted_at: null } }),
    ])

    const hasCompany = companyCount > 0
    const hasContract = contractCount > 0
    // Brugeren der oprettede org tælles altid som 1 — så vi kræver >1 for at
    // sige at en kollega er inviteret.
    const hasAdditionalUser = userCount > 1
    const completedCount =
      (hasCompany ? 1 : 0) + (hasContract ? 1 : 0) + (hasAdditionalUser ? 1 : 0)

    const now = Date.now()
    const orgAgeInDays = organization
      ? Math.floor((now - organization.created_at.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    const allDone = completedCount === 3
    const tooOld = orgAgeInDays >= 14
    const shouldShow = !allDone && !tooOld

    return {
      shouldShow,
      hasCompany,
      hasContract,
      hasAdditionalUser,
      completedCount,
      totalCount: 3,
      orgAgeInDays,
    }
  } catch (err) {
    captureError(err, { namespace: 'action:getOnboardingStatus' })
    return EMPTY_STATUS
  }
}
