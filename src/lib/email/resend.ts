import { Resend } from 'resend'

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const resendApiKey = process.env.RESEND_API_KEY

export const resend = resendApiKey ? new Resend(resendApiKey) : null

export const DIGEST_FROM = process.env.DIGEST_FROM_EMAIL ?? 'ChainHub <noreply@chainhub.dk>'

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  orgName: string,
  inviterName: string
): Promise<void> {
  if (!resend) {
    console.warn('RESEND_API_KEY ikke konfigureret — invite email springes over')
    return
  }

  await resend.emails.send({
    from: DIGEST_FROM,
    to,
    subject: `Du er inviteret til ${orgName} — ChainHub`,
    html: `
      <h2>Hej,</h2>
      <p>${inviterName} har inviteret dig til <strong>${orgName}</strong> på ChainHub.</p>
      <p><a href="${inviteUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Acceptér invitation</a></p>
      <p>Linket udløber om 7 dage.</p>
      <p>Venlig hilsen,<br/>ChainHub</p>
    `,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName: string
): Promise<void> {
  if (!resend) {
    console.warn('RESEND_API_KEY ikke konfigureret — password reset email springes over')
    return
  }

  await resend.emails.send({
    from: DIGEST_FROM,
    to,
    subject: 'Nulstil din adgangskode — ChainHub',
    html: `
      <h2>Hej ${userName},</h2>
      <p>Du har anmodet om at nulstille din adgangskode.</p>
      <p><a href="${resetUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Nulstil adgangskode</a></p>
      <p>Linket udløber om 1 time.</p>
      <p>Hvis du ikke har anmodet om dette, kan du ignorere denne email.</p>
      <p>Venlig hilsen,<br/>ChainHub</p>
    `,
  })
}

export const CONTACT_TO = process.env.CONTACT_TO_EMAIL ?? 'kontakt@chainhub.dk'

export async function sendContactEmail(input: {
  name: string
  email: string
  company?: string
  message: string
}): Promise<void> {
  if (!resend) {
    // Ingen Resend-konfiguration → kast, så server-action degraderer til mailto-fallback.
    throw new Error('RESEND_API_KEY ikke konfigureret')
  }

  const { name, email, company, message } = input
  const safeCompany = company?.trim() ? company : '—'

  // 1) Notifikation til ChainHub (svar går direkte til afsenderen via replyTo)
  await resend.emails.send({
    from: DIGEST_FROM,
    to: CONTACT_TO,
    replyTo: email,
    subject: `Ny demo-forespørgsel fra ${name}`,
    html: `
      <h2>Ny henvendelse via chainhub.dk</h2>
      <p><strong>Navn:</strong> ${escHtml(name)}</p>
      <p><strong>E-mail:</strong> ${escHtml(email)}</p>
      <p><strong>Virksomhed:</strong> ${escHtml(safeCompany)}</p>
      <p><strong>Besked:</strong></p>
      <p>${escHtml(message).replace(/\n/g, '<br/>')}</p>
    `,
  })

  // 2) Kvittering til afsenderen
  await resend.emails.send({
    from: DIGEST_FROM,
    to: email,
    subject: 'Tak for din henvendelse — ChainHub',
    html: `
      <h2>Hej ${escHtml(name)},</h2>
      <p>Tak for din interesse i ChainHub. Vi har modtaget din besked og vender tilbage hurtigst muligt.</p>
      <p>Venlig hilsen,<br/>ChainHub</p>
    `,
  })
}
