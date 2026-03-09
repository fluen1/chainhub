import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Outlook Calendar Push — Placeholder
 *
 * Denne route er en placeholder for fremtidig Microsoft Graph Calendar integration.
 * Fuld implementation kræver:
 *  1. Microsoft Graph API access med Calendar.ReadWrite scope
 *  2. OAuth 2.0 token-flow for den pågældende bruger (delegated permissions)
 *  3. Event-oprettelse via POST /v1.0/me/events
 *
 * Kræver MICROSOFT_CLIENT_ID at være konfigureret.
 */

const MICROSOFT_GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

export async function POST(request: NextRequest) {
  // Check Microsoft integration er konfigureret
  if (!process.env.MICROSOFT_CLIENT_ID) {
    return NextResponse.json(
      {
        error: 'Microsoft Calendar-integration er ikke konfigureret',
        details:
          'Kontakt din administrator for at aktivere Outlook Calendar-integration. MICROSOFT_CLIENT_ID mangler.',
        configured: false,
      },
      { status: 501 }
    )
  }

  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  let body: { taskId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ugyldigt request body' }, { status: 400 })
  }

  const { taskId } = body
  if (!taskId) {
    return NextResponse.json({ error: 'taskId er påkrævet' }, { status: 400 })
  }

  // Hent opgaven med organization_id tjek
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    include: {
      assignee: {
        select: { id: true, name: true, email: true, microsoftId: true },
      },
    },
  })

  if (!task) {
    return NextResponse.json({ error: 'Opgaven blev ikke fundet' }, { status: 404 })
  }

  if (!task.dueDate) {
    return NextResponse.json(
      {
        error: 'Opgaven har ingen forfaldsdato — kan ikke oprette kalenderbegivenhed',
      },
      { status: 400 }
    )
  }

  // Tjek om brugeren har en Microsoft konto tilknyttet
  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      organizationId: session.user.organizationId,
    },
    select: { microsoftId: true },
  })

  if (!user?.microsoftId) {
    return NextResponse.json(
      {
        error: 'Din konto er ikke forbundet med Microsoft — log ud og log ind via Microsoft for at aktivere calendar-integration',
        configured: true,
        microsoftLinked: false,
      },
      { status: 403 }
    )
  }

  // PLACEHOLDER: Her ville den faktiske Graph API implementation foregå
  // Eksempel på hvad der ville ske:
  //
  // 1. Hent brugerens access token fra session/token store
  //    const accessToken = await getMicrosoftAccessToken(session.user.id)
  //
  // 2. Byg kalenderbegivenhed
  //    const calendarEvent = {
  //      subject: `Opgave: ${task.title}`,
  //      body: { contentType: 'HTML', content: task.description ?? '' },
  //      start: { dateTime: task.dueDate.toISOString(), timeZone: 'Europe/Copenhagen' },
  //      end: { dateTime: new Date(task.dueDate.getTime() + 30 * 60 * 1000).toISOString(), timeZone: 'Europe/Copenhagen' },
  //      isReminderOn: true,
  //      reminderMinutesBeforeStart: 60,
  //    }
  //
  // 3. POST til Graph API
  //    const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me/events`, {
  //      method: 'POST',
  //      headers: {
  //        Authorization: `Bearer ${accessToken}`,
  //        'Content-Type': 'application/json',
  //      },
  //      body: JSON.stringify(calendarEvent),
  //    })

  console.log(
    `outlook-calendar: Placeholder aktiveret for opgave ${taskId} (bruger: ${session.user.id})`
  )

  return NextResponse.json(
    {
      success: false,
      placeholder: true,
      configured: true,
      microsoftLinked: true,
      message:
        'Outlook Calendar-integration er under udvikling. Funktionen vil snart være tilgængelig.',
      taskId: task.id,
      taskTitle: task.title,
      dueDate: task.dueDate,
    },
    { status: 202 }
  )
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  return NextResponse.json({
    configured: !!process.env.MICROSOFT_CLIENT_ID,
    placeholder: true,
    description:
      'Outlook Calendar Push — tilføjer opgaver med forfaldsdato til din Outlook-kalender',
    requiredScopes: ['Calendars.ReadWrite'],
    status: process.env.MICROSOFT_CLIENT_ID
      ? 'Konfigureret men ikke fuldt implementeret'
      : 'Ikke konfigureret — MICROSOFT_CLIENT_ID mangler',
  })
}