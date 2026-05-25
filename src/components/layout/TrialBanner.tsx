import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// ────────────────────────────────────────────────────────────────────────────
// TrialBanner — viser amber-banner når prøveperiode udløber inden for 7 dage
// Returnerer null hvis org ikke er på trial, ikke har plan_expires_at, eller
// der er mere end 7 dage tilbage.
// ────────────────────────────────────────────────────────────────────────────

export async function TrialBanner() {
  const session = await auth()
  if (!session) return null

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { plan: true, plan_expires_at: true },
  })

  if (!org || org.plan !== 'trial' || !org.plan_expires_at) return null

  const now = new Date()
  const diff = org.plan_expires_at.getTime() - now.getTime()
  const daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))

  // Kun vis banner de sidste 7 dage
  if (daysLeft > 7) return null

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-[13px]">
      <span className="text-amber-800">
        {daysLeft === 0 ? (
          'Din prøveperiode er udløbet.'
        ) : (
          <>
            <span className="font-medium">
              {daysLeft} {daysLeft === 1 ? 'dag' : 'dage'} tilbage
            </span>{' '}
            af din prøveperiode.
          </>
        )}
      </span>
      <Link
        href="/billing"
        className="shrink-0 inline-flex items-center rounded-[4px] bg-amber-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-amber-700 no-underline transition-colors"
      >
        Vælg plan
      </Link>
    </div>
  )
}
