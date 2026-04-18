import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: dsn || undefined,
  enabled: !!dsn,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  // Reducer PII i events — ChainHub arbejder med følsomme data (kontrakter, personer)
  sendDefaultPii: false,
  beforeSend(event) {
    // Fjern headers der kan indeholde cookies/tokens
    if (event.request?.headers) {
      delete event.request.headers.cookie
      delete event.request.headers.authorization
    }
    return event
  },
})
