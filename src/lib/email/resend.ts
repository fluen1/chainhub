import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY

export const resend = resendApiKey ? new Resend(resendApiKey) : null

export const DIGEST_FROM =
  process.env.DIGEST_FROM_EMAIL ?? 'ChainHub <noreply@chainhub.dk>'
