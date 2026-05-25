import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY

export const resend = resendApiKey ? new Resend(resendApiKey) : null

export const DIGEST_FROM = process.env.DIGEST_FROM_EMAIL ?? 'ChainHub <noreply@chainhub.dk>'

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
