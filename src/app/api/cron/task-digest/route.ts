import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendDigestEmail } from '@/lib/email/task-digest'
import type { DigestRecipient } from '@/lib/email/task-digest'
import type { Task } from '@prisma/client'

/**
 * Daglig task-digest cron job
 *
 * Kører kl. 07:00 dansk tid (06:00 UTC vintertid, 05:00 UTC sommertid)
 * Schedule i vercel.json: "0 6 * * *"
 *
 * Logik:
 * 1. Find alle ikke-lukkede opgaver med dueDate inden for 7 dage og en ansvarlig
 * 2. Gruppér pr. ansvarlig bruger
 * 3. Send kun email hvis der faktisk er opgaver (per bruger)
 * 4. Bruger Resend SDK, dansk sprog
 */
export async function GET(request: NextRequest) {
  // Sikkerhedstjek — kræv CRON_SECRET header
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[task-digest] RESEND_API_KEY er ikke konfigureret')
    return NextResponse.json(
      { error: 'Email-konfiguration mangler — sæt RESEND_API_KEY' },
      { status: 500 }
    )
  }

  const jobStart = Date.now()
  console.log('[task-digest] Job startet:', new Date().toISOString())

  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Hent alle relevante opgaver med organization_id (ikke-forhandlingsbart)
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['LUKKET'] },
        assignedTo: { not: null },
        dueDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            deletedAt: true,
            organizationId: true,
          },
        },
        case: {
          select: { id: true, title: true },
        },
      },
      orderBy: [
        { organizationId: 'asc' },
        { assignedTo: 'asc' },
        { dueDate: 'asc' },
      ],
    })

    console.log(`[task-digest] Fandt ${tasks.length} opgaver der udløber inden for 7 dage`)

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        skipped: 0,
        message: 'Ingen opgaver udløber inden for 7 dage — ingen emails sendt',
        durationMs: Date.now() - jobStart,
      })
    }

    // Gruppér pr. ansvarlig bruger
    const grouped = new Map<
      string,
      DigestRecipient
    >()

    for (const task of tasks) {
      if (!task.assignee || !task.assignedTo) continue
      if (task.assignee.deletedAt) continue // Spring slettede brugere over

      const userId = task.assignedTo

      if (!grouped.has(userId)) {
        grouped.set(userId, {
          user: {
            id: task.assignee.id,
            name: task.assignee.name,
            email: task.assignee.email,
          },
          tasks: [],
        })
      }

      grouped.get(userId)!.tasks.push(
        task as Task & { case: { id: string; title: string } | null }
      )
    }

    console.log(`[task-digest] Sender digest til ${grouped.size} bruger(e)`)

    // Send emails
    let sentCount = 0
    let errorCount = 0
    const errorDetails: string[] = []

    for (const [userId, recipient] of grouped) {
      if (recipient.tasks.length === 0) continue

      const result = await sendDigestEmail(recipient)

      if (result.success) {
        console.log(
          `[task-digest] Email sendt til ${recipient.user.email} — ${recipient.tasks.length} opgave(r), email-id: ${result.id}`
        )
        sentCount++
      } else {
        console.error(
          `[task-digest] Email fejlede for ${recipient.user.email}: ${result.error}`
        )
        errorDetails.push(`${recipient.user.email}: ${result.error}`)
        errorCount++
      }
    }

    const duration = Date.now() - jobStart
    console.log(
      `[task-digest] Job afsluttet: ${sentCount} sendt, ${errorCount} fejl, ${duration}ms`
    )

    return NextResponse.json({
      success: true,
      sent: sentCount,
      errors: errorCount,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      totalTasks: tasks.length,
      durationMs: duration,
    })
  } catch (error) {
    console.error('[task-digest] Kritisk fejl:', error)
    return NextResponse.json(
      {
        error: 'Digest-job fejlede uventet — se server logs',
        durationMs: Date.now() - jobStart,
      },
      { status: 500 }
    )
  }
}