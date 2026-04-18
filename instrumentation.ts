export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Sentry 10.x eksporterer captureRequestError som Next.js' onRequestError-hook
export { captureRequestError as onRequestError } from '@sentry/nextjs'
