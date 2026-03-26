import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resend, DIGEST_FROM } from '@/lib/email/resend'
import {
  getExpiringContracts,
  getOverdueTasks,
  getUpcomingTasks,
} from '@/lib/notifications/deadlines'
import {
  buildDigestHtml,
  buildDigestSubject,
} from '@/lib/email/templates/digest'

export async function POST(request: NextRequest) {
  // Auth: tjek cron-hemmelighed
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.DIGEST_CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!resend) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured' },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Hent alle aktive brugere grupperet efter organisation
  const users = await prisma.user.findMany({
    where: { active: true, deleted_at: null },
    select: { id: true, email: true, name: true, organization_id: true },
  })

  const results: {
    email: string
    status: 'sent' | 'skipped' | 'error'
    reason?: string
  }[] = []
  const today = new Date()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

  for (const user of users) {
    try {
      const [overdueTasks, upcomingTasks, expiringContracts, newCasesCount] =
        await Promise.all([
          getOverdueTasks(user.organization_id, user.id),
          getUpcomingTasks(user.organization_id, user.id, 7),
          getExpiringContracts(user.organization_id, user.id, [7, 30, 90]),
          prisma.case.count({
            where: {
              organization_id: user.organization_id,
              deleted_at: null,
              created_at: { gte: yesterday },
            },
          }),
        ])

      // Spring over hvis der ikke er noget at rapportere
      const hasContent =
        overdueTasks.length > 0 ||
        upcomingTasks.length > 0 ||
        Object.values(expiringContracts).some((v) => v.length > 0) ||
        newCasesCount > 0

      if (!hasContent) {
        results.push({
          email: user.email,
          status: 'skipped',
          reason: 'no content',
        })
        continue
      }

      const html = buildDigestHtml({
        userName: user.name,
        overdueTasks,
        upcomingTasks,
        expiringContracts,
        newCasesCount,
        appUrl,
      })

      const subject = buildDigestSubject(overdueTasks)

      await resend.emails.send({
        from: DIGEST_FROM,
        to: user.email,
        subject,
        html,
      })

      results.push({ email: user.email, status: 'sent' })
    } catch (error) {
      results.push({
        email: user.email,
        status: 'error',
        reason: String(error),
      })
    }
  }

  // Log digest-kørsel
  const sentCount = results.filter((r) => r.status === 'sent').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const errorCount = results.filter((r) => r.status === 'error').length

  return NextResponse.json({
    success: true,
    timestamp: today.toISOString(),
    summary: { sent: sentCount, skipped: skippedCount, errors: errorCount },
    details: results,
  })
}
