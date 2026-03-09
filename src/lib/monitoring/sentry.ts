import * as Sentry from '@sentry/nextjs'

/**
 * Logger en payment_failed hændelse til Sentry med høj synlighed.
 * Kaldes fra Stripe webhook-handler ved invoice.payment_failed
 * og payment_intent.payment_failed events.
 */
export function capturePaymentFailed(params: {
  customerId: string
  invoiceId?: string
  paymentIntentId?: string
  amountDue?: number
  attemptCount?: number
  currency?: string
}): void {
  Sentry.captureEvent({
    message: `payment_failed: kunde ${params.customerId}`,
    level: 'warning',
    tags: {
      webhook_event: 'payment_failed',
      customer_id: params.customerId,
    },
    extra: {
      invoice_id: params.invoiceId,
      payment_intent_id: params.paymentIntentId,
      amount_due: params.amountDue,
      attempt_count: params.attemptCount,
      currency: params.currency,
    },
  })
}

/**
 * Logger webhook-fejl til Sentry.
 */
export function captureWebhookError(
  error: unknown,
  context: { event_type: string; event_id: string }
): void {
  Sentry.withScope((scope) => {
    scope.setTag('webhook_event', context.event_type)
    scope.setExtra('stripe_event_id', context.event_id)
    scope.setLevel('error')
    Sentry.captureException(error)
  })
}