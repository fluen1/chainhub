import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY er ikke sat - email-funktionalitet er deaktiveret')
}

export const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@chainhub.dk'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.chainhub.dk'