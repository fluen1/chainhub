import { Resend } from 'resend'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'
import type { Task, Prioritet, TaskStatus } from '@prisma/client'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const DIGEST_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'digest@chainhub.dk'

export type DigestTask = Task & {
  case: { id: string; title: string } | null
}

export type DigestRecipient = {
  user: { id: string; name: string; email: string }
  tasks: DigestTask[]
}

const PRIORITET_LABELS: Record<Prioritet, string> = {
  LAV: 'Lav',
  MELLEM: 'Medium',
  HOEJ: 'Høj',
  KRITISK: 'Kritisk',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AFVENTER: 'Afventer',
  LUKKET: 'Lukket',
}

export function formatDanishDate(date: Date): string {
  return format(date, "d. MMMM yyyy", { locale: da })
}

export function buildDigestSubject(taskCount: number): string {
  return `${taskCount} opgave${taskCount !== 1 ? 'r' : ''} udløber inden for 7 dage — ChainHub`
}

export function buildDigestHtml(recipient: DigestRecipient): string {
  const { user, tasks } = recipient
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.chainhub.dk'

  const taskRows = tasks
    .map((task) => {
      const dueDate = task.dueDate
        ? formatDanishDate(new Date(task.dueDate))
        : 'Ingen forfaldsdato'
      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
      const caseRef = task.case ? `<br><span style="font-size:12px;color:#6b7280;">Sag: ${task.case.title}</span>` : ''

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 16px; font-size: 14px; color: #111827;">
            <strong>${task.title}</strong>${caseRef}
          </td>
          <td style="padding: 12px 16px; font-size: 13px; color: #6b7280; white-space: nowrap;">${STATUS_LABELS[task.status]}</td>
          <td style="padding: 12px 16px; font-size: 13px; color: #6b7280; white-space: nowrap;">${PRIORITET_LABELS[task.priority]}</td>
          <td style="padding: 12px 16px; font-size: 13px; white-space: nowrap; color: ${isOverdue ? '#dc2626' : '#374151'}; font-weight: ${isOverdue ? '600' : '400'};">
            ${dueDate}${isOverdue ? ' ⚠' : ''}
          </td>
        </tr>
      `
    })
    .join('')

  return `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;max-width:600px;">
        
        <!-- Header -->
        <tr>
          <td style="background:#1e40af;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ChainHub</p>
                  <p style="margin:6px 0 0;color:#93c5fd;font-size:14px;">Daglig opgavedigest • ${format(new Date(), "d. MMMM yyyy", { locale: da })}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:28px 32px 20px;">
            <p style="margin:0;color:#111827;font-size:16px;">Hej ${user.name},</p>
            <p style="margin:10px 0 0;color:#4b5563;font-size:14px;line-height:1.6;">
              Du har <strong style="color:#1e40af;">${tasks.length} opgave${tasks.length !== 1 ? 'r' : ''}</strong> 
              der udløber inden for de næste 7 dage. Husk at følge op i god tid.
            </p>
          </td>
        </tr>

        <!-- Opgavetabel -->
        <tr>
          <td style="padding:0 32px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Opgave</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Status</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Prioritet</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Forfaldsdato</th>
                </tr>
              </thead>
              <tbody>${taskRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px;">
            <a href="${appUrl}/tasks?assignedTo=mine" 
               style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:600;">
              Se mine opgaver i ChainHub
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
              Du modtager denne email fordi du har opgaver der udløber inden for 7 dage i ChainHub.
              Sendt automatisk kl. 07:00 dansk tid.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim()
}

export function buildDigestText(recipient: DigestRecipient): string {
  const { user, tasks } = recipient
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.chainhub.dk'

  const lines = tasks.map((task) => {
    const dueDate = task.dueDate
      ? formatDanishDate(new Date(task.dueDate))
      : 'Ingen forfaldsdato'
    const caseRef = task.case ? ` [Sag: ${task.case.title}]` : ''
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
    return `• ${task.title}${caseRef}\n  Status: ${STATUS_LABELS[task.status]} | Prioritet: ${PRIORITET_LABELS[task.priority]} | Forfald: ${dueDate}${isOverdue ? ' (OVERSKREDET)' : ''}`
  })

  return `
Hej ${user.name},

Du har ${tasks.length} opgave${tasks.length !== 1 ? 'r' : ''} der udløber inden for de næste 7 dage:

${lines.join('\n\n')}

---
Se dine opgaver: ${appUrl}/tasks

Sendt automatisk af ChainHub kl. 07:00 dansk tid.
  `.trim()
}

export async function sendDigestEmail(recipient: DigestRecipient): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  try {
    const { data, error } = await resend.emails.send({
      from: DIGEST_FROM_EMAIL,
      to: recipient.user.email,
      subject: buildDigestSubject(recipient.tasks.length),
      html: buildDigestHtml(recipient),
      text: buildDigestText(recipient),
      tags: [
        { name: 'type', value: 'task-digest' },
        { name: 'user_id', value: recipient.user.id },
      ],
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl'
    return { success: false, error: message }
  }
}